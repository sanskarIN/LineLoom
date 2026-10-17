import { describe, expect, it } from "vitest";
import { cleanCompletion } from "../../src/completion/filter";
describe("completion filtering", () => {
  it("strips Markdown fences", () => expect(cleanCompletion("```python\nprint(1)\n```", "", "", true)).toBe("print(1)"));
  it("discards empty whitespace", () => expect(cleanCompletion("   ", "", "", true)).toBe(""));
  it("supports optional single-line suggestions", () => expect(cleanCompletion("abc\ndef", "", "", false)).toBe("abc"));
  it("removes exact suffix overlap", () => expect(cleanCompletion("return value\n}", "", "\n}", true)).toBe("return value"));
  it("removes echoed current line", () => expect(cleanCompletion("let x = 3;", "let x = ", "", true)).toBe("3;"));
  it("rejects conversational responses", () => expect(cleanCompletion("Certainly, I can help", "", "", true)).toBe(""));
});
