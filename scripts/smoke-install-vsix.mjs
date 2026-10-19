#!/usr/bin/env node
/**
 * Verify that a packaged VSIX can be installed and listed by an isolated,
 * real VS Code CLI. This is a headless smoke test, not an interactive test of
 * inline completion, and never downloads an inference model or reads user data.
 *
 * Usage: node scripts/smoke-install-vsix.mjs LineLoom-0.9.5.vsix
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, statSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { downloadAndUnzipVSCode, resolveCliPathFromVSCodeExecutablePath } from "@vscode/test-electron";

const candidate = process.argv[2];
if (!candidate || !candidate.toLowerCase().endsWith(".vsix")) {
  console.error("Usage: node scripts/smoke-install-vsix.mjs <versioned.vsix>");
  process.exitCode = 2;
} else {
  const packagePath = resolve(candidate);
  let directory;
  try {
    if (!statSync(packagePath).isFile()) throw new Error("Not a VSIX file");
    const { version, publisher, name } = JSON.parse(readFileSync("package.json", "utf8"));
    if (publisher !== "SanskarCodes" || name !== "lineloom" || !/^0\.\d+\.\d+$/.test(version)) {
      throw new Error("This smoke test is restricted to LineLoom pre-release packages.");
    }
    directory = mkdtempSync(join(tmpdir(), "lineloom-vsix-install-"));
    const extensionsDir = join(directory, "extensions");
    const userDataDir = join(directory, "user-data");
    mkdirSync(extensionsDir);
    mkdirSync(userDataDir);
    const exe = await downloadAndUnzipVSCode({ version: "stable" });
    const cli = resolveCliPathFromVSCodeExecutablePath(exe);
    const run = (...args) => execFileSync(cli, [
      ...args, "--extensions-dir", extensionsDir, "--user-data-dir", userDataDir,
      "--disable-telemetry"
    ], {
      encoding: "utf8", timeout: 120_000, maxBuffer: 1024 * 1024,
      env: { ...process.env, VSCODE_DISABLE_UPDATE_CHECK: "1" }
    });
    const installation = run("--install-extension", packagePath, "--force");
    if (installation.trim()) console.log(installation.trim());
    const listing = run("--list-extensions", "--show-versions").trim().split(/\r?\n/);
    const expected = (publisher + "." + name + "@" + version).toLowerCase();
    if (!listing.some(item => item.trim().toLowerCase() === expected)) {
      throw new Error("VS Code CLI did not list installed extension " + expected + ".");
    }
    console.log("PASS: clean VS Code CLI installed and enumerated " + expected);
    console.log("NOTE: Real Ollama, interactive inline suggestion acceptance, and OS user-profile UI checks remain manual.");
  } catch (error) {
    console.error("FAIL: isolated VS Code CLI install smoke test:", error?.message ?? error);
    process.exitCode = 1;
  } finally {
    if (directory) rmSync(directory, { recursive: true, force: true });
  }
}
