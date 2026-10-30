import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  EVAL_BENCHMARK_PROTOCOL, EVAL_LANGUAGES, EVAL_CATEGORIES,
  fixtureSetSha256, requestSpecSha256, summarizeMeasurements, validateFixtures
} from "./model-eval-lib.mjs";
import { validateComparableReport, compareModelReports } from "./model-eval-compare-lib.mjs";
import { readFileSync } from "node:fs";

const fixtures = validateFixtures(JSON.parse(readFileSync(
  fileURLToPath(new URL("../model/fixtures/completion-v1.json", import.meta.url)), "utf8"
)));
function report({ runs = 2, model = "local-test-a", count = 1, selected = fixtures, mode = "fim" } = {}) {
  const results = [];
  for (let run = 0; run < runs; run++) {
    for (const [index, fixture] of selected.entries()) {
      const exact = index < count;
      results.push({
        fixtureId: fixture.id, language: fixture.language, category: fixture.category,
        ok: true, exact, formatSignals: [],
        syntaxOutcome: fixture.language === "typescript" ? "passed" : "unchecked",
        firstTokenMs: 10 + run, totalMs: 30 + run
      });
    }
  }
  return {
    ...summarizeMeasurements(results, selected.length, model, mode),
    benchmarkProtocol: EVAL_BENCHMARK_PROTOCOL,
    fixtureSetSha256: fixtureSetSha256(selected),
    requestSpecSha256: requestSpecSha256(selected, mode), runsPerFixture: runs
  };
}
test("fixture content fingerprint is order-independent and changes on real fixture edits", () => {
  const hash = fixtureSetSha256(fixtures);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(hash, fixtureSetSha256([...fixtures].reverse()));
  assert.notEqual(hash, fixtureSetSha256(fixtures.map((f, i) =>
    i === 0 ? { ...f, expected: f.expected + "x" } : f)));
  assert.notEqual(hash, fixtureSetSha256(fixtures.slice(1)));
});

test("recognized checked-in language/category scopes and modes compare offline", () => {
  for (const mode of ["fim", "instruction"]) {
    for (const selected of [
      fixtures.filter(item => item.language === "rust"),
      fixtures.filter(item => item.category === "suffix"),
      fixtures.filter(item => item.language === "typescript" && item.category === "indentation")
    ]) {
      if (!selected.length) continue;
      const baseline = report({ selected, mode, runs: 2, count: 0 });
      const candidate = report({ selected, mode, runs: 2, count: 1 });
      assert.equal(validateComparableReport(baseline).syntheticFixtures, selected.length);
      assert.equal(compareModelReports(baseline, candidate).scopeVerified, true);
    }
  }
});
test("rejects fabricated matching hashes and rearranged attempt allocations", () => {
  const valid = report();
  const fake = { ...valid,
    fixtureSetSha256: "0".repeat(64), requestSpecSha256: "1".repeat(64)
  };
  assert.throws(() => compareModelReports(fake, fake),
    "Matching invented hashes are not evidence of the reviewed fixture set");
  const misallocated = structuredClone(valid);
  for (const field of ["attempts", "completed"]) {
    misallocated.perLanguage.rust[field] -= 1;
    misallocated.perLanguage.c[field] += 1;
  }
  assert.throws(() => validateComparableReport(misallocated),
    "Equal totals cannot hide attempts moved to another language");
  assert.throws(() => validateComparableReport({ ...valid, mode: "instruction" }),
    "A request hash must bind to its claimed prompt mode");
});

test("comparison returns only bounded counts and per-language/category deltas", () => {
  const baseline = report({ count: 1 });
  const candidate = report({ count: 3, model: "secret-model-tag" });
  const result = compareModelReports(baseline, candidate);
  assert.equal(result.scopeVerified, true);
  assert.equal(result.syntheticFixtures, 30);
  assert.equal(result.candidateMinusBaseline.strictExactMatches, 4);
  assert.equal(result.candidateMinusBaseline.failed, 0);
  assert.equal(result.completedWithoutFormatSignalDelta, 0);
  assert.equal(result.completionFormatSignalDelta.markdownFence, 0);
  const expectedRustDelta = fixtures.slice(1, 3).filter(f => f.language === "rust").length * 2;
  assert.equal(result.perLanguageStrictMatchDelta.rust, expectedRustDelta);
  assert.equal(Object.values(result.perLanguageStrictMatchDelta).reduce((a, b) => a + b, 0), 4);
  assert.equal(Object.keys(result.perLanguageStrictMatchDelta).length, 5);
  assert.equal(Object.keys(result.perCategoryStrictMatchDelta).length, 5);
  const text = JSON.stringify(result);
  assert.ok(!text.includes("secret-model-tag"));
  assert.ok(!text.includes(baseline.fixtureSetSha256));
  assert.ok(!text.includes(baseline.requestSpecSha256));
  assert.ok(!text.includes("rust-branch"));
  assert.ok(!text.includes("fn double(value"));
  assert.ok(!text.includes("private-source"));
});

