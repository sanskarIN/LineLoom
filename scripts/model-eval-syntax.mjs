/**
 * Parser-only grammar evidence from checked-in, original synthetic FIM fixtures.
 * TypeScript uses the locked local parser. Python uses stdlib ast.parse in a
 * bounded, isolated interpreter: source passes over stdin, is never executed,
 * saved or included in report fields. Rust, C and C++ remain unchecked.
 */
import { spawnSync } from "node:child_process";
import ts from "typescript";

export const GENERATED_SYNTAX_METHOD = "python-ast-typescript-parser-v1";
export const MAX_SYNTHETIC_TS_CHARS = 16_384;
export const MAX_SYNTHETIC_PY_CHARS = 8_192;
export const GENERATED_SYNTAX_OUTCOMES = Object.freeze(["passed", "failed", "unchecked"]);

const PYTHON_AST_SCRIPT = [
  "import ast,sys",
  "try:",
  "    source = sys.stdin.read(8193)",
  "    if len(source) > 8192: sys.exit(2)",
  "    try: ast.parse(source, filename='<public-fim-syntax>', mode='exec')",
  "    except (SyntaxError, ValueError, TypeError, RecursionError): print('failed')",
  "    else: print('passed')",
  "except (OSError, UnicodeError, MemoryError): sys.exit(2)"
].join("\n");
const PYTHON_ENV_KEYS = [
  "PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "TMPDIR", "LANG", "LC_ALL"
];
const PYTHON_ENV = Object.fromEntries(
  PYTHON_ENV_KEYS.filter(key => typeof process.env[key] === "string")
    .map(key => [key, process.env[key]])
);

/**
 * Return unchecked if the local Python interpreter is missing or the parser
 * is unavailable. Never confuse an instrumentation failure with malformed
 * generated code. Python execution uses no shell, -I -S isolation and a
 * fixed script; model-generated source is stdin data, never a command.
 */
function classifyPythonSource(source) {
  const executable = process.platform === "win32" ? "python" : "python3";
  const result = spawnSync(executable, ["-I", "-S", "-X", "utf8", "-c", PYTHON_AST_SCRIPT], {
    input: source, encoding: "utf8", timeout: 2_500, maxBuffer: 128,
    windowsHide: true, env: PYTHON_ENV, stdio: ["pipe", "pipe", "ignore"]
  });
  if (result.status !== 0 || result.error ||
      !/^(?:passed|failed)\r?\n$/.test(result.stdout)) {
    return "unchecked";
  }
  return result.stdout.trim();
}

/**
 * Invoked only with the checked-in public synthetic fixtures by the opt-in
 * local evaluator. Never use as a check for arbitrary editor/workspace code.
 */
export function classifyGeneratedSyntax(fixture, insertion) {
  if (!fixture || typeof fixture !== "object" ||
      typeof fixture.language !== "string" || typeof insertion !== "string") {
    throw Error("invalid-generated-syntax-input");
  }
  if (fixture.language !== "typescript" && fixture.language !== "python") return "unchecked";
  if (typeof fixture.prefix !== "string" || typeof fixture.suffix !== "string") {
    throw Error("invalid-generated-syntax-fixture");
  }
  const source = fixture.prefix + insertion + fixture.suffix;
  if (fixture.language === "python") {
    if (source.length > MAX_SYNTHETIC_PY_CHARS) throw Error("generated-syntax-input-too-large");
    return classifyPythonSource(source);
  }
  if (source.length > MAX_SYNTHETIC_TS_CHARS) throw Error("generated-syntax-input-too-large");
  // Source text, AST and diagnostics are local variables only.
  // createSourceFile only parses grammar: it never runs generated code.
  const parsed = ts.createSourceFile(
    "lineloom-public-fim.ts", source, ts.ScriptTarget.ES2020, false, ts.ScriptKind.TS
  );
  return parsed.parseDiagnostics.length ? "failed" : "passed";
}
