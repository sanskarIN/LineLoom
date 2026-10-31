#!/usr/bin/env node
/**
 * Compile-check ONLY the checked-in ORIGINAL expected FIM insertions for
 * Rust, C and C++. This is reference-fixture QA, NOT generated-model QA.
 * No workspace/source discovery, inference, executables or network calls.
 * A compiler may preprocess headers; run only against the reviewed public
 * synthetic fixtures, never private/unknown code.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const REFERENCE_LANGUAGES = Object.freeze(["rust", "c", "cpp"]);
const COMPILER_CANDIDATES = Object.freeze({
  rust: ["rustc"], c: ["clang", "gcc"], cpp: ["clang++", "g++"]
});
const MAX_SOURCE_BYTES = 16_384;
const COMPILER_TIMEOUT_MS = 5_000;
const CLEAN_ENV_KEYS = ["PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "TMPDIR", "LANG", "LC_ALL"];
const CLEAN_ENV = Object.fromEntries(CLEAN_ENV_KEYS.filter(k => typeof process.env[k] === "string")
  .map(k => [k, process.env[k]]));

/** No stdout/stderr is captured in reports; compiler failures may contain code. */
function spawnBounded(spawn, command, args, source = undefined) {
  return spawn(command, args, {
    input: source, encoding: "utf8", windowsHide: true, shell: false,
    timeout: COMPILER_TIMEOUT_MS, maxBuffer: 1024, env: CLEAN_ENV,
    stdio: ["pipe", "ignore", "ignore"]
  });
}

export function selectNativeCompiler(language, spawn = spawnSync) {
  if (!REFERENCE_LANGUAGES.includes(language)) throw Error("invalid-reference-language");
  for (const command of COMPILER_CANDIDATES[language]) {
    const check = spawnBounded(spawn, command, ["--version"]);
    if (!check.error && check.status === 0 && !check.signal) return command;
  }
  return null;
}

/**
 * The caller must supply one of the checked-in *reference* fixtures.
 * Return only fixed status enums. Do not send model output to compilers.
 */
export function checkNativeReference(fixture, { spawn = spawnSync, compiler = undefined } = {}) {
  if (!fixture || !REFERENCE_LANGUAGES.includes(fixture.language) ||
      !["prefix", "suffix", "expected"].every(k => typeof fixture[k] === "string") ||
      !fixture.prefix || !fixture.expected) throw Error("invalid-reference-fixture");
  const source = fixture.prefix + fixture.expected + fixture.suffix;
  if (Buffer.byteLength(source, "utf8") > MAX_SOURCE_BYTES || source.includes("\0")) {
    throw Error("reference-source-too-large");
  }
  const command = compiler === undefined ? selectNativeCompiler(fixture.language, spawn) : compiler;
  if (command === null) return "unchecked";
  if (!COMPILER_CANDIDATES[fixture.language].includes(command)) throw Error("invalid-reference-compiler");

  // rustc emits metadata into a disposable directory; never link or execute.
  // C/C++ compilers use -fsyntax-only and write no object or executable.
  const temporary = fixture.language === "rust" ? mkdtempSync(join(tmpdir(), "lineloom-reference-")) : null;
  try {
    const args = fixture.language === "rust"
      ? ["--crate-name", "lineloom_reference", "--crate-type=lib", "--edition=2021",
        "--emit=metadata", "-o", join(temporary, "reference.rmeta"), "-"]
      : ["-std=" + (fixture.language === "c" ? "c11" : "c++17"),
        "-fsyntax-only", "-x", fixture.language === "c" ? "c" : "c++", "-"];
    const result = spawnBounded(spawn, command, args, source);
    // A signal, timeout, missing tool or abnormal transport cannot count as
    // a source-code failure; only a completed nonzero compiler exit can.
    if (result.error || result.signal || !Number.isInteger(result.status)) return "unchecked";
    return result.status === 0 ? "passed" : "failed";
  } finally {
    if (temporary) rmSync(temporary, { recursive: true, force: true });
  }
}

export function summarizeNativeReferences(fixtures, { spawn = spawnSync } = {}) {
  if (!Array.isArray(fixtures) || fixtures.length === 0 || fixtures.length > 100) {
    throw Error("invalid-reference-scope");
  }
  const counts = Object.fromEntries(REFERENCE_LANGUAGES.map(language =>
    [language, { compiler: null, checked: 0, passed: 0, failed: 0, unchecked: 0 }]));
  for (const language of REFERENCE_LANGUAGES) {
    const compiler = selectNativeCompiler(language, spawn);
    counts[language].compiler = compiler;
    for (const fixture of fixtures.filter(item => item?.language === language)) {
      const outcome = checkNativeReference(fixture, { spawn, compiler });
      if (outcome === "unchecked") counts[language].unchecked++;
      else { counts[language].checked++; counts[language][outcome]++; }
    }
  }
  return { scope: "public-expected-insertions-only", generatedCodeChecked: false,
    sourceLogged: false, executedGeneratedPrograms: false, byLanguage: counts };
}

function main(argv) {
  if (argv.length > 1 || (argv.length === 1 && argv[0] !== "--require-all")) {
    throw Error("invalid-reference-options");
  }
  const path = fileURLToPath(new URL("../model/fixtures/completion-v1.json", import.meta.url));
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.fixtures) ||
      parsed.fixtures.length !== 30 || REFERENCE_LANGUAGES.some(language =>
        parsed.fixtures.filter(fixture => fixture.language === language).length !== 6)) {
    throw Error("invalid-reference-coverage");
  }
  const report = summarizeNativeReferences(parsed.fixtures);
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  const languages = Object.values(report.byLanguage);
  if (languages.some(item => item.failed > 0) ||
      (argv[0] === "--require-all" && languages.some(item => item.unchecked > 0))) {
    process.exitCode = 1;
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); }
  catch { process.stderr.write("Native reference QA failed; verify fixtures and toolchains.\n"); process.exitCode = 1; }
}
