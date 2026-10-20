import { validateEndpoint } from "../settings/endpoint";
export interface OllamaModel { name: string; size?: number }
export interface GenerateInput {
  model: string; prompt: string; suffix?: string; numPredict: number;
  contextSize: number; temperature: number; keepAlive: string;
}
function endpointUrl(origin: string, endpoint: string): string {
  return validateEndpoint(origin).origin + endpoint;
}
function requestSignal(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(8_000);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}
async function readableResponse(response: Response): Promise<Response> {
  if (!response.ok) {
    // Do not consume or log an untrusted server's potentially unbounded error body.
    await response.body?.cancel().catch(() => undefined);
    throw new Error("Ollama returned HTTP " + response.status + ".");
  }
  return response;
}
export async function listModels(origin: string, signal?: AbortSignal): Promise<OllamaModel[]> {
  const response = await readableResponse(await fetch(endpointUrl(origin, "/api/tags"), { signal: requestSignal(signal), redirect: "error" }));
  const body: unknown = await readBoundedJson(response);
  if (!body || typeof body !== "object" || !("models" in body) || !Array.isArray(body.models)) throw new Error("Unexpected /api/tags response.");
  // The endpoint may be remote and untrusted. Model names flow into native
  // QuickPick UI and settings, so enforce a strict bounded Ollama tag shape.
  // Never display server-provided control characters, newlines or commands.
  const models: OllamaModel[] = [];
  const seen = new Set<string>();
  for (const entry of body.models) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const name: unknown = (entry as Record<string, unknown>).name;
    if (typeof name !== "string" || name.length > 128 ||
        !/^[A-Za-z0-9][A-Za-z0-9._/:@-]*$/.test(name) || seen.has(name)) continue;
    seen.add(name);
    const size: unknown = (entry as Record<string, unknown>).size;
    models.push(typeof size === "number" && Number.isSafeInteger(size) && size >= 0
      ? { name, size } : { name });
    if (models.length >= 512) break;
  }
  if (body.models.length > 0 && models.length === 0) {
    throw new Error("Ollama model list contained no valid model names.");
  }
  return models;
}
export async function showModel(origin: string, model: string, signal?: AbortSignal): Promise<boolean> {
  const response = await fetch(endpointUrl(origin, "/api/show"), {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model }), signal: requestSignal(signal), redirect: "error"
  });
  if (response.status === 404) {
    await response.body?.cancel().catch(() => undefined);
    return false;
  }
  await readableResponse(response);
  await response.body?.cancel().catch(() => undefined);
  return true;
}
/** Limit model discovery responses before parsing JSON from an untrusted endpoint. */
async function readBoundedJson(response: Response): Promise<unknown> {
  if (!response.body) throw new Error("Ollama returned an empty model list response.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let json = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 256_000) throw new Error("Ollama model list exceeded safety limit.");
      json += decoder.decode(value, { stream: true });
    }
    return JSON.parse(json + decoder.decode()) as unknown;
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
/** Parse arbitrary NDJSON chunk boundaries; reject malformed streams and excessive output. */
export async function parseNdjson(
  stream: ReadableStream<Uint8Array>,
  signal?: AbortSignal
): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const onAbort = (): void => { void reader.cancel().catch(() => undefined); };
  signal?.addEventListener("abort", onAbort, { once: true });
  let carry = ""; let result = ""; let sawDone = false;
  let streamedBytes = 0; let eventCount = 0;
  const MAX_STREAM_BYTES = 1_000_000;
  const MAX_EVENTS = 4_096;
  function handle(line: string): void {
    if (!line.trim()) return;
    if (++eventCount > MAX_EVENTS) throw new Error("Ollama event count exceeded safety limit.");
    const data: unknown = JSON.parse(line);
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("Invalid Ollama JSON event.");
    }
    // Never propagate raw server error strings: they may contain code or credentials.
    if ("error" in data) throw new Error("Ollama model reported a generation error.");
    if ("response" in data) {
      if (typeof data.response !== "string") throw new Error("Invalid Ollama response event.");
      result += data.response;
      if (result.length > 10_000) throw new Error("Ollama output exceeded safety limit.");
    }
    if ("done" in data) {
      if (typeof data.done !== "boolean") throw new Error("Invalid Ollama completion status.");
      if (data.done) sawDone = true;
    }
  }
  try {
    while (!sawDone) {
      if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
      const { done, value } = await reader.read();
      if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
      if (done) break;
      streamedBytes += value.byteLength;
      if (streamedBytes > MAX_STREAM_BYTES) throw new Error("Ollama stream exceeded safety limit.");
      carry += decoder.decode(value, { stream: true });
      let newline = carry.indexOf("\n");
      while (newline >= 0 && !sawDone) {
        // A transport chunk may contain many small events; limit each event,
        // not the aggregate decoded chunk, before processing delimiters.
        if (newline > 50_000) throw new Error("Invalid oversized Ollama event.");
        handle(carry.slice(0, newline).trim());
        carry = carry.slice(newline + 1);
        newline = carry.indexOf("\n");
      }
      if (!sawDone && carry.length > 50_000) throw new Error("Invalid oversized Ollama event.");
    }
    carry += decoder.decode();
    if (!sawDone && carry.trim()) handle(carry.trim());
    if (!sawDone) throw new Error("Incomplete Ollama response stream.");
    return result;
  } finally {
    signal?.removeEventListener("abort", onAbort);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
export async function generateCompletion(
  origin: string, input: GenerateInput, signal: AbortSignal
): Promise<string> {
  const request = {
    model: input.model, prompt: input.prompt, ...(input.suffix ? { suffix: input.suffix } : {}),
    stream: true, keep_alive: input.keepAlive,
    options: { num_predict: input.numPredict, num_ctx: input.contextSize, temperature: input.temperature }
  };
  const response = await readableResponse(await fetch(endpointUrl(origin, "/api/generate"), {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request), signal, redirect: "error"
  }));
  if (!response.body) throw new Error("Ollama did not provide a response stream.");
  return parseNdjson(response.body, signal);
}
