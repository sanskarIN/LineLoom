import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { auditTrainingManifest } from "./model-data-audit-lib.mjs";
import { EVAL_LANGUAGES } from "./model-eval-lib.mjs";

const fixtures = JSON.parse(readFileSync(new URL("../model/fixtures/completion-v1.json", import.meta.url), "utf8"));
const create = (n, split) => ({
  id: "example-" + n, language: EVAL_LANGUAGES[(n - 1) % EVAL_LANGUAGES.length],
  split, repositoryGroup: "reviewed-project-" + n,
  sourceRevision: n.toString(16).padStart(40, "0"),
  spdxLicense: n % 2 ? "MIT" : "Apache-2.0",
  rightsReviewed: true, optOutReviewed: true, attributionReviewed: true,
  // Large deterministic distinct markers keep test-only examples genuinely
  // different despite their similar Rust-like surrounding scaffold.
  prefix: "/* " + String.fromCharCode(96 + n).repeat(65) + " */ fn synthetic_variant_" + n +
    "(item: usize) -> usize { let intermediate_" + n + " = item + " + (100+n) + "; ",
  middle: "intermediate_" + n + " * " + (100+n),
  suffix: " } // deliberately original test-only code " + n
});
const good = () => ({ schemaVersion: 1, samples: Array.from({ length: 15 }, (_, index) =>
  create(index + 1, ["train", "validation", "test"][Math.floor(index / 5)])) });
const shouldReject = sample => assert.throws(() => auditTrainingManifest(sample, fixtures));

test("review-only valid synthetic records return counts, no IDs or code", () => {
  const summary = auditTrainingManifest(good(), fixtures);
  assert.equal(summary.status, "MECHANICAL_CHECKS_PASS_ONLY");
  assert.equal(summary.samples, 15);
  assert.equal(summary.bySplit.train, 5);
  assert.equal(summary.bySplit.validation, 5);
  assert.equal(summary.bySplit.test, 5);
  for (const language of EVAL_LANGUAGES) {
    assert.deepEqual(summary.byLanguageAndSplit[language], {
      train: 1, validation: 1, test: 1
    });
  }
  const output = JSON.stringify(summary);
  assert.ok(!output.includes("synthetic_variant_"));
  assert.ok(!output.includes("reviewed-project-"));
  assert.ok(!output.includes("example-1"));
  assert.ok(!output.includes("100"));
  assert.ok(!output.includes("BEGIN PRIVATE"));
});
test("rejects unreviewed rights, opt outs, unknown SPDX, language or revision", () => {
  for (const key of ["rightsReviewed", "optOutReviewed", "attributionReviewed"]) {
    const value = good(); value.samples[0][key] = false; shouldReject(value);
  }
  for (const [key, value] of [["spdxLicense", "GPL-3.0"], ["language", "java"], ["sourceRevision", "main"], ["split", "unknown"]]) {
    const copy = good(); copy.samples[0][key] = value; shouldReject(copy);
  }
});
test("rejects absent splits, duplicate IDs, exact/near source duplicates, and repo split leakage", () => {
  const noTest = good();
  for (const item of noTest.samples) if (item.split === "test") item.split = "train";
  shouldReject(noTest);
  const noCppTest = good(); noCppTest.samples.find(x =>
    x.language === "cpp" && x.split === "test").split = "train";
  shouldReject(noCppTest);
  const absentPython = good(); absentPython.samples = absentPython.samples.filter(x =>
    x.language !== "python");
  shouldReject(absentPython);
  const duplicateId = good(); duplicateId.samples[1].id = duplicateId.samples[0].id; shouldReject(duplicateId);
  const duplicateCode = good();
  duplicateCode.samples[1].prefix = duplicateCode.samples[0].prefix;
  duplicateCode.samples[1].middle = duplicateCode.samples[0].middle;
  duplicateCode.samples[1].suffix = duplicateCode.samples[0].suffix;
  shouldReject(duplicateCode);
  const sameRepo = good(); sameRepo.samples[5].repositoryGroup = sameRepo.samples[0].repositoryGroup;
  shouldReject(sameRepo);
  const near = good();
  near.samples[1].prefix = near.samples[0].prefix;
  near.samples[1].middle = near.samples[0].middle;
  near.samples[1].suffix = near.samples[0].suffix.replace("code 1", "code 9");
  shouldReject(near);
});
test("blocks direct reuse of public synthetic evaluation material", () => {
  const copy = good();
  const evalItem = fixtures.fixtures[0];
  copy.samples[0].prefix = evalItem.prefix;
  copy.samples[0].middle = evalItem.expected;
  copy.samples[0].suffix = evalItem.suffix;
  shouldReject(copy);
});
test("public fixture near-duplicates with benign edits fail preflight", () => {
  const sample = good();
  const probe = fixtures.fixtures.find(x => x.id === "rust-iterator");
  // An evaluator string with an otherwise innocuous variable rename must
  // not become a training example under a new user-supplied sample ID.
  sample.samples[0].prefix = probe.prefix.replace("items", "values");
  sample.samples[0].middle = probe.expected;
  sample.samples[0].suffix = probe.suffix;
  shouldReject(sample);
});
test("requires complete five-language train/validation/test holdouts", () => {
  const omitted = good();
  omitted.samples.splice(9, 1); // Last validation group loses one language.
  shouldReject(omitted);
});
test("heuristics reject obvious secrets, emails, unsafe Unicode and control characters", () => {
  for (const poison of [
    'password = "superprivate1234"',
    'person@example.org',
    '-----BEGIN PRIVATE KEY-----',
    'AKIAABCDEFGHIJKLMNOP',
    '\u202e', '\u0000'
  ]) {
    const copy = good(); copy.samples[0].middle += poison; shouldReject(copy);
  }
});
test("rejects reserved FIM and chat tokens from any training span", () => {
  for (const marker of [
    "<|fim_prefix|>", "<|fim_suffix|>", "<|fim_middle|>",
    "<|endoftext|>", "<|im_start|>", "<|im_end|>", "<|file_sep|>"
  ]) {
    for (const part of ["prefix", "middle", "suffix"]) {
      const manifest = good();
      manifest.samples[0][part] += " /*" + marker + "*/";
      shouldReject(manifest);
    }
  }
});
test("rejects unknown, missing and inherited manifest or sample fields", () => {
  for (const change of [
    manifest => { manifest.unreviewedSource = "must-not-be-accepted"; },
    manifest => { delete manifest.schemaVersion; },
    manifest => { manifest.samples[0].privateSnippet = "do-not-accept"; },
    manifest => { delete manifest.samples[0].attributionReviewed; }
  ]) {
    const copy = good(); change(copy); shouldReject(copy);
  }
  const inherited = good();
  const prototype = Object.create(inherited.samples[0]);
  for (const field of ["id", "language", "split"]) prototype[field] = inherited.samples[0][field];
  inherited.samples[0] = prototype;
  shouldReject(inherited);
  const inheritedRoot = Object.create(good());
  shouldReject(inheritedRoot);
});

