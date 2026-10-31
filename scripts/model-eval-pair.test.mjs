import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validateFixtures } from "./model-eval-lib.mjs";
import {
  parsePairedOptions, selectedPairedFixtures,
  pairedDryRun, runPairedSyntheticBenchmarks
} from "./model-eval-pair-lib.mjs";

const fixtures = validateFixtures(JSON.parse(readFileSync(
  new URL("../model/fixtures/completion-v1.json", import.meta.url), "utf8"
))).filter(x => x.language === "rust");
const options = {
  baseline: "local-base:1", candidate: "local-candidate:2",
  mode: "fim", runs: 3, language: "rust", category: "all"
};
const trial = (id, opts = {}) => ({
  fixtureId: id.id, language: id.language, category: id.category,
  ok: true, exact: false, totalMs: 25, firstTokenMs: 5,
  formatSignals: [], syntaxOutcome: "unchecked",
  nativeStructureOutcome: "unchecked",
  tokenUsage: { generatedTokens: 8, generationDurationNs: 250_000_000 },
  privateCode: "NEVER_SHOW_USER_SOURCE", ...opts
});

test("paired options enforce one explicit common prompt mode and bounded scope", () => {
  const parsed = parsePairedOptions([
    "--baseline", "local-base:1", "--candidate", "local-candidate:2",
    "--mode", "instruction", "--runs", "5", "--language", "cpp",
    "--category", "suffix", "--dry-run"
  ]);
  assert.deepEqual(parsed, {
    baseline: "local-base:1", candidate: "local-candidate:2",
    mode: "instruction", runs: 5, language: "cpp",
    category: "suffix", dryRun: true
  });
  for (const args of [
    [], ["--baseline", "a", "--candidate", "b"],
    ["--baseline", "a", "--candidate", "b", "--mode", "auto"],
    ["--baseline", "a", "--candidate", "b", "--mode", "fim", "--runs", "6"],
    ["--baseline", "a", "--candidate", "b", "--mode", "fim", "--runs", "0"],
    ["--baseline", "a", "--candidate", "b", "--mode", "fim", "--language", "javascript"],
    ["--baseline", "a", "--candidate", "b", "--mode", "fim", "--category", "unknown"],
    ["--baseline", "a", "--candidate", "b", "--mode", "fim", "--mode", "fim"],
    ["--baseline", "a", "--candidate", "b", "--mode", "fim", "--dry-run", "--dry-run"],
    ["--baseline", "a; echo SECRET", "--candidate", "b", "--mode", "fim"],
    ["--baseline", "a", "--candidate", "b", "--mode", "fim", "--endpoint", "http://example.invalid"],
  ]) assert.throws(() => parsePairedOptions(args));
});

test("dry run computes reviewed hashes but never contacts a model", () => {
  const chosen = selectedPairedFixtures(fixtures, options);
  assert.equal(chosen.length, 8);
  const result = pairedDryRun(chosen, options);
  assert.equal(result.benchmarkProtocol, "lineloom-synthetic-v9");
  assert.equal(result.networkCalls, 0);
  assert.equal(result.requestsPerModel, 24);
  assert.equal(result.totalRequestsPlanned, 48);
  assert.equal(result.runOrder, "alternating-full-pass-v1");
  assert.ok(!JSON.stringify(result).includes("local-base:1"));
  assert.ok(!JSON.stringify(result).includes("local-candidate:2"));
  assert.ok(!JSON.stringify(result).includes(chosen[0].prefix));
  assert.throws(() => selectedPairedFixtures(fixtures, { ...options, category: "unavailable" }));
  assert.throws(() => selectedPairedFixtures(fixtures, { ...options, language: "cpp" }));
});

test("run order alternates complete model passes and leaves source and tags private", async () => {
  const calls = [];
  const compare = await runPairedSyntheticBenchmarks(fixtures, options,
    async (fixture, model, mode) => {
      calls.push({ fixtureId: fixture.id, model, mode });
      return trial(fixture, { exact: model === options.candidate });
    });
  assert.equal(calls.length, 48);
  assert.deepEqual(calls.filter((_, i) => i % 8 === 0).map(x => x.model), [
    options.baseline, options.candidate, options.candidate,
    options.baseline, options.baseline, options.candidate
  ]);
  assert.deepEqual([...new Set(calls.map(x => x.mode))], ["fim"]);
  assert.equal(compare.anyRequestFailed, false);
  assert.equal(compare.comparison.scopeVerified, true);
  assert.equal(compare.comparison.baseline.strictExactMatches, 0);
  assert.equal(compare.comparison.candidate.strictExactMatches, 24);
  assert.equal(compare.pairedStrictExact.pairs, 24);
  assert.equal(compare.pairedStrictExact.comparablePairs, 24);
  assert.equal(compare.pairedStrictExact.candidateWins, 24);
  assert.equal(compare.pairedStrictExact.baselineWins, 0);
  assert.equal(compare.pairedStrictExact.byLanguage.rust.candidateWins, 24);
  assert.equal(compare.pairedStrictExact.byLanguage.cpp.pairs, 0);
  assert.equal(compare.comparison.outputTokenAccounting.baseline.generatedTokens, 192);
  assert.equal(compare.comparison.outputTokenAccounting.outputVolumeComparable, true);
  assert.equal(compare.runOrder, "alternating-full-pass-v1");
  const serialized = JSON.stringify(compare);
  for (const sensitive of ["local-base:1", "local-candidate:2", "NEVER_SHOW_USER_SOURCE", fixtures[0].id]) {
    assert.ok(!serialized.includes(sensitive));
  }
});

