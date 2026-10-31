import assert from "node:assert/strict";
import test from "node:test";
import {
  NATIVE_STRUCTURE_METHOD, summarizeNativeStructure, validateNativeStructureReport
} from "./model-eval-native-accounting.mjs";

const completed = (language, nativeStructureOutcome) =>
  ({ ok: true, language, nativeStructureOutcome });
const counts = { rust: { completed: 2 }, c: { completed: 1 }, cpp: { completed: 1 } };

function report() {
  return summarizeNativeStructure([
    completed("rust", "clean"), completed("rust", "mismatch"),
    completed("c", "unchecked"), completed("cpp", undefined),
    completed("python", undefined), { ok: false, language: "rust" }
  ]);
}

test("counts clean, mismatch and unchecked separately without treating absent evidence as clean", () => {
  const data = report();
  assert.equal(data.method, NATIVE_STRUCTURE_METHOD);
  assert.deepEqual([data.completed, data.clean, data.mismatch, data.unchecked], [4, 1, 1, 2]);
  assert.deepEqual(data.byLanguage.rust, {
    completed: 2, clean: 1, mismatch: 1, unchecked: 0
  });
  assert.deepEqual(data.byLanguage.cpp, {
    completed: 1, clean: 0, mismatch: 0, unchecked: 1
  });
  assert.deepEqual(validateNativeStructureReport(data, counts, 1), data);
});

test("only counts completed native-language responses", () => {
  const data = summarizeNativeStructure([
    completed("typescript", "mismatch"), completed("python", "clean"),
    { ok: false, language: "rust", nativeStructureOutcome: "mismatch" }
  ]);
  assert.equal(data.completed, 0);
  assert.equal(data.mismatch, 0);
  assert.equal(data.unchecked, 0);
});

test("refuses invalid explicit outcome and any fabricated or inconsistent coverage", () => {
  assert.throws(() => summarizeNativeStructure([completed("rust", "passed")]),
    /invalid-native-structure-status/);
  assert.throws(() => summarizeNativeStructure(null), /invalid-native-structure-input/);
  const mutations = [
    r => { r.method = "forged"; },
    r => { delete r.byLanguage.cpp; },
    r => { r.byLanguage.rust.clean = 2; },
    r => { r.byLanguage.c.unchecked = 0; },
    r => { r.byLanguage.rust.source = "PRIVATE_SOURCE"; },
    r => { r.clean = 2; },
    r => { r.mismatch = true; },
    r => { r.byLanguage.cpp.completed = 2; },
    r => { r.unchecked = -1; },
  ];
  for (const mutate of mutations) {
    const invalid = structuredClone(report());
    mutate(invalid);
    assert.throws(() => validateNativeStructureReport(invalid, counts, 1));
  }
  assert.throws(() => validateNativeStructureReport(report(), counts, 0));
});

test("source-like fields are not reproduced in any summary", () => {
  const privateSource = "PRIVATE_NATIVE_INSERTION_SHOULD_NOT_LEAK";
  const data = summarizeNativeStructure([
    { ...completed("rust", "mismatch"), source: privateSource, fixtureId: privateSource }
  ]);
  const checked = validateNativeStructureReport(data, {
    rust: { completed: 1 }, c: { completed: 0 }, cpp: { completed: 0 }
  }, 1);
  assert.ok(!JSON.stringify(checked).includes(privateSource));
});
