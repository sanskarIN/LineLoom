#!/usr/bin/env node
/**
 * Voluntary model comparison on ORIGINAL SYNTHETIC fixtures.
 * Only contacts localhost Ollama. Prints aggregate statistics, never code.
 */
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import {
  EVAL_LANGUAGES, EVAL_MODES, createRequest, normalizeGenerated,
  resolveMode, summarizeMeasurements, validateFixtures, validateModelTag
} from "./model-eval-lib.mjs";

function cli(argv) {
  const options = { model: "qwen2.5-coder:1.5b", runs: 1, mode: "auto", language: "all", dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--dry-run") { options.dryRun = true; continue; }
    if (!["--model", "--runs", "--mode", "--language"].includes(flag) || i + 1 >= argv.length) {
      throw new Error("Use --model TAG --runs 1..5 --mode auto|fim|instruction --language LANG|all [--dry-run]");
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
  }
  validateModelTag(options.model);
  return options;
}
/** Parse bounded Ollama NDJSON while respecting cancellation and split UTF-8 chunks. */
async function consumeStream(stream, start) {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let pending = "", output = "", firstTokenMs = null, done = false, byteCount = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      byteCount += chunk.value.byteLength;
      if (byteCount > 262144) throw new Error("stream-limit");
      pending += decoder.decode(chunk.value, { stream: true });
      if (pending.length > 65536) throw new Error("line-limit");
      let lineEnd;
      while ((lineEnd = pending.indexOf("\n")) !== -1) {
        const line = pending.slice(0, lineEnd).trim(); pending = pending.slice(lineEnd + 1);
        if (!line) continue;
        const payload = JSON.parse(line);
        if (typeof payload.error === "string") throw new Error("server-error");
        if (typeof payload.response === "string") {
          if (payload.response.length && firstTokenMs === null) firstTokenMs = performance.now() - start;
          output += payload.response;
          if (output.length > 8192) throw new Error("output-limit");
        }
        if (payload.done === true) { done = true; break; }
      }
      if (done) break;
    }
    // The final response must declare done, not silently accept a cut-off stream.
    if (!done) throw new Error("incomplete-stream");
    return { output, firstTokenMs };
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
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
    const parsed = await consumeStream(response.body, start);
    return {
      language: fixture.language, ok: true,
      exact: normalizeGenerated(parsed.output) === fixture.expected,
      firstTokenMs: parsed.firstTokenMs, totalMs: performance.now() - start
    };
  } catch {
    // Do not print request, source, endpoint details, exception text, or model response.
    return { language: fixture.language, ok: false, exact: false };
  } finally {
    clearTimeout(timeout);
  }
}
async function main() {
  const opts = cli(process.argv.slice(2));
  const fixtures = validateFixtures(JSON.parse(await readFile(
    fileURLToPath(new URL("../model/fixtures/completion-v1.json", import.meta.url)), "utf8"
  ))).filter(item => opts.language === "all" || item.language === opts.language);
  const mode = resolveMode(opts.model, opts.mode);
  if (opts.dryRun) {
    console.log(JSON.stringify({
      dryRun: true, model: opts.model, mode,
      targetLanguages: [...new Set(fixtures.map(item => item.language))],
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
