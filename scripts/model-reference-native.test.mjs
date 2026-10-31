import assert from "node:assert/strict";
import test from "node:test";
import {
  selectNativeCompiler, checkNativeReference, summarizeNativeReferences
} from "./model-reference-native.mjs";

const reference = language => ({ language, prefix: "fn f() { ", expected: "1", suffix: " }" });
const mock = ({ available = ["rustc", "clang", "clang++"], failOnSource = false,
  timeoutOnSource = false, calls = [] } = {}) => (command, args, options) => {
  calls.push({ command, args, options });
  if (!available.includes(command)) return { status: null, error: { code: "ENOENT" } };
  if (args.includes("--version")) return { status: 0 };
  if (timeoutOnSource) return { status: null, error: { code: "ETIMEDOUT" }, signal: "SIGTERM" };
  return { status: failOnSource ? 1 : 0 };
};

test("selects available native compilers in a documented priority order", () => {
  const spawn = mock({ available: ["gcc", "g++"] });
  assert.equal(selectNativeCompiler("c", spawn), "gcc");
  assert.equal(selectNativeCompiler("cpp", spawn), "g++");
  assert.equal(selectNativeCompiler("rust", spawn), null);
  assert.throws(() => selectNativeCompiler("python", spawn), /invalid-reference-language/);
});

test("Rust only emits library metadata, C and C++ only perform syntax checks", () => {
  for (const [language, command] of [["rust", "rustc"], ["c", "clang"], ["cpp", "clang++"]]) {
    const calls = [];
    assert.equal(checkNativeReference(reference(language), { compiler: command, spawn: mock({ calls }) }), "passed");
    const { args, options } = calls.at(-1);
    assert.equal(options.input, "fn f() { 1 }");
    assert.equal(options.shell, false);
    assert.equal(options.stdio[1], "ignore");
    assert.equal(options.stdio[2], "ignore");
    assert.ok(args.includes("-"));
    if (language === "rust") {
      assert.ok(args.includes("--crate-type=lib"));
      assert.ok(args.includes("--emit=metadata"));
      assert.ok(!args.includes("--test"));
    } else {
      assert.ok(args.includes("-fsyntax-only"));
      assert.ok(!args.includes("-o"));
    }
  }
});

test("compiler failure differs from unavailable or timed-out compiler", () => {
  const fixture = reference("cpp");
  assert.equal(checkNativeReference(fixture, { compiler: "clang++",
    spawn: mock({ failOnSource: true }) }), "failed");
  assert.equal(checkNativeReference(fixture, { compiler: "clang++",
    spawn: mock({ timeoutOnSource: true }) }), "unchecked");
  assert.equal(checkNativeReference(fixture, { spawn: mock({ available: [] }) }), "unchecked");
});

test("rejects arbitrary compiler commands and invalid/unbounded references", () => {
  assert.throws(() => checkNativeReference(reference("c"), { compiler: "bash" }),
    /invalid-reference-compiler/);
  assert.throws(() => checkNativeReference({ ...reference("rust"), expected: "X".repeat(20000) }),
    /reference-source-too-large/);
  assert.throws(() => checkNativeReference({ ...reference("cpp"), suffix: "\0" }),
    /reference-source-too-large/);
  assert.throws(() => checkNativeReference({ language: "typescript" }), /invalid-reference-fixture/);
});

test("aggregate result contains no fixture IDs, source, compiler stderr or generated-code claims", () => {
  const source = "PRIVATE_TEST_SOURCE_DO_NOT_REPORT";
  const cases = ["rust", "c", "cpp"].map(language => ({ ...reference(language), expected: source }));
  const report = summarizeNativeReferences(cases, { spawn: mock({ available: ["gcc", "g++"] }) });
  assert.equal(report.generatedCodeChecked, false);
  assert.equal(report.byLanguage.rust.unchecked, 1);
  assert.equal(report.byLanguage.c.passed, 1);
  assert.equal(report.byLanguage.cpp.passed, 1);
  const printed = JSON.stringify(report);
  assert.ok(!printed.includes(source));
  assert.ok(!printed.includes("fixtureId"));
});
