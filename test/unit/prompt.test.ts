import { describe, expect, it } from "vitest";
import { buildPrompt } from "../../src/completion/prompt";
import { getLanguage } from "../../src/languages/registry";
import { extractContext } from "../../src/context/extract";
describe("prompt generation", () => {
  const language = getLanguage("typescript")!;
  const context = extractContext("const answer = ", 15, 500);
  it("uses native suffix support only for configured supported family", () => {
    expect(buildPrompt(language, context, "qwen2.5-coder:1.5b").prompt).toBe("const answer = ");
    expect(buildPrompt(language, context, "generic-model:latest").prompt).toContain("Output ONLY");
  });
});
