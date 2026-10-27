import assert from "node:assert/strict";
import test from "node:test";
import { classifyCompletionFormat, FORMAT_SIGNAL_NAMES } from "./model-eval-quality.mjs";
import { summarizeMeasurements, EVAL_BENCHMARK_PROTOCOL } from "./model-eval-lib.mjs";

const fixture = {
  prefix: "function testSource() { return veryLongExistingPrefix",
  suffix: "\n  } // long existing suffix that should not be generated again"
};
const classify = raw => classifyCompletionFormat(raw, fixture);

test("fixed format signal enums cannot reproduce generated source", () => {
  const output = classify("\x60\x60\x60typescript\nconst SECRET_MARKER = 1;\n\x60\x60\x60");
  assert.deepEqual(output, ["markdownFence"]);
  assert.ok(FORMAT_SIGNAL_NAMES.includes(output[0]));
  assert.ok(!JSON.stringify(output).includes("SECRET_MARKER"));
  assert.equal(EVAL_BENCHMARK_PROTOCOL, "lineloom-synthetic-v4");
});
test("detects empty, chat, protocol, Unicode and normal output", () => {
  assert.deepEqual(classify(" \r\n "), ["empty"]);
  assert.deepEqual(classify("Certainly, here is the code"), ["chatPreamble"]);
  assert.deepEqual(classify("<|fim_middle|>value"), ["specialToken"]);
  assert.deepEqual(classify("let value = 0; \u202e"), ["unsafeUnicode"]);
  assert.deepEqual(classify("let flag = true;\r\n"), []);
});
test("flags significant copied prefix or suffix, not trivial brackets", () => {
  assert.ok(classify(fixture.prefix.slice(-20) + "return 4").includes("prefixEcho"));
  assert.ok(classify("return value;" + fixture.suffix.trim()).includes("suffixEcho"));
  assert.ok(!classify("}").includes("suffixEcho"));
  assert.ok(!classify("return 1;").includes("prefixEcho"));
});
test("counts overlapping indicators, never prints raw model results", () => {
  const report = summarizeMeasurements([
    { fixtureId: "x", language: "rust", category: "statement", ok: true, exact: false,
      firstTokenMs: 4, totalMs: 10, formatSignals: ["markdownFence", "chatPreamble"] },
    { fixtureId: "y", language: "python", category: "type", ok: true, exact: true,
      firstTokenMs: 6, totalMs: 12, formatSignals: [] },
    { fixtureId: "z", language: "cpp", category: "type", ok: false, exact: false }
  ], 3, "private-model:tag", "fim");
  assert.equal(report.formatDiagnostics.inspectedCompleted, 2);
  assert.equal(report.formatDiagnostics.completedWithoutFormatSignals, 1);
  assert.equal(report.formatDiagnostics.signals.markdownFence, 1);
  assert.equal(report.formatDiagnostics.signals.chatPreamble, 1);
  assert.ok(!JSON.stringify(report.formatDiagnostics).includes("private-model:tag"));
});
