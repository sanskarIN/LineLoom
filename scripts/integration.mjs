import esbuild from "esbuild";
import path from "node:path";
import os from "node:os";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { runTests } from "@vscode/test-electron";
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
  await runTests({
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
