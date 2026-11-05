#!/usr/bin/env node
/**
 * Create the new Sanskar.lineloom VSIX from the SAME compiled source as the
 * legacy package, without modifying the tracked legacy package.json.
 *
 * Run npm ci && npm run check before packaging. Publication is always manual
 * or independently owner-gated by an authorized GitHub release workflow.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function stageNewPublisher(sourceRoot, destination) {
  const source = JSON.parse(readFileSync(join(sourceRoot, "package.json"), "utf8"));
  assert.equal(source.publisher, "SanskarCodes", "The primary manifest must retain legacy identity");
  assert.equal(source.name, "lineloom");
  assert.match(source.version, /^\d+\.\d+\.\d+$/);
  assert.equal(source.main, "./dist/extension.js");
  // Build a *curated* staging directory: no user files, secrets, training
  // datasets, repository metadata, or dependency directories can be copied.
  for (const relative of ["README.md", "CHANGELOG.md", "LICENSE", "PRIVACY.md", ".vscodeignore", "dist", "assets/icons"]) {
    const src = join(sourceRoot, relative);
    assert.ok(existsSync(src), "Missing package prerequisite: " + relative);
    const dest = join(destination, relative);
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(src, dest, { recursive: true });
  }
  const next = { ...source, publisher: "Sanskar" };
  writeFileSync(join(destination, "package.json"), JSON.stringify(next, null, 2) + "\n", "utf8");
  return next;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const output = resolve(root, process.argv[2] || ("LineLoom-" + manifest.version + "-Sanskar.vsix"));
  assert.ok(output.endsWith(".vsix"), "Output must be a .vsix file");
  const stage = mkdtempSync(join(tmpdir(), "lineloom-new-publisher-"));
  try {
    const created = stageNewPublisher(root, stage);
    // Resolve vsce's real Node CLI instead of relying on .cmd execution on Windows.
    // Invoking Node directly avoids shell interpolation of the output filename.
    const vsceRoot = join(root, "node_modules", "@vscode", "vsce");
    const vscePkg = JSON.parse(readFileSync(join(vsceRoot, "package.json"), "utf8"));
    const cli = typeof vscePkg.bin === "string" ? vscePkg.bin : vscePkg.bin?.vsce;
    assert.ok(typeof cli === "string" && cli.length > 0, "Missing locked vsce CLI");
    const vsce = resolve(vsceRoot, cli);
    assert.ok(existsSync(vsce), "Install locked dev dependencies via npm ci");
    execFileSync(process.execPath, [vsce, "package", "--pre-release", "--no-dependencies", "-o", output], {
      cwd: stage, stdio: "inherit", timeout: 180_000
    });
    console.log("Packaged separate extension ID: " + created.publisher + "." + created.name);
    console.log("Primary tracked manifest remains " + manifest.publisher + "." + manifest.name);
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}
