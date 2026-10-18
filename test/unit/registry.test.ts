import { describe, expect, it } from "vitest";
import {
  DEFAULT_ENABLED_LANGUAGES, LANGUAGES, getLanguage, isLanguageEnabled,
  normalizeEnabledLanguages
} from "../../src/languages/registry";

describe("language registry", () => {
  it("registers all nine preview language IDs exactly once", () => {
    expect(LANGUAGES.map(x => x.id)).toEqual([
      "python", "javascript", "typescript", "rust", "kotlin",
      "go", "java", "c", "cpp"
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
    expect(getLanguage("unknown")).toBeUndefined();
  });
  it("defaults to every supported language and preserves explicitly empty selections", () => {
    expect(normalizeEnabledLanguages(undefined)).toEqual(DEFAULT_ENABLED_LANGUAGES);
    expect(normalizeEnabledLanguages([])).toEqual([]);
    expect(normalizeEnabledLanguages(null)).toEqual([]);
  });
  it("rejects unknown languages and deduplicates configured IDs", () => {
    const ids = normalizeEnabledLanguages(["python", "python", "go", "unknown", 123, "cpp"]);
    expect(ids).toEqual(["python", "go", "cpp"]);
    expect(isLanguageEnabled(getLanguage("cpp")!, ids)).toBe(true);
    expect(isLanguageEnabled(getLanguage("java")!, ids)).toBe(false);
    expect(isLanguageEnabled(getLanguage("javascriptreact")!, ["javascript"])).toBe(true);
  });
});
