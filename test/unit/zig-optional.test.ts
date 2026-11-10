import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_ENABLED_LANGUAGES, getLanguage, isLanguageEnabled,
  LANGUAGES, normalizeEnabledLanguages
} from "../../src/languages/registry";
import { normalizeLanguageModels, resolveLanguageModel } from "../../src/settings/language-models";
import { summarizeActiveEditor } from "../../src/ui/editor-context";
import { buildPrompt } from "../../src/completion/prompt";
import { extractContext } from "../../src/context/extract";
import { cleanCompletion } from "../../src/completion/filter";

describe("experimental Zig editor autocomplete (source-only opt-in)", () => {
  it("uses the explicit zig mode without changing the nine original defaults", () => {
    expect(LANGUAGES).toHaveLength(19);
    expect(getLanguage("zig")).toMatchObject({
      id: "zig", label: "Zig", extensions: [".zig"]
    });
    expect(getLanguage("zig")?.guidance).toContain("explicit allocators");
    expect(DEFAULT_ENABLED_LANGUAGES).not.toContain("zig");
    expect(normalizeEnabledLanguages(undefined)).not.toContain("zig");
    expect(normalizeEnabledLanguages([])).toEqual([]);
    expect(normalizeEnabledLanguages(["zig", "zig", "unknown"])).toEqual(["zig"]);
    expect(isLanguageEnabled(getLanguage("zig")!, DEFAULT_ENABLED_LANGUAGES)).toBe(false);
    expect(isLanguageEnabled(getLanguage("zig")!, ["zig"])).toBe(true);
    expect(getLanguage("zig-custom-mode")).toBeUndefined();
  });

  it("offers zig through VS Code settings without silently changing enabled languages", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      contributes: { configuration: { properties: Record<string, {
        items?: { enum: string[] }; default?: string[]
      }> } }
    };
    const setting = pkg.contributes.configuration.properties["lineloom.enabledLanguages"];
    expect(setting.items?.enum).toEqual(LANGUAGES.map(x => x.id));
    expect(setting.default).toEqual(DEFAULT_ENABLED_LANGUAGES);
  });

  it("keeps per-language model mapping separate from permission to complete", () => {
    const overrides = normalizeLanguageModels({ zig: "zig-local:latest", rust: "rust-local" });
    expect(overrides.zig).toBe("zig-local:latest");
    expect(resolveLanguageModel("global-local", "zig", overrides)).toBe("zig-local:latest");
    const common = {
      languageId: "zig", scheme: "file", enabled: true, workspaceTrusted: true,
      defaultModel: "global-local", languageModels: overrides, endpointState: "loopback" as const
    };
    const blocked = summarizeActiveEditor({
      ...common, enabledLanguages: normalizeEnabledLanguages(undefined)
    });
    expect(blocked.eligibility).toBe("Language disabled in settings");
    const enabled = summarizeActiveEditor({
      ...common, enabledLanguages: normalizeEnabledLanguages(["zig"])
    });
    expect(enabled.modelSource).toBe("Language override");
    expect(enabled.model).toBe("zig-local:latest");
    expect(enabled.eligibility).toMatch(/file rules checked on request/);
  });

  it("preserves native FIM input and gives instruction models fixed Zig guidance", () => {
    const before = "const value: u8 = ";
    const context = extractContext(before + "fallback", before.length, 512);
    const spec = getLanguage("zig")!;
    expect(buildPrompt(spec, context, "qwen2.5-coder:1.5b"))
      .toEqual({ prompt: context.prefix, suffix: context.suffix });
    const generic = buildPrompt(spec, context, "generic-local");
    expect(generic.prompt).toContain("Language: Zig. ");
    expect(generic.prompt).toContain(spec.guidance);
    expect(generic.prompt).toContain("untrusted source lines");
  });

  it("accepts Zig fences but rejects known mismatched language fences", () => {
    const fence = String.fromCharCode(96).repeat(3);
    const code = "const value: u8 = 42;";
    const wrapped = (label: string) => fence + label + "\n" + code + "\n" + fence;
    expect(cleanCompletion(wrapped("zig"), "", "", true, 8, "zig")).toBe(code);
    expect(cleanCompletion(wrapped("python"), "", "", true, 8, "zig")).toBe("");
    expect(cleanCompletion(wrapped("zig"), "", "", true, 8, "python")).toBe("");
    expect(cleanCompletion(code, "", "", true, 8, "zig")).toBe(code);
  });
});
