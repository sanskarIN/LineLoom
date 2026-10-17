import { validateEndpoint } from "../settings/endpoint";
export interface OllamaModel { name: string; size?: number }
export interface GenerateInput {
  model: string; prompt: string; suffix?: string; numPredict: number;
  contextSize: number; temperature: number; keepAlive: string;
}
function endpointUrl(origin: string, endpoint: string): string {
  return validateEndpoint(origin).origin + endpoint;
}
async function readableResponse(response: Response): Promise<Response> {
  if (!response.ok) {
    let error = "Ollama returned HTTP " + response.status + ".";
    try {
      const body = await response.text();
      if (body.length < 500) error += " " + body;
    } catch { /* do not log raw prompts */ }
    throw new Error(error);
  }
  return response;
}
export async function listModels(origin: string, signal?: AbortSignal): Promise<OllamaModel[]> {
  const response = await readableResponse(await fetch(endpointUrl(origin, "/api/tags"), { signal }));
  const body: unknown = await response.json();
  if (!body || typeof body !== "object" || !("models" in body) || !Array.isArray(body.models)) throw new Error("Unexpected /api/tags response.");
  return body.models.filter((m: unknown): m is OllamaModel => Boolean(m && typeof m === "object" && "name" in m && typeof m.name === "string"));
}
export async function showModel(origin: string, model: string, signal?: AbortSignal): Promise<boolean> {
  const response = await fetch(endpointUrl(origin, "/api/show"), {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model }), signal
  });
  if (response.status === 404) return false;
  await readableResponse(response);
  return true;
}
/** Parse arbitrary NDJSON chunk boundaries; reject malformed streams and excessive output. */
export async function parseNdjson(
  stream: ReadableStream<Uint8Array>,
  signal?: AbortSignal
): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let carry = ""; let result = ""; let sawDone = false;
  function handle(line: string): void {
    if (!line.trim()) return;
    const data: unknown = JSON.parse(line);
    if (!data || typeof data !== "object") throw new Error("Invalid Ollama JSON event.");
    if ("error" in data && typeof data.error === "string") throw new Error(data.error);
    if ("response" in data && typeof data.response === "string") {
      result += data.response;
      if (result.length > 10_000) throw new Error("Ollama output exceeded safety limit.");
    }
    if ("done" in data && data.done === true) sawDone = true;
  }
  try {
    while (!sawDone) {
      if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
      const { done, value } = await reader.read();
      if (done) break;
      carry += decoder.decode(value, { stream: true });
      if (carry.length > 50_000) throw new Error("Invalid oversized Ollama event.");
      let newline = carry.indexOf("\n");
      while (newline >= 0) {
        handle(carry.slice(0, newline).trim());
        carry = carry.slice(newline + 1);
        newline = carry.indexOf("\n");
      }
    }
    carry += decoder.decode();
    if (!sawDone && carry.trim()) handle(carry.trim());
    if (!sawDone) throw new Error("Incomplete Ollama response stream.");
    return result;
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
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
    body: JSON.stringify(request), signal
  }));
  if (!response.body) throw new Error("Ollama did not provide a response stream.");
  return parseNdjson(response.body, signal);
}
