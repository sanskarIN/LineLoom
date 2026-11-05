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
  it("preserves identifiers that continue after Unicode connector punctuation or joiners", () => {
    // A full-looking overlap of "name" must not be removed when the suffix
    // continues the same identifier using connector punctuation or a joiner.
    for (const continuation of ["\u203f", "\u2040", "\u200c", "\u200d"]) {
      const suffix = "name" + continuation + "rest;";
      expect(cleanCompletion("return name", "", suffix, true), suffix)
        .toBe("return name");
      // Nor should matching text after a connector/joiner be cut from the
      // generated token when the model continues an existing identifier.
      const generated = "return first" + continuation + "name";
      expect(cleanCompletion(generated, "", "name;", true), generated)
        .toBe(generated);
    }
    // International identifier text and legitimate punctuation remain intact.
    const hindi = "return नाम\u200cसूची";
    expect(cleanCompletion(hindi, "", "सूची;", true)).toBe(hindi);
    expect(cleanCompletion("return value;;", "", ";", true)).toBe("return value;");
    expect(cleanCompletion("return result", "", "result;", true)).toBe("return ");
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
    expect(cleanCompletion("if ready:\n    ", "", "pass", true)).toBe("if ready:\n    ");
    expect(cleanCompletion("if ready:\n    ", "", "# existing", true)).toBe("if ready:\n    ");
    expect(cleanCompletion("if ready:\n\t", "", "return x", true)).toBe("if ready:\n\t");
  });
  it("trims trailing whitespace only when no source character is adjacent", () => {
    expect(cleanCompletion("return   ", "", ";", true)).toBe("return   ");
    expect(cleanCompletion("return   ", "", "\nresult", true)).toBe("return");
    expect(cleanCompletion("return   ", "", "", true)).toBe("return");
    expect(cleanCompletion("return  ", "", "// existing comment", true)).toBe("return  ");
    expect(cleanCompletion("   ", "", "result", true)).toBe("");
    expect(cleanCompletion("return   \n  done  ", "", "", true)).toBe("return\n  done");
  });
  it("prefers a longer repeated suffix to a one-character identifier coincidence", () => {
    expect(cleanCompletion("ready", "", "ready;", true)).toBe("");
    expect(cleanCompletion("return value\n}", "", "\n}", true)).toBe("return value");
  });
  it("does not truncate generated identifiers that only resemble the unfinished prefix", () => {
    // Both short and long identifier echoes are ambiguous without a token boundary.
    expect(cleanCompletion("foobar()", "foo", "", true)).toBe("foobar()");
    expect(cleanCompletion("functionality()", "function", "", true)).toBe("functionality()");
    expect(cleanCompletion("initializationMode", "const initialization", "", true)).toBe("initializationMode");
    expect(cleanCompletion("константа", "констан", "", true)).toBe("константа");
    expect(cleanCompletion("identifierMore", "const identifier", "", true)).toBe("identifierMore");
  });
  it("treats astral Unicode letters as whole identifier characters in prefix echoes", () => {
    // Deseret (U+10400, U+10401) are genuine non-BMP Unicode letters.
    // A UTF-16 high surrogate alone must never be mistaken for punctuation.
    expect(cleanCompletion("𐐀a𐐁()", "𐐀a", "", true)).toBe("𐐀a𐐁()");
    expect(cleanCompletion("foo𐐀bar", "foo𐐀", "", true)).toBe("foo𐐀bar");
    expect(cleanCompletion("foo𐐀()", "foo𐐀", "", true)).toBe("()");
  });
  it("does not cut Unicode identifiers when cleaning generated suffix overlaps", () => {
    expect(cleanCompletion("𐐀name", "", "name;", true)).toBe("𐐀name");
    expect(cleanCompletion("return ab𐐀", "", "ab𐐀c", true)).toBe("return ab𐐀");
    expect(cleanCompletion("value = 𐐀foo", "", "𐐀foo;", true)).toBe("value = ");
  });
  it("still drops genuine echoed prefix and line fragments at code boundaries", () => {
    expect(cleanCompletion("const answer = 42;", "const answer = ", "", true)).toBe("42;");
    expect(cleanCompletion("function() {", "function", "", true)).toBe("() {");
    expect(cleanCompletion("return value;", "return", "", true)).toBe(" value;");
    expect(cleanCompletion("foo()", "foo", "", true)).toBe("()");
    expect(cleanCompletion("const answer = 42", "something else; const answer = ", "", true)).toBe("42");
  });
  it("removes echoed current line", () => expect(cleanCompletion("let x = 3;", "let x = ", "", true)).toBe("3;"));
  it("rejects conversational responses", () => expect(cleanCompletion("Certainly, I can help", "", "", true)).toBe(""));
  it("removes only indentation already typed on an otherwise blank editor line", () => {
    // On acceptance the editor retains the prefix; repeating its leading
    // spaces would turn four-space Python indentation into eight spaces.
    expect(cleanCompletion("    return value", "def compute():\n    ", "", true)).toBe("return value");
    expect(cleanCompletion("\treturn value", "def compute():\n\t", "", true)).toBe("return value");
    expect(cleanCompletion(" \tresult = x", "def compute():\n \t", "", true)).toBe("result = x");
    expect(cleanCompletion("        pass", "if ready:\n    ", "", true)).toBe("    pass");
    expect(cleanCompletion("        return x\n    # note", "def compute():\n    ", "", true))
      .toBe("    return x\n    # note");
  });
  it("constructs a correctly indented document after accepting ghost text", () => {
    const prefix = "def compute():\n    ";
    const suffix = "\n";
    const candidate = cleanCompletion("    return 42", prefix, suffix, true);
    expect(prefix + candidate + suffix).toBe("def compute():\n    return 42\n");
    const nested = cleanCompletion("        if ready:\n            return 42", prefix, suffix, true);
    expect(prefix + nested + suffix).toBe("def compute():\n        if ready:\n            return 42\n");
  });
  it("keeps genuine new-line indentation and non-blank cursor spacing", () => {
    expect(cleanCompletion("    return value", "def compute():\n", "", true)).toBe("    return value");
    expect(cleanCompletion("\n    return value", "def compute():\n    ", "", true))
      .toBe("\n    return value");
    expect(cleanCompletion("    return value", "if ready: ", "", true)).toBe("    return value");
    expect(cleanCompletion("    return value", "const code = ", "", true)).toBe("    return value");
    expect(cleanCompletion("    return value", "prefix\n  x", "", true)).toBe("    return value");
  });
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
  it("rejects invisible supplementary Unicode tag characters", () => {
    // These U+E0000..U+E007F code points are default-ignorable.
    // Reject the entire generated insertion instead of silently modifying it.
    for (const codePoint of [0xe0001, 0xe0020, 0xe0061, 0xe007f]) {
      const raw = "const value = 1; // " + String.fromCodePoint(codePoint) + " hidden";
      expect(cleanCompletion(raw, "", "", true), codePoint.toString(16)).toBe("");
    }
    // Legitimate non-BMP letters and emoji are not tag characters.
    expect(cleanCompletion("const 𐐀name = '🚀';", "", "", true))
      .toBe("const 𐐀name = '🚀';");
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
  it("removes a complete leading reasoning section before inserting local model code", () => {
    const raw = "<think>\nConsider the requested implementation.\n</think>\nreturn computedValue;";
    expect(cleanCompletion(raw, "", "", true, 8, "python")).toBe("return computedValue;");
    const wrapped = "<|im_start|>assistant\n" + raw + "<|im_end|>";
    expect(cleanCompletion(wrapped, "", "", true, 8, "typescript"))
      .toBe("return computedValue;");
    // The fenced-language gate must still run on the actual code that follows.
    const fence = String.fromCharCode(96).repeat(3);
    const mismatched = "<think>\nDo not insert explanation.\n</think>\n" +
      fence + "python\nprint(1)\n" + fence;
    expect(cleanCompletion(mismatched, "", "", true, 8, "typescript")).toBe("");
    expect(cleanCompletion(mismatched, "", "", true, 8, "python")).toBe("print(1)");
  });

  it("rejects incomplete or ambiguous leading reasoning without exposing it as ghost text", () => {
    for (const raw of [
      "<think>",
      "<think>\nexplanation without closing marker",
      "<think>\nexplanation</think>\nreturn token;",
      "<think>\npart one\n<think>\npart two\n</think>\nreturn token;",
      "<think>\nQuoted </think> does not close the section.\nreturn token;"
    ]) {
      expect(cleanCompletion(raw, "", "", true, 8, "typescript"), raw).toBe("");
    }
    expect(cleanCompletion("<think>\ninternal note\n</think>\n", "", "", true, 8, "rust"))
      .toBe("");
  });

  it("does not rewrite literal reasoning-like tags inside source or HTML", () => {
    for (const source of [
      'const marker = "<think>not a protocol</think>";',
      "const closing = '</think>';",
      'print("<think>literal text</think>")'
    ]) {
      expect(cleanCompletion(source, "", "", true, 8, "python")).toBe(source);
    }
    const markup = "<think>\nvisible custom element\n</think>\n<main>page</main>";
    expect(cleanCompletion(markup, "", "", true, 8, "html")).toBe(markup);
  });

  it("strips model-boundary FIM and chat markers", () => {
    expect(cleanCompletion("<|fim_middle|>return x;<|fim_suffix|>", "", "", true)).toBe("return x;");
    expect(cleanCompletion("let x = 1;<|endoftext|>", "", "", true)).toBe("let x = 1;");
    expect(cleanCompletion("<|im_start|>assistant\n42<|im_end|>", "", "", true)).toBe("42");
  });
  it("unwraps interleaved chat and FIM markers without suggesting model tokens", () => {
    const wrapped = [
      "<|im_start|>assistant\n<|fim_middle|>return x;<|fim_suffix|><|im_end|>",
      "<|fim_middle|><|im_start|>assistant\nreturn x;<|im_end|><|fim_suffix|>",
      "Completion:\n<|fim_middle|>return x;<|endoftext|>",
      "Here's the code:\n<|im_start|>assistant\n<|fim_middle|>return x;<|im_end|> \n<|fim_suffix|>"
    ];
    for (const raw of wrapped) {
      expect(cleanCompletion(raw, "", "", true), raw).toBe("return x;");
    }
  });

  it("rejects leftover protocol headers at response boundaries without changing code strings", () => {
    for (const invalid of [
      "<|im_start|>system\nreturn x;<|im_end|>",
      "  <|im_start|>user\nreturn x;",
      "<|im_start|>assistant",
      "<|fim_suffix|>return x;",
      "return x;<|im_start|>user",
      "<|im_start|>assistant\nreturn x;<|im_start|>user"
    ]) {
      expect(cleanCompletion(invalid, "", "", true), invalid).toBe("");
    }
    const literal = 'const marker = "<|im_start|>";';
    expect(cleanCompletion(literal, "", "", true)).toBe(literal);
    expect(cleanCompletion("<|im_start|>assistant\n" + literal + "<|im_end|>",
      "", "", true)).toBe(literal);
  });

  it("validates fenced languages after nested envelopes and preserves code literals", () => {
    const fence = String.fromCharCode(96).repeat(3);
    const wrapped = "<|im_start|>assistant\n<|fim_middle|>" +
      fence + "python\nprint(1)\n" + fence + "<|fim_suffix|><|im_end|>";
    expect(cleanCompletion(wrapped, "", "", true, 8, "typescript")).toBe("");
    expect(cleanCompletion(wrapped, "", "", true, 8, "python")).toBe("print(1)");
    const literal = 'const m = "<|fim_middle|><|im_end|>";';
    expect(cleanCompletion(literal, "", "", true)).toBe(literal);
  });

  it("rejects excessive nested model envelopes rather than inserting leftover markers", () => {
    const nested = "<|im_start|>assistant\n".repeat(20) + "return x;";
    expect(cleanCompletion(nested, "", "", true)).toBe("");
  });

  it("does not rewrite control-token text inside an ordinary code string", () =>
    expect(cleanCompletion('const s = "<|fim_middle|>";', "", "", true)).toBe('const s = "<|fim_middle|>";'));

});


