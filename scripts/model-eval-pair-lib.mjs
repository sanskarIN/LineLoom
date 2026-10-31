/**
 * Opt-in, loopback-only paired evaluations on the same reviewed synthetic
 * FIM scope. No persistence, remote endpoints, private editor/workspace reads,
 * prompt/output logging, model downloads or shell calls.
 *
 * Runs complete passes and alternates model-first order across passes to
 * reduce (not remove) a fixed model-order bias. Model loading, cache state,
 * thermal effects and hardware identity are NOT attested.
 */
import { compareModelReports } from "./model-eval-compare-lib.mjs";
import {
  EVAL_LANGUAGES, EVAL_CATEGORIES, EVAL_BENCHMARK_PROTOCOL,
  validateModelTag, fixtureSetSha256, requestSpecSha256,
  summarizeMeasurements
} from "./model-eval-lib.mjs";
import { evaluateSyntheticFixture } from "./model-eval-runner.mjs";

const validMode = mode => mode === "fim" || mode === "instruction";

export function parsePairedOptions(args) {
  if (!Array.isArray(args) || args.length > 15) throw Error("invalid-pair-options");
  const config = { runs: 1, language: "all", category: "all", dryRun: false };
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === "--dry-run") {
      if (seen.has(flag)) throw Error("duplicate-pair-option");
      seen.add(flag);
      config.dryRun = true;
      continue;
    }
    if (!["--baseline", "--candidate", "--mode", "--runs", "--language", "--category"].includes(flag) ||
        seen.has(flag) || i + 1 >= args.length || args[i + 1].startsWith("--")) {
      throw Error("invalid-pair-option");
    }
    seen.add(flag);
    const value = args[++i];
    if (flag === "--baseline") config.baseline = validateModelTag(value);
    if (flag === "--candidate") config.candidate = validateModelTag(value);
    if (flag === "--mode") {
      if (!validMode(value)) throw Error("invalid-pair-mode");
      config.mode = value;
    }
    if (flag === "--runs") {
      if (!/^[1-5]$/.test(value)) throw Error("invalid-pair-runs");
      config.runs = Number(value);
    }
    if (flag === "--language") {
      if (value !== "all" && !EVAL_LANGUAGES.includes(value)) throw Error("invalid-pair-language");
      config.language = value;
    }
    if (flag === "--category") {
      if (value !== "all" && !EVAL_CATEGORIES.includes(value)) throw Error("invalid-pair-category");
      config.category = value;
    }
  }
  if (!config.baseline || !config.candidate || !validMode(config.mode)) {
    throw Error("missing-pair-model-or-mode");
  }
  return config;
}

export function selectedPairedFixtures(reviewed, opts) {
  if (!Array.isArray(reviewed) || reviewed.length < 1 ||
      !["all", ...EVAL_LANGUAGES].includes(opts.language) ||
      !["all", ...EVAL_CATEGORIES].includes(opts.category)) {
    throw Error("invalid-pair-scope");
  }
  const selected = reviewed.filter(item =>
    (opts.language === "all" || item.language === opts.language) &&
    (opts.category === "all" || item.category === opts.category)
  );
  if (!selected.length) throw Error("empty-pair-scope");
  return selected;
}

export function pairedDryRun(fixtures, opts) {
  if (!validMode(opts.mode) || !Number.isSafeInteger(opts.runs) || opts.runs < 1 || opts.runs > 5 ||
      !Array.isArray(fixtures) || !fixtures.length || fixtures.length > 100) {
    throw Error("invalid-pair-dry-run");
  }
  return {
    dryRun: true,
    benchmarkProtocol: EVAL_BENCHMARK_PROTOCOL,
    scopeFingerprint: fixtureSetSha256(fixtures),
    requestSpecSha256: requestSpecSha256(fixtures, opts.mode),
    promptMode: opts.mode,
    fixtureCount: fixtures.length,
    runsPerModel: opts.runs,
    requestsPerModel: fixtures.length * opts.runs,
    totalRequestsPlanned: fixtures.length * opts.runs * 2,
    runOrder: "alternating-full-pass-v1",
    networkCalls: 0
  };
}

/**
 * Descriptive head-to-head strict-match outcomes for the SAME synthetic
 * fixture and repetition. A request failure is neither a win nor a loss.
 * The ordinal pairing is verified before aggregating; model identifiers,
 * fixture IDs, completions and error payloads never enter the returned report.
 * Repeated runs are correlated and must not be treated as independent trials.
 */
