/**
 * Bounded, aggregate-only Ollama terminal token metrics for public synthetic
 * model evaluations. No model output, prompts, paths or tokens are retained.
 *
 * These are server-reported token counters, not independent tokenizer QA,
 * hardware attestation, editor latency or a judgment about code quality.
 */
export const TOKEN_ACCOUNTING_METHOD = "ollama-terminal-generation-v1";
export const TOKEN_ACCOUNTING_LANGUAGES = Object.freeze([
  "rust", "c", "cpp", "python", "typescript"
]);
const BUCKET_KEYS = ["completed", "checked", "unchecked", "generatedTokens", "generationDurationNs"];
const ROOT_KEYS = ["method", ...BUCKET_KEYS, "tokensPerSecond", "byLanguage"];
const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
const exactKeys = (data, keys) => isObject(data) &&
  Object.keys(data).length === keys.length &&
  Object.keys(data).every(key => keys.includes(key));
const count = (value, limit) => Number.isSafeInteger(value) && value >= 0 && value <= limit;
function blankBucket() {
  return { completed: 0, checked: 0, unchecked: 0, generatedTokens: 0, generationDurationNs: 0 };
}
function tokenRate(tokens, duration) {
  return duration > 0 ? Math.round(tokens * 1_000_000_000 / duration) : null;
}
export function checkedOllamaTokenUsage(value) {
  if (!exactKeys(value, ["generatedTokens", "generationDurationNs"]) ||
      !count(value.generatedTokens, 4096) ||
      !count(value.generationDurationNs, 1_000_000_000_000) ||
      (value.generatedTokens === 0) !== (value.generationDurationNs === 0)) {
    throw Error("invalid-ollama-token-usage");
  }
  return { generatedTokens: value.generatedTokens, generationDurationNs: value.generationDurationNs };
}
export function summarizeTokenAccounting(results) {
  if (!Array.isArray(results) || results.length > 500) throw Error("invalid-token-accounting-input");
  const byLanguage = Object.fromEntries(
    TOKEN_ACCOUNTING_LANGUAGES.map(language => [language, blankBucket()])
  );
  for (const result of results) {
    if (!result || result.ok !== true || !Object.hasOwn(byLanguage, result.language)) continue;
    const bucket = byLanguage[result.language];
    bucket.completed++;
    if (result.tokenUsage === undefined || result.tokenUsage === null) {
      bucket.unchecked++;
      continue;
    }
    const usage = checkedOllamaTokenUsage(result.tokenUsage);
    bucket.checked++;
    bucket.generatedTokens += usage.generatedTokens;
    bucket.generationDurationNs += usage.generationDurationNs;
  }
  const totals = Object.fromEntries(BUCKET_KEYS.map(key => [
    key, Object.values(byLanguage).reduce((sum, bucket) => sum + bucket[key], 0)
  ]));
  return {
    method: TOKEN_ACCOUNTING_METHOD,
    ...totals,
    tokensPerSecond: tokenRate(totals.generatedTokens, totals.generationDurationNs),
    byLanguage
  };
}
export function validateTokenAccounting(raw, perLanguage) {
  if (!exactKeys(raw, ROOT_KEYS) ||
      raw.method !== TOKEN_ACCOUNTING_METHOD ||
      !exactKeys(raw.byLanguage, TOKEN_ACCOUNTING_LANGUAGES) ||
      !BUCKET_KEYS.every(key => count(raw[key], key === "generationDurationNs" ? 500_000_000_000_000 : 2_048_000))) {
    throw Error("invalid-token-accounting-report");
  }
  const byLanguage = {};
  for (const language of TOKEN_ACCOUNTING_LANGUAGES) {
    const rawBucket = raw.byLanguage[language];
    const completed = perLanguage[language]?.completed;
    if (!exactKeys(rawBucket, BUCKET_KEYS) ||
        !BUCKET_KEYS.every(key => count(rawBucket[key], key === "generationDurationNs" ? 500_000_000_000_000 : 2_048_000)) ||
        rawBucket.completed !== completed ||
        rawBucket.checked + rawBucket.unchecked !== rawBucket.completed ||
        rawBucket.generatedTokens > rawBucket.checked * 4096 ||
        rawBucket.generationDurationNs > rawBucket.checked * 1_000_000_000_000 ||
        (rawBucket.generatedTokens === 0) !== (rawBucket.generationDurationNs === 0)) {
      throw Error("invalid-token-accounting-language");
    }
    byLanguage[language] = Object.fromEntries(
      BUCKET_KEYS.map(key => [key, rawBucket[key]])
    );
  }
  if (BUCKET_KEYS.some(key => TOKEN_ACCOUNTING_LANGUAGES.reduce(
    (sum, language) => sum + byLanguage[language][key], 0
  ) !== raw[key]) ||
      raw.checked + raw.unchecked !== raw.completed ||
      (raw.generatedTokens === 0) !== (raw.generationDurationNs === 0) ||
      raw.tokensPerSecond !== tokenRate(raw.generatedTokens, raw.generationDurationNs) ||
      (raw.tokensPerSecond !== null && !count(raw.tokensPerSecond, 1_000_000_000))) {
    throw Error("inconsistent-token-accounting-totals");
  }
  return {
    method: TOKEN_ACCOUNTING_METHOD,
    ...Object.fromEntries(BUCKET_KEYS.map(key => [key, raw[key]])),
    tokensPerSecond: raw.tokensPerSecond,
    byLanguage
  };
}
