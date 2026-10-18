import { afterEach, describe, expect, it, vi } from "vitest";
import { generateCompletion, listModels, showModel } from "../../src/models/ollama";

afterEach(() => vi.unstubAllGlobals());

describe("Ollama endpoint requests", () => {
  it("rejects overlarge model-list responses without parsing them", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ models: ["x".repeat(260_000)] }))));
    await expect(listModels("http://127.0.0.1:11434")).rejects.toThrow(/safety limit/);
  });
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
  it("never follows redirects during discovery, model lookup or source completion", async () => {
    const fetchMock = vi.fn(async (url: string, options: RequestInit) => {
      expect(options.redirect).toBe("error");
      if (url.endsWith("/api/tags")) return new Response(JSON.stringify({ models: [] }));
      if (url.endsWith("/api/show")) return new Response(JSON.stringify({ details: {} }));
      if (url.endsWith("/api/generate")) {
        return new Response('{"response":"safe","done":true}\n');
      }
      throw new Error("Unexpected endpoint");
    });
    vi.stubGlobal("fetch", fetchMock);
    const origin = "http://127.0.0.1:11434";
    expect(await listModels(origin)).toEqual([]);
    expect(await showModel(origin, "example")).toBe(true);
    expect(await generateCompletion(origin, {
      model: "example", prompt: "const privateCode = ", numPredict: 16,
      contextSize: 1024, temperature: 0, keepAlive: "1m"
    }, new AbortController().signal)).toBe("safe");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it("propagates rejected redirect errors without sending a second request", async () => {
    const fetchMock = vi.fn(async (_url: string, opts: RequestInit) => {
      expect(opts.redirect).toBe("error");
      throw new TypeError("fetch failed");
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(generateCompletion("http://127.0.0.1:11434", {
      model: "test", prompt: "do not forward", numPredict: 16,
      contextSize: 1024, temperature: 0, keepAlive: "1m"
    }, new AbortController().signal)).rejects.toThrow("fetch failed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

});
