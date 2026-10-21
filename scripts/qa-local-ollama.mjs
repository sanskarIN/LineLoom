/**
 * Explicit, local-only Ollama smoke test. Never reads workspace files.
 * Deliberately NOT invoked automatically by CI, install, or extension startup.
 */
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

const PUBLIC_FIXTURE = "def lineloom_public_example_sum(a: int, b: int) -> int:\n    return ";
const DEFAULT_ENDPOINT = "http://127.0.0.1:11434";
const MAX_TAG_BYTES = 256_000;
const MAX_STREAM_BYTES = 1_000_000;

export function localOrigin(value = DEFAULT_ENDPOINT) {
  let url;
  try { url = new URL(value); } catch { throw new Error("Invalid local Ollama endpoint."); }
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname.toLowerCase()) ||
      url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Smoke tests are restricted to plain loopback HTTP origins without credentials or paths.");
  }
  return url.origin;
}

export function parseOptions(args) {
  const result = { run: false, help: false, model: "", endpoint: DEFAULT_ENDPOINT };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--run") result.run = true;
    else if (arg === "--help") result.help = true;
    else if (arg === "--model" || arg === "--endpoint") {
      if (!args[i + 1] || args[i + 1].startsWith("--")) throw new Error("Missing value for " + arg + ".");
      result[arg === "--model" ? "model" : "endpoint"] = args[++i];
    } else throw new Error("Unknown smoke-test argument.");
  }
  if (result.help) return result;
  if (!result.run) throw new Error("No requests made: pass --run to explicitly approve this local smoke test.");
  if (!result.model || result.model.length > 128 || !/^[A-Za-z0-9][A-Za-z0-9._/:@-]*$/.test(result.model)) {
    throw new Error("Specify a valid installed Ollama model with --model.");
  }
  result.endpoint = localOrigin(result.endpoint);
  return result;
}

async function boundedText(response, maxBytes, label) {
  if (!response.ok) throw new Error("Local Ollama " + label + " returned HTTP " + response.status + ".");
  if (!response.body) throw new Error("Local Ollama response has no body.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new Error("Local Ollama response exceeded safety limit.");
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

async function countStreamingCompletion(response) {
  if (!response.ok) throw new Error("Local Ollama generation returned HTTP " + response.status + ".");
  if (!response.body) throw new Error("Local Ollama generation returned no stream.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let carry = "";
  let characters = 0;
  let done = false;
  let events = 0;
  function accept(line) {
    if (!line.trim()) return;
    if (++events > 4096) throw new Error("Local Ollama event count exceeded safety limit.");
    let event;
    try { event = JSON.parse(line); } catch { throw new Error("Invalid local Ollama streaming event."); }
    if (!event || Array.isArray(event) || typeof event !== "object" || "error" in event) {
      throw new Error("Invalid local Ollama streaming event.");
    }
    if ("response" in event) {
      if (typeof event.response !== "string") throw new Error("Invalid local Ollama response event.");
      characters += event.response.length;
      if (characters > 10_000) throw new Error("Local Ollama output exceeded safety limit.");
    }
    if ("done" in event) {
      if (typeof event.done !== "boolean") throw new Error("Invalid local Ollama completion status.");
      if (event.done) done = true;
    }
  }
  try {
    while (!done) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_STREAM_BYTES) throw new Error("Local Ollama stream exceeded safety limit.");
      carry += decoder.decode(chunk.value, { stream: true });
      let newline = carry.indexOf("\n");
      while (newline >= 0 && !done) {
        if (newline > 50_000) throw new Error("Local Ollama event exceeded safety limit.");
        accept(carry.slice(0, newline));
        carry = carry.slice(newline + 1);
        newline = carry.indexOf("\n");
      }
      if (!done && carry.length > 50_000) throw new Error("Local Ollama event exceeded safety limit.");
    }
    if (!done && carry.trim()) accept(carry + decoder.decode());
    if (!done || characters === 0) throw new Error("Local Ollama did not produce a complete nonempty suggestion.");
    return characters;
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

/** Returns bounded metrics only. Does not print or persist generated code. */
export async function runLocalSmoke({ model, endpoint = DEFAULT_ENDPOINT, fetchImpl = fetch }) {
  const origin = localOrigin(endpoint);
  if (typeof model !== "string" || model.length > 128 || !/^[A-Za-z0-9][A-Za-z0-9._/:@-]*$/.test(model)) {
    throw new Error("A valid model name is required.");
  }
  const tags = await fetchImpl(origin + "/api/tags", {
    redirect: "error", signal: AbortSignal.timeout(8_000)
  });
  let catalog;
  try { catalog = JSON.parse(await boundedText(tags, MAX_TAG_BYTES, "model list")); }
  catch (error) {
    if (error instanceof SyntaxError) throw new Error("Invalid local Ollama model list.");
    throw error;
  }
  if (!catalog || !Array.isArray(catalog.models)) throw new Error("Invalid local Ollama model list.");
  if (!catalog.models.some((item) => item && typeof item === "object" && item.name === model)) {
    throw new Error("Requested model is not installed on this loopback Ollama instance. No models were downloaded.");
  }
  const started = performance.now();
  const generated = await fetchImpl(origin + "/api/generate", {
    method: "POST", redirect: "error", signal: AbortSignal.timeout(90_000),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model, prompt: PUBLIC_FIXTURE, stream: true, keep_alive: "1m",
      options: { num_predict: 32, num_ctx: 2048, temperature: 0 }
    })
  });
  const completionCharacters = await countStreamingCompletion(generated);
  return {
    status: "pass", mode: "local-only", fixture: "public-synthetic", model,
    platform: process.platform, arch: process.arch,
    completionCharacters, totalMs: Math.round(performance.now() - started)
  };
}

const usage = "Usage: npm run qa:ollama -- --run --model <installed-tag> [--endpoint http://127.0.0.1:11434]";
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const options = parseOptions(process.argv.slice(2));
    if (options.help) console.log(usage);
    else {
      const metrics = await runLocalSmoke(options);
      console.log(JSON.stringify(metrics, null, 2));
      console.log("Manual editor, cancellation, accessibility and upgrade QA are still required.");
    }
  } catch (error) {
    const safe = error instanceof Error && (
      error.message.startsWith("No requests made:") ||
      error.message.startsWith("Specify a valid") ||
      error.message.startsWith("Missing value") ||
      error.message.startsWith("Unknown smoke-test") ||
      error.message.startsWith("Smoke tests are restricted") ||
      error.message.startsWith("Invalid local") ||
      error.message.startsWith("Local Ollama") ||
      error.message.startsWith("Requested model is not installed")
    );
    console.error("LineLoom QA: " + (safe ? error.message : "Unable to complete local model test."));
    console.error(usage);
    process.exitCode = 1;
  }
}
