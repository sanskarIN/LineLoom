import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspectSourceTree } from "./verify-source-tree.mjs";

function withFixture(files, assertTree) {
  const root = mkdtempSync(join(tmpdir(), "lineloom-source-tree-"));
  try {
    for (const [path, source] of Object.entries(files)) {
      const location = join(root, path);
      mkdirSync(join(location, ".."), { recursive: true });
      writeFileSync(location, source, "utf8");
    }
    assertTree(inspectSourceTree(root));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("resolves reachable relative project sources and ignores external dependencies", () => {
  withFixture({
    "src/extension.ts": 'import "./privacy/rules"; import type { Local } from "./ui/model"; import "vscode";',
    "src/privacy/rules.ts": "export const rule = true;",
    "src/ui/model.ts": "export interface Local { value: string }"
  }, (result) => {
    assert.equal(result.moduleCount, 3);
    assert.equal(result.importCount, 2);
    assert.deepEqual(result.missing, []);
    assert.deepEqual(result.orphans, []);
  });
});

test("reports unresolved imports without printing source content", () => {
  withFixture({
    "src/extension.ts": 'import "./missing";'
  }, (result) => {
    assert.deepEqual(result.missing, ["src/extension.ts -> ./missing"]);
  });
});

test("reports unreferenced source code that would not ship in the bundle", () => {
  withFixture({
    "src/extension.ts": 'export const ready = true;',
    "src/unused.ts": "export const debug = true;"
  }, (result) => {
    assert.deepEqual(result.orphans, ["src/unused.ts"]);
  });
});
