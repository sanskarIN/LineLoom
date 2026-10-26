import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { evaluateSyntheticFixture } from "./model-eval-runner.mjs";

const samples = JSON.parse(readFileSync(new URL("../model/fixtures/completion-v1.json", import.meta.url), "utf8"));
const fixture = samples.fixtures.find(x => x.id === "rust-arithmetic");
const encoder = new TextEncoder();
const frame = (response, done = false, extra = {}) =>
  JSON.stringify({ response, done, ...extra }) + "\n";
const stream = (...chunks) => new ReadableStream({
  start(controller) {
    for (const text of chunks) controller.enqueue(encoder.encode(text));
    controller.close();
  }
});
const goodResponse = (...chunks) => ({
  ok: true, status: 200, redirected: false,
  body: stream(...chunks)
});
const run = (transport, options = {}) => evaluateSyntheticFixture(
  fixture, "local-model:tag", "fim",
  { clock: () => 125, fetchImpl: transport, ...options }
);

test("uses fixed loopback URL and exact generation settings without exposing the model response", async () => {
  const result = await run(async (url, options) => {
    assert.equal(url, "http://127.0.0.1:11434/api/generate");
    assert.equal(options.method, "POST");
    assert.equal(options.redirect, "error");
    assert.equal(options.headers["content-type"], "application/json");
    assert.equal(options.signal.aborted, false);
    const body = JSON.parse(options.body);
    assert.deepEqual(body.options, { temperature: 0, num_predict: 64, num_ctx: 2048 });
    assert.equal(body.model, "local-model:tag");
    assert.equal(body.prompt, fixture.prefix);
    assert.equal(body.suffix, fixture.suffix);
    return goodResponse(frame(fixture.expected.slice(0, 1)), frame(fixture.expected.slice(1), true));
  });
  assert.equal(result.ok, true);
  assert.equal(result.exact, true);
  assert.equal(result.firstTokenMs, 0);
  assert.equal(result.totalMs, 0);
  assert.deepEqual(result.formatSignals, []);
  assert.ok(!JSON.stringify(result).includes("local-model:tag"));
  assert.ok(!Object.hasOwn(result, "output"));
});

test("reports nonmatching, markdown or hidden-control results as aggregate-only flags", async () => {
  const raw = "\x60\x60\x60rust\nlet flag = false;\u202e\n\x60\x60\x60";
  const result = await run(async () => goodResponse(frame(raw, true)));
  assert.equal(result.ok, true);
  assert.equal(result.exact, false);
  assert.ok(result.formatSignals.includes("markdownFence"));
  assert.ok(result.formatSignals.includes("unsafeUnicode"));
  assert.ok(!JSON.stringify(result).includes("let flag"));
  assert.ok(!JSON.stringify(result).includes("\u202e"));
});

test("rejects non-200, redirect, missing body, malformed stream and private server errors", async () => {
  for (const response of [
    { status: 206, ok: true, body: stream(frame("partial", true)) },
    { status: 200, ok: true, redirected: true, body: stream(frame("redirect", true)) },
    { status: 200, ok: true },
    goodResponse('{"error":"private/sensitive/path","done":true}\n'),
    goodResponse(frame("incomplete")),
    goodResponse('{"response":17,"done":true}\n')
  ]) {
    const result = await run(async () => response);
    assert.deepEqual(result, {
      fixtureId: fixture.id, language: fixture.language,
      category: fixture.category, ok: false, exact: false
    });
    assert.ok(!JSON.stringify(result).includes("private/sensitive/path"));
  }
});
test("HTTP exceptions do not echo user-supplied endpoint or generated error bodies", async () => {
  const result = await run(async () => { throw Error("private-token=https://example.invalid/secret"); });
  assert.equal(result.ok, false);
  assert.ok(!JSON.stringify(result).includes("secret"));
});

test("times out stalled fetch, passes the abort signal and returns source-free failure", async () => {
  let capturedSignal;
  const result = await run((_url, opts) => {
    capturedSignal = opts.signal;
    return new Promise((_resolve, reject) => {
      opts.signal.addEventListener("abort", () => reject(Error("private-transport-body")), { once: true });
    });
  }, { timeoutMs: 5 });
  assert.equal(capturedSignal.aborted, true);
  assert.equal(result.ok, false);
  assert.ok(!JSON.stringify(result).includes("private-transport-body"));
});

test("does not count a cancellation-racing successful mock as a completed measurement", async () => {
  const result = await run(async (_url, opts) => {
    // Even a custom transport that ignores abort cannot turn a timeout
    // into a strict match by returning a result after its deadline.
    await new Promise(resolve => opts.signal.addEventListener("abort", resolve, { once: true }));
    return goodResponse(frame(fixture.expected, true));
  }, { timeoutMs: 5 });
  assert.equal(result.ok, false);
  assert.ok(!Object.hasOwn(result, "firstTokenMs"));
});

test("invalid timeouts are rejected before transport or a timer is started", async () => {
  for (const timeoutMs of [0, -1, 12_001, Number.NaN, "5"]) {
    await assert.rejects(run(async () => {
      assert.fail("must not send a request");
    }, { timeoutMs }));
  }
});
