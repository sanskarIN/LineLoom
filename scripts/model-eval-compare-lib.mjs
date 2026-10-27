/**
 * Pure, source-free comparison of two reports emitted by model-eval.mjs.
 *
 * Never reproduce user-provided JSON fields, model tags, paths or responses.
 * Reject incompatible reports instead of manufacturing percentages over
 * different fixture sets, run counts or prompting protocols.
 */
import { readFileSync } from "node:fs";
import {
  EVAL_BENCHMARK_PROTOCOL, EVAL_LANGUAGES, EVAL_CATEGORIES,
  validateFixtures, fixtureSetSha256, requestSpecSha256
} from "./model-eval-lib.mjs";
import { FORMAT_SIGNAL_NAMES } from "./model-eval-quality.mjs";

/**
 * Reconstruct the only scopes exposed by the evaluator from the fixed
 * checked-in public manifest. Hash agreement between two arbitrary reports
 * alone is not proof that they used our reviewed synthetic fixtures.
 * This is NOT an attestation of an actual model run or model identity.
 */
function buildReviewedScopes() {
  const fixtures = validateFixtures(JSON.parse(readFileSync(
    new URL("../model/fixtures/completion-v1.json", import.meta.url), "utf8"
  )));
  const scopes = new Map();
  for (const language of ["all", ...EVAL_LANGUAGES]) {
    for (const category of ["all", ...EVAL_CATEGORIES]) {
      const selected = fixtures.filter(item =>
        (language === "all" || item.language === language) &&
        (category === "all" || item.category === category));
      if (!selected.length) continue;
      const fingerprint = fixtureSetSha256(selected);
      const languageCounts = Object.fromEntries(EVAL_LANGUAGES.map(id => [
        id, selected.filter(item => item.language === id).length
      ]));
      const categoryCounts = Object.fromEntries(EVAL_CATEGORIES.map(id => [
        id, selected.filter(item => item.category === id).length
      ]));
      for (const mode of ["fim", "instruction"]) {
        scopes.set([fingerprint, requestSpecSha256(selected, mode), mode].join(":"),
          { count: selected.length, languageCounts, categoryCounts });
      }
    }
  }
  return scopes;
}
const REVIEWED_SCOPES = buildReviewedScopes();
const isObject = v => v !== null && typeof v === "object" && !Array.isArray(v);
const integer = (v, min = 0, max = 1_000_000) =>
  Number.isSafeInteger(v) && v >= min && v <= max;
const latency = value => value === null ||
  (integer(value, 0, 1_000_000_000));

function validateBreakdown(raw, names, totalAttempts, completed, strictMatches) {
  if (!isObject(raw) || Object.keys(raw).length !== names.length ||
      Object.keys(raw).some(key => !names.includes(key))) throw Error("invalid-breakdown");
  const out = {};
  for (const name of names) {
    const entry = raw[name];
    if (!isObject(entry) || !integer(entry.attempts) ||
        !integer(entry.completed) || !integer(entry.strictMatches) ||
        entry.strictMatches > entry.completed ||
        entry.completed > entry.attempts) throw Error("invalid-breakdown");
    out[name] = { attempts: entry.attempts, completed: entry.completed, strictMatches: entry.strictMatches };
  }
  const sum = key => Object.values(out).reduce((acc, v) => acc + v[key], 0);
  if (sum("attempts") !== totalAttempts || sum("completed") !== completed ||
      sum("strictMatches") !== strictMatches) throw Error("inconsistent-breakdown");
  return out;
}

