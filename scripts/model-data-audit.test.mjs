import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { auditTrainingManifest } from "./model-data-audit-lib.mjs";

const fixtures = JSON.parse(readFileSync(new URL("../model/fixtures/completion-v1.json", import.meta.url), "utf8"));
const create = (n, split) => ({
  id: "example-" + n, language: ["rust", "c", "typescript"][n % 3],
  split, repositoryGroup: "reviewed-project-" + n,
  sourceRevision: n.toString(16).padStart(40, "0"),
  spdxLicense: n % 2 ? "MIT" : "Apache-2.0",
  rightsReviewed: true, optOutReviewed: true, attributionReviewed: true,
  prefix: "fn synthetic_variant_" + n + "(item: usize) -> usize { let intermediate_" + n + " = item + " + (100+n) + "; ",
  middle: "intermediate_" + n + " * " + (100+n),
  suffix: " } // deliberately original test-only code " + n
});
const good = () => ({ schemaVersion: 1, samples: [create(1, "train"), create(2, "validation"), create(3, "test")] });
const shouldReject = sample => assert.throws(() => auditTrainingManifest(sample, fixtures));

test("review-only valid synthetic records return counts, no IDs or code", () => {
  const summary = auditTrainingManifest(good(), fixtures);
  assert.equal(summary.status, "MECHANICAL_CHECKS_PASS_ONLY");
  assert.equal(summary.samples, 3);
  assert.equal(summary.bySplit.train, 1);
  assert.equal(summary.bySplit.validation, 1);
  assert.equal(summary.bySplit.test, 1);
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
  const noTest = good(); noTest.samples[2].split = "train"; shouldReject(noTest);
  const duplicateId = good(); duplicateId.samples[1].id = duplicateId.samples[0].id; shouldReject(duplicateId);
  const duplicateCode = good();
  duplicateCode.samples[1].prefix = duplicateCode.samples[0].prefix;
  duplicateCode.samples[1].middle = duplicateCode.samples[0].middle;
  duplicateCode.samples[1].suffix = duplicateCode.samples[0].suffix;
  shouldReject(duplicateCode);
  const sameRepo = good(); sameRepo.samples[1].repositoryGroup = sameRepo.samples[0].repositoryGroup; shouldReject(sameRepo);
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
test("bounded CLI is offline, does not echo source/paths on success or rejection", () => {
  const root = mkdtempSync(join(tmpdir(), "lineloom-private-corpus-"));
  const file = join(root, "private-source-with-names.json");
  const script = fileURLToPath(new URL("./model-data-audit.mjs", import.meta.url));
  try {
    writeFileSync(file, JSON.stringify(good()));
    const ok = spawnSync(process.execPath, [script, "--manifest", file], { encoding: "utf8", timeout: 5000 });
    assert.equal(ok.status, 0, ok.stderr);
    assert.equal(JSON.parse(ok.stdout).samples, 3);
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
