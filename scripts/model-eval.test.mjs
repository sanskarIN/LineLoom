import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  EVAL_LANGUAGES, createRequest, normalizeGenerated, percentile,
  resolveMode, summarizeMeasurements, validateFixtures, validateModelTag
} from "./model-eval-lib.mjs";

const fixturePath = new URL("../model/fixtures/completion-v1.json", import.meta.url);
const fixtures = validateFixtures(JSON.parse(await readFile(fixturePath, "utf8")));

test("manifest contains distinct synthetic cases for each scoped language", () => {
  assert.equal(fixtures.length, 10);
  assert.deepEqual([...new Set(fixtures.map(item => item.language))].sort(), [...EVAL_LANGUAGES].sort());
  assert.equal(new Set(fixtures.map(item => item.id)).size, fixtures.length);
});

test("fixture validation rejects missing coverage, duplicates and malformed content", () => {
  assert.throws(() => validateFixtures({ schemaVersion: 1, fixtures: fixtures.slice(0, 2) }));
  assert.throws(() => validateFixtures({
    schemaVersion: 1, fixtures: [...fixtures, { ...fixtures[0] }]
  }));
  assert.throws(() => validateFixtures({
    schemaVersion: 1, fixtures: fixtures.map((item, i) =>
      i === 0 ? { ...item, language: "javascript" } : item)
  }));
  assert.throws(() => validateFixtures({
    schemaVersion: 1, fixtures: fixtures.map((item, i) =>
      i === 0 ? { ...item, prefix: "x".repeat(4097) } : item)
  }));
});

test("model tag validation rejects control, whitespace and shell-looking values", () => {
  assert.equal(validateModelTag("lineloom-code:0.1"), "lineloom-code:0.1");
  for (const invalid of ["", "a b", "a\n", "../../some file", "--help", "x;echo", "x".repeat(130)]) {
    assert.throws(() => validateModelTag(invalid));
  }
});

test("FIM option retains suffix and instruction mode contains untrusted marked context", () => {
  const example = fixtures[0];
  assert.equal(resolveMode("qwen2.5-coder:1.5b"), "fim");
  assert.equal(resolveMode("lineloom-code:dev"), "instruction");
  const native = createRequest(example, "qwen2.5-coder:1.5b", "auto");
  assert.equal(native.prompt, example.prefix);
  assert.equal(native.suffix, example.suffix);
  assert.equal(native.options.temperature, 0);
  const forced = createRequest(example, "lineloom-code:dev", "fim");
  assert.equal(forced.suffix, example.suffix);
  const generic = createRequest(example, "lineloom-code:dev", "instruction");
  assert.equal(Object.hasOwn(generic, "suffix"), false);
  assert.match(generic.prompt, /untrusted/);
  assert.match(generic.prompt, /Language: Rust/);
});

test("strict normalization preserves indentation but strips boundary-only model tokens", () => {
  assert.equal(normalizeGenerated("<|fim_middle|>    value<|fim_suffix|>"), "    value");
  assert.equal(normalizeGenerated("return 1;\r\n"), "return 1;\n");
  assert.equal(normalizeGenerated('const tag = "<|fim_middle|>";'), 'const tag = "<|fim_middle|>";');
  assert.equal(normalizeGenerated("  value  "), "  value  ");
});

test("nearest-rank percentiles and safe aggregate reporting", () => {
  assert.equal(percentile([], 0.95), null);
  assert.equal(percentile([15, 10, 100, 20], 0.5), 15);
  assert.equal(percentile([15, 10, 100, 20], 0.95), 100);
  const summary = summarizeMeasurements([
    { language: "rust", ok: true, exact: true, totalMs: 20, firstTokenMs: 10 },
    { language: "rust", ok: true, exact: false, totalMs: 100, firstTokenMs: null },
    { language: "cpp", ok: false, exact: false }
  ], 10, "local-test", "fim");
  assert.equal(summary.attempts, 3);
  assert.equal(summary.completed, 2);
  assert.equal(summary.failed, 1);
  assert.equal(summary.strictExactMatches, 1);
  assert.equal(summary.firstTokenP50Ms, 10);
  assert.equal(summary.completionP95Ms, 100);
  assert.deepEqual(summary.perLanguage.rust, { attempts: 2, completed: 2, strictMatches: 1 });
  assert.equal(JSON.stringify(summary).includes("return"), false);
});

test("dry-run reports scoped fixture IDs without starting inference", () => {
  const script = fileURLToPath(new URL("./model-eval.mjs", import.meta.url));
  const stdout = execFileSync(process.execPath, [script, "--dry-run", "--language", "cpp", "--runs", "2"], {
    encoding: "utf8", timeout: 5000
  });
  const data = JSON.parse(stdout);
  assert.equal(data.dryRun, true);
  assert.equal(data.networkCalls, 0);
  assert.equal(data.requestsPlanned, 4);
  assert.deepEqual(data.targetLanguages, ["cpp"]);
  assert.equal(Object.hasOwn(data, "prefix"), false);
});
