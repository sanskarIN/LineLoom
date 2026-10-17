import esbuild from "esbuild";
import path from "node:path";
import os from "node:os";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
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
