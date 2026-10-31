import assert from "node:assert/strict";
import test from "node:test";
import { consumeOllamaStream } from "./model-eval-stream.mjs";

const encoder = new TextEncoder();
function stream(chunks) {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(
        typeof chunk === "string" ? encoder.encode(chunk) : chunk
      );
      controller.close();
    }
  });
}
const entry = (response, done = false) => JSON.stringify({ model: "synthetic", response, done }) + "\n";

test("decodes ordinary Ollama NDJSON and captures first-token timing", async () => {
  const result = await consumeOllamaStream(stream([
    entry("ab"), entry("cd"), entry("", true)
  ]), 100, () => 125);
  assert.deepEqual(result, { output: "abcd", firstTokenMs: 25, tokenUsage: null });
});

test("handles unicode codepoint divided over transport chunks", async () => {
  const bytes = encoder.encode(entry("🚀", true));
  const emoji = encoder.encode("🚀");
  const at = bytes.findIndex((v, i) => bytes.slice(i, i + emoji.length).every((n, j) => n === emoji[j]));
  assert.ok(at >= 0);
  const result = await consumeOllamaStream(stream([
    bytes.slice(0, at + 2), bytes.slice(at + 2)
  ]), 5, () => 15);
  assert.deepEqual(result, { output: "🚀", firstTokenMs: 10, tokenUsage: null });
});

test("allows a final complete NDJSON object without a trailing newline", async () => {
  const body = JSON.stringify({ response: "42;", done: true });
  const result = await consumeOllamaStream(stream([body]), 0, () => 7);
  assert.deepEqual(result, { output: "42;", firstTokenMs: 7, tokenUsage: null });
});

test("rejects incomplete, malformed or server-error responses", async () => {
  for (const data of [
    [entry("no final flag", false)],
    ['{"response":'],
    ['{"response":3,"done":true}\n'],
    ['{"response":"ok","done":"yes"}\n'],
    ['{"error":"private path data","done":true}\n'],
    ['{"response":"ok","done":true}\n{"response":"extra","done":true}\n'],
    ['{"response":"ok","done":true}\n{"oops":']
  ]) {
    await assert.rejects(consumeOllamaStream(stream(data), 0, () => 1));
  }
});

test("rejects extra frames even when they arrive after the terminal chunk", async () => {
  for (const later of [
    entry("surprise", true),
    '{"error":"sensitive error body"}\\n',
    '{"response":"private source fragment"',
    "unexpected-data"
  ]) {
    await assert.rejects(
      consumeOllamaStream(stream([entry("accepted", true), later.replaceAll("\\n", "\n")]), 0, () => 1),
      error => {
        assert.equal(error.message, "trailing-frames");
        assert.ok(!error.message.includes("sensitive"));
        assert.ok(!error.message.includes("private"));
        return true;
      }
    );
  }
});

test("allows only trailing whitespace after a complete terminal event", async () => {
  const result = await consumeOllamaStream(
    stream([entry("safe", true), "  \n\t\n", " \t"]), 0, () => 1
  );
  assert.deepEqual(result, { output: "safe", firstTokenMs: 1, tokenUsage: null });
});

test("aborts a server that never closes its stream after the terminal frame", async () => {
  let cancelled = false;
  const body = new ReadableStream({
    start(controller) { controller.enqueue(encoder.encode(entry("safe", true))); },
    cancel() { cancelled = true; }
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5);
  try {
    await assert.rejects(consumeOllamaStream(body, 0, () => 1, controller.signal),
      /evaluation-aborted/);
    assert.equal(cancelled, true);
  } finally {
    clearTimeout(timeout);
  }
});

test("rejects invalid UTF-8 rather than silently altering generated source", async () => {
  await assert.rejects(consumeOllamaStream(stream([
    Uint8Array.of(0xff, 0x0a)
  ]), 0, () => 1));
  await assert.rejects(consumeOllamaStream(stream([
    Uint8Array.of(0xe2, 0x82)
  ]), 0, () => 1));
});

test("stops overly large model outputs and overlong streamed records", async () => {
  await assert.rejects(consumeOllamaStream(stream([
    entry("x".repeat(8193), true)
  ]), 0, () => 1));
  await assert.rejects(consumeOllamaStream(stream([
    "z".repeat(65537)
  ]), 0, () => 1));
});

test("rejects excess NDJSON frames even with individually short valid lines", async () => {
  const lines = Array.from({ length: 513 }, () => entry("", false));
  lines.push(entry("", true));
  await assert.rejects(consumeOllamaStream(stream(lines), 0, () => 1));
});


test("accepts bounded Ollama terminal token counters without logging output", async () => {
  const body = JSON.stringify({
    response: "private generated text", done: true,
    eval_count: 17, eval_duration: 250_000_000,
    prompt_eval_count: 65, total_duration: 1_000_000_000
  }) + "\n";
  const result = await consumeOllamaStream(stream([body]), 0, () => 25);
  assert.deepEqual(result.tokenUsage, {
    generatedTokens: 17, generationDurationNs: 250_000_000
  });
  assert.equal(result.firstTokenMs, 25);
  assert.ok(!JSON.stringify(result.tokenUsage).includes("private"));
});

test("incomplete, malformed or unsafe terminal counters fail closed without source", async () => {
  const invalid = [
    { eval_count: 5 },
    { eval_duration: 1_000 },
    { eval_count: -1, eval_duration: 1_000 },
    { eval_count: "5", eval_duration: 1_000 },
    { eval_count: 5, eval_duration: 0 },
    { eval_count: 0, eval_duration: 5 },
    { eval_count: 4097, eval_duration: 1_000 },
    { eval_count: 5, eval_duration: Number.MAX_SAFE_INTEGER },
    { eval_count: true, eval_duration: 50 },
  ];
  for (const fields of invalid) {
    const line = JSON.stringify({
      response: "PRIVATE_OUTPUT", done: true, ...fields
    }) + "\n";
    await assert.rejects(consumeOllamaStream(stream([line]), 0, () => 1), err => {
      assert.ok(!String(err).includes("PRIVATE_OUTPUT"));
      return true;
    });
  }
});

test("a terminal frame without optional token metadata remains explicitly unchecked", async () => {
  const result = await consumeOllamaStream(stream([
    JSON.stringify({ response: "abc", done: true }) + "\n"
  ]), 0, () => 1);
  assert.equal(result.tokenUsage, null);
});
