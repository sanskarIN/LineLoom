import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  EVAL_LANGUAGES, EVAL_CATEGORIES, fixtureSetSha256, requestSpecSha256,
  EVAL_BENCHMARK_PROTOCOL, createRequest, normalizeGenerated, percentile,
  resolveMode, summarizeMeasurements, validateFixtures, validateModelTag
} from "./model-eval-lib.mjs";

const fixturePath = new URL("../model/fixtures/completion-v1.json", import.meta.url);
const fixtures = validateFixtures(JSON.parse(await readFile(fixturePath, "utf8")));

test("manifest contains distinct synthetic cases for each scoped language", () => {
  assert.equal(fixtures.length, 40);
  assert.deepEqual([...new Set(fixtures.map(item => item.language))].sort(), [...EVAL_LANGUAGES].sort());
  assert.equal(new Set(fixtures.map(item => item.id)).size, fixtures.length);
  for (const language of EVAL_LANGUAGES) {
    assert.equal(fixtures.filter(item => item.language === language).length, 8);
  }
  assert.deepEqual([...new Set(fixtures.map(item => item.category))].sort(), [...EVAL_CATEGORIES].sort());
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
  assert.throws(() => validateFixtures({
    schemaVersion: 1, fixtures: fixtures.map((item, i) =>
      i === 0 ? { ...item, category: "unknown" } : item)
  }));
  assert.throws(() => validateFixtures({
    schemaVersion: 1, fixtures: fixtures.map((item, i) =>
      i === 0 ? { ...item, category: undefined } : item)
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
  for (const model of [
    "lineloom-code", "lineloom-code:dev", "LineLoom-Code:local",
    "qwen2.5-coder", "qwen2.5-coder:1.5b", "qwen2.5-coder-7b"
  ]) assert.equal(resolveMode(model), "fim", model);
  for (const other of [
    "lineloom-code-next", "lineloom-coder:dev", "user/lineloom-code:dev",
    "qwen2.5-coderx:7b", "generic-local:latest"
  ]) assert.equal(resolveMode(other), "instruction", other);
  assert.equal(resolveMode("lineloom-code:dev", "instruction"), "instruction");
  assert.equal(resolveMode("generic-local:latest", "fim"), "fim");
  const native = createRequest(example, "qwen2.5-coder:1.5b", "auto");
  assert.equal(native.prompt, example.prefix);
  assert.equal(native.suffix, example.suffix);
  assert.equal(native.options.temperature, 0);
  const autoLineLoom = createRequest(example, "lineloom-code:dev", "auto");
  assert.equal(autoLineLoom.prompt, example.prefix);
  assert.equal(autoLineLoom.suffix, example.suffix);
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
    { language: "rust", category: "expression", ok: true, exact: true, totalMs: 20, firstTokenMs: 10 },
    { language: "rust", category: "expression", ok: true, exact: false, totalMs: 100, firstTokenMs: null },
    { language: "cpp", category: "suffix", ok: false, exact: false }
  ], 10, "local-test", "fim");
  assert.equal(summary.attempts, 3);
  assert.equal(summary.completed, 2);
  assert.equal(summary.failed, 1);
  assert.equal(summary.strictExactMatches, 1);
  assert.equal(summary.firstTokenP50Ms, 10);
  assert.equal(summary.completionP95Ms, 100);
  assert.deepEqual(summary.perLanguage.rust, { attempts: 2, completed: 2, strictMatches: 1 });
  assert.deepEqual(summary.perCategory.expression, { attempts: 2, completed: 2, strictMatches: 1 });
  assert.deepEqual(summary.perCategory.suffix, { attempts: 1, completed: 0, strictMatches: 0 });
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
  assert.equal(data.benchmarkProtocol, EVAL_BENCHMARK_PROTOCOL);
  assert.equal(data.requestSpecSha256, requestSpecSha256(
    fixtures.filter(item => item.language === "cpp"), "fim"
  ));
  assert.equal(data.requestsPlanned, 16);
  assert.deepEqual(data.targetLanguages, ["cpp"]);
  assert.equal(Object.hasOwn(data, "prefix"), false);
});

test("LineLoom Code auto dry-run selects FIM and binds the native request fingerprint", () => {
  const script = fileURLToPath(new URL("./model-eval.mjs", import.meta.url));
  const stdout = execFileSync(process.execPath, [
    script, "--dry-run", "--model", "lineloom-code:dev", "--mode", "auto",
    "--language", "typescript"
  ], { encoding: "utf8", timeout: 5000 });
  const data = JSON.parse(stdout);
  assert.equal(data.mode, "fim");
  assert.equal(data.networkCalls, 0);
  assert.equal(data.benchmarkProtocol, "lineloom-synthetic-v8");
  assert.equal(data.requestSpecSha256, requestSpecSha256(
    fixtures.filter(item => item.language === "typescript"), "fim"
  ));
  assert.equal(stdout.includes("const"), false, "Never print synthetic prompt code");
});

test("category-selective dry-run stays offline and never prints fixture content", () => {
  const script = fileURLToPath(new URL("./model-eval.mjs", import.meta.url));
  const stdout = execFileSync(process.execPath, [
    script, "--dry-run", "--language", "rust", "--category", "indentation"
  ], { encoding: "utf8", timeout: 5000 });
  const data = JSON.parse(stdout);
  assert.equal(data.networkCalls, 0);
  assert.deepEqual(data.targetLanguages, ["rust"]);
  assert.deepEqual(data.targetCategories, ["indentation"]);
  assert.deepEqual(data.fixtureIds, ["rust-branch"]);
  assert.equal(data.requestsPlanned, 1);
  assert.equal(stdout.includes("fn non_negative"), false);
});

test("model evaluator rejects unsupported category filters without making requests", () => {
  const script = fileURLToPath(new URL("./model-eval.mjs", import.meta.url));
  assert.throws(() => execFileSync(process.execPath, [
    script, "--dry-run", "--category", "unreviewed"
  ], { encoding: "utf8", timeout: 5000, stdio: "pipe" }));
});

test("repeated synthetic fixture outcomes distinguish consistent and mixed strict matches", () => {
  const measurements = [
    { fixtureId: "rust-loop", language: "rust", category: "statement", ok: true, exact: true, totalMs: 10, firstTokenMs: 4 },
    { fixtureId: "rust-loop", language: "rust", category: "statement", ok: true, exact: false, totalMs: 11, firstTokenMs: 5 },
    { fixtureId: "cpp-const", language: "cpp", category: "type", ok: true, exact: true, totalMs: 12, firstTokenMs: 6 },
    { fixtureId: "cpp-const", language: "cpp", category: "type", ok: true, exact: true, totalMs: 13, firstTokenMs: 7 },
    { fixtureId: "python-indent", language: "python", category: "indentation", ok: false, exact: false },
    { fixtureId: "python-indent", language: "python", category: "indentation", ok: true, exact: false, totalMs: 15, firstTokenMs: 8 }
  ];
  const summary = summarizeMeasurements(measurements, 3, "local-test", "fim");
  assert.equal(summary.attempts, 6);
  assert.equal(summary.strictExactMatches, 3);
  assert.deepEqual(summary.fixtureOutcomes, {
    evaluated: 3, repeated: 3, exactAtLeastOnce: 2,
    exactEveryAttempt: 1, mixedExactOutcomes: 1
  });
  assert.equal(summary.perLanguage.rust.strictMatches, 1);
  assert.equal(summary.perCategory.type.strictMatches, 2);
  // Model outputs and even synthetic fixture IDs stay out of aggregate reporting.
  assert.equal(JSON.stringify(summary).includes("rust-loop"), false);
  assert.equal(JSON.stringify(summary).includes("python-indent"), false);
});

test("a single attempt cannot imply repeated-outcome stability", () => {
  const summary = summarizeMeasurements([
    { fixtureId: "single-test", language: "rust", category: "expression",
      ok: true, exact: true, totalMs: 2, firstTokenMs: 1 }
  ], 1, "local-test", "instruction");
  assert.deepEqual(summary.fixtureOutcomes, {
    evaluated: 1, repeated: 0, exactAtLeastOnce: 1,
    exactEveryAttempt: 1, mixedExactOutcomes: 0
  });
});


test("evaluator's fixture identity binds original content and benchmark protocol", () => {
  assert.equal(EVAL_BENCHMARK_PROTOCOL, "lineloom-synthetic-v8");
  assert.match(fixtureSetSha256(fixtures), /^[a-f0-9]{64}$/);
  assert.match(requestSpecSha256(fixtures, "fim"), /^[a-f0-9]{64}$/);
  assert.equal(requestSpecSha256(fixtures, "fim"), requestSpecSha256([...fixtures].reverse(), "fim"));
  assert.notEqual(requestSpecSha256(fixtures, "fim"), requestSpecSha256(fixtures, "instruction"));
  assert.throws(() => requestSpecSha256(fixtures, "auto"));
  assert.notEqual(requestSpecSha256(fixtures, "fim"), requestSpecSha256(fixtures, "fim",
    (fixture, model, mode) => {
      const original = createRequest(fixture, model, mode);
      return { ...original, options: { ...original.options, num_ctx: 4096 } };
    }));
  assert.notEqual(fixtureSetSha256(fixtures), fixtureSetSha256(
    fixtures.map((item, index) => index ? item : { ...item, prefix: item.prefix + " " })
  ));
});
