/**
 * Aggregate, source-free coverage of the bounded Rust/C/C++ delimiter scanner.
 *
 * "clean" means only that this lexical heuristic found no mismatch.
 * "unchecked" covers unsupported/oversized inputs and missing instrumentation.
 * These values are not compiler, parser, safety or semantic verdicts.
 */
export const NATIVE_STRUCTURE_METHOD = "bounded-native-delimiter-coverage-v1";
export const NATIVE_STRUCTURE_LANGUAGES = Object.freeze(["rust", "c", "cpp"]);
export const NATIVE_STRUCTURE_STATUSES = Object.freeze(["clean", "mismatch", "unchecked"]);
const STATUS_KEYS = ["completed", ...NATIVE_STRUCTURE_STATUSES];

function blankBucket() {
  return { completed: 0, clean: 0, mismatch: 0, unchecked: 0 };
}

/** Input measurements remain in memory. Output contains only counts and fixed names. */
export function summarizeNativeStructure(results) {
  if (!Array.isArray(results)) throw Error("invalid-native-structure-input");
  const byLanguage = Object.fromEntries(
    NATIVE_STRUCTURE_LANGUAGES.map(language => [language, blankBucket()])
  );
  for (const item of results) {
    if (!item || !item.ok || !Object.hasOwn(byLanguage, item.language)) continue;
    const status = item.nativeStructureOutcome === undefined
      ? "unchecked" : item.nativeStructureOutcome;
    if (!NATIVE_STRUCTURE_STATUSES.includes(status)) {
      throw Error("invalid-native-structure-status");
    }
    byLanguage[item.language].completed++;
    byLanguage[item.language][status]++;
  }
  const sum = key => Object.values(byLanguage).reduce((total, bucket) => total + bucket[key], 0);
  return {
    method: NATIVE_STRUCTURE_METHOD,
    completed: sum("completed"),
    clean: sum("clean"),
    mismatch: sum("mismatch"),
    unchecked: sum("unchecked"),
    byLanguage
  };
}

const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
const count = value => Number.isSafeInteger(value) && value >= 0 && value <= 500;
const exactKeys = (value, names) => isObject(value) &&
  Object.keys(value).length === names.length &&
  Object.keys(value).every(key => names.includes(key));

/**
 * Validate an untrusted synthetic benchmark report before comparison.
 * The single aggregate format flag must equal the mismatch count.
 * Fail-closed instead of reporting unchecked samples as clean.
 */
export function validateNativeStructureReport(raw, perLanguage, mismatchSignal) {
  if (!exactKeys(raw, ["method", ...STATUS_KEYS, "byLanguage"]) ||
      raw.method !== NATIVE_STRUCTURE_METHOD ||
      !exactKeys(raw.byLanguage, NATIVE_STRUCTURE_LANGUAGES) ||
      !STATUS_KEYS.every(key => count(raw[key])) ||
      !count(mismatchSignal)) throw Error("invalid-native-structure-report");

  const byLanguage = {};
  for (const language of NATIVE_STRUCTURE_LANGUAGES) {
    const bucket = raw.byLanguage[language];
    if (!exactKeys(bucket, STATUS_KEYS) || !STATUS_KEYS.every(key => count(bucket[key])) ||
        bucket.completed !== perLanguage[language]?.completed ||
        bucket.clean + bucket.mismatch + bucket.unchecked !== bucket.completed) {
      throw Error("invalid-native-structure-breakdown");
    }
    byLanguage[language] = Object.fromEntries(STATUS_KEYS.map(key => [key, bucket[key]]));
  }
  if (STATUS_KEYS.some(key =>
        NATIVE_STRUCTURE_LANGUAGES.reduce((sum, language) =>
          sum + byLanguage[language][key], 0) !== raw[key]) ||
      raw.clean + raw.mismatch + raw.unchecked !== raw.completed ||
      raw.mismatch !== mismatchSignal) {
    throw Error("inconsistent-native-structure-coverage");
  }
  return {
    method: NATIVE_STRUCTURE_METHOD,
    ...Object.fromEntries(STATUS_KEYS.map(key => [key, raw[key]])),
    byLanguage
  };
}
