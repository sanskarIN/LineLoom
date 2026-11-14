#!/usr/bin/env node
/**
 * Integration smoke test for changing publisher identity.
 * VS Code installs the two IDs independently; the user must uninstall the
 * legacy ID. We validate both install, removal and synthetic settings survival.
 *
 * This test uses a disposable VS Code profile, not actual user data.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { downloadAndUnzipVSCode, resolveCliPathFromVSCodeExecutablePath } from "@vscode/test-electron";
import { downloadVSCodeWithTransientRetries } from "./vscode-download-retry.mjs";

const [legacyInput, nextInput] = process.argv.slice(2);
assert.ok(legacyInput?.endsWith(".vsix") && nextInput?.endsWith(".vsix"),
  "Usage: node scripts/smoke-publisher-migration.mjs <legacy.vsix> <Sanskar.vsix>");
const unzip = (file, entry) => execFileSync("unzip", ["-p", resolve(file), entry], { encoding: "utf8" });
const legacy = JSON.parse(unzip(legacyInput, "extension/package.json"));
const next = JSON.parse(unzip(nextInput, "extension/package.json"));
assert.equal(legacy.publisher, "SanskarCodes");
assert.equal(next.publisher, "Sanskar");
assert.equal(legacy.name, "lineloom");
assert.equal(next.name, "lineloom");
assert.notEqual(next.publisher + "." + next.name, legacy.publisher + "." + legacy.name);
const tmp = mkdtempSync(join(tmpdir(), "lineloom-publisher-migration-"));
try {
  const extensionsDir = join(tmp, "extensions");
  const userDataDir = join(tmp, "user");
  const settingsDir = join(userDataDir, "User");
  mkdirSync(extensionsDir, { recursive: true });
  mkdirSync(settingsDir, { recursive: true });
  const settings = join(settingsDir, "settings.json");
  const fixture = JSON.stringify({
    "lineloom.enabled": true,
    "lineloom.model": "synthetic-local-model:latest",
    "lineloom.languageModels": { rust: "synthetic-only:latest" },
    "lineloom.allowRemoteEndpoints": false,
    "lineloom.excludedPaths": ["**/synthetic-private/**"]
  }, null, 2) + "\n";
  writeFileSync(settings, fixture, { flag: "wx" });
  const executable = await downloadVSCodeWithTransientRetries(downloadAndUnzipVSCode);
  const cli = resolveCliPathFromVSCodeExecutablePath(executable);
  const run = (...args) => execFileSync(cli, [
    ...args, "--extensions-dir", extensionsDir, "--user-data-dir", userDataDir,
    "--disable-telemetry"
  ], { encoding: "utf8", timeout: 120_000, env: { ...process.env, VSCODE_DISABLE_UPDATE_CHECK: "1" } });
  const listed = () => run("--list-extensions", "--show-versions").toLowerCase().split(/\r?\n/).filter(Boolean);
  const oldId = "sanskarcodes.lineloom@" + legacy.version;
  const newId = "sanskar.lineloom@" + next.version;
  run("--install-extension", resolve(legacyInput), "--force");
  assert.ok(listed().includes(oldId));
  run("--install-extension", resolve(nextInput), "--force");
  assert.ok(listed().includes(oldId) && listed().includes(newId), "Both publisher IDs must be distinct");
  assert.equal(readFileSync(settings, "utf8"), fixture, "Settings unexpectedly changed during install");
  run("--uninstall-extension", "SanskarCodes.lineloom");
  assert.ok(!listed().some(item => item.startsWith("sanskarcodes.lineloom@")));
  assert.ok(listed().includes(newId), "Uninstalling legacy must retain new publisher");
  assert.equal(readFileSync(settings, "utf8"), fixture, "Settings unexpectedly changed during migration");
  console.log("PASS: legacy and new publisher are distinct; legacy removed; synthetic settings preserved");
  console.log("NOTE: extension globalState and secrets are not automatically migrated; human editor QA remains NOT RUN");
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