describe("active-language fenced completion filtering", () => {
  it("rejects clearly mismatched fenced model responses", () => {
    expect(cleanCompletion("```python\nprint(1)\n```", "", "", true, 8, "typescript")).toBe("");
    expect(cleanCompletion("```typescript\nconst x: number = 1;\n```", "", "", true, 8, "python")).toBe("");
    expect(cleanCompletion("```rust\nlet x = 3;\n```", "", "", true, 8, "cpp")).toBe("");
    expect(cleanCompletion("```bash\necho unsafe\n```", "", "", true, 8, "javascript")).toBe("");
    expect(cleanCompletion("```json\n{\"x\": 1}\n```", "", "", true, 8, "python")).toBe("");
  });

  it("accepts recognized aliases for Python, Rust, TSX, C++, Go", () => {
    expect(cleanCompletion("```py\nprint(2)\n```", "", "", true, 8, "python")).toBe("print(2)");
    expect(cleanCompletion("```rs\nlet answer = 3;\n```", "", "", true, 8, "rust")).toBe("let answer = 3;");
    expect(cleanCompletion("```tsx\nconst V = () => <span />;\n```", "", "", true, 8, "typescript"))
      .toBe("const V = () => <span />;");
    expect(cleanCompletion("```c++\nstd::string name;\n```", "", "", true, 8, "cpp"))
      .toBe("std::string name;");
    expect(cleanCompletion("```golang\nfmt.Println(3)\n```", "", "", true, 8, "go"))
      .toBe("fmt.Println(3)");
  });

  it("permits JS in TypeScript and C in C++, but not reverse assumptions", () => {
    expect(cleanCompletion("```javascript\nconst x = 1;\n```", "", "", true, 8, "typescript"))
      .toBe("const x = 1;");
    expect(cleanCompletion("```c\nint x = 1;\n```", "", "", true, 8, "cpp"))
      .toBe("int x = 1;");
    expect(cleanCompletion("```typescript\nconst x: number = 1;\n```", "", "", true, 8, "javascript"))
      .toBe("");
    expect(cleanCompletion("```cpp\nstd::string x;\n```", "", "", true, 8, "c")).toBe("");
  });

  it("recognizes C# fenced output without confusing it with C or C++", () => {
    const example = "public int Value { get; init; }";
    for (const name of ["c#", "cs", "csharp"]) {
      const fenced = "```" + name + "\n" + example + "\n```";
      expect(cleanCompletion(fenced, "", "", true, 8, "csharp")).toBe(example);
      expect(cleanCompletion(fenced, "", "", true, 8, "c")).toBe("");
      expect(cleanCompletion(fenced, "", "", true, 8, "cpp")).toBe("");
    }
    expect(cleanCompletion("```cpp\nint value = 1;\n```",
      "", "", true, 8, "csharp")).toBe("");
    expect(cleanCompletion("```python\nprint(1)\n```",
      "", "", true, 8, "csharp")).toBe("");
    expect(cleanCompletion(example, "", "", true, 8, "csharp")).toBe(example);
  });

  it("accepts CUDA fences only in CUDA mode with safe C++/C fallbacks", () => {
    const code = "__global__ void kernel() {}";
    for (const label of ["cuda", "cuda-cpp", "cu"]) {
      expect(cleanCompletion("```" + label + "\n" + code + "\n```", "", "", true, 8, "cuda-cpp"))
        .toBe(code);
      expect(cleanCompletion("```" + label + "\n" + code + "\n```", "", "", true, 8, "cpp"))
        .toBe("");
    }
    expect(cleanCompletion("```cpp\nint value = 3;\n```", "", "", true, 8, "cuda-cpp"))
      .toBe("int value = 3;");
    expect(cleanCompletion("```c\nint value = 3;\n```", "", "", true, 8, "cuda-cpp"))
      .toBe("int value = 3;");
    expect(cleanCompletion("```python\nprint(1)\n```", "", "", true, 8, "cuda-cpp"))
      .toBe("");
    expect(cleanCompletion("```cu\n" + code, "", "", true, 8, "cuda-cpp"))
      .toBe(code);
  });

  it("preserves plain code, unlabeled fences, unknown custom labels and legacy calls", () => {
    const code = "const x = 1;";
    expect(cleanCompletion(code, "", "", true, 8, "typescript")).toBe(code);
    expect(cleanCompletion("```\nconst x = 1;\n```", "", "", true, 8, "typescript")).toBe(code);
    expect(cleanCompletion("```mydsl\nconst x = 1;\n```", "", "", true, 8, "typescript")).toBe(code);
    expect(cleanCompletion("```constructor\nconst x = 1;\n```", "", "", true, 8, "typescript")).toBe(code);
    expect(cleanCompletion("```python\nprint(1)\n```", "", "", true)).toBe("print(1)");
  });

  it("checks the language of a fenced response even after a known chat introduction", () => {
    const introductions = ["Here's the code:", "Here is the code:", "Here is code:", "Completion:"];
    for (const intro of introductions) {
      const wrong = intro + "\n```python\nprint(1)\n```";
      expect(cleanCompletion(wrong, "", "", true, 8, "typescript"), intro).toBe("");
      const allowed = intro + "\n```typescript\nconst x = 1;\n```";
      expect(cleanCompletion(allowed, "", "", true, 8, "typescript"), intro).toBe("const x = 1;");
    }
    // CRLF and boundary control tokens are normalized before the same validation.
    expect(cleanCompletion("<|im_start|>assistant\r\nHere is the code:\r\n```python\r\nprint(1)\r\n```<|im_end|>",
      "", "", true, 8, "typescript")).toBe("");
    expect(cleanCompletion("<|im_start|>assistant\r\nHere is the code:\r\n```typescript\r\nconst x = 1;\r\n```<|im_end|>",
      "", "", true, 8, "typescript")).toBe("const x = 1;");
  });

  it("rejects unrecognized single-line prose before a code fence rather than inserting markdown", () => {
    for (const before of ["Try this:", "## Suggested implementation", "A quick answer:"]) {
      expect(cleanCompletion(before + "\n```python\nprint(1)\n```",
        "", "", true, 8, "typescript")).toBe("");
      expect(cleanCompletion(before + "\n```typescript\nconst x = 1;\n```",
        "", "", true, 8, "typescript")).toBe("");
    }
  });

  it("preserves ordinary code, string literals and source-exact single fences", () => {
    const source = "const message = \"Here is the code:\";";
    expect(cleanCompletion(source, "", "", true, 8, "typescript")).toBe(source);
    expect(cleanCompletion("```typescript\nlet result = 1;\n```",
      "", "", true, 8, "typescript")).toBe("let result = 1;");
    expect(cleanCompletion("Here is the code:\n```mydsl\nconst custom = 1;\n```",
      "", "", true, 8, "typescript")).toBe("const custom = 1;");
    expect(cleanCompletion("Here is the code:\n```python\nprint(1)",
      "", "", true, 8, "typescript")).toBe("");
    expect(cleanCompletion("Here is the code:\n```typescript\nconst x = 1;",
      "", "", true, 8, "typescript")).toBe("const x = 1;");
  });

  it("checks indented and whitespace-separated fence labels before extracting code", () => {
    const fence = "```";
    for (const separator of [" ", "  ", "\t", " \t"]) {
      const wrong = "  " + fence + separator + "python\nprint(1)\n" + fence;
      const right = "  " + fence + separator + "typescript\nconst ok = 1;\n" + fence;
      expect(cleanCompletion(wrong, "", "", true, 8, "typescript"), separator).toBe("");
      expect(cleanCompletion(right, "", "", true, 8, "typescript"), separator)
        .toBe("const ok = 1;");
      expect(cleanCompletion(fence + separator + "python\nprint(1)", "", "", true, 8, "typescript"))
        .toBe("");
      expect(cleanCompletion(fence + separator + "typescript\nconst ok = 1;",
        "", "", true, 8, "typescript")).toBe("const ok = 1;");
    }
    // Unknown labels and unlabeled code still follow the legacy behavior.
    expect(cleanCompletion("``` custom\nconst x = 1;\n```",
      "", "", true, 8, "typescript")).toBe("const x = 1;");
    expect(cleanCompletion("```  \nconst x = 1;\n```",
      "", "", true, 8, "typescript")).toBe("const x = 1;");
    // A nested chat wrapper must not bypass the same check.
    expect(cleanCompletion("<|im_start|>assistant\n``` python\nprint(1)\n```<|im_end|>",
      "", "", true, 8, "typescript")).toBe("");
  });

  it("also checks a truncated fence header while allowing compatible partial code", () => {
    expect(cleanCompletion("```python\nprint(1)", "", "", true, 8, "typescript")).toBe("");
    expect(cleanCompletion("```typescript\nconst ok = 1;", "", "", true, 8, "typescript"))
      .toBe("const ok = 1;");
  });

  it("preserves inline triple backticks inside fenced code instead of truncating", () => {
    const fence = String.fromCharCode(96).repeat(3);
    const source = [
      'const literal = "' + fence + '";',
      "console.log(literal);"
    ].join("\n");
    expect(cleanCompletion(fence + "typescript\n" + source + "\n" + fence,
      "", "", true, 8, "typescript")).toBe(source);
    // Only a standalone closing fence ends a block, even with indentation
    // and explanatory prose after the actual closing delimiter.
    const withExplanation = fence + " typescript\n" + source +
      "\n  " + fence + "\nExplanation: the string contains three ticks.";
    expect(cleanCompletion(withExplanation, "", "", true, 8, "typescript")).toBe(source);
    // An incomplete response with no standalone closing line retains source.
    expect(cleanCompletion(fence + "typescript\n" + source,
      "", "", true, 8, "typescript")).toBe(source);
  });

  it("preserves unfenced code comments ending with triple backticks", () => {
    const source = 'return result; // ' + String.fromCharCode(96).repeat(3);
    expect(cleanCompletion(source, "", "", true, 8, "typescript")).toBe(source);
    const python = "return result  # " + String.fromCharCode(96).repeat(3);
    expect(cleanCompletion(python, "", "", true, 8, "python")).toBe(python);
  });

  it("still rejects mismatched languages when code contains inline fences", () => {
    const fence = String.fromCharCode(96).repeat(3);
    const source = 'const marker = "' + fence + '";\nreturn marker;';
    expect(cleanCompletion(fence + "python\n" + source + "\n" + fence,
      "", "", true, 8, "typescript")).toBe("");
    expect(cleanCompletion(fence + "typescript\n" + source + "\n" + fence,
      "", "", true, 8, "typescript")).toBe(source);
  });

  it("does not misread a code-string containing fence markers as a fence", () => {
    const text = 'const example = "```python";';
    expect(cleanCompletion(text, "", "", true, 8, "typescript")).toBe(text);
  });
});
