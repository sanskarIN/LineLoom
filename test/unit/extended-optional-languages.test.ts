import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_ENABLED_LANGUAGES, getLanguage, isLanguageEnabled, LANGUAGES, normalizeEnabledLanguages
} from "../../src/languages/registry";
import { normalizeLanguageModels } from "../../src/settings/language-models";
import { summarizeActiveEditor } from "../../src/ui/editor-context";
import { extractContext } from "../../src/context/extract";
import { buildPrompt } from "../../src/completion/prompt";
import { cleanCompletion } from "../../src/completion/filter";

describe("opt-in Swift, Dart, Ruby and PHP editor modes", () => {
  const additions = ["swift", "dart", "ruby", "php"] as const;

  it("registers distinct VS Code IDs without silently enabling inference", () => {
    expect(LANGUAGES).toHaveLength(18);
    expect(new Set(LANGUAGES.map(spec => spec.id)).size).toBe(18);
    expect(DEFAULT_ENABLED_LANGUAGES).toEqual([
      "python", "javascript", "typescript", "rust", "kotlin", "go", "java", "c", "cpp"
    ]);
    expect(normalizeEnabledLanguages(undefined)).toEqual(DEFAULT_ENABLED_LANGUAGES);
    expect(normalizeEnabledLanguages([])).toEqual([]);
    expect(normalizeEnabledLanguages(["swift", "php", "dart", "ruby", "php", "unknown"]))
      .toEqual(["swift", "php", "dart", "ruby"]);
    for (const id of additions) {
      const spec = getLanguage(id)!;
      expect(spec.id).toBe(id);
      expect(spec.extensions.length).toBeGreaterThan(0);
      expect(spec.guidance.length).toBeGreaterThan(40);
      expect(isLanguageEnabled(spec, DEFAULT_ENABLED_LANGUAGES)).toBe(false);
      expect(isLanguageEnabled(spec, normalizeEnabledLanguages([id]))).toBe(true);
    }
  });

  it("keeps VS Code setting enums synchronized and never changes the original defaults", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      contributes: { configuration: { properties: Record<string, {
        default?: string[]; items?: { enum: string[] }
      }> } }
    };
    const languages = pkg.contributes.configuration.properties["lineloom.enabledLanguages"];
    expect(languages.default).toEqual(DEFAULT_ENABLED_LANGUAGES);
    expect(languages.items?.enum).toEqual(LANGUAGES.map(spec => spec.id));
  });

  it("only selects per-language model overrides after explicit user opt-in", () => {
    const overrides = normalizeLanguageModels({
      swift: "swift-local", dart: "dart-local", ruby: "ruby-local",
      php: "php-local", unknown: "ignore", plaintext: "ignore"
    });
    expect(overrides).toEqual({
      swift: "swift-local", dart: "dart-local", ruby: "ruby-local", php: "php-local"
    });
    for (const id of additions) {
      const state = {
        languageId: id, scheme: "file", enabled: true, workspaceTrusted: true,
        defaultModel: "default-local", languageModels: overrides, endpointState: "loopback" as const
      };
      const blocked = summarizeActiveEditor({
        ...state, enabledLanguages: normalizeEnabledLanguages(undefined)
      });
      expect(blocked.eligibility).toBe("Language disabled in settings");
      const selected = summarizeActiveEditor({
        ...state, enabledLanguages: normalizeEnabledLanguages([id])
      });
      expect(selected.modelSource).toBe("Language override");
      expect(selected.model).toBe(overrides[id]);
      expect(selected.eligibility).toMatch(/file rules checked on request/);
    }
  });

  it("preserves byte-exact FIM and uses fixed guidance only for instruction models", () => {
    const before = "let value = ";
    const ctx = extractContext(before + "fallback", before.length, 512);
    for (const id of additions) {
      const spec = getLanguage(id)!;
      const fim = buildPrompt(spec, ctx, "qwen2.5-coder:1.5b");
      expect(fim).toEqual({ prompt: ctx.prefix, suffix: ctx.suffix });
      const generic = buildPrompt(spec, ctx, "generic-local:latest");
      expect(generic.prompt).toContain("Language: " + spec.label + ". ");
      expect(generic.prompt).toContain(spec.guidance);
      expect(generic.prompt).toContain("untrusted source lines");
      expect(generic.prompt).not.toContain("Language: Python.");
    }
  });

  it("accepts matching fenced code and rejects recognized cross-language fences", () => {
    const cases = [
      ["swift", "let count = 1", "php"],
      ["dart", "final count = 1;", "ruby"],
      ["ruby", "puts :ok", "dart"],
      ["php", "$count = 1;", "swift"]
    ] as const;
    for (const [id, source, mismatch] of cases) {
      expect(cleanCompletion(`\`\`\`${id}\n${source}\n\`\`\``, "", "", true, 8, id))
        .toBe(source);
      expect(cleanCompletion(`\`\`\`${mismatch}\n${source}\n\`\`\``, "", "", true, 8, id))
        .toBe("");
    }
    expect(cleanCompletion("```rb\nputs :ok\n```", "", "", true, 8, "ruby"))
      .toBe("puts :ok");
    expect(cleanCompletion("```unknown-local-mode\nputs :ok\n```", "", "", true, 8, "ruby"))
      .toBe("puts :ok");
  });
});
