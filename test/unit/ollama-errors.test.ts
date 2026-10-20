import { describe, expect, it } from "vitest";
import { ollamaFailureMessage } from "../../src/models/errors";

describe("safe Ollama failure diagnostics", () => {
  it("classifies HTTP, server and model failures with actionable messages", () => {
    expect(ollamaFailureMessage(new Error("Ollama returned HTTP 404."))).toMatch(/not found/);
    expect(ollamaFailureMessage(new Error("Ollama returned HTTP 503."))).toMatch(/server error/);
    expect(ollamaFailureMessage(new Error("Ollama returned HTTP 403."))).toMatch(/authorization/);
    expect(ollamaFailureMessage(new Error("Ollama returned HTTP 429."))).toMatch(/busy/);
    expect(ollamaFailureMessage(new Error("Model no longer installed."))).toMatch(/no longer installed/);
    expect(ollamaFailureMessage(new Error("Incomplete Ollama response stream."))).toMatch(/invalid/);
  });
  it("does not leak untrusted URLs, model output or server errors to the user", () => {
    const secret = "https://example.net/key?token=secret123";
    for (const error of [new Error(secret), new Error("Ollama error: " + secret),
      { message: secret }, null, "secret123"]) {
      expect(ollamaFailureMessage(error)).not.toContain(secret);
      expect(ollamaFailureMessage(error)).not.toContain("secret123");
    }
  });
  it("identifies timeout and aborted requests", () => {
    expect(ollamaFailureMessage(new DOMException("Timed out", "TimeoutError"))).toMatch(/timed out/);
    expect(ollamaFailureMessage(new DOMException("Cancelled", "AbortError"))).toMatch(/cancelled/);
  });
});