test("source-free regression review flags worse counts and format artifacts", () => {
  const base = report({ count: 3 });
  const worse = report({ count: 1, model: "sensitive-model-tag" });
  worse.formatDiagnostics.completedWithoutFormatSignals -= 1;
  worse.formatDiagnostics.signals.markdownFence += 1;
  const compared = compareModelReports(base, worse);
  assert.equal(compared.regressionReview.status, "inspect-regressions");
  assert.ok(compared.regressionReview.flags.includes("fewer-strict-matches"));
  assert.ok(compared.regressionReview.flags.includes("per-language-strict-regression"));
  assert.ok(compared.regressionReview.flags.includes("per-category-strict-regression"));
  assert.ok(compared.regressionReview.categoriesWithFewerStrictMatches.length > 0);
  assert.ok(compared.regressionReview.flags.includes("fewer-format-clean-completions"));
  assert.ok(compared.regressionReview.flags.includes("more-format-artifacts"));
  assert.ok(compared.regressionReview.languagesWithFewerStrictMatches.includes("rust"));
  assert.deepEqual(compared.regressionReview.increasedFormatSignals, ["markdownFence"]);
  assert.equal(compared.regressionReview.latencyComparable, true);
  assert.ok(!JSON.stringify(compared.regressionReview).includes("sensitive-model-tag"));
});
test("regression review does not treat tiny or incomparable latency changes as proven regression", () => {
  const base = report({ count: 2 });
  const candidate = report({ count: 2 });
  candidate.completionP95Ms += 5;
  candidate.completionP50Ms += 5;
  const first = compareModelReports(base, candidate);
  assert.equal(first.regressionReview.status, "no-heuristic-regressions-detected");
  assert.equal(first.regressionReview.latencyComparable, true);

  candidate.completionP95Ms = 300;
  const slow = compareModelReports(base, candidate);
  assert.ok(slow.regressionReview.flags.includes("higher-completed-p95-latency"));
  assert.equal(slow.regressionReview.status, "inspect-regressions");
  const selected = fixtures.filter(item => item.language === "rust");
  const fewBase = report({ selected });
  const fewCandidate = report({ selected });
  fewCandidate.completionP95Ms = 900;
  assert.equal(compareModelReports(fewBase, fewCandidate).regressionReview.latencyComparable, true);
  const failureCandidate = report({ selected });
  failureCandidate.failed = 1;
  failureCandidate.completed = failureCandidate.attempts - 1;
  failureCandidate.perLanguage.rust.completed -= 1;
  failureCandidate.perCategory.expression.completed -= 1;
  // An inconsistent derived report must be rejected rather than used as
  // comparative latency evidence.
  assert.throws(() => compareModelReports(fewBase, failureCandidate));
});

