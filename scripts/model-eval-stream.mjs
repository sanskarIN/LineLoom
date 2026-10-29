import { performance } from "node:perf_hooks";

/**
 * Bounded, strictly decoded Ollama NDJSON reader for developer-run model tests.
 * No generated code, error payloads, prompts or paths are logged.
 * Accepts the final JSON line even when the server omits its trailing newline.
 * Unlike interactive ghost text, research runs require a clean EOF after the
 * terminal frame so that extra network chunks cannot skew measurements.
 */
export async function consumeOllamaStream(stream, started, clock = () => performance.now(), signal) {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const onAbort = () => { void reader.cancel().catch(() => undefined); };
  signal?.addEventListener("abort", onAbort, { once: true });
  let pending = "";
  let output = "";
  let firstTokenMs = null;
  let receivedBytes = 0;
  let frames = 0;
  let finished = false;

  const frame = (line) => {
    if (!line.trim()) return;
    if (finished) throw new Error("trailing-frames");
    frames++;
    if (frames > 512) throw new Error("frame-limit");
    const payload = JSON.parse(line);
    if (!payload || typeof payload !== "object" || Array.isArray(payload) ||
        payload.error !== undefined ||
        (payload.done !== undefined && typeof payload.done !== "boolean") ||
        (payload.response !== undefined && typeof payload.response !== "string")) {
      throw new Error("invalid-response");
    }
    if (payload.response?.length) {
      if (firstTokenMs === null) firstTokenMs = Math.max(0, clock() - started);
      output += payload.response;
      if (output.length > 8192) throw new Error("output-limit");
    }
    if (payload.done === true) finished = true;
  };

  try {
    while (true) {
      if (signal?.aborted) throw new Error("evaluation-aborted");
      const chunk = await reader.read();
      if (signal?.aborted) throw new Error("evaluation-aborted");
      if (chunk.done) {
        pending += decoder.decode();
        if (pending.trim()) {
          if (pending.length > 65536) throw new Error("line-limit");
          frame(pending);
          pending = "";
        }
        break;
      }
      receivedBytes += chunk.value.byteLength;
      if (receivedBytes > 262144) throw new Error("stream-limit");
      pending += decoder.decode(chunk.value, { stream: true });
      let lineEnd;
      while ((lineEnd = pending.indexOf("\n")) !== -1) {
        const line = pending.slice(0, lineEnd);
        pending = pending.slice(lineEnd + 1);
        if (line.length > 65536) throw new Error("line-limit");
        frame(line);
      }
      if (pending.length > 65536) throw new Error("line-limit");
    }
    if (!finished) throw new Error("incomplete-stream");
    return { output, firstTokenMs };
  } finally {
    signal?.removeEventListener("abort", onAbort);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
