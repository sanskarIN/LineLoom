import { describe, expect, it } from "vitest";
import { cleanCompletion } from "../../src/completion/filter";
describe("completion filtering", () => {
  it("strips Markdown fences", () => expect(cleanCompletion("```python\nprint(1)\n```", "", "", true)).toBe("print(1)"));
  it("discards empty whitespace", () => expect(cleanCompletion("   ", "", "", true)).toBe(""));
  it("supports optional single-line suggestions", () => expect(cleanCompletion("abc\ndef", "", "", false)).toBe("abc"));
  it("removes exact suffix overlap", () => expect(cleanCompletion("return value\n}", "", "\n}", true)).toBe("return value"));
  it("removes echoed current line", () => expect(cleanCompletion("let x = 3;", "let x = ", "", true)).toBe("3;"));
  it("rejects conversational responses", () => expect(cleanCompletion("Certainly, I can help", "", "", true)).toBe(""));
  it("preserves meaningful Python indentation", () =>
    expect(cleanCompletion("    return answer\n", "def calculate():\n", "", true)).toBe("    return answer\n"));
  it("drops partial prefix echo from language models", () =>
    expect(cleanCompletion("answer = 42", "const answer = ", "", true)).toBe("42"));
  it("respects configurable maximum number of lines", () =>
    expect(cleanCompletion("a\nb\nc\nd", "", "", true, 2)).toBe("a\nb"));
  it("keeps one line if multi-line mode is off", () =>
    expect(cleanCompletion("a\nb\nc", "", "", false, 20)).toBe("a"));
  it("removes null characters and normalises old-style line endings", () =>
    expect(cleanCompletion("foo\0\rbar", "", "", true)).toBe("foo\nbar"));
  it("rejects only-overlap completions", () =>
    expect(cleanCompletion("after", "", "after", true)).toBe(""));
  it("keeps only the leading fenced code block, not follow-up prose", () =>
    expect(cleanCompletion("```go\nfmt.Println(42)\n```\nThis prints a value.", "", "", true)).toBe("fmt.Println(42)"));
  it("strips model-boundary FIM and chat markers", () => {
    expect(cleanCompletion("<|fim_middle|>return x;<|fim_suffix|>", "", "", true)).toBe("return x;");
    expect(cleanCompletion("let x = 1;<|endoftext|>", "", "", true)).toBe("let x = 1;");
    expect(cleanCompletion("<|im_start|>assistant\n42<|im_end|>", "", "", true)).toBe("42");
  });
  it("does not rewrite control-token text inside an ordinary code string", () =>
    expect(cleanCompletion('const s = "<|fim_middle|>";', "", "", true)).toBe('const s = "<|fim_middle|>";'));

});
