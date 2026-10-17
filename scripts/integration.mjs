import esbuild from "esbuild";
import path from "node:path";
import { runTests } from "@vscode/test-electron";
const root = process.cwd();
await esbuild.build({
  entryPoints: ["test/integration/suite.ts"],
  outfile: "dist/integration.js",
  bundle: true, platform: "node", format: "cjs",
  external: ["vscode"], target: "node20", sourcemap: false
});
try {
  await runTests({
    extensionDevelopmentPath: root,
    extensionTestsPath: path.join(root, "dist/integration.js"),
    launchArgs: ["--disable-extensions", "--skip-welcome", "--skip-release-notes"]
  });
} catch (error) {
  console.error("VS Code extension-host integration failed:", error);
  process.exitCode = 1;
}
