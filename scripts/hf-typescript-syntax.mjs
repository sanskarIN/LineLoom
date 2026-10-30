#!/usr/bin/env node
/**
 * Local-only grammar check of one HF-generated TypeScript insertion.
 * stdin: bounded JSON containing a public fixture ID and a generated
 * insertion. stdout: one fixed pass/fail enum. Never logs code, AST,
 * diagnostics, paths, token text, or server-provided messages.
 *
 * This process is started only by an explicitly approved local HF smoke
 * experiment. Parsing never executes or evaluates generated source.
 */
import { readFileSync } from "node:fs";
import { classifyGeneratedSyntax } from "./model-eval-syntax.mjs";

const MAX_INPUT_BYTES = 20_000;
async function main() {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    bytes += chunk.byteLength;
    if (bytes > MAX_INPUT_BYTES) throw Error("oversized-parser-request");
    chunks.push(chunk);
  }
  if (!bytes) throw Error("empty-parser-request");
  const input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      Object.keys(input).length !== 2 || !Object.hasOwn(input, "id") ||
      !Object.hasOwn(input, "insertion") ||
      typeof input.id !== "string" || typeof input.insertion !== "string" ||
      input.insertion.length > 8192) throw Error("invalid-parser-request");

  // Only original fixed synthetic examples; never let the caller supply a
  // source prefix, suffix, arbitrary path or non-TypeScript language.
  const manifest = JSON.parse(readFileSync(
    new URL("../model/fixtures/completion-v1.json", import.meta.url), "utf8"
  ));
  const fixture = manifest.fixtures?.find(item =>
    item.id === input.id && item.language === "typescript");
  if (!fixture) throw Error("unrecognized-public-fixture");
  const status = classifyGeneratedSyntax(fixture, input.insertion);
  if (status !== "passed" && status !== "failed") throw Error("invalid-parser-outcome");
  process.stdout.write(JSON.stringify({ syntaxOutcome: status }) + "\n");
}
await main().catch(() => {
  // Generic error. Never echo source, request JSON or parser diagnostics.
  process.stderr.write("Local TypeScript synthetic grammar check rejected.\n");
  process.exitCode = 1;
});
