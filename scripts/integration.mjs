import esbuild from "esbuild";
import path from "node:path";
import os from "node:os";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { downloadAndUnzipVSCode, runTests } from "@vscode/test-electron";
import { downloadVSCodeWithTransientRetries } from "./vscode-download-retry.mjs";
const root = process.cwd();
await esbuild.build({
  entryPoints: ["test/integration/suite.ts"],
  outfile: "dist/integration.js",
  bundle: true, platform: "node", format: "cjs",
  external: ["vscode"], target: "node20", sourcemap: false
});
const fixture = await mkdtemp(path.join(os.tmpdir(), "lineloom-vscode-integration-"));
try {
  await writeFile(path.join(fixture, "editor-test.ts"), "const answer = ", "utf8");
  await writeFile(path.join(fixture, ".env"), "INTEGRATION_SECRET=unused\n", "utf8");
  await mkdir(path.join(fixture, "src"));
  await writeFile(path.join(fixture, "src", ".gitignore"), "blocked-by-git.ts\n", "utf8");
  await writeFile(path.join(fixture, "src", ".lineloomignore"), "blocked.ts\n", "utf8");
  await writeFile(path.join(fixture, "src", "blocked.ts"), "const hidden = 1;\n", "utf8");
  await writeFile(path.join(fixture, "src", "blocked-by-git.ts"), "const hidden = 2;\n", "utf8");
  await writeFile(path.join(fixture, "src", "allowed.ts"), "const visible = 3;\n", "utf8");
  // A safe disposable directory for testing real VS Code ignore-file watcher
  // create/change/delete events (rather than calling clearIgnoreCache()).
  await mkdir(path.join(fixture, "src", "watch-probe"));
  await writeFile(path.join(fixture, "src", "watch-probe", "sample.ts"),
    "const syntheticWatcher = 1;\n", "utf8");
  // A deeply nested synthetic source exercises cold/warm privacy checks for
  // many applicable policy-file paths without relying on real workspace data.
  const deepSegments = Array.from({ length: 12 }, (_unused, index) => "level" + index);
  const deepFolder = path.join(fixture, "src", "deep-probe", ...deepSegments);
  await mkdir(deepFolder, { recursive: true });
  await writeFile(path.join(deepFolder, "sample.ts"), "const syntheticDeep = 1;\n", "utf8");
  // Synthetic protected files used by the actual VS Code extension-host
  // test. Never put real credentials or private code into test fixtures.
  await writeFile(path.join(fixture, "src", "credentials.ts"), "const synthetic = 4;\n", "utf8");
  // These innocent-looking TypeScript files live below sensitive directory
  // names. The provider must fail closed before posting any model request.
  for (const folderName of ["credentials", ".env.local", "secrets", ".dev.vars.preview"]) {
    await mkdir(path.join(fixture, "src", folderName));
    await writeFile(path.join(fixture, "src", folderName, "example.ts"),
      "const synthetic = 7;\n", "utf8");
  }
  await writeFile(path.join(fixture, "src", ".dev.vars"), "SYNTHETIC_ONLY=1\n", "utf8");
  await writeFile(path.join(fixture, "src", "production.tfvars.json"), "{}\n", "utf8");
  await mkdir(path.join(fixture, "src", ".terraform"));
  await writeFile(path.join(fixture, "src", ".terraform", "state.ts"), "const synthetic = 5;\n", "utf8");
  await mkdir(path.join(fixture, "src", ".direnv"));
  await writeFile(path.join(fixture, "src", ".direnv", "cached.ts"), "const synthetic = 6;\n", "utf8");
  await writeFile(path.join(fixture, "editor-test.go"), "package main\nfunc answer() int { return ", "utf8");
  await writeFile(path.join(fixture, "editor-test.java"), "class Example { int answer() { return ", "utf8");
  await writeFile(path.join(fixture, "editor-test.c"), "int answer(void) { return ", "utf8");
  await writeFile(path.join(fixture, "editor-test.cpp"), "int answer() { return ", "utf8");
  await writeFile(path.join(fixture, "editor-rust.rs"),
    "fn parse(value: Option<&str>) -> Result<usize, Error> {\n    match value { Some(item) =>  /* preserved Rust suffix */ }\n}\n", "utf8");
  await writeFile(path.join(fixture, "editor-optin.html"), "<main><p>", "utf8");
  await writeFile(path.join(fixture, "editor-optin.css"), ".card { padding: ", "utf8");
  await writeFile(path.join(fixture, "editor-optin.lua"), "local answer = ", "utf8");
  await writeFile(path.join(fixture, "editor-fim.ts"), "const answer = /* preserved suffix */", "utf8");
  // Only the editor download can be retried; test/extension failures must
  // remain visible and must never be retried as if they were network errors.
  const vscodeExecutablePath = await downloadVSCodeWithTransientRetries(downloadAndUnzipVSCode);
  await runTests({
    vscodeExecutablePath,
    extensionDevelopmentPath: root,
    extensionTestsPath: path.join(root, "dist/integration.js"),
    launchArgs: ["--disable-extensions", "--disable-workspace-trust", "--skip-welcome", "--skip-release-notes", fixture]
  });
} catch (error) {
  console.error("VS Code extension-host integration failed:", error);
  process.exitCode = 1;
} finally {
  await rm(fixture, { recursive: true, force: true });
}