export function summarizePairedStrictExact(fixtures, runs, measurements) {
  if (!Array.isArray(fixtures) || fixtures.length < 1 || fixtures.length > 100 ||
      !Number.isSafeInteger(runs) || runs < 1 || runs > 5 ||
      !Array.isArray(measurements) || measurements.length !== 2 ||
      !measurements.every(items => Array.isArray(items) && items.length === fixtures.length * runs)) {
    throw Error("invalid-paired-outcomes");
  }
  const empty = () => ({
    pairs: 0, comparablePairs: 0, candidateWins: 0, baselineWins: 0,
    bothExact: 0, neitherExact: 0, failedPairs: 0
  });
  const total = empty();
  const byLanguage = Object.fromEntries(EVAL_LANGUAGES.map(language => [language, empty()]));
  const byCategory = Object.fromEntries(EVAL_CATEGORIES.map(category => [category, empty()]));
  const seen = new Set();
  for (const fixture of fixtures) {
    if (!fixture || typeof fixture.id !== "string" || seen.has(fixture.id) ||
        !EVAL_LANGUAGES.includes(fixture.language) || !EVAL_CATEGORIES.includes(fixture.category)) {
      throw Error("invalid-paired-fixture");
    }
    seen.add(fixture.id);
  }
  for (let pass = 0; pass < runs; pass++) {
    for (let i = 0; i < fixtures.length; i++) {
      const fixture = fixtures[i];
      const offset = pass * fixtures.length + i;
      const a = measurements[0][offset];
      const b = measurements[1][offset];
      for (const result of [a, b]) {
        if (!result || result.fixtureId !== fixture.id ||
            result.language !== fixture.language || result.category !== fixture.category ||
            typeof result.ok !== "boolean" || typeof result.exact !== "boolean" ||
            (!result.ok && result.exact)) {
          throw Error("inconsistent-paired-result");
        }
      }
      const status = !a.ok || !b.ok ? "failedPairs"
        : a.exact && b.exact ? "bothExact"
        : a.exact ? "baselineWins"
        : b.exact ? "candidateWins" : "neitherExact";
      for (const bucket of [total, byLanguage[fixture.language], byCategory[fixture.category]]) {
        bucket.pairs++;
        if (status !== "failedPairs") bucket.comparablePairs++;
        bucket[status]++;
      }
    }
  }
  return { ...total, byLanguage, byCategory };
}

/** Test seam accepts only simulated, in-memory responses; CLI always uses real
 * evaluateSyntheticFixture and the fixed Ollama 127.0.0.1 endpoint. */
export async function runPairedSyntheticBenchmarks(fixtures, opts, evaluate = evaluateSyntheticFixture) {
  if (!Array.isArray(fixtures) || fixtures.length < 1 || fixtures.length > 100 ||
      !opts || typeof opts !== "object" || !Number.isSafeInteger(opts.runs) ||
      opts.runs < 1 || opts.runs > 5 || !validMode(opts.mode)) {
    throw Error("invalid-pair-run");
  }
  const models = [validateModelTag(opts.baseline), validateModelTag(opts.candidate)];
  const measurements = [[], []];
  // One full fixture pass per model, alternating which model runs first on
  // successive repetitions. Avoid per-fixture model swapping, which would
  // cause repeated unload/reload overhead on limited local hardware.
  for (let pass = 0; pass < opts.runs; pass++) {
    const order = pass % 2 === 0 ? [0, 1] : [1, 0];
    for (const index of order) {
      for (const fixture of fixtures) {
        const result = await evaluate(fixture, models[index], opts.mode);
        measurements[index].push(result);
      }
    }
  }
  const report = index => ({
    ...summarizeMeasurements(measurements[index], fixtures.length, models[index], opts.mode),
    benchmarkProtocol: EVAL_BENCHMARK_PROTOCOL,
    fixtureSetSha256: fixtureSetSha256(fixtures),
    requestSpecSha256: requestSpecSha256(fixtures, opts.mode),
    runsPerFixture: opts.runs
  });
  const baseline = report(0);
  const candidate = report(1);
  return {
    comparison: compareModelReports(baseline, candidate),
    pairedStrictExact: summarizePairedStrictExact(fixtures, opts.runs, measurements),
    runOrder: "alternating-full-pass-v1",
    requestsPerModel: fixtures.length * opts.runs,
    anyRequestFailed: baseline.failed > 0 || candidate.failed > 0,
    limitations: [
      "Only reviewed synthetic fixtures were tested; no user source was read.",
      "Sequential local model runs do not attest identical cold/warm cache conditions, hardware load, quantization, runtime configuration or model weights.",
      "Head-to-head strict-match wins are descriptive only; repeated fixtures are correlated, failed requests are not losses, and no significance or practical usefulness is inferred.",
      "Strict exact-match, lexical checks and token telemetry do not establish code usefulness, release approval or genuine first-party model training."
    ]
  };
}