/** Builds a completely allowlisted report; unknown raw strings are discarded. */
export function validateComparableReport(raw) {
  if (!isObject(raw) || raw.benchmarkProtocol !== EVAL_BENCHMARK_PROTOCOL ||
      !/^[a-f0-9]{64}$/.test(raw.fixtureSetSha256 ?? "") ||
      !/^[a-f0-9]{64}$/.test(raw.requestSpecSha256 ?? "") ||
      !["fim", "instruction"].includes(raw.mode) ||
      !integer(raw.syntheticFixtures, 1, 100) ||
      !integer(raw.runsPerFixture, 1, 5) ||
      !integer(raw.attempts, 1, 500) ||
      raw.attempts !== raw.syntheticFixtures * raw.runsPerFixture ||
      !integer(raw.completed) || !integer(raw.failed) ||
      !integer(raw.strictExactMatches) ||
      raw.completed + raw.failed !== raw.attempts ||
      raw.strictExactMatches > raw.completed) throw Error("invalid-benchmark-report");

  for (const key of ["completionP50Ms", "completionP95Ms", "firstTokenP50Ms", "firstTokenP95Ms"]) {
    if (!latency(raw[key])) throw Error("invalid-latency");
  }
  if (raw.completed === 0 && (raw.completionP50Ms !== null || raw.completionP95Ms !== null)) {
    throw Error("invalid-empty-latency");
  }
  if (raw.completed > 0 && (raw.completionP50Ms === null || raw.completionP95Ms === null)) {
    throw Error("missing-completion-latency");
  }
  for (const prefix of ["completion", "firstToken"]) {
    if (raw[prefix + "P50Ms"] !== null && raw[prefix + "P95Ms"] !== null &&
        raw[prefix + "P50Ms"] > raw[prefix + "P95Ms"]) throw Error("invalid-percentiles");
    if ((raw[prefix + "P50Ms"] === null) !== (raw[prefix + "P95Ms"] === null)) {
      throw Error("incomplete-percentiles");
    }
  }
  const format = raw.formatDiagnostics;
  if (!isObject(format) || !integer(format.inspectedCompleted) ||
      format.inspectedCompleted !== raw.completed ||
      !integer(format.completedWithoutFormatSignals) ||
      format.completedWithoutFormatSignals > raw.completed ||
      !isObject(format.signals) ||
      Object.keys(format.signals).length !== FORMAT_SIGNAL_NAMES.length ||
      Object.keys(format.signals).some(key => !FORMAT_SIGNAL_NAMES.includes(key)) ||
      !FORMAT_SIGNAL_NAMES.every(key => integer(format.signals[key]) && format.signals[key] <= raw.completed) ||
      (format.completedWithoutFormatSignals === raw.completed &&
        FORMAT_SIGNAL_NAMES.some(key => format.signals[key] !== 0)) ||
      (format.completedWithoutFormatSignals < raw.completed &&
        FORMAT_SIGNAL_NAMES.every(key => format.signals[key] === 0))) {
    throw Error("invalid-format-diagnostics");
  }
  const outcome = raw.fixtureOutcomes;
  if (!isObject(outcome) || ![
    "evaluated", "repeated", "exactAtLeastOnce", "exactEveryAttempt", "mixedExactOutcomes"
  ].every(k => integer(outcome[k]))) throw Error("invalid-outcomes");
  if (outcome.evaluated !== raw.syntheticFixtures ||
      outcome.repeated !== (raw.runsPerFixture > 1 ? raw.syntheticFixtures : 0) ||
      outcome.exactEveryAttempt > outcome.exactAtLeastOnce ||
      outcome.exactAtLeastOnce > raw.strictExactMatches ||
      outcome.exactEveryAttempt * raw.runsPerFixture > raw.strictExactMatches ||
      outcome.mixedExactOutcomes > outcome.repeated ||
      outcome.mixedExactOutcomes > outcome.exactAtLeastOnce ||
      (raw.runsPerFixture === 1 && outcome.exactAtLeastOnce !== outcome.exactEveryAttempt)) {
    throw Error("inconsistent-outcomes");
  }
  const scope = REVIEWED_SCOPES.get([
    raw.fixtureSetSha256, raw.requestSpecSha256, raw.mode
  ].join(":"));
  if (!scope || scope.count !== raw.syntheticFixtures) {
    throw Error("unrecognized-reviewed-scope");
  }
  const perLanguage = validateBreakdown(
    raw.perLanguage, EVAL_LANGUAGES, raw.attempts, raw.completed, raw.strictExactMatches
  );
  const perCategory = validateBreakdown(
    raw.perCategory, EVAL_CATEGORIES, raw.attempts, raw.completed, raw.strictExactMatches
  );
  if (EVAL_LANGUAGES.some(key =>
        perLanguage[key].attempts !== scope.languageCounts[key] * raw.runsPerFixture) ||
      EVAL_CATEGORIES.some(key =>
        perCategory[key].attempts !== scope.categoryCounts[key] * raw.runsPerFixture)) {
    throw Error("inconsistent-reviewed-scope-counts");
  }
  return {
    benchmarkProtocol: EVAL_BENCHMARK_PROTOCOL,
    fixtureSetSha256: raw.fixtureSetSha256,
    requestSpecSha256: raw.requestSpecSha256,
    mode: raw.mode,
    syntheticFixtures: raw.syntheticFixtures,
    runsPerFixture: raw.runsPerFixture,
    attempts: raw.attempts, completed: raw.completed,
    failed: raw.failed, strictExactMatches: raw.strictExactMatches,
    completionP50Ms: raw.completionP50Ms, completionP95Ms: raw.completionP95Ms,
    firstTokenP50Ms: raw.firstTokenP50Ms, firstTokenP95Ms: raw.firstTokenP95Ms,
    perLanguage, perCategory,
    formatDiagnostics: {
      inspectedCompleted: format.inspectedCompleted,
      completedWithoutFormatSignals: format.completedWithoutFormatSignals,
      signals: Object.fromEntries(FORMAT_SIGNAL_NAMES.map(key => [key, format.signals[key]]))
    },
    fixtureOutcomes: {
      evaluated: outcome.evaluated, repeated: outcome.repeated,
      exactAtLeastOnce: outcome.exactAtLeastOnce,
      exactEveryAttempt: outcome.exactEveryAttempt,
      mixedExactOutcomes: outcome.mixedExactOutcomes
    }
  };
}
const delta = (baseline, candidate) =>
  baseline === null || candidate === null ? null : candidate - baseline;