test("repeated-fixture outcomes must describe mathematically possible exact matches", () => {
  const valid = report({ runs: 3, count: 2 });
  assert.equal(validateComparableReport(valid).fixtureOutcomes.exactEveryAttempt, 2);
  const cases = [
    { ...valid.fixtureOutcomes, mixedExactOutcomes: 1 },
    // A single partial fixture can contribute at most runs-1 matches:
    { ...valid.fixtureOutcomes, exactEveryAttempt: 1, mixedExactOutcomes: 1 },
    // A new mixed fixture must contribute at least one additional match:
    { ...valid.fixtureOutcomes, exactAtLeastOnce: 3, mixedExactOutcomes: 1 },
    { ...valid.fixtureOutcomes, exactAtLeastOnce: 31, mixedExactOutcomes: 29 }
  ];
  for (const fixtureOutcomes of cases) {
    assert.throws(() => validateComparableReport({ ...valid, fixtureOutcomes }));
  }

  // A genuine mixture is valid, including failures/nonmatches within a run.
  const results = [];
  for (let run = 0; run < 3; run++) {
    for (const [index, fixture] of fixtures.entries()) {
      results.push({
        fixtureId: fixture.id, language: fixture.language, category: fixture.category,
        ok: true, exact: index === 0 || (index === 1 && run === 0),
        formatSignals: [],
        syntaxOutcome: fixture.language === "typescript" ? "passed" : "unchecked",
        firstTokenMs: 10, totalMs: 30
      });
    }
  }
  const mixed = {
    ...summarizeMeasurements(results, fixtures.length, "local-test", "fim"),
    benchmarkProtocol: EVAL_BENCHMARK_PROTOCOL,
    fixtureSetSha256: fixtureSetSha256(fixtures),
    requestSpecSha256: requestSpecSha256(fixtures, "fim"),
    runsPerFixture: 3
  };
  assert.equal(mixed.fixtureOutcomes.mixedExactOutcomes, 1);
  assert.equal(mixed.strictExactMatches, 4);
  assert.equal(validateComparableReport(mixed).strictExactMatches, 4);
  const single = report({ runs: 1, count: 2 });
  assert.equal(validateComparableReport(single).strictExactMatches, 2);
});

test("completion format signals must cover precisely the flagged completion union", () => {
  const valid = report();
  const tooFewSignals = structuredClone(valid);
  tooFewSignals.formatDiagnostics.completedWithoutFormatSignals -= 2;
  tooFewSignals.formatDiagnostics.signals.markdownFence = 1;
  assert.throws(() => validateComparableReport(tooFewSignals));

  const tooManyOfOne = structuredClone(valid);
  tooManyOfOne.formatDiagnostics.completedWithoutFormatSignals -= 1;
  tooManyOfOne.formatDiagnostics.signals.markdownFence = 2;
  assert.throws(() => validateComparableReport(tooManyOfOne));

  const overlapping = structuredClone(valid);
  overlapping.formatDiagnostics.completedWithoutFormatSignals -= 2;
  overlapping.formatDiagnostics.signals.markdownFence = 2;
  overlapping.formatDiagnostics.signals.prefixEcho = 2;
  assert.equal(validateComparableReport(overlapping).formatDiagnostics.signals.prefixEcho, 2);
});

test("rejects forged TypeScript grammar counts and reports parser regressions without source", () => {
  const baseline = report();
  const worse = structuredClone(report());
  assert.equal(baseline.generatedSyntax.checked, 12);
  assert.equal(baseline.generatedSyntax.unchecked, 48);
  assert.equal(baseline.generatedSyntax.passed, 12);
  worse.generatedSyntax.byLanguage.typescript.passed -= 2;
  worse.generatedSyntax.byLanguage.typescript.failed += 2;
  worse.generatedSyntax.passed -= 2;
  worse.generatedSyntax.failed += 2;
  const comparison = compareModelReports(baseline, worse);
  assert.equal(comparison.generatedTypeScriptSyntax.checkedPerModel, 12);
  assert.equal(comparison.generatedTypeScriptSyntax.passedDelta, -2);
  assert.equal(comparison.generatedTypeScriptSyntax.failedDelta, 2);
  assert.ok(comparison.regressionReview.flags.includes("more-typescript-syntax-failures"));
  assert.equal(comparison.generatedTypeScriptSyntax.uncheckedPerModel, 48);
  assert.ok(!JSON.stringify(comparison).includes(baseline.model));
  for (const mutation of [
    report => { delete report.generatedSyntax; },
    report => { report.generatedSyntax.method = "unapproved"; },
    report => { report.generatedSyntax.checked = 13; },
    report => { report.generatedSyntax.byLanguage.typescript.checked -= 1; },
    report => { report.generatedSyntax.byLanguage.typescript.unchecked += 1; },
    report => { report.generatedSyntax.byLanguage.rust.passed = 1; },
    report => { report.generatedSyntax.byLanguage.python.unchecked -= 1; },
    report => { report.generatedSyntax.byLanguage.typescript.failed = true; },
    report => { report.generatedSyntax.byLanguage.typescript.source = "PRIVATE_SOURCE"; },
    report => { report.generatedSyntax.passed = -1; },
    report => { report.generatedSyntax.byLanguage.typescript.passed = 0; }
  ]) {
    const candidate = structuredClone(baseline);
    mutation(candidate);
    assert.throws(() => validateComparableReport(candidate));
  }
  const rustScope = report({ selected: fixtures.filter(f => f.language === "rust") });
  const result = compareModelReports(rustScope, rustScope);
  assert.equal(result.generatedTypeScriptSyntax.checkedPerModel, 0);
  assert.equal(result.generatedTypeScriptSyntax.uncheckedPerModel, 12);
  assert.equal(result.generatedTypeScriptSyntax.passedDelta, 0);
});

