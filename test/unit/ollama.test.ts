import { describe, expect, it } from "vitest";
import { parseNdjson } from "../../src/models/ollama";
function stream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({ start(controller) {
    for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
    controller.close();
  } });
}
describe("Ollama streaming NDJSON", () => {
  it("parses events split between arbitrary byte chunks", async () => {
    const result = await parseNdjson(stream(['{"response":"hello","done":false}\n{"res', 'ponse":" world","done":false}\n{"done":true}\n']));
    expect(result).toBe("hello world");
  });
  it("rejects malformed JSON", async () => {
    await expect(parseNdjson(stream(["not-json\n"]))).rejects.toThrow();
  });
  it("rejects truncated streams", async () => {
    await expect(parseNdjson(stream(['{"response":"hi"}\n']))).rejects.toThrow(/Incomplete/);
  });
  it("reports an explicit model error", async () => {
    await expect(parseNdjson(stream(['{"error":"model missing"}\n']))).rejects.toThrow(/model missing/);
  });
});
