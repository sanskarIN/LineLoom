import { describe, expect, it } from "vitest";
import {
  normalizeModelTag, normalizeEndpointSetting, normalizeKeepAlive, normalizeExcludedPaths
} from "../../src/settings/normalize";

describe("fail-closed settings normalization", () => {
  it("accepts Ollama model tags and trims surrounding whitespace", () => {
    expect(normalizeModelTag(" qwen2.5-coder:1.5b ")).toBe("qwen2.5-coder:1.5b");
    expect(normalizeModelTag("registry.ollama.ai/library/model:latest")).toBe("registry.ollama.ai/library/model:latest");
  });
  it("rejects malformed and non-string model names without throwing", () => {
    for (const input of [undefined, null, 42, {}, [], true, " ", " x\ny ", "a b", "x".repeat(129)]) {
      expect(normalizeModelTag(input)).toBe("");
    }
  });
  it("preserves invalid endpoints as invalid rather than falling back to loopback", () => {
    expect(normalizeEndpointSetting(" http://127.0.0.1:11434 ")).toBe("http://127.0.0.1:11434");
    for (const input of [false, [], 42, {}, null]) expect(normalizeEndpointSetting(input)).toBe("");
  });
  it("normalizes safe keep-alive durations and rejects malformed values", () => {
    for (const value of ["5m", "0", "-1", "1h", "30s", "500ms", "10us"]) {
      expect(normalizeKeepAlive(value)).toBe(value);
    }
    for (const input of ["", "until tomorrow", "3 days", "15\nms", "9".repeat(100), true]) {
      expect(normalizeKeepAlive(input)).toBe("5m");
    }
  });
  it("does not silently remove exclusions when a configuration array is malformed", () => {
    expect(normalizeExcludedPaths(undefined)).toEqual([]);
    expect(normalizeExcludedPaths([])).toEqual([]);
    expect(normalizeExcludedPaths(["src/private/**", "*.secret"])).toEqual(["src/private/**", "*.secret"]);
    for (const input of [42, "private/**", null, ["private/**", 42], {}]) {
      expect(normalizeExcludedPaths(input)).toEqual(["**"]);
    }
  });
});
