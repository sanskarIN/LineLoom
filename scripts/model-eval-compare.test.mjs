import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  EVAL_BENCHMARK_PROTOCOL, EVAL_LANGUAGES, EVAL_CATEGORIES,
  fixtureSetSha256, summarizeMeasurements, validateFixtures
} from "./model-eval-lib.mjs";
import { validateComparableReport, compareModelReports } from "./model-eval-compare-lib.mjs";
import { readFileSync } from "node:fs";

const fixtures = validateFixtures(JSON.parse(readFileSync(
  fileURLToPath(new URL("../model/fixtures/completion-v1.json", import.meta.url)), "utf8"
)));
function report({ runs = 2, model = "local-test-a", count = 1 } = {}) {
  const results = [];
  for (let run = 0; run < runs; run++) {
    for (const [index, fixture] of fixtures.entries()) {
      const exact = index < count;
      results.push({
        fixtureId: fixture.id, language: fixture.language, category: fixture.category,
        ok: true, exact, formatSignals: [], firstTokenMs: 10 + run, totalMs: 30 + run
      });
    }
  }
  return {
    ...summarizeMeasurements(results, fixtures.length, model, "fim"),
    benchmarkProtocol: EVAL_BENCHMARK_PROTOCOL,
    fixtureSetSha256: fixtureSetSha256(fixtures), runsPerFixture: runs
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

test("comparison returns only bounded counts and per-language/category deltas", () => {
  const baseline = report({ count: 1 });
  const candidate = report({ count: 3, model: "secret-model-tag" });
  const result = compareModelReports(baseline, candidate);
  assert.equal(result.scopeVerified, true);
  assert.equal(result.syntheticFixtures, 30);
  assert.equal(result.candidateMinusBaseline.strictExactMatches, 4);
  assert.equal(result.candidateMinusBaseline.failed, 0);
  const expectedRustDelta = fixtures.slice(1, 3).filter(f => f.language === "rust").length * 2;
  assert.equal(result.perLanguageStrictMatchDelta.rust, expectedRustDelta);
  assert.equal(Object.values(result.perLanguageStrictMatchDelta).reduce((a, b) => a + b, 0), 4);
  assert.equal(Object.keys(result.perLanguageStrictMatchDelta).length, 5);
  assert.equal(Object.keys(result.perCategoryStrictMatchDelta).length, 5);
  const text = JSON.stringify(result);
  assert.ok(!text.includes("secret-model-tag"));
  assert.ok(!text.includes(baseline.fixtureSetSha256));
  assert.ok(!text.includes("rust-branch"));
  assert.ok(!text.includes("prefix"));
});

test("old, mismatched and inconsistent benchmark reports fail closed", () => {
  const valid = report();
  assert.equal(validateComparableReport(valid).attempts, 60);
  const invalid = [
    { ...valid, benchmarkProtocol: "old" }, { ...valid, runsPerFixture: 1 },
    { ...valid, fixtureSetSha256: "secret" }, { ...valid, mode: "instruction" },
    { ...valid, failed: 4 }, { ...valid, strictExactMatches: 61 },
    { ...valid, completionP95Ms: -1 }, { ...valid, completionP95Ms: "fast" },
    { ...valid, perLanguage: { rust: {} } },
    { ...valid, fixtureOutcomes: { ...valid.fixtureOutcomes, evaluated: 0 } }
  ];
  for (const item of invalid) assert.throws(() => compareModelReports(valid, item));
  const changedScope = report();
  changedScope.fixtureSetSha256 = "0".repeat(64);
  assert.throws(() => compareModelReports(valid, changedScope));
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