function selectedNumbers(report) {
  const { attempts, completed, failed, strictExactMatches,
    completionP50Ms, completionP95Ms, firstTokenP50Ms, firstTokenP95Ms } = report;
  return { attempts, completed, failed, strictExactMatches,
    completionP50Ms, completionP95Ms, firstTokenP50Ms, firstTokenP95Ms };
}

/** Review flags are diagnostic signals, not a release verdict or quality score.
 * Keep output entirely allowlisted; never repeat untrusted input strings. */
export function reviewSyntheticRegressions(baseline, candidate) {
  const flags = [];
  if (candidate.failed > baseline.failed) flags.push("more-failed-requests");
  if (candidate.strictExactMatches < baseline.strictExactMatches) flags.push("fewer-strict-matches");
  if (candidate.formatDiagnostics.completedWithoutFormatSignals <
      baseline.formatDiagnostics.completedWithoutFormatSignals) {
    flags.push("fewer-format-clean-completions");
  }
  const languagesWithFewerStrictMatches = EVAL_LANGUAGES.filter(language =>
    candidate.perLanguage[language].strictMatches <
    baseline.perLanguage[language].strictMatches);
  if (languagesWithFewerStrictMatches.length) flags.push("per-language-strict-regression");
  const increasedFormatSignals = FORMAT_SIGNAL_NAMES.filter(name =>
    candidate.formatDiagnostics.signals[name] > baseline.formatDiagnostics.signals[name]);
  if (increasedFormatSignals.length) flags.push("more-format-artifacts");
  // Total latency only counts completions, so flag substantial changes only
  // with equal finished counts and at least ten completed requests. This is
  // still descriptive; hardware and other process loads are not attested.
  const latencyComparable = baseline.completed === candidate.completed &&
    baseline.completed >= 10;
  if (latencyComparable && baseline.completionP95Ms !== null &&
      candidate.completionP95Ms !== null &&
      candidate.completionP95Ms - baseline.completionP95Ms >= 100 &&
      candidate.completionP95Ms >= baseline.completionP95Ms * 1.25) {
    flags.push("higher-completed-p95-latency");
  }
  return {
    status: flags.length ? "inspect-regressions" : "no-heuristic-regressions-detected",
    flags,
    languagesWithFewerStrictMatches,
    increasedFormatSignals,
    latencyComparable,
    interpretation: "Synthetic review signals only; not model quality, statistical significance or release approval."
  };
}
/**
 * Higher delta strict matches is not necessarily better code. Both mode and
 * fixture fingerprint must agree; environment/quantization cannot be checked
 * by this local-only tool and require independent review.
 */
