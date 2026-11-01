import { describe, expect, it } from "vitest";
import { nativeContextHints, scanNativeCode } from "../../src/languages/native-context";
import { buildPrompt } from "../../src/completion/prompt";
import { extractContext } from "../../src/context/extract";
import { getLanguage } from "../../src/languages/registry";

const generic = "generic-local:latest";
const prompt = (language: "c" | "cpp", source: string, model = generic, related: string[] = []) =>
  buildPrompt(getLanguage(language)!, extractContext(source, source.length, 30_000), model, related);

describe("C/C++ source-aware instruction context", () => {
  it("recognizes C allocations, declarations, callbacks and conditional directives", () => {
    const source = "#ifdef CONFIG\nstruct Buffer { unsigned char *data; };\n" +
      "void (*callback)(int); void *p = malloc(32);\n";
    const value = prompt("c", source).prompt;
    expect(value).toContain("C pointers and allocation:");
    expect(value).toContain("C declarations:");
    expect(value).toContain("C callbacks:");
    expect(value).toContain("C/C++ preprocessing:");
    expect(value).not.toContain("C++ templates and constraints:");
  });

  it("recognizes C++ templates, resource lifetimes, lambdas and coroutines", () => {
    const source = "template <typename T> concept Sized = requires(T t) { t.size(); };\n" +
      "auto ptr = std::make_unique<T>();\n" +
      "auto f = [&, ptr = std::move(ptr)](int n) mutable { co_return n; ";
    const value = prompt("cpp", source).prompt;
    expect(value).toContain("C++ templates and constraints:");
    expect(value).toContain("C++ resource lifetime:");
    expect(value).toContain("C++ lambdas:");
    expect(value).toContain("C++ coroutines:");
    expect(value).not.toContain("C pointers and allocation:");
  });

  it("caps context guidance and never includes identifiers or source snippets in hints", () => {
    const source = "#define PRIVATE_MACRO 1\n" +
      "template <typename SECRET_ID> struct Example { std::unique_ptr<SECRET_ID> ptr; };\n" +
      "auto f = [&, secret = 1]() noexcept { co_return secret; };";
    const hints = nativeContextHints(source, "cpp");
    expect(hints).toHaveLength(4);
    for (const hint of hints) {
      expect(hint).not.toContain("PRIVATE_MACRO");
      expect(hint).not.toContain("SECRET_ID");
      expect(hint).not.toContain("secret = 1");
    }
  });

  it("does not infer C++ features from comments, ordinary strings, or character literals", () => {
    const source = "/* template <typename Hidden> and std::move(hidden) */\n" +
      "const char *s = \"co_return []() { std::unique_ptr<Hidden>\";\n" +
      "char c = '[';\n";
    expect(nativeContextHints(source, "cpp")).toEqual([]);
    const c = scanNativeCode(source, "cpp");
    expect(c.code).not.toContain("Hidden");
    expect(c.code).not.toContain("unique_ptr");
    expect(c.state).toBe("code");
  });

  it("preserves comment and string cursor behavior without injecting code instructions", () => {
    for (const language of ["c", "cpp"] as const) {
      expect(prompt(language, "int n = 1; // std::move(x); template <typename T>"))
        .toHaveProperty("prompt", expect.stringContaining("continue only comment text"));
      expect(nativeContextHints("/* malloc(1) std::move(x)", language)).toEqual([
        expect.stringContaining("continue only comment text")
      ]);
      expect(nativeContextHints('const char *s = "template<typename T>', language)).toEqual([
        expect.stringContaining("continue literal content")
      ]);
      expect(nativeContextHints("char c = '\\", language)).toEqual([
        expect.stringContaining("continue literal content")
      ]);
    }
  });

  it("splices C/C++ line continuations before recognizing comments", () => {
    for (const language of ["c", "cpp"] as const) {
      for (const newline of ["\n", "\r\n"]) {
        const source = "int n = 1; // continued \\" + newline + " std::move(ptr); template <typename T>";
        const scan = scanNativeCode(source, language);
        expect(scan.state).toBe("line-comment");
        expect(scan.code).not.toContain("std::move");
        expect(nativeContextHints(source, language)).toEqual([
          expect.stringContaining("continue only comment text")
        ]);
      }
    }
    const source = "#include <stdlib.h>\nvoid *p = malloc(24);";
    expect(nativeContextHints(source, "c").join(" ")).toContain("allocation");
  });

  it("recognizes and masks C++ raw strings with custom delimiters and prefixes", () => {
    for (const marker of ['R"tag(', 'u8R"tag(', 'uR"tag(', 'UR"tag(', 'LR"tag(']) {
      const open = "auto sample = " + marker +
        "std::make_unique<T>(); /* not a comment */ template <class Hidden>\n";
      const inside = scanNativeCode(open, "cpp");
      expect(inside.state).toBe("raw-string");
      expect(inside.code).not.toContain("make_unique");
      expect(nativeContextHints(open, "cpp")).toEqual([
        expect.stringContaining("continue literal content")
      ]);
      const closed = open + ')tag";\nconstexpr int real = 42;';
      expect(scanNativeCode(closed, "cpp").state).toBe("code");
      expect(nativeContextHints(closed, "cpp").join(" ")).toContain("constexpr");
      expect(nativeContextHints(closed, "cpp").join(" ")).not.toContain("smart-pointer");
    }
  });

  it("handles escaped quotes and closed multiline block comments", () => {
    const source = 'const char *s = "a\\\" // std::move(fake)";\n' +
      "/* comment \n template <typename Fake> */\n" +
      "template <typename Real> class Box {};\n";
    const scan = scanNativeCode(source, "cpp");
    expect(scan.state).toBe("code");
    expect(scan.code).not.toContain("Fake");
    expect(scan.code).toContain("template <typename Real>");
    expect(nativeContextHints(source, "cpp").join(" ")).toContain("templates and constraints");
  });

  it("uses fixed hints with instruction models, preserves byte-exact native FIM", () => {
    for (const language of ["c", "cpp"] as const) {
      const source = language === "c" ? "struct Node { int value; };\nNode *n = " :
        "template <typename T> struct Box {};\nauto item = ";
      const ctx = extractContext(source + "already_here;", source.length, 30_000);
      const instructions = buildPrompt(getLanguage(language)!, ctx, generic);
      expect(instructions.suffix).toBeUndefined();
      expect(instructions.prompt).toContain(language === "c" ? "C declarations:" :
        "C++ templates and constraints:");
      const refs = buildPrompt(getLanguage(language)!, ctx, "qwen2.5-coder:1.5b", [
        "PRIVATE_REFERENCE"
      ]);
      expect(refs.prompt).toContain("untrusted reference data");
      expect(refs.prompt).toContain("PRIVATE_REFERENCE");
      for (const model of ["qwen2.5-coder:1.5b", "lineloom-code:dev"]) {
        const fim = buildPrompt(getLanguage(language)!, ctx, model);
        expect(fim).toEqual({ prompt: ctx.prefix, suffix: ctx.suffix });
      }
    }
  });

  it("leaves other-language instruction guidance unchanged", () => {
    const source = "template <typename T> struct Fake {};\n";
    for (const language of ["python", "typescript", "rust"] as const) {
      const value = buildPrompt(getLanguage(language)!, extractContext(source, source.length, 512), generic);
      expect(value.prompt).not.toContain("C++ templates and constraints:");
      expect(value.prompt).not.toContain("C declarations:");
    }
  });
});