test("rejects coerced numeric or non-string record identifiers and revisions", () => {
  for (const [field, value] of [
    ["id", 123], ["repositoryGroup", 123],
    ["id", new String("example-1")],
    ["repositoryGroup", new String("reviewed-project-1")],
    ["sourceRevision", 123],
    ["sourceRevision", null], ["language", 1],
    ["spdxLicense", 3], ["split", 1]
  ]) {
    const copy = good();
    copy.samples[0][field] = value;
    shouldReject(copy);
  }
});

test("case-only repository-family changes cannot cross holdout splits", () => {
  const copy = good();
  copy.samples[5].repositoryGroup = copy.samples[0].repositoryGroup.toUpperCase();
  shouldReject(copy);
  const sameSplit = good();
  sameSplit.samples[1].repositoryGroup = sameSplit.samples[0].repositoryGroup.toUpperCase();
  const report = auditTrainingManifest(sameSplit, fixtures);
  assert.equal(report.repositoryGroups, 14);
  assert.ok(!JSON.stringify(report).includes("REVIEWED-PROJECT"));
});

test("bounded CLI is offline, does not echo source/paths on success or rejection", () => {
  const root = mkdtempSync(join(tmpdir(), "lineloom-private-corpus-"));
  const file = join(root, "private-source-with-names.json");
  const script = fileURLToPath(new URL("./model-data-audit.mjs", import.meta.url));
  try {
    writeFileSync(file, JSON.stringify(good()));
    const ok = spawnSync(process.execPath, [script, "--manifest", file], { encoding: "utf8", timeout: 5000 });
    assert.equal(ok.status, 0, ok.stderr);
    assert.equal(JSON.parse(ok.stdout).samples, 15);
    assert.ok(!ok.stdout.includes(root));
    assert.ok(!ok.stdout.includes("synthetic_variant_"));
    const withSecret = good(); withSecret.samples[0].middle += " person@example.org";
    writeFileSync(file, JSON.stringify(withSecret));
    const bad = spawnSync(process.execPath, [script, "--manifest", file], { encoding: "utf8", timeout: 5000 });
    assert.equal(bad.status, 1);
    assert.equal(bad.stdout, "");
    assert.ok(!bad.stderr.includes("person@example.org"));
    assert.ok(!bad.stderr.includes(file));
    writeFileSync(file, "x".repeat(1_048_577));
    assert.equal(spawnSync(process.execPath, [script, "--manifest", file],
      { encoding: "utf8", timeout: 5000 }).status, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
