import assert from "node:assert/strict";
import { test } from "node:test";
import { localOrigin, parseOptions, runLocalSmoke } from "./qa-local-ollama.mjs";

const model = "qwen2.5-coder:1.5b";
function localFetch({ models = [{ name: model }], generation = '{"response":" + b","done":true}\n' } = {}) {
  const calls = [];
  const request = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("/api/tags")) return new Response(JSON.stringify({ models }));
    if (url.endsWith("/api/generate")) return new Response(generation);
    throw new Error("Unexpected request");
  };
  return { calls, request };
}

test("requires an explicit --run and named installed model before any network access", () => {
  assert.throws(() => parseOptions(["--model", model]), /No requests made/);
  assert.throws(() => parseOptions(["--run"]), /Specify a valid/);
  assert.throws(() => parseOptions(["--run", "--model", "bad\nname"]), /Specify a valid/);
  assert.equal(parseOptions(["--run", "--model", model]).model, model);
});

test("allows only plain local HTTP origin; refuses remote URLs and credentials", () => {
  for (const endpoint of [
    "https://example.org", "http://192.168.1.10:11434", "http://user:password@127.0.0.1:11434",
    "http://127.0.0.1:11434/path", "http://127.0.0.1:11434/?token=abc",
    "https://127.0.0.1:11434", "file:///tmp/sample"
  ]) assert.throws(() => localOrigin(endpoint), /loopback|Invalid/);
  assert.equal(localOrigin("http://127.0.0.1:11434"), "http://127.0.0.1:11434");
  assert.equal(localOrigin("http://[::1]:11434"), "http://[::1]:11434");
});

test("checks installed model and sends only fixed synthetic fixture, never logs generated source", async () => {
  const { request, calls } = localFetch();
  const output = await runLocalSmoke({ model, fetchImpl: request });
  assert.equal(output.status, "pass");
  assert.equal(output.completionCharacters, 4);
  assert.equal(output.fixture, "public-synthetic");
  assert.equal(calls.length, 2);
  for (const call of calls) assert.equal(call.init.redirect, "error");
  const body = JSON.parse(calls[1].init.body);
  assert.match(body.prompt, /lineloom_public_example_sum/);
  assert.equal(body.stream, true);
  assert.equal(body.model, model);
  assert.doesNotMatch(JSON.stringify(output), /return |\+ b/);
});

test("refuses unknown installed model before making a completion request", async () => {
  const { request, calls } = localFetch({ models: [{ name: "another:latest" }] });
  await assert.rejects(runLocalSmoke({ model, fetchImpl: request }), /not installed/);
  assert.equal(calls.length, 1);
});

test("fails closed on malformed, incomplete, empty and error streams", async () => {
  for (const generation of [
    '{"response":"x"}\n', '{"done":true}\n', "garbage\n",
    '{"error":"private data must never appear"}\n',
    '{"response":"x","done":"yes"}\n'
  ]) {
    const { request } = localFetch({ generation });
    await assert.rejects(runLocalSmoke({ model, fetchImpl: request }), /Local Ollama|Invalid local/);
  }
});

test("rejects unexpectedly large model catalogs and oversized generation events", async () => {
  let mock = localFetch({ models: [{ name: model, blob: "x".repeat(260_000) }] });
  await assert.rejects(runLocalSmoke({ model, fetchImpl: mock.request }), /safety limit/);
  assert.equal(mock.calls.length, 1);
  mock = localFetch({ generation: '{"response":"' + "x".repeat(50_001) });
  await assert.rejects(runLocalSmoke({ model, fetchImpl: mock.request }), /safety limit/);
});
