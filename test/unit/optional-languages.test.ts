import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_ENABLED_LANGUAGES, getLanguage, isLanguageEnabled, LANGUAGES, normalizeEnabledLanguages
} from "../../src/languages/registry";
import { normalizeLanguageModels, resolveLanguageModel } from "../../src/settings/language-models";
import { summarizeActiveEditor } from "../../src/ui/editor-context";
import { buildPrompt } from "../../src/completion/prompt";
import { extractContext } from "../../src/context/extract";

describe("opt-in HTML, CSS and Lua completion modes", () => {
  const additions = ["html", "css", "lua"] as const;

  it("registers each language once with a distinct VS Code mode and guidance", () => {
    expect(new Set(LANGUAGES.map(language => language.id)).size).toBe(LANGUAGES.length);
    expect(LANGUAGES).toHaveLength(12);
    for (const id of additions) {
      const spec = getLanguage(id);
      expect(spec?.id).toBe(id);
      expect(spec?.extensions.length).toBeGreaterThan(0);
      expect(spec?.guidance.length).toBeGreaterThan(20);
      expect(buildPrompt(spec!, extractContext("x =", 3, 512), "generic-local").prompt)
        .toContain("Language: " + spec?.label + ".");
    }
    expect(getLanguage("plaintext")).toBeUndefined();
  });

  it("retains the exact nine shipping defaults with no silent opt-in", () => {
    expect(DEFAULT_ENABLED_LANGUAGES).toEqual([
      "python", "javascript", "typescript", "rust", "kotlin", "go", "java", "c", "cpp"
    ]);
    for (const id of additions) {
      expect(isLanguageEnabled(getLanguage(id)!, normalizeEnabledLanguages(undefined))).toBe(false);
    }
    expect(normalizeEnabledLanguages(["lua", "html", "css", "lua", "unexpected"]))
      .toEqual(["lua", "html", "css"]);
    expect(normalizeEnabledLanguages([])).toEqual([]);
  });

  it("matches the contributed VS Code enums and leaves the default setting untouched", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      contributes: { configuration: { properties: Record<string, {
        default?: string[]; items?: { enum: string[] }
      }> } }
    };
    const setting = pkg.contributes.configuration.properties["lineloom.enabledLanguages"];
    expect(setting.default).toEqual(DEFAULT_ENABLED_LANGUAGES);
    expect(setting.items?.enum).toEqual(LANGUAGES.map(language => language.id));
  });

  it("accepts valid optional model overrides but does not enable inference by itself", () => {
    const overrides = normalizeLanguageModels({
      html: "markup-local", css: "style-local", lua: "lua-local",
      plaintext: "ignored", python: "python-local", unknown: "ignored"
    });
    expect(overrides).toEqual({
      python: "python-local", html: "markup-local", css: "style-local", lua: "lua-local"
    });
    for (const id of additions) {
      const blocked = summarizeActiveEditor({
        languageId: id, scheme: "file", enabled: true, workspaceTrusted: true,
        enabledLanguages: normalizeEnabledLanguages(undefined), defaultModel: "global-local",
        languageModels: overrides, endpointState: "loopback"
      });
      expect(blocked.eligibility).toBe("Language disabled in settings");
      const enabled = summarizeActiveEditor({
        languageId: id, scheme: "file", enabled: true, workspaceTrusted: true,
        enabledLanguages: normalizeEnabledLanguages([id]), defaultModel: "global-local",
        languageModels: overrides, endpointState: "loopback"
      });
      expect(enabled.modelSource).toBe("Language override");
      expect(enabled.model).toBe(resolveLanguageModel("global-local", id, overrides));
      expect(enabled.eligibility).toMatch(/file rules checked on request/);
    }
  });
});
