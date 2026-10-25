#!/usr/bin/env node
/**
 * Voluntary model comparison on ORIGINAL SYNTHETIC fixtures.
 * Only contacts localhost Ollama. Prints aggregate statistics, never code.
 */
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import {
  EVAL_LANGUAGES, EVAL_MODES, EVAL_CATEGORIES, createRequest, normalizeGenerated,
  resolveMode, summarizeMeasurements, validateFixtures, validateModelTag
} from "./model-eval-lib.mjs";
import { consumeOllamaStream } from "./model-eval-stream.mjs";

function cli(argv) {
  const options = { model: "qwen2.5-coder:1.5b", runs: 1, mode: "auto", language: "all", category: "all", dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--dry-run") { options.dryRun = true; continue; }
    if (!["--model", "--runs", "--mode", "--language", "--category"].includes(flag) || i + 1 >= argv.length) {
      throw new Error("Use --model TAG --runs 1..5 --mode auto|fim|instruction --language LANG|all --category CATEGORY|all [--dry-run]");
    }
    const value = argv[++i];
    if (flag === "--model") options.model = validateModelTag(value);
    if (flag === "--runs") {
      if (!/^[1-5]$/.test(value)) throw new Error("Runs must be 1 to 5");
      options.runs = Number(value);
    }
    if (flag === "--mode") {
      if (!EVAL_MODES.includes(value)) throw new Error("Unsupported prompt mode");
      options.mode = value;
    }
    if (flag === "--language") {
      if (value !== "all" && !EVAL_LANGUAGES.includes(value)) throw new Error("Unsupported language");
      options.language = value;
    }
    if (flag === "--category") {
      if (value !== "all" && !EVAL_CATEGORIES.includes(value)) throw new Error("Unsupported category");
      options.category = value;
    }
  }
  validateModelTag(options.model);
  return options;
}
async function evaluate(fixture, model, mode) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  const start = performance.now();
  try {
    const response = await fetch("http://127.0.0.1:11434/api/generate", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(createRequest(fixture, model, mode)),
      signal: controller.signal, redirect: "error"
    });
    if (!response.ok || !response.body) throw new Error("http-failed");
    const parsed = await consumeOllamaStream(response.body, start);
    return {
      language: fixture.language, category: fixture.category, ok: true,
      exact: normalizeGenerated(parsed.output) === fixture.expected,
      firstTokenMs: parsed.firstTokenMs, totalMs: performance.now() - start
    };
  } catch {
    // Do not print request, source, endpoint details, exception text, or model response.
    return { language: fixture.language, category: fixture.category, ok: false, exact: false };
  } finally {
    clearTimeout(timeout);
  }
}
async function main() {
  const opts = cli(process.argv.slice(2));
  const fixtures = validateFixtures(JSON.parse(await readFile(
    fileURLToPath(new URL("../model/fixtures/completion-v1.json", import.meta.url)), "utf8"
  ))).filter(item => (opts.language === "all" || item.language === opts.language) &&
    (opts.category === "all" || item.category === opts.category));
  const mode = resolveMode(opts.model, opts.mode);
  if (fixtures.length === 0) throw new Error("No matching fixtures");
  if (opts.dryRun) {
    console.log(JSON.stringify({
      dryRun: true, model: opts.model, mode,
      targetLanguages: [...new Set(fixtures.map(item => item.language))],
      targetCategories: [...new Set(fixtures.map(item => item.category))],
      fixtureIds: fixtures.map(item => item.id), requestsPlanned: fixtures.length * opts.runs,
      networkCalls: 0
    }, null, 2));
    return;
  }
  const measurements = [];
  for (let i = 0; i < opts.runs; i++) {
    for (const fixture of fixtures) measurements.push(await evaluate(fixture, opts.model, mode));
  }
  console.log(JSON.stringify(summarizeMeasurements(
    measurements, fixtures.length, opts.model, mode
  ), null, 2));
  if (measurements.some(item => !item.ok)) process.exitCode = 1;
}
await main().catch(() => {
  // Error text may include user-supplied arguments or an unintended filesystem path.
  console.error("Model evaluation could not start. Check benchmark options and manifest.");
  process.exitCode = 1;
});
