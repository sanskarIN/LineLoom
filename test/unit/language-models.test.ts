import { describe, expect, it } from "vitest";
import { normalizeLanguageModels, resolveLanguageModel } from "../../src/settings/language-models";

describe("per-language installed Ollama models", () => {
  it("normalizes supported language overrides while ignoring unknown or malformed values", () => {
    const parsed = normalizeLanguageModels({
      rust: " code-llama:7b ", python: "qwen2.5-coder:1.5b",
      unknownLanguage: "unrelated", javascript: 42, kotlin: "",
      go: "X".repeat(129), java: "contains\\nnewline",
      c: "local-c:latest"
    });
    expect(parsed).toEqual({
      python: "qwen2.5-coder:1.5b", rust: "code-llama:7b", c: "local-c:latest"
    });
  });
  it("uses global model as fallback, including JSX and TSX aliases", () => {
    const overrides = normalizeLanguageModels({ javascript: "js-local", typescript: "ts-local" });
    expect(resolveLanguageModel("global", "javascript", overrides)).toBe("js-local");
    expect(resolveLanguageModel("global", "typescript", overrides)).toBe("ts-local");
    expect(resolveLanguageModel("global", "rust", overrides)).toBe("global");
  });
  it("fails safely on malformed settings", () => {
    for (const value of [null, undefined, "", [], 123, true]) {
      expect(normalizeLanguageModels(value)).toEqual({});
    }
    const protectedNames = normalizeLanguageModels({ __proto__: "not-a-model", constructor: "bad" });
    expect(Object.keys(protectedNames)).toEqual([]);
  });
});
