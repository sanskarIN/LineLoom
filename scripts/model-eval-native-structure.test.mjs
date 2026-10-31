import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { inspectNativeGeneratedStructure as inspect } from "./model-eval-native-structure.mjs";

const fixture = (language, prefix = "fn f() { ", suffix = " }") => ({ language, prefix, suffix });

test("checks delimiter pairs across all three native generated FIM insertions", () => {
  for (const language of ["rust", "c", "cpp"]) {
    const input = fixture(language);
    assert.equal(inspect(input, "(2 + 3)"), "clean");
    assert.equal(inspect(input, "([2 + 3)"), "mismatch");
    assert.equal(inspect(input, "foo(]"), "mismatch");
  }
});

test("scanner ignores misleading delimiters inside comments and literals", () => {
  for (const language of ["rust", "c", "cpp"]) {
    assert.equal(inspect(fixture(language), '"[ {" /* ) ] */ (2)'), "clean");
    assert.equal(inspect(fixture(language), '"unterminated'), "mismatch");
    assert.equal(inspect(fixture(language), "/* unterminated"), "mismatch");
  }
});

test("supports nested Rust comments, lifetimes and 255-hash raw strings", () => {
  assert.equal(inspect(fixture("rust"), "/* { /* [ */ } */ (1)"), "clean");
  assert.equal(inspect(fixture("rust"), "let x: &'a str = r###\"{[(\"###;"), "clean");
  assert.equal(inspect(fixture("rust"), "let x = r" + "#".repeat(255) + '"{"' + "#".repeat(255) + ";"), "clean");
  assert.equal(inspect(fixture("rust"), "let x = r###\"{;"), "mismatch");
  assert.equal(inspect(fixture("rust"), "let x = r#ident;"), "clean");
  assert.equal(inspect(fixture("rust"), "let x = r" + "#".repeat(256) + '"{ }"' + "#".repeat(256) + ";"), "unchecked");
});

test("handles C++ raw strings and ordinary C/C++ headers", () => {
  assert.equal(inspect(fixture("cpp", "#include <vector>\nint f() { "),
    'const char *s = R"tag({)]} /*ignored*/)tag";'), "clean");
  assert.equal(inspect(fixture("cpp"), 'R"tag({")'), "mismatch");
  assert.equal(inspect(fixture("c", "#define OPEN_PAREN (\nint f() { "), "0;"), "unchecked");
});

test("a malformed input is unchecked, never silently accepted as valid syntax", () => {
  assert.equal(inspect(null, ")"), "unchecked");
  assert.equal(inspect(fixture("python"), ")"), "unchecked");
  assert.equal(inspect(fixture("rust"), null), "unchecked");
  assert.equal(inspect(fixture("c"), "a".repeat(20000)), "unchecked");
  assert.equal(inspect(fixture("c"), "\0"), "unchecked");
});

test("all 24 checked-in native reference FIM insertions scan clean", () => {
  const { fixtures } = JSON.parse(readFileSync(
    new URL("../model/fixtures/completion-v1.json", import.meta.url), "utf8"
  ));
  const native = fixtures.filter(item => ["rust", "c", "cpp"].includes(item.language));
  assert.equal(native.length, 24);
  for (const item of native) {
    assert.equal(inspect(item, item.expected), "clean", item.id);
  }
});
