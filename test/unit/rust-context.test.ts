import { describe, expect, it } from "vitest";
import { rustContextHints, scanRustCode } from "../../src/languages/rust-context";
import { buildPrompt } from "../../src/completion/prompt";
import { getLanguage } from "../../src/languages/registry";
import { extractContext } from "../../src/context/extract";

const rust = getLanguage("rust")!;
const typescript = getLanguage("typescript")!;

function prompt(text: string, model = "generic-local:latest"): string {
  return buildPrompt(rust, extractContext(text, text.length, 30_000), model).prompt;
}

describe("Rust feature-aware autocomplete guidance", () => {
  it("recognizes match patterns and guards without inventing pattern bindings", () => {
    const hints = rustContextHints("fn f(item: Option<i32>) { match item { Some(value) if value > 0 => ");
    expect(hints.some(h => h.includes("match arms"))).toBe(true);
    expect(prompt("match result { Ok(value) => ")).toContain("pattern bindings");
  });

  it("supports Result/Option propagation and preserves return contracts", () => {
    const text = "fn parse(raw: &str) -> Result<u32, Error> {\n let value = raw.parse::<u32>()?;\n ";
    expect(prompt(text)).toContain("use ? only when");
    expect(prompt("fn f(v: Option<i32>) -> Option<i32> { Some(")).toContain("Result/Option:");
  });

  it("recognizes async blocks and awaits without claiming to type check", () => {
    expect(prompt("async fn fetch() -> Result<(), Error> {\n client.send().await; \n"))
      .toContain("borrowing across suspension");
    expect(prompt("let task = async move {")).toContain("Future and .await");
  });

  it("recognizes trait impls, associated types, and where-bound generics", () => {
    const text = "impl<T> Stream for MySource<T> where T: Send {\n fn poll_next(&mut self) -> ";
    const value = prompt(text);
    expect(value).toContain("trait method signatures");
    expect(value).toContain("where clauses");
    expect(value).toContain("Rust ownership:");
  });

  it("recognizes references, iterator adapters, closures and owned moves", () => {
    expect(prompt("fn borrow<'a>(x: &'a mut String) {")).toContain("Rust ownership");
    const iter = prompt("fn total(xs: &[i32]) { xs.iter().map(|value| ");
    expect(iter).toContain("iterator adapters");
    expect(prompt("let closure = move |x: i32| ")).toContain("closure captures");
  });

  it("recognizes Rust macros without treating raw source as an instruction", () => {
    const invocation = prompt('fn main() { println!("done"); format!("text: {}", ');
    expect(invocation).toContain("token-tree syntax");
    expect(prompt("macro_rules! pair { ($first:expr, $second:expr) => "))
      .toContain("macro_rules!");
  });

  it("never treats content inside comments as executable Rust syntax", () => {
    const text = "fn f() {}\n/* match sample { \n /* async fn foo() -> Result<()> */\n trait Bad { } */\n";
    const hints = rustContextHints(text);
    expect(hints).toEqual([]);
    const line = prompt("fn f() { // match item { => async fn");
    expect(line).toContain("continue only comment text");
    expect(line).not.toContain("Rust match arms:");
  });

  it("handles nested block comments, then resumes scanning code after closure", () => {
    const scan = scanRustCode("/* outer /* inner */ still outer */ async fn run() {}");
    expect(scan.state).toBe("code");
    expect(scan.code).not.toContain("outer");
    expect(scan.code).toContain("async fn run");
    expect(rustContextHints("/* nested /* comment */ match unused { */ async fn f() {"))
      .toEqual(expect.arrayContaining([expect.stringContaining("Future and .await")]));
  });

  it("does not activate code guidance inside ordinary, byte or raw strings", () => {
    for (const text of [
      'let s = "match x { async fn f()',
      'let s = b"Result<Some> macro_rules!',
      'let s = r#"async fn run() -> Result<Option<i32>>"',
      'let s = br###"trait Test { match x {',
    ]) {
      const hints = rustContextHints(text);
      expect(hints).toHaveLength(1);
      expect(hints[0]).toContain("Rust string literal");
    }
    const completed = 'let s = r##"async fn f() -> Result<Ok>"##;\n';
    expect(rustContextHints(completed)).toEqual([]);
    expect(scanRustCode('let key = r#type;\nasync fn f() {}').code)
      .toContain("r#type");
  });

  it("does not misclassify Rust lifetimes as character literals", () => {
    const scan = scanRustCode("fn borrow<'a>(x: &'a str) -> &'a str { x }");
    expect(scan.code).toContain("borrow<'a>");
    expect(scan.code).toContain("&'a");
    const literal = scanRustCode("let c = 'a'; let escape = '\\n'; impl Trait for X {}");
    expect(literal.code).not.toContain("'a'");
    expect(literal.code).toContain("impl Trait");
  });

  it("keeps untrusted comment/string content out of safe fixed hints", () => {
    const secret = "PRIVATE_TOKEN_DO_NOT_ECHO_123";
    const hints = rustContextHints("fn f() { /* " + secret + " trait Foo async fn */ match input {");
    expect(hints.some(h => h.includes("match arms"))).toBe(true);
    expect(JSON.stringify(hints)).not.toContain(secret);
    const value = prompt("fn f() { /* " + secret + " */ let item = Ok(");
    const generatedHints = value.split("Language: Rust.")[1]?.split("Code before cursor")[0] ?? "";
    expect(generatedHints).toContain("Result/Option");
    expect(generatedHints).not.toContain(secret);
  });

  it("keeps native FIM requests for local supported models byte-exact", () => {
    const source = "fn parse(x: Result<i32, Error>) -> Result<i32, Error> { x?";
    const ctx = extractContext(source + " }", source.length, 3000);
    for (const model of ["qwen2.5-coder:1.5b", "lineloom-code:dev"]) {
      const built = buildPrompt(rust, ctx, model);
      expect(built).toEqual({ prompt: ctx.prefix, suffix: ctx.suffix });
      expect(built.prompt).not.toContain("Rust Result/Option:");
    }
  });

  it("never adds Rust advice to another language or changes related-file policy", () => {
    const ctx = extractContext("let value = async fn match Result<", 34, 2048);
    const other = buildPrompt(typescript, ctx, "generic-local:latest").prompt;
    expect(other).not.toContain("Rust match arms:");
    const related = buildPrompt(rust, ctx, "qwen2.5-coder:1.5b", ["trait Other {}"]);
    expect(related.suffix).toBeUndefined();
    expect(related.prompt).toContain("untrusted reference data");
    expect(related.prompt).toContain("Language: Rust.");
  });

  it("caps the Rust context hints to a small fixed set with no interpolated snippets", () => {
    const source = 'async fn f<\'a, T>(v: &\'a mut T) -> Result<(), E> where T: Send {\n match x { Ok(v) => v.iter().map(|x| format!("{}", x)).collect::<Vec<_>>(), ';
    const hints = rustContextHints(source);
    expect(hints.length).toBeLessThanOrEqual(4);
    expect(hints.every(x => x.length < 190)).toBe(true);
    expect(new Set(hints).size).toBe(hints.length);
    expect(rustContextHints("")).toEqual([]);
    expect(rustContextHints("fn ordinary() { let value = 1; ")).toEqual([]);
  });
});
