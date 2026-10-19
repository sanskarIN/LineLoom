#!/usr/bin/env node
/**
 * Validate an already packaged VS Code VSIX before it is published.
 *
 * This is a read-only check. It never invokes the Visual Studio VSIX installer,
 * installs extensions, or needs marketplace authentication.
 */
import { execFileSync } from "node:child_process";
import { openSync, readSync, statSync, closeSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { resolve } from "node:path";

const vsixArg = process.argv[2];
if (!vsixArg || !vsixArg.toLowerCase().endsWith(".vsix")) {
  console.error("Usage: node scripts/verify-vsix.mjs <LineLoom-version.vsix>");
  process.exit(2);
}
const path = resolve(vsixArg);
try {
  const fd = openSync(path, "r");
  const magic = Buffer.alloc(4);
  try { assert.equal(readSync(fd, magic, 0, 4, 0), 4); }
  finally { closeSync(fd); }
  assert.equal(magic.toString("hex"), "504b0304", "Expected a ZIP-based VSIX archive");
  assert.ok(statSync(path).size > 1000, "VSIX is unexpectedly small");

  // unzip is provided on the Linux CI runner; this is only a release quality gate.
  execFileSync("unzip", ["-t", path], { stdio: "pipe" });
  const entries = execFileSync("unzip", ["-Z", "-1", path], { encoding: "utf8" }).trim().split(/\r?\n/);
  const mustContain = ["extension.vsixmanifest", "extension/package.json", "extension/dist/extension.js"];
  for (const item of mustContain) assert.ok(entries.includes(item), "VSIX missing: " + item);
  assert.ok(!entries.some(x => /(^|\/)node_modules\//.test(x)), "VSIX must exclude node_modules");
  assert.ok(!entries.some(x => x.startsWith("extension/site/")), "VSIX must exclude the website");
  assert.ok(!entries.some(x => /(^|\/)\.env(\.|$)/.test(x)), "VSIX unexpectedly includes an environment file");

  const source = JSON.parse(readFileSync("package.json", "utf8"));
  const packaged = JSON.parse(execFileSync("unzip", ["-p", path, "extension/package.json"], { encoding: "utf8" }));
  for (const key of ["name", "publisher", "version"]) {
    assert.equal(packaged[key], source[key], "Mismatched packaged " + key);
  }
  assert.equal(packaged.publisher, "SanskarCodes");
  assert.equal(packaged.name, "lineloom");
  assert.match(packaged.version, /^\d+\.\d+\.\d+$/, "Package must have a semantic three-part version");
  assert.equal(packaged.version, source.version);
  assert.ok(entries.some(x => x === "extension/assets/icons/lineloom.png"), "Missing extension icon");
  console.log("Verified VS Code VSIX: " + packaged.publisher + "." + packaged.name + "@" + packaged.version);
  console.log("Install in VS Code using Extensions → ... → Install from VSIX (never the Visual Studio installer).");
} catch (err) {
  console.error("VSIX verification failed:", err.message);
  process.exit(1);
}