export function compareModelReports(baselineRaw, candidateRaw) {
  const baseline = validateComparableReport(baselineRaw);
  const candidate = validateComparableReport(candidateRaw);
  if (baseline.fixtureSetSha256 !== candidate.fixtureSetSha256 ||
      baseline.requestSpecSha256 !== candidate.requestSpecSha256 ||
      baseline.benchmarkProtocol !== candidate.benchmarkProtocol ||
      baseline.mode !== candidate.mode ||
      baseline.syntheticFixtures !== candidate.syntheticFixtures ||
      baseline.runsPerFixture !== candidate.runsPerFixture ||
      baseline.attempts !== candidate.attempts ||
      EVAL_LANGUAGES.some(k => baseline.perLanguage[k].attempts !== candidate.perLanguage[k].attempts) ||
      EVAL_CATEGORIES.some(k => baseline.perCategory[k].attempts !== candidate.perCategory[k].attempts)) {
    throw Error("incompatible-fixture-scope");
  }
  return {
    regressionReview: reviewSyntheticRegressions(baseline, candidate),
    comparisonType: "controlled-synthetic-exact-match",
    benchmarkProtocol: EVAL_BENCHMARK_PROTOCOL,
    scopeVerified: true,
    mode: baseline.mode, syntheticFixtures: baseline.syntheticFixtures,
    runsPerFixture: baseline.runsPerFixture,
    baseline: selectedNumbers(baseline), candidate: selectedNumbers(candidate),
    candidateMinusBaseline: {
      completed: delta(baseline.completed, candidate.completed),
      failed: delta(baseline.failed, candidate.failed),
      strictExactMatches: delta(baseline.strictExactMatches, candidate.strictExactMatches),
      completionP50Ms: delta(baseline.completionP50Ms, candidate.completionP50Ms),
      completionP95Ms: delta(baseline.completionP95Ms, candidate.completionP95Ms),
      firstTokenP50Ms: delta(baseline.firstTokenP50Ms, candidate.firstTokenP50Ms),
      firstTokenP95Ms: delta(baseline.firstTokenP95Ms, candidate.firstTokenP95Ms)
    },
    perLanguageStrictMatchDelta: Object.fromEntries(EVAL_LANGUAGES.map(k =>
      [k, candidate.perLanguage[k].strictMatches - baseline.perLanguage[k].strictMatches])),
    perCategoryStrictMatchDelta: Object.fromEntries(EVAL_CATEGORIES.map(k =>
      [k, candidate.perCategory[k].strictMatches - baseline.perCategory[k].strictMatches])),
    completionFormatSignalDelta: Object.fromEntries(FORMAT_SIGNAL_NAMES.map(name =>
      [name, candidate.formatDiagnostics.signals[name] - baseline.formatDiagnostics.signals[name]])),
    completedWithoutFormatSignalDelta:
      candidate.formatDiagnostics.completedWithoutFormatSignals -
      baseline.formatDiagnostics.completedWithoutFormatSignals,
    warnings: [
      "Strict equality on original synthetic fixtures is not compile correctness, semantic quality, or editor acceptance.",
      "Request and fixture hashes match, including explicit settings, but server defaults, model checkpoint revision, hardware, quantization and runtime conditions require manual verification.",
      "Latency percentiles include only completed requests. Do not infer performance from few samples or unequal failure counts.",
      "Format signals are heuristic and overlapping, not evidence of compile correctness, safety or human usefulness.",
      "No real-model comparison was performed by the offline tool."
    ]
  };
}
