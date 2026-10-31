import assert from "node:assert/strict";
import test from "node:test";
import {
  TOKEN_ACCOUNTING_METHOD, checkedOllamaTokenUsage,
  summarizeTokenAccounting, validateTokenAccounting
} from "./model-eval-token-accounting.mjs";

const sample = (language, tokenUsage, ok = true) =>
  ({ language, tokenUsage, ok });
const usage = (generatedTokens, generationDurationNs) =>
  ({ generatedTokens, generationDurationNs });
const scope = Object.fromEntries(
  ["rust", "c", "cpp", "python", "typescript"].map(language => [language, { completed: 0 }])
);

test("counts complete token metadata, absent metadata and source-free throughput separately", () => {
  const results = [
    sample("rust", usage(20, 500_000_000)),
    sample("rust", undefined),
    sample("cpp", usage(10, 500_000_000)),
    sample("python", usage(0, 0)),
    sample("c", usage(100, 1_000), false),
    sample("typescript", null)
  ];
  const tally = summarizeTokenAccounting(results);
  assert.equal(tally.method, TOKEN_ACCOUNTING_METHOD);
  assert.deepEqual([
    tally.completed, tally.checked, tally.unchecked,
    tally.generatedTokens, tally.generationDurationNs, tally.tokensPerSecond
  ], [5, 3, 2, 30, 1_000_000_000, 30]);
  assert.deepEqual(tally.byLanguage.rust, {
    completed: 2, checked: 1, unchecked: 1,
    generatedTokens: 20, generationDurationNs: 500_000_000
  });
  assert.deepEqual(tally.byLanguage.python, {
    completed: 1, checked: 1, unchecked: 0,
    generatedTokens: 0, generationDurationNs: 0
  });
  const expectedScope = structuredClone(scope);
  expectedScope.rust.completed = 2;
  expectedScope.cpp.completed = 1;
  expectedScope.python.completed = 1;
  expectedScope.typescript.completed = 1;
  assert.deepEqual(validateTokenAccounting(tally, expectedScope), tally);
});

test("entirely absent metadata never implies tokens or measured speed", () => {
  const report = summarizeTokenAccounting([sample("rust", undefined)]);
  assert.equal(report.checked, 0);
  assert.equal(report.unchecked, 1);
  assert.equal(report.tokensPerSecond, null);
  const expectedScope = structuredClone(scope);
  expectedScope.rust.completed = 1;
  assert.deepEqual(validateTokenAccounting(report, expectedScope), report);
});

test("rejects malformed token usage and impossible aggregate allocations", () => {
  for (const invalid of [
    {}, null, usage(true, 10), usage(5, 0), usage(0, 3),
    usage(-1, 100), usage(4097, 100), usage(5.2, 100),
    usage(1, 1_000_000_000_001),
    { ...usage(5, 10), privateSnippet: "SECRET_SOURCE" }
  ]) assert.throws(() => checkedOllamaTokenUsage(invalid));
  const baseline = summarizeTokenAccounting([sample("rust", usage(7, 300_000_000))]);
  const expectedScope = structuredClone(scope);
  expectedScope.rust.completed = 1;
  const changes = [
    obj => { obj.method = "unapproved"; },
    obj => { obj.checked = 0; },
    obj => { obj.unchecked = 1; },
    obj => { obj.generatedTokens = 8; },
    obj => { obj.generationDurationNs = 0; },
    obj => { obj.tokensPerSecond = 99999; },
    obj => { obj.byLanguage.rust.generatedTokens = 8; },
    obj => { obj.byLanguage.rust.completed = 2; },
    obj => { obj.byLanguage.c.unknown = "PRIVATE_SOURCE"; },
    obj => { obj.byLanguage.cpp.checked = true; },
    obj => { delete obj.byLanguage.python; },
  ];
  for (const change of changes) {
    const malformed = structuredClone(baseline);
    change(malformed);
    assert.throws(() => validateTokenAccounting(malformed, expectedScope));
  }
});

test("metrics never reproduce user text, fixture IDs or model strings", () => {
  const secret = "PRIVATE_GENERATED_COMPLETION";
  const report = summarizeTokenAccounting([
    { ...sample("typescript", usage(10, 100_000_000)), source: secret,
      fixtureId: secret, model: secret },
  ]);
  assert.ok(!JSON.stringify(report).includes(secret));
  const expectedScope = structuredClone(scope);
  expectedScope.typescript.completed = 1;
  assert.ok(!JSON.stringify(validateTokenAccounting(report, expectedScope)).includes(secret));
});
