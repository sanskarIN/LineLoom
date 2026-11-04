import { describe, expect, it } from "vitest";
import {
  DEFAULT_ENABLED_LANGUAGES, LANGUAGES, getLanguage, isLanguageEnabled,
  normalizeEnabledLanguages
} from "../../src/languages/registry";

describe("language registry", () => {
  it("registers original and experimental language IDs exactly once", () => {
    expect(LANGUAGES.map(x => x.id)).toEqual([
      "python", "javascript", "typescript", "rust", "kotlin",
      "go", "java", "c", "cpp", "html", "css", "lua", "cuda-cpp", "csharp"
    ]);
    expect(new Set(LANGUAGES.map(x => x.id)).size).toBe(LANGUAGES.length);
  });
  it("recognizes JSX/TSX aliases without changing the selected language", () => {
    expect(getLanguage("typescriptreact")?.id).toBe("typescript");
    expect(getLanguage("javascriptreact")?.id).toBe("javascript");
    expect(getLanguage("cpp")?.extensions).toContain(".cpp");
    expect(getLanguage("c")?.extensions).toContain(".c");
    expect(getLanguage("go")?.extensions).toContain(".go");
    expect(getLanguage("java")?.extensions).toContain(".java");
    expect(getLanguage("cuda-cpp")?.extensions).toEqual([".cu", ".cuh"]);
    expect(getLanguage("cuda")?.id).toBe("cuda-cpp");
    expect(getLanguage("csharp")?.extensions).toEqual([".cs", ".csx"]);
    expect(getLanguage("unknown")).toBeUndefined();
  });
  it("defaults to every supported language and preserves explicitly empty selections", () => {
    expect(normalizeEnabledLanguages(undefined)).toEqual(DEFAULT_ENABLED_LANGUAGES);
    expect(normalizeEnabledLanguages([])).toEqual([]);
    expect(normalizeEnabledLanguages(null)).toEqual([]);
    expect(DEFAULT_ENABLED_LANGUAGES).not.toContain("cuda-cpp");
    expect(DEFAULT_ENABLED_LANGUAGES).not.toContain("csharp");
  });
  it("rejects unknown languages and deduplicates configured IDs", () => {
    const ids = normalizeEnabledLanguages(["python", "python", "go", "unknown", 123, "cpp"]);
    expect(ids).toEqual(["python", "go", "cpp"]);
    expect(isLanguageEnabled(getLanguage("cpp")!, ids)).toBe(true);
    expect(isLanguageEnabled(getLanguage("java")!, ids)).toBe(false);
    expect(isLanguageEnabled(getLanguage("javascriptreact")!, ["javascript"])).toBe(true);
    expect(normalizeEnabledLanguages(["cuda-cpp", "cuda-cpp", "cuda"])).toEqual(["cuda-cpp"]);
    expect(isLanguageEnabled(getLanguage("cuda")!, ["cuda-cpp"])).toBe(true);
    expect(normalizeEnabledLanguages(["csharp", "csharp", "cs", "unknown"]))
      .toEqual(["csharp"]);
    expect(isLanguageEnabled(getLanguage("csharp")!, ["csharp"])).toBe(true);
    expect(isLanguageEnabled(getLanguage("csharp")!, ["cpp"])).toBe(false);
  });
});
