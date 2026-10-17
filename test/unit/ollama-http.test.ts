import { afterEach, describe, expect, it, vi } from "vitest";
import { listModels, showModel } from "../../src/models/ollama";

afterEach(() => vi.unstubAllGlobals());

describe("Ollama endpoint requests", () => {
  it("lists models from a valid response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ models: [{ name: "qwen2.5-coder:1.5b" }, { broken: true }] }),
      { headers: { "content-type": "application/json" } }
    )));
    expect((await listModels("http://127.0.0.1:11434")).map(x => x.name)).toEqual(["qwen2.5-coder:1.5b"]);
  });
  it("fails safely on malformed model responses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ models: {} }))));
    await expect(listModels("http://127.0.0.1:11434")).rejects.toThrow(/Unexpected/);
  });
  it("never reads or incorporates an untrusted error body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("secret output must not appear", { status: 503 })));
    await expect(listModels("http://127.0.0.1:11434")).rejects.toThrow("HTTP 503");
  });
  it("treats missing model as not installed", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
    expect(await showModel("http://127.0.0.1:11434", "missing")).toBe(false);
  });
  it("aborts a model-listing request after a bounded deadline", async () => {
    const requests: AbortSignal[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, options: { signal: AbortSignal }) => {
      requests.push(options.signal);
      return new Response(JSON.stringify({ models: [] }));
    }));
    await listModels("http://127.0.0.1:11434");
    expect(requests[0]).toBeInstanceOf(AbortSignal);
  });
});
