import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import { generateCompletion, listModels, showModel } from "../../src/models/ollama";

afterEach(() => vi.unstubAllGlobals());

async function withDeadline<T>(request: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      request,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("cancel-cleanup-stalled")), 1500);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

describe("Ollama endpoint requests", () => {
  it("rejects a bounded catalog overflow even when stream cancellation never settles", async () => {
    let cancelStarted = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(256_001).fill(65));
        // Malicious transport leaves the response open forever.
      },
      cancel() {
        cancelStarted = true;
        return new Promise<void>(() => {});
      }
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(body)));
    await expect(withDeadline(listModels("http://127.0.0.1:11434")))
      .rejects.toThrow("Ollama model list exceeded safety limit.");
    expect(cancelStarted).toBe(true);
  });

  it("does not hang model lookup or HTTP failure on unacknowledged stream cleanup", async () => {
    for (const status of [200, 404, 503]) {
      let cancelStarted = false;
      const body = new ReadableStream<Uint8Array>({
        start() { /* No bytes are needed to decide the HTTP/lookup status. */ },
        cancel() {
          cancelStarted = true;
          return new Promise<void>(() => {});
        }
      });
      vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { status })));
      if (status === 503) {
        await expect(withDeadline(listModels("http://127.0.0.1:11434")))
          .rejects.toThrow("Ollama returned HTTP 503.");
      } else {
        expect(await withDeadline(showModel("http://127.0.0.1:11434", "local:latest")))
          .toBe(status === 200);
      }
      expect(cancelStarted).toBe(true);
    }
  });

  it("rejects overlarge model-list responses without parsing them", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ models: ["x".repeat(260_000)] }))));
    await expect(listModels("http://127.0.0.1:11434")).rejects.toThrow(/safety limit/);
  });
  it("rejects malformed UTF-8 in a model discovery response without displaying server bytes", async () => {
    const prefix = new TextEncoder().encode('{"models":[{"name":"model:');
    const suffix = new TextEncoder().encode('"}]}');
    const raw = new Uint8Array(prefix.length + 1 + suffix.length);
    raw.set(prefix);
    raw[prefix.length] = 0xff;
    raw.set(suffix, prefix.length + 1);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(raw)));
    await expect(listModels("http://127.0.0.1:11434")).rejects
      .toThrow("Invalid Ollama UTF-8 response.");
  });

  it("accepts valid UTF-8 split in the model catalog across transport chunks", async () => {
    const json = new TextEncoder().encode(
      JSON.stringify({ models: [{ name: "test:latest", details: "日本語" }] })
    );
    const marker = new TextEncoder().encode("日");
    const at = json.findIndex((b, i) => b === marker[0] && json[i + 1] === marker[1]);
    expect(at).toBeGreaterThan(0);
    const parts = new ReadableStream<Uint8Array>({ start(controller) {
      controller.enqueue(json.slice(0, at + 1));
      controller.enqueue(json.slice(at + 1));
      controller.close();
    } });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(parts)));
    expect(await listModels("http://127.0.0.1:11434")).toEqual([{ name: "test:latest" }]);
  });

  it("lists models from a valid response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ models: [{ name: "qwen2.5-coder:1.5b" }, { broken: true }] }),
      { headers: { "content-type": "application/json" } }
    )));
    expect((await listModels("http://127.0.0.1:11434")).map(x => x.name)).toEqual(["qwen2.5-coder:1.5b"]);
  });
  it("sanitizes untrusted model names before showing them in the picker", async () => {
    const raw = [
      { name: "qwen2.5-coder:1.5b", size: 1234567 },
      { name: "qwen2.5-coder:1.5b", size: 2 },
      { name: "hf.co/user/repository:Q4_K_M" },
      { name: "bad\\nname" },
      { name: " leading" },
      { name: "trailing " },
      { name: "$(warning) masquerading" },
      { name: "x".repeat(129) },
      { name: "" },
      { name: 123 },
      { name: "local:latest", size: -50 },
      null,
      [],
      {}
    ];
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ models: raw }))));
    const names = await listModels("http://127.0.0.1:11434");
    expect(names).toEqual([
      { name: "qwen2.5-coder:1.5b", size: 1234567 },
      { name: "hf.co/user/repository:Q4_K_M" },
      { name: "local:latest" }
    ]);
  });
  it("bounds the number of model options shown for an untrusted endpoint", async () => {
    const models = Array.from({ length: 600 }, (_, i) => ({ name: "model-" + i + ":latest" }));
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ models }))));
    const selected = await listModels("http://127.0.0.1:11434");
    expect(selected).toHaveLength(512);
    expect(selected[0].name).toBe("model-0:latest");
    expect(selected.at(-1)?.name).toBe("model-511:latest");
  });
  it("reports an unusable nonempty model list rather than claiming no models installed", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ models: [{ name: "danger\\nnewline" }, { name: " " }] })
    )));
    await expect(listModels("http://127.0.0.1:11434"))
      .rejects.toThrow(/no valid model names/);
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

  it("does not forward source to a redirect destination on real loopback HTTP", async () => {
    let forwarded = 0;
    const receiver = createServer((_request, response) => {
      forwarded++;
      response.end('{"response":"leaked","done":true}\n');
    });
    const redirector = createServer((_request, response) => {
      response.writeHead(307, { Location: destination + "/api/generate" });
      response.end();
    });
    let destination = "";
    try {
      await new Promise<void>((resolve) => receiver.listen(0, "127.0.0.1", resolve));
      const receiverAddress = receiver.address();
      expect(receiverAddress).not.toBeNull();
      if (!receiverAddress || typeof receiverAddress === "string") throw new Error("Missing receiver port");
      destination = "http://127.0.0.1:" + receiverAddress.port;
      await new Promise<void>((resolve) => redirector.listen(0, "127.0.0.1", resolve));
      const redirectAddress = redirector.address();
      if (!redirectAddress || typeof redirectAddress === "string") throw new Error("Missing redirect port");
      const origin = "http://127.0.0.1:" + redirectAddress.port;
      await expect(generateCompletion(origin, {
        model: "test", prompt: "private example", numPredict: 16,
        contextSize: 1024, temperature: 0, keepAlive: "1m"
      }, new AbortController().signal)).rejects.toThrow();
      expect(forwarded).toBe(0);
    } finally {
      await Promise.all([
        new Promise<void>((resolve) => redirector.close(() => resolve())),
        new Promise<void>((resolve) => receiver.close(() => resolve()))
      ]);
    }
  });

});
