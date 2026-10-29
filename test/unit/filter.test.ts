import { describe, expect, it } from "vitest";
import { cleanCompletion } from "../../src/completion/filter";
describe("completion filtering", () => {
  it("strips Markdown fences", () => expect(cleanCompletion("```python\nprint(1)\n```", "", "", true)).toBe("print(1)"));
  it("discards empty whitespace", () => expect(cleanCompletion("   ", "", "", true)).toBe(""));
  it("supports optional single-line suggestions", () => expect(cleanCompletion("abc\ndef", "", "", false)).toBe("abc"));
  it("removes exact suffix overlap", () => expect(cleanCompletion("return value\n}", "", "\n}", true)).toBe("return value"));
  it("keeps short incidental identifier matches across the cursor", () => {
    // Previously even one matching letter was removed from the model's code.
    expect(cleanCompletion("return value", "", "else {", true)).toBe("return value");
    expect(cleanCompletion("type", "", "peers", true)).toBe("type");
    expect(cleanCompletion("const answer", "", "return count;", true)).toBe("const answer");
    expect(cleanCompletion("let имя", "", "язык", true)).toBe("let имя");
    expect(cleanCompletion("const code42", "", "42foo", true)).toBe("const code42");
    expect(cleanCompletion("var $", "", "$foo", true)).toBe("var $");
    expect(cleanCompletion("some", "", "omega", true)).toBe("some");
    expect(cleanCompletion("return name", "", "nameSpace", true)).toBe("return name");
    expect(cleanCompletion("scope", "", "pearl", true)).toBe("scope");
    expect(cleanCompletion("const λambda", "", "ambdaExtra", true)).toBe("const λambda");
    expect(cleanCompletion("some", "", "ome;", true)).toBe("some");
    expect(cleanCompletion("const alpha", "", "pha;", true)).toBe("const alpha");
    expect(cleanCompletion("myCounter", "", "Counter;", true)).toBe("myCounter");
  });
  it("still removes substantive echoed suffixes and repeated closing punctuation", () => {
    expect(cleanCompletion("return result", "", "result;", true)).toBe("return ");
    expect(cleanCompletion("call(x))", "", ")", true)).toBe("call(x)");
    expect(cleanCompletion("fn main() {}}", "", "}", true)).toBe("fn main() {}");
    expect(cleanCompletion("answer;;", "", ";", true)).toBe("answer;");
  });
  it("preserves a generated separator before existing identifier text", () => {
    // The caret is directly before "result;"; concatenating "return" without
    // the original space would produce the invalid token "returnresult".
    expect(cleanCompletion("return result", "", "result;", true)).toBe("return ");
    expect(cleanCompletion("return ", "", "result;", true)).toBe("return ");
    expect(cleanCompletion("let имя ", "", "значение;", true)).toBe("let имя ");
    expect(cleanCompletion("const count  ", "", "value", true)).toBe("const count  ");
  });
  it("preserves indentation before an existing first token on the next line", () => {
    expect(cleanCompletion("if ready:\\n    ", "", "pass", true)).toBe("if ready:\\n    ");
    expect(cleanCompletion("if ready:\\n\\t", "", "return x", true)).toBe("if ready:\\n\\t");
  });
  it("still removes trailing whitespace when no adjacent identifier follows", () => {
    expect(cleanCompletion("return   ", "", ";", true)).toBe("return");
    expect(cleanCompletion("return   ", "", "\\nresult", true)).toBe("return");
    expect(cleanCompletion("return   ", "", "", true)).toBe("return");
    expect(cleanCompletion("   ", "", "result", true)).toBe("");
    expect(cleanCompletion("return   \\n  done  ", "", "", true)).toBe("return\\ndone");
  });
  it("prefers a longer repeated suffix to a one-character identifier coincidence", () => {
    expect(cleanCompletion("ready", "", "ready;", true)).toBe("");
    expect(cleanCompletion("return value\n}", "", "\n}", true)).toBe("return value");
  });
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
  it("normalises old-style line endings without removing indentation", () =>
    expect(cleanCompletion("foo\rbar\r\nbaz", "", "", true)).toBe("foo\nbar\nbaz"));
  it("rejects control bytes rather than silently transforming generated source", () => {
    for (const codePoint of [0, 1, 8, 11, 12, 27, 31, 127, 133, 159]) {
      const raw = 'const value = "a' + String.fromCharCode(codePoint) + 'b";';
      expect(cleanCompletion(raw, "", "", true), String(codePoint)).toBe("");
    }
  });
  it("rejects bidi override and isolate controls even inside code comments or strings", () => {
    for (const codePoint of [0x202a, 0x202b, 0x202c, 0x202d, 0x202e,
      0x2066, 0x2067, 0x2068, 0x2069]) {
      expect(cleanCompletion("const x = 1; // " + String.fromCharCode(codePoint), "", "", true),
        codePoint.toString(16)).toBe("");
    }
  });
  it("rejects hidden directional marks and invisible formatting characters", () => {
    // Do not silently strip a character that could change how generated
    // source appears relative to the code that an editor actually runs.
    const hidden = [
      0x00ad, 0x061c, 0x180e, 0x200b, 0x200e, 0x200f,
      0x2028, 0x2029, 0x2060, 0x2061, 0x2062, 0x2063, 0x2064,
      0x206a, 0x206b, 0x206c, 0x206d, 0x206e, 0x206f, 0xfeff
    ];
    for (const codePoint of hidden) {
      const raw = "const answer = 42; // " + String.fromCodePoint(codePoint) + " hidden";
      expect(cleanCompletion(raw, "", "", true), codePoint.toString(16)).toBe("");
    }
  });
  it("preserves Unicode joiners for international identifiers and emoji", () => {
    const source = "const नाम\u200cसूची = '👩\u200d💻';";
    expect(cleanCompletion(source, "", "", true)).toBe(source);
  });
  it("allows ordinary newline, tabs and valid non-ASCII characters", () => {
    expect(cleanCompletion("    return 😀\r\n\tvalue", "", "", true)).toBe("    return 😀\n\tvalue");
    expect(cleanCompletion("const 日本語 = 'ok';", "", "", true)).toBe("const 日本語 = 'ok';");
  });
  it("rejects isolated UTF-16 surrogates without rejecting complete astral characters", () => {
    expect(cleanCompletion("x" + String.fromCharCode(0xd800), "", "", true)).toBe("");
    expect(cleanCompletion("x" + String.fromCharCode(0xdc00), "", "", true)).toBe("");
    expect(cleanCompletion("const rocket = '🚀';", "", "", true)).toBe("const rocket = '🚀';");
  });
  it("does not split an astral character at the 6000 UTF-16 code-unit cap", () => {
    const completion = "x".repeat(5999) + "🚀" + "tail";
    const result = cleanCompletion(completion, "", "", true);
    expect(result).toBe("x".repeat(5999));
    expect(result.length).toBe(5999);
    expect(result).not.toContain("�");
  });
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