test("failed local requests remain in the attempted scope and force review", async () => {
  let count = 0;
  const result = await runPairedSyntheticBenchmarks(fixtures, { ...options, runs: 1 },
    async (fixture, model) => {
      count++;
      if (model === options.candidate && count === fixtures.length + 1) {
        return { fixtureId: fixture.id, language: fixture.language,
          category: fixture.category, ok: false, exact: false };
      }
      return trial(fixture, { exact: false });
    });
  assert.equal(result.anyRequestFailed, true);
  assert.equal(result.comparison.candidate.failed, 1);
  assert.equal(result.pairedStrictExact.failedPairs, 1);
  assert.equal(result.pairedStrictExact.comparablePairs, 7);
  assert.equal(result.pairedStrictExact.baselineWins, 0);
  assert.equal(result.pairedStrictExact.candidateWins, 0);
  assert.equal(result.comparison.baseline.attempts, 8);
  assert.equal(result.comparison.candidate.attempts, 8);
  assert.ok(result.comparison.regressionReview.flags.includes("more-failed-requests"));
  assert.equal(result.comparison.outputTokenAccounting.candidate.checked, 7);
});


test("head-to-head metrics distinguish candidate/baseline wins, ties and failed requests", async () => {
  const calls = new Map();
  const subset = fixtures;
  const compare = await runPairedSyntheticBenchmarks(subset, { ...options, runs: 2 },
    async (fixture, model) => {
      const seen = calls.get(model) ?? 0;
      calls.set(model, seen + 1);
      const pass = Math.floor(seen / subset.length);
      const i = subset.indexOf(fixture);
      const baseline = model === options.baseline;
      // Candidate-only, baseline-only, both, neither, candidate failure,
      // baseline failure, respectively. Failures occur only in the first pass.
      const exact = i === 0 ? !baseline : i === 1 ? baseline : i === 2;
      const failed = pass === 0 && ((i === 4 && !baseline) || (i === 5 && baseline));
      return trial(fixture, { ok: !failed, exact: !failed && exact });
    });
  const paired = compare.pairedStrictExact;
  assert.deepEqual({
    pairs: paired.pairs, comparablePairs: paired.comparablePairs,
    candidateWins: paired.candidateWins, baselineWins: paired.baselineWins,
    bothExact: paired.bothExact, neitherExact: paired.neitherExact,
    failedPairs: paired.failedPairs
  }, {
    pairs: 16, comparablePairs: 14, candidateWins: 2, baselineWins: 2,
    bothExact: 2, neitherExact: 8, failedPairs: 2
  });
  assert.equal(paired.byLanguage.rust.failedPairs, 2);
  assert.equal(Object.values(paired.byCategory).reduce((n, x) => n + x.pairs, 0), 16);
  assert.equal(compare.anyRequestFailed, true);
  assert.ok(!JSON.stringify(compare).includes(subset[0].id));
  assert.ok(!JSON.stringify(compare).includes("NEVER_SHOW_USER_SOURCE"));
});

test("mismatched, reordered or contradictory evaluation results fail closed", async () => {
  for (const mutate of [
    (fixture, model, result) => model === options.candidate
      ? { ...result, fixtureId: "wrong-public-id" } : result,
    (fixture, model, result) => model === options.baseline
      ? { ...result, language: "python" } : result,
    (fixture, model, result) => model === options.candidate
      ? { ...result, ok: false, exact: true } : result
  ]) {
    await assert.rejects(
      runPairedSyntheticBenchmarks(fixtures, { ...options, runs: 1 },
        async (fixture, model) => mutate(fixture, model, trial(fixture))),
      /inconsistent-paired-result/
    );
  }
});

test("CLI dry run is strictly offline and errors never echo secret arguments", () => {
  const path = fileURLToPath(new URL("./model-eval-pair.mjs", import.meta.url));
  const args = ["--baseline", "private-test:1", "--candidate", "private-other:1",
    "--mode", "fim", "--language", "python", "--runs", "2", "--dry-run"];
  const output = JSON.parse(execFileSync(process.execPath, [path, ...args], {
    encoding: "utf8", timeout: 5000
  }));
  assert.equal(output.networkCalls, 0);
  assert.equal(output.fixtureCount, 8);
  assert.equal(output.totalRequestsPlanned, 32);
  assert.ok(!JSON.stringify(output).includes("private-test"));
  const rejected = spawnSync(process.execPath, [
    path, "--baseline", "private-SUPER_SECRET;exec", "--candidate", "safe:1",
    "--mode", "fim", "--dry-run"
  ], { encoding: "utf8", timeout: 5000 });
  assert.equal(rejected.status, 1);
  assert.ok(!rejected.stderr.includes("SUPER_SECRET"));
  assert.ok(!rejected.stdout.includes("SUPER_SECRET"));
});
