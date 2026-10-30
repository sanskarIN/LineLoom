/**
 * Source-private parser-only syntax evidence for original synthetic TypeScript
 * completions. No evaluation, AST execution, filesystem reads or diagnostics
 * leave this function. Other languages are deliberately marked unchecked.
 */
import ts from "typescript";

export const GENERATED_SYNTAX_METHOD = "typescript-parser-only-v1";
export const MAX_SYNTHETIC_TS_CHARS = 16_384;
export const GENERATED_SYNTAX_OUTCOMES = Object.freeze(["passed", "failed", "unchecked"]);

/**
 * Invoked only with checked-in synthetic fixtures by the opt-in local model
 * evaluator. Never use this as a safety check for arbitrary workspace code.
 */
export function classifyGeneratedSyntax(fixture, insertion) {
  if (!fixture || typeof fixture !== "object" ||
      typeof fixture.language !== "string" || typeof insertion !== "string") {
    throw Error("invalid-generated-syntax-input");
  }
  if (fixture.language !== "typescript") return "unchecked";
  if (typeof fixture.prefix !== "string" || typeof fixture.suffix !== "string") {
    throw Error("invalid-typescript-fixture");
  }
  const source = fixture.prefix + insertion + fixture.suffix;
  if (source.length > MAX_SYNTHETIC_TS_CHARS) throw Error("generated-syntax-input-too-large");
  // Source text, AST and diagnostic messages are local variables only.
  // createSourceFile only parses grammar: it never runs the generated code.
  const parsed = ts.createSourceFile(
    "lineloom-public-fim.ts", source, ts.ScriptTarget.ES2020, false, ts.ScriptKind.TS
  );
  return parsed.parseDiagnostics.length ? "failed" : "passed";
}
