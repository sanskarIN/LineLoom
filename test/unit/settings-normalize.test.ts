import { describe, expect, it } from "vitest";
import {
  normalizeModelTag, normalizeEndpointSetting, normalizeKeepAlive, normalizeExcludedPaths,
  normalizePermissionToggle, normalizeNumericSetting
} from "../../src/settings/normalize";

describe("fail-closed settings normalization", () => {
  it("only grants enable and remote permissions from literal booleans", () => {
    expect(normalizePermissionToggle(true)).toBe(true);
    expect(normalizePermissionToggle(false)).toBe(false);
    expect(normalizePermissionToggle(undefined)).toBe(false);
    expect(normalizePermissionToggle(undefined, true)).toBe(true);
    expect(normalizePermissionToggle(false, true)).toBe(false);
    for (const invalid of [null, 0, 1, "true", "false", [], {}, ["true"]]) {
      expect(normalizePermissionToggle(invalid), String(invalid)).toBe(false);
      expect(normalizePermissionToggle(invalid, true), String(invalid)).toBe(false);
    }
  });

  it("restores numeric settings defaults for malformed values instead of disabling throttling", () => {
    const integerSettings = [
      { fallback: 2, lower: 0, upper: 32 },       // minAutoTriggerChars
      { fallback: 250, lower: 0, upper: 3000 },   // debounceMs
      { fallback: 12000, lower: 1000, upper: 120000 }, // timeoutMs
      { fallback: 8000, lower: 512, upper: 30000 },   // maxContextChars
      { fallback: 128, lower: 16, upper: 512 },   // maxOutputTokens
      { fallback: 8, lower: 1, upper: 20 },       // maxSuggestionLines
      { fallback: 4096, lower: 512, upper: 32768 } // contextSize
    ];
    for (const { fallback, lower, upper } of integerSettings) {
      for (const invalid of [undefined, null, true, false, "250", [], {}, NaN, Infinity, -Infinity, 1.5, Number.MAX_VALUE]) {
        expect(normalizeNumericSetting(invalid, fallback, lower, upper, true)).toBe(fallback);
      }
      expect(normalizeNumericSetting(lower, fallback, lower, upper, true)).toBe(lower);
      expect(normalizeNumericSetting(upper, fallback, lower, upper, true)).toBe(upper);
      expect(normalizeNumericSetting(lower - 1, fallback, lower, upper, true)).toBe(lower);
      expect(normalizeNumericSetting(upper + 1, fallback, lower, upper, true)).toBe(upper);
    }
  });

  it("preserves finite decimal temperatures without coercing invalid JSON types", () => {
    for (const invalid of [undefined, null, "0.7", true, {}, [], NaN, Infinity, -Infinity]) {
      expect(normalizeNumericSetting(invalid, 0.1, 0, 1)).toBe(0.1);
    }
    expect(normalizeNumericSetting(0.7, 0.1, 0, 1)).toBe(0.7);
    expect(normalizeNumericSetting(-0.5, 0.1, 0, 1)).toBe(0);
    expect(normalizeNumericSetting(1.5, 0.1, 0, 1)).toBe(1);
  });

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
    for (const input of [42, "private/**", null, ["private/**", 42], {},
      [""], ["    "], ["src/private/**", ""],
      ["src/private/**", String.fromCharCode(0)],
      ["src/private/**", String.fromCharCode(10)],
      ["x".repeat(4097)],
      Array.from({ length: 257 }, (_, index) => `private/${index}/`)]) {
      expect(normalizeExcludedPaths(input)).toEqual(["**"]);
    }
  });
});