test("old, mismatched and inconsistent benchmark reports fail closed", () => {
  const valid = report();
  assert.equal(validateComparableReport(valid).attempts, 60);
  const invalid = [
    { ...valid, benchmarkProtocol: "old" }, { ...valid, runsPerFixture: 1 },
    { ...valid, fixtureSetSha256: "secret" },
    { ...valid, requestSpecSha256: undefined },
    { ...valid, requestSpecSha256: "not-a-hash" }, { ...valid, mode: "instruction" },
    { ...valid, failed: 4 }, { ...valid, strictExactMatches: 61 },
    { ...valid, completionP95Ms: -1 }, { ...valid, completionP95Ms: "fast" },
    { ...valid, perLanguage: { rust: {} } },
    { ...valid, formatDiagnostics: undefined },
    { ...valid, formatDiagnostics: { ...valid.formatDiagnostics, inspectedCompleted: 0 } },
    { ...valid, formatDiagnostics: { ...valid.formatDiagnostics, signals: {
      ...valid.formatDiagnostics.signals, markdownFence: 999
    } } },
    { ...valid, fixtureOutcomes: { ...valid.fixtureOutcomes, evaluated: 0 } }
  ];
  for (const item of invalid) assert.throws(() => compareModelReports(valid, item));
  const changedScope = report();
  changedScope.fixtureSetSha256 = "0".repeat(64);
  assert.throws(() => compareModelReports(valid, changedScope));
  const changedRequest = report();
  changedRequest.requestSpecSha256 = "a".repeat(64);
  assert.throws(() => compareModelReports(valid, changedRequest));
  assert.throws(() => compareModelReports(valid, report({ runs: 3 })));
  assert.throws(() => compareModelReports(valid, { ...valid, mode: "instruction" }));
});

test("offline CLI compares bounded report files and never echoes injected model/path data", () => {
  const dir = mkdtempSync(join(tmpdir(), "lineloom-eval-comparison-"));
  const baseline = join(dir, "baseline-private.json");
  const candidate = join(dir, "candidate-private.json");
  const script = fileURLToPath(new URL("./model-eval-compare.mjs", import.meta.url));
  try {
    writeFileSync(baseline, JSON.stringify(report({ count: 1 })));
    writeFileSync(candidate, JSON.stringify(report({ count: 2, model: "secret-model-tag" })));
    const output = execFileSync(process.execPath, [script, "--baseline", baseline, "--candidate", candidate], {
      encoding: "utf8", timeout: 5000
    });
    assert.equal(JSON.parse(output).candidateMinusBaseline.strictExactMatches, 2);
    assert.ok(!output.includes(dir));
    assert.ok(!output.includes("secret-model-tag"));

    writeFileSync(candidate, JSON.stringify({ ...report(), mode: "wrong-mode", model: "TOP_SECRET" }));
    const invalid = spawnSync(process.execPath, [script, "--baseline", baseline, "--candidate", candidate], {
      encoding: "utf8", timeout: 5000
    });
    assert.equal(invalid.status, 1);
    assert.ok(!invalid.stderr.includes(dir));
    assert.ok(!invalid.stderr.includes("TOP_SECRET"));
    assert.equal(invalid.stdout, "");
    writeFileSync(candidate, "x".repeat(32_769));
    const oversized = spawnSync(process.execPath, [script, "--baseline", baseline, "--candidate", candidate], {
      encoding: "utf8", timeout: 5000
    });
    assert.equal(oversized.status, 1);
    assert.ok(!oversized.stderr.includes(dir));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
