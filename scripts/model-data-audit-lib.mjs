import { createHash } from "node:crypto";
import { EVAL_LANGUAGES, validateFixtures } from "./model-eval-lib.mjs";

/**
 * Read-only, local, fail-closed training data preflight.
 * Passing means only that the declared records meet these mechanical gates.
 * It NEVER grants training rights, checks live opt-out status, or exports code.
 */
const LANGUAGES = new Set(EVAL_LANGUAGES);
const SPLITS = ["train", "validation", "test"];
const LICENSES = ["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC"];
const validId = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/;
const sha256 = text => createHash("sha256").update(text, "utf8").digest("hex");
const normalized = value => value.replace(/\s+/gu, " ").trim();
const tokenize = value => normalized(value).toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? [];
const windows = (tokens, n) => {
  const result = new Set();
  for (let i = 0; i + n <= tokens.length; i++) result.add(tokens.slice(i, i + n).join(" "));
  return result;
};
const intersect = (a, b) => {
  let count = 0;
  for (const item of a) if (b.has(item)) count++;
  return count;
};
const looksSensitive = text => {
  if (/-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/i.test(text)) return true;
  if (/(?:AKIA|ASIA)[A-Z0-9]{16}/.test(text)) return true;
  if (/\b(?:ghp_|gho_|ghu_|ghs_|github_pat_)[a-zA-Z0-9_]{20,}/.test(text)) return true;
  if (/\b[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}\b/.test(text)) return true;
  if (/(?:password|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*["'][^"' \t\r\n]{8,}["']/i.test(text)) return true;
  if (/\b[a-z]+:\/\/[^\s/@]+:[^\s/@]+@/i.test(text)) return true;
  // Invisible format controls are not safe even in review-only samples.
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b\u200e\u200f\u202a-\u202e\u2060-\u206f\ufeff]/u.test(text)) return true;
  return false;
};
const malformed = () => { throw Error("dataset-audit-rejected"); };

/**
 * Each entry needs independent reviewed rights and opt-out declarations.
 * A reviewed boolean is not verifiable license evidence; human review remains
 * obligatory even when this function returns a count-only PASS.
 */
export function auditTrainingManifest(manifest, publicEvalManifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest) ||
      manifest.schemaVersion !== 1 || !Array.isArray(manifest.samples) ||
      manifest.samples.length < 3 || manifest.samples.length > 256) malformed();
  const publicFixtures = validateFixtures(publicEvalManifest);
  const publicTexts = publicFixtures.map(item =>
    normalized(item.prefix + item.expected + item.suffix));
  const publicHashes = new Set(publicTexts.map(sha256));
  const publicWindows = publicTexts.map(item => windows(tokenize(item), 5));
  const samples = [];
  const ids = new Set();
  const repoSplits = new Map();
  const seenSource = new Set();
  const countByLanguage = Object.fromEntries(EVAL_LANGUAGES.map(x => [x, 0]));
  const countBySplit = Object.fromEntries(SPLITS.map(x => [x, 0]));
  const countByLicense = Object.fromEntries(LICENSES.map(x => [x, 0]));

  for (const s of manifest.samples) {
    if (!s || typeof s !== "object" || Array.isArray(s) ||
        !validId.test(s.id ?? "") || ids.has(s.id) ||
        !LANGUAGES.has(s.language) || !SPLITS.includes(s.split) ||
        !LICENSES.includes(s.spdxLicense) ||
        !validId.test(s.repositoryGroup ?? "") ||
        !/^[0-9a-f]{40}$/.test(s.sourceRevision ?? "") ||
        s.rightsReviewed !== true || s.optOutReviewed !== true ||
        s.attributionReviewed !== true) malformed();
    ids.add(s.id);
    for (const part of ["prefix", "middle", "suffix"]) {
      if (typeof s[part] !== "string" || s[part].length > 4096) malformed();
    }
    if (!s.prefix || !s.middle ||
        s.prefix.length + s.middle.length + s.suffix.length > 8192) malformed();
    const content = s.prefix + s.middle + s.suffix;
    if (looksSensitive(content)) malformed();

    const lastSplit = repoSplits.get(s.repositoryGroup);
    if (lastSplit !== undefined && lastSplit !== s.split) malformed();
    repoSplits.set(s.repositoryGroup, s.split);
    // Source identity cannot be repeated under different split IDs or repos.
    const exact = sha256(normalized(content));
    if (seenSource.has(exact) || publicHashes.has(exact)) malformed();
    seenSource.add(exact);

    // Check both literal passages and common five-token sequences. Evaluate
    // only ORIGINAL checked-in public fixtures, no external requests.
    const norm = normalized(content);
    const tokens = windows(tokenize(content), 5);
    if (publicTexts.some(t => (t.length >= 48 && norm.includes(t)) ||
        (norm.length >= 48 && t.includes(norm)))) malformed();
    if (publicWindows.some(reference => reference.size >= 5 && tokens.size >= 5 &&
        intersect(reference, tokens) / Math.min(reference.size, tokens.size) >= 0.85)) malformed();
    for (const existing of samples) {
      // Conservative near-duplicate block even within a split. Similarity
      // screening is heuristic and MUST be supplemented before training.
      if (norm.length >= 48 && existing.norm.length >= 48 &&
          (norm.includes(existing.norm) || existing.norm.includes(norm))) malformed();
      if (tokens.size >= 5 && existing.tokens.size >= 5 &&
          intersect(tokens, existing.tokens) / Math.min(tokens.size, existing.tokens.size) >= 0.9) malformed();
    }
    samples.push({ norm, tokens });
    countByLanguage[s.language]++;
    countBySplit[s.split]++;
    countByLicense[s.spdxLicense]++;
  }
  if (SPLITS.some(s => countBySplit[s] === 0)) malformed();
  return {
    auditProtocol: "lineloom-data-preflight-v1",
    status: "MECHANICAL_CHECKS_PASS_ONLY",
    samples: samples.length,
    repositoryGroups: repoSplits.size,
    byLanguage: countByLanguage,
    bySplit: countBySplit,
    byDeclaredLicense: countByLicense,
    blockersStillRequiringHumanReview: [
      "Review actual copyright, licensing, author consent, attribution and current opt-out records.",
      "Check code for secrets/PII and unsafe or poisoned instructions using independent tooling and human review.",
      "Review all forks and near-duplicates outside this manifest and public evaluation fixtures.",
      "Approve any training, checkpoint download, model weights export and distribution separately."
    ]
  };
}
