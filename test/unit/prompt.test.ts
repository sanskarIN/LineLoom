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
  it("supplies a language-specific instruction for generic models in all languages", () => {
    for (const spec of LANGUAGES) {
      const prompt = buildPrompt(spec, context, "generic-model:latest").prompt;
      expect(prompt).toContain("Language: " + spec.label + ".");
      expect(prompt).toContain(spec.guidance);
    }
  });
});
