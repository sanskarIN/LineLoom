#!/usr/bin/env node
/**
 * Isolated, non-interactive VS Code CLI upgrade smoke: published v1.2.0
 * stable VSIX -> locally packaged maintenance candidate matching package.json.
 *
 * Checks that the CLI replaces the listed extension version while preserving
 * a synthetic user settings.json byte-for-byte. It does NOT verify that an
 * interactive VS Code window loads settings, starts a real model, or behaves
 * correctly on a physical Windows/macOS/Linux desktop.
 *
 * Usage:
 *   node scripts/smoke-upgrade-vsix.mjs LineLoom-1.2.0.vsix LineLoom-1.2.2.vsix
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { downloadAndUnzipVSCode, resolveCliPathFromVSCodeExecutablePath } from "@vscode/test-electron";

function inspectVsix(archive) {
  assert.ok(statSync(archive).isFile(), "Expected a VSIX file");
  // The CI job runs on Linux (where unzip is installed) and checks the
  // published v1.2.0 SHA-256 before running this script.
  const options = { encoding: "utf8", timeout: 20_000, maxBuffer: 2 * 1024 * 1024 };
  const metadata = JSON.parse(execFileSync("unzip", ["-p", archive, "extension/package.json"], options));
  const manifest = execFileSync("unzip", ["-p", archive, "extension.vsixmanifest"], options);
  assert.equal(metadata.publisher, "SanskarCodes");
  assert.equal(metadata.name, "lineloom");
  assert.ok(!manifest.includes("Microsoft.VisualStudio.Code.PreRelease"), "Expected stable-channel VSIX");
  return metadata;
}

function installedVersion(run, expectedVersion) {
  const items = run("--list-extensions", "--show-versions")
    .trim().split(/\r?\n/).map((item) => item.trim().toLowerCase());
  const lineLoom = items.filter((item) => item.startsWith("sanskarcodes.lineloom@"));
  assert.deepEqual(lineLoom, ["sanskarcodes.lineloom@" + expectedVersion],
    "CLI must list precisely one LineLoom entry at the expected version");
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args.some((arg) => !arg.toLowerCase().endsWith(".vsix"))) {
    console.error("Usage: node scripts/smoke-upgrade-vsix.mjs <v1.2.0.vsix> <v1.2.1.vsix>");
    process.exitCode = 2;
    return;
  }
  let temporary;
  try {
    const previousArchive = resolve(args[0]);
    const candidateArchive = resolve(args[1]);
    const previous = inspectVsix(previousArchive);
    const candidate = inspectVsix(candidateArchive);
    const source = JSON.parse(readFileSync("package.json", "utf8"));
    assert.equal(previous.version, "1.2.0", "Base must be published LineLoom v1.2.0");
    assert.notEqual(candidate.version, previous.version, "Candidate must be a different version");
    assert.equal(candidate.version, source.version, "Candidate and source version must match");

    temporary = mkdtempSync(join(tmpdir(), "lineloom-upgrade-smoke-"));
    const extensionsDir = join(temporary, "extensions");
    const userDataDir = join(temporary, "user-data");
    const userDir = join(userDataDir, "User");
    mkdirSync(extensionsDir, { recursive: true });
    mkdirSync(userDir, { recursive: true });
    const settingsFile = join(userDir, "settings.json");
    // These values are intentionally synthetic; no private workspace is
    // mounted, no network inference occurs, and no credentials are stored.
    const fixture = JSON.stringify({
      "lineloom.model": "synthetic-local-model:latest",
      "lineloom.languageModels": { rust: "synthetic-rust-model:latest" },
      "lineloom.enabledLanguages": ["typescript", "rust"],
      "lineloom.autoTrigger": false,
      "lineloom.enabled": true,
      "lineloom.excludedPaths": ["**/synthetic-private/**"],
      "lineloom.performanceDiagnostics": true
    }, null, 2) + "\n";
    writeFileSync(settingsFile, fixture, { encoding: "utf8", flag: "wx" });

    const exe = await downloadAndUnzipVSCode({ version: "stable" });
    const cli = resolveCliPathFromVSCodeExecutablePath(exe);
    const run = (...commandArgs) => execFileSync(cli, [
      ...commandArgs, "--extensions-dir", extensionsDir, "--user-data-dir", userDataDir,
      "--disable-telemetry"
    ], {
      encoding: "utf8", timeout: 120_000, maxBuffer: 2 * 1024 * 1024,
      env: { ...process.env, VSCODE_DISABLE_UPDATE_CHECK: "1" }
    });

    run("--install-extension", previousArchive, "--force");
    installedVersion(run, previous.version);
    assert.equal(readFileSync(settingsFile, "utf8"), fixture,
      "Synthetic profile settings changed during baseline installation");
    run("--install-extension", candidateArchive, "--force");
    installedVersion(run, candidate.version);
    assert.equal(readFileSync(settingsFile, "utf8"), fixture,
      "Synthetic profile settings changed during upgrade");

    console.log("PASS: isolated CLI upgrade SanskarCodes.lineloom@1.2.0 -> @" + candidate.version);
    console.log("PASS: synthetic user settings preserved byte-for-byte");
    console.log("NOTE: interactive settings behavior, real Ollama and cross-platform desktop upgrades remain unverified.");
  } catch (error) {
    console.error("FAIL: isolated VS Code CLI upgrade smoke:", error?.message ?? error);
    process.exitCode = 1;
  } finally {
    if (temporary) rmSync(temporary, { recursive: true, force: true });
  }
}

await main();
