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
    await expect(parseNdjson(stream(['{"error":"sensitive server response"}\n']))).rejects.toThrow(/generation error/);
  });
  it("supports split multibyte UTF-8 across stream chunks", async () => {
    const bytes = new TextEncoder().encode('{"response":"🚀","done":false}\n{"done":true}\n');
    const emoji = new TextEncoder().encode("🚀");
    const index = bytes.findIndex((b, i) => b === emoji[0] && bytes[i + 1] === emoji[1]);
    const streamBytes = new ReadableStream<Uint8Array>({ start(controller) {
      controller.enqueue(bytes.slice(0, index + 1));
      controller.enqueue(bytes.slice(index + 1));
      controller.close();
    } });
    expect(await parseNdjson(streamBytes)).toBe("🚀");
  });
  it("interrupts a stalled stream when cancelled", async () => {
    const controller = new AbortController();
    const stalled = new ReadableStream<Uint8Array>({ start() {} });
    const pending = parseNdjson(stalled, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
  it("rejects excessive generated output", async () => {
    const huge = JSON.stringify({ response: "x".repeat(10_001), done: true }) + "\n";
    await expect(parseNdjson(stream([huge]))).rejects.toThrow(/safety limit/);
  });
  it("does not echo raw remote server error text", async () => {
    await expect(parseNdjson(stream(['{"error":"password=do-not-repeat"}\n']))).rejects.toThrow("generation error");
  });

  it("rejects streams that transfer too many bytes without producing code", async () => {
    await expect(parseNdjson(stream(["\n".repeat(1_000_001)]))).rejects.toThrow(/stream exceeded safety limit/);
  });
  it("rejects excessive numbers of tiny NDJSON events", async () => {
    const events = Array.from({ length: 4_097 }, () => '{"done":false}\n').join("");
    await expect(parseNdjson(stream([events]))).rejects.toThrow(/event count exceeded safety limit/);
  });
  it("accepts many small events in one large transport chunk", async () => {
    const events = '{"response":"x","done":false}\n'.repeat(1_800) + '{"done":true}\n';
    const result = await parseNdjson(stream([events]));
    expect(result).toHaveLength(1_800);
  });
  it("rejects a single oversized incomplete JSON event", async () => {
    const chunk = '{"response":"' + "z".repeat(50_001);
    await expect(parseNdjson(stream([chunk]))).rejects.toThrow(/oversized Ollama event/);
  });
  it("fails closed on malformed response and status event types", async () => {
    await expect(parseNdjson(stream(['{"response":42,"done":false}\n']))).rejects.toThrow(/Invalid Ollama response event/);
    await expect(parseNdjson(stream(['{"done":"true"}\n']))).rejects.toThrow(/Invalid Ollama completion status/);
    await expect(parseNdjson(stream(['[]\n']))).rejects.toThrow(/Invalid Ollama JSON event/);
  });
  it("accepts valid final events with completion text", async () => {
    expect(await parseNdjson(stream(['{"response":"ok","done":true}\n']))).toBe("ok");
  });

  it("rejects malformed UTF-8 inside generated source instead of inserting replacement characters", async () => {
    const prefix = new TextEncoder().encode('{"response":"');
    const suffix = new TextEncoder().encode('","done":true}' + "\n");
    const corrupt = new ReadableStream<Uint8Array>({ start(controller) {
      controller.enqueue(prefix);
      controller.enqueue(Uint8Array.from([0xff]));
      controller.enqueue(suffix);
      controller.close();
    } });
    await expect(parseNdjson(corrupt)).rejects.toThrow("Invalid Ollama UTF-8 response.");
  });

  it("rejects truncated multi-byte UTF-8 even when the stream ends", async () => {
    const bytes = new TextEncoder().encode('{"response":"');
    const truncated = new ReadableStream<Uint8Array>({ start(controller) {
      controller.enqueue(bytes);
      controller.enqueue(Uint8Array.from([0xf0, 0x9f]));
      controller.close();
    } });
    await expect(parseNdjson(truncated)).rejects.toThrow("Invalid Ollama UTF-8 response.");
  });

  it("rejects extra buffered events after a terminal frame without exposing them", async () => {
    const cases = [
      '{"response":"ok","done":true}\\n{"error":"private-error"}\\n',
      '{"response":"ok","done":true}\\n{"response":"another","done":true}\\n',
      '{"response":"ok","done":true}\\n{"response":"unfinished"',
      '{"response":"ok","done":true}\\nnot-json',
      '{"response":"ok","done":true}\\n\\n{"done":false}\\n'
    ];
    for (const input of cases) {
      const payload = input.replaceAll("\\n", "\n");
      await expect(parseNdjson(stream([payload]))).rejects.toThrow("Invalid trailing Ollama event.");
    }
  });
  it("accepts terminal frames with harmless whitespace and without a final newline", async () => {
    expect(await parseNdjson(stream(['{"response":"ok","done":true}']))).toBe("ok");
    expect(await parseNdjson(stream(['{"response":"ok","done":true}\\n   \t\\n'.replaceAll("\\n", "\n")]))).toBe("ok");
  });
  it("returns a completed generation even if the stream never resolves cancel()", async () => {
    let cancellationStarted = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"response":"safe","done":true}\\n'.replaceAll("\\n", "\n")));
      },
      cancel() {
        cancellationStarted = true;
        return new Promise<void>(() => { /* Simulate a permanently stalled transport. */ });
      }
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("stream-cancel-stalled")), 500);
      });
      expect(await Promise.race([parseNdjson(body), timeout])).toBe("safe");
    } finally {
      if (timer) clearTimeout(timer);
    }
    expect(cancellationStarted).toBe(true);
  });

  it("does not mask a malformed stream error behind stalled cancellation", async () => {
    let cancellationStarted = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("private-invalid-json\n"));
      },
      cancel() {
        cancellationStarted = true;
        return new Promise<void>(() => {});
      }
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("stream-cancel-stalled")), 500);
      });
      await expect(Promise.race([parseNdjson(body), timeout])).rejects.toThrow(SyntaxError);
    } finally {
      if (timer) clearTimeout(timer);
    }
    expect(cancellationStarted).toBe(true);
  });

  it("cancels a live stream promptly after terminal completion without waiting for EOF", async () => {
    let cancelled = false;
    const pending = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"response":"ok","done":true}\\n'.replaceAll("\\n", "\n")));
        // Keep the source open: a waiting-for-EOF parser would hang.
      },
      cancel() { cancelled = true; }
    });
    expect(await parseNdjson(pending)).toBe("ok");
    expect(cancelled).toBe(true);
  });

});
