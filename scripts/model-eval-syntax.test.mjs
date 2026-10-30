import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { classifyGeneratedSyntax, GENERATED_SYNTAX_METHOD, MAX_SYNTHETIC_TS_CHARS } from "./model-eval-syntax.mjs";
import { normalizeGenerated, summarizeMeasurements, EVAL_LANGUAGES } from "./model-eval-lib.mjs";

const cases = JSON.parse(readFileSync(new URL("../model/fixtures/completion-v1.json", import.meta.url), "utf8")).fixtures;
const tsCases = cases.filter(x => x.language === "typescript");

test("parses the six public TypeScript reference insertions without evaluating them", () => {
  assert.equal(tsCases.length, 6);
  for (const fixture of tsCases) {
    assert.equal(classifyGeneratedSyntax(fixture, fixture.expected), "passed", fixture.id);
  }
  assert.equal(GENERATED_SYNTAX_METHOD, "typescript-parser-only-v1");
});

test("distinguishes alternative grammatical completions from malformed insertions", () => {
  const fixture = tsCases.find(x => x.id === "typescript-multiply");
  assert.ok(fixture);
  assert.equal(classifyGeneratedSyntax(fixture, "value + value"), "passed");
  for (const bad of ["return }", "(", "value + )", "???;"]) {
    assert.equal(classifyGeneratedSyntax(fixture, bad), "failed");
  }
  // An expression with side effects is parsed only, never invoked.
  // This deliberately proves only grammar, not safety of executable code.
  assert.equal(classifyGeneratedSyntax(fixture,
    "(() => { throw new Error('never-run'); })()"), "passed");
});

test("normalizes only boundary markers before an in-memory TypeScript syntax check", () => {
  const fixture = tsCases.find(x => x.id === "typescript-nullish");
  assert.equal(classifyGeneratedSyntax(fixture,
    normalizeGenerated(fixture.expected + "<|fim_suffix|>")), "passed");
});

test("all other generated languages are unchecked, not implicitly passed", () => {
  for (const lang of EVAL_LANGUAGES.filter(x => x !== "typescript")) {
    const fixture = cases.find(x => x.language === lang);
    assert.equal(classifyGeneratedSyntax(fixture, fixture.expected), "unchecked");
    assert.equal(classifyGeneratedSyntax(fixture, "???invalid"), "unchecked");
  }
});

test("rejects malformed TypeScript fixture input and unbounded inserts without logging", () => {
  const fixture = tsCases[0];
  for (const [input, insert] of [
    [null, "secret"], [{ language: "typescript", prefix: "" }, "secret"],
    [fixture, null], [fixture, "private-" .repeat(MAX_SYNTHETIC_TS_CHARS)]
  ]) {
    assert.throws(() => classifyGeneratedSyntax(input, insert), error =>
      !JSON.stringify(error).includes("secret") && !JSON.stringify(error).includes("private-"));
  }
});

test("source-free summary reflects completed TypeScript parse results and other unchecked languages", () => {
  const result = summarizeMeasurements([
    { fixtureId: "ts-one", language: "typescript", category: "expression",
      ok: true, exact: false, totalMs: 10, firstTokenMs: 5,
      formatSignals: [], syntaxOutcome: "passed", privateSource: "SECRET_INSERTION" },
    { fixtureId: "ts-two", language: "typescript", category: "expression",
      ok: true, exact: false, totalMs: 12, firstTokenMs: 6,
      formatSignals: [], syntaxOutcome: "failed" },
    { fixtureId: "rust", language: "rust", category: "expression",
      ok: true, exact: false, totalMs: 11, firstTokenMs: 6,
      formatSignals: [], syntaxOutcome: "unchecked" },
    { fixtureId: "ts-error", language: "typescript", category: "expression",
      ok: false, exact: false }
  ], 4, "secret-model", "fim");
  const syntax = result.generatedSyntax;
  assert.equal(syntax.checked, 2);
  assert.equal(syntax.passed, 1);
  assert.equal(syntax.failed, 1);
  assert.equal(syntax.unchecked, 1);
  assert.deepEqual(syntax.byLanguage.typescript, {
    completed: 2, checked: 2, passed: 1, failed: 1, unchecked: 0
  });
  assert.deepEqual(syntax.byLanguage.rust, {
    completed: 1, checked: 0, passed: 0, failed: 0, unchecked: 1
  });
  assert.ok(!JSON.stringify(syntax).includes("SECRET_INSERTION"));
  assert.ok(!JSON.stringify(syntax).includes("secret-model"));
  assert.ok(!JSON.stringify(syntax).includes("ts-two"));
});
