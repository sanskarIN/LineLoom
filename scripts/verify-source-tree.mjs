#!/usr/bin/env node
/**
 * Check that every project-owned src/**/*.ts module is reachable from the
 * extension entry point and that all relative TS imports resolve.
 *
 * This is a source-inventory/packaging guard, not evidence of runtime QA.
 * Do not inspect user workspaces or emit source snippets.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import ts from "typescript";

const START = "src/extension.ts";

function walkSource(directory, root) {
  const found = [];
  for (const name of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, name.name);
    if (name.isDirectory()) found.push(...walkSource(path, root));
    if (name.isFile() && path.endsWith(".ts")) {
      found.push(relative(root, path).replaceAll("\\", "/"));
    }
  }
  return found;
}

export function inspectSourceTree(root) {
  const base = resolve(root);
  const directory = join(base, "src");
  if (!statSync(directory).isDirectory()) throw new Error("Expected src directory");
  const paths = walkSource(directory, base).sort();
  const available = new Set(paths);
  if (!available.has(START)) throw new Error("Missing required entry point: " + START);

  const graph = new Map();
  const missing = [];
  let imports = 0;
  for (const path of paths) {
    const text = readFileSync(join(base, path), "utf8");
    const preprocessed = ts.preProcessFile(text, true, true);
    const linked = [];
    for (const imported of preprocessed.importedFiles) {
      if (!imported.fileName.startsWith(".")) continue; // External packages, including vscode
      imports++;
      const resolved = resolve(base, dirname(path), imported.fileName);
      const candidates = [
        resolved, resolved + ".ts", resolved + ".tsx", join(resolved, "index.ts"),
        resolved.replace(/\.js$/, ".ts")
      ];
      const target = candidates
        .map((candidate) => relative(base, candidate).replaceAll("\\", "/"))
        .find((candidate) => available.has(candidate));
      if (!target) missing.push(path + " -> " + imported.fileName);
      else linked.push(target);
    }
    graph.set(path, linked);
  }

  const visited = new Set();
  const visit = (path) => {
    if (visited.has(path)) return;
    visited.add(path);
    for (const next of graph.get(path) ?? []) visit(next);
  };
  visit(START);
  const orphans = paths.filter((path) => !visited.has(path));
  return { moduleCount: paths.length, importCount: imports, missing, orphans };
}

function main() {
  const result = inspectSourceTree(process.cwd());
  if (result.missing.length || result.orphans.length) {
    if (result.missing.length) console.error("Unresolved local source imports:\n" + result.missing.join("\n"));
    if (result.orphans.length) console.error("Unreachable project-owned modules:\n" + result.orphans.join("\n"));
    process.exitCode = 1;
    return;
  }
  console.log("PASS: " + result.moduleCount + " source modules and " +
    result.importCount + " relative imports reachable from " + START);
}

if (process.argv[1] && isAbsolute(process.argv[1]) &&
    resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  main();
}
