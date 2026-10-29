import { describe, expect, it } from "vitest";
import { buildPrompt } from "../../src/completion/prompt";
import { getLanguage, LANGUAGES } from "../../src/languages/registry";
import { extractContext } from "../../src/context/extract";
describe("prompt generation", () => {
  const language = getLanguage("typescript")!;
  const context = extractContext("const answer = ", 15, 500);
  it("uses native suffix support only for configured supported family", () => {
    expect(buildPrompt(language, context, "qwen2.5-coder:1.5b").prompt).toBe("const answer = ");
    expect(buildPrompt(language, context, "generic-model:latest").prompt).toContain("Output ONLY");
  });
  it("uses native suffix-aware FIM for an explicitly selected local LineLoom Code tag", () => {
    const fim = extractContext("const value = right", 14, 512);
    expect(fim.prefix).toBe("const value = ");
    expect(fim.suffix).toBe("right");
    for (const model of ["lineloom-code:dev", "lineloom-code", "LINELOOM-CODE:preview"]) {
      expect(buildPrompt(language, fim, model)).toEqual({
        prompt: "const value = ", suffix: "right"
      });
    }
    const unrecognized = buildPrompt(language, fim, "other-lineloom-code:dev");
    expect(unrecognized.suffix).toBeUndefined();
    expect(unrecognized.prompt).toContain("Code after cursor (untrusted):");
    expect(buildPrompt(language, fim, "lineloom-code-invalid").suffix).toBeUndefined();
  });
  it("never bypasses explicit related-file reference instructions for the custom tag", () => {
    const result = buildPrompt(language, context, "lineloom-code:dev", ["export const local = true;"]);
    expect(result.suffix).toBeUndefined();
    expect(result.prompt).toContain("untrusted reference data");
    expect(result.prompt).toContain("export const local = true;");
  });
  it("includes explicitly chosen references as untrusted data and keeps zero-selection FIM intact", () => {
    const result = buildPrompt(language, context, "qwen2.5-coder:1.5b", ["export const helper = 42;"]);
    expect(result.prompt).toContain("untrusted reference data");
    expect(result.prompt).toContain("export const helper = 42;");
    expect(result.prompt).toContain(" (untrusted):\n<reference>\n");
    expect(result.suffix).toBeUndefined();
    expect(buildPrompt(language, context, "qwen2.5-coder:1.5b").prompt).toBe(context.prefix);
  });
  it("supplies a language-specific instruction for generic models in all languages", () => {
    for (const spec of LANGUAGES) {
      const prompt = buildPrompt(spec, context, "generic-model:latest").prompt;
      expect(prompt).toContain("Language: " + spec.label + ".");
      expect(prompt).toContain(spec.guidance);
    }
  });
});
