import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("public FIM reference syntax CI evidence", () => {
  const workflow = readFileSync(".github/workflows/ci.yml", "utf8").replace(/\r\n?/g, "\n");
  const job = workflow.split("  reference-syntax:\n")[1]?.split("\n  integration:\n")[0] ?? "";

  it("has a separate bounded job using real local toolchains, not mocked checks", () => {
    expect(job).toContain("name: Public reference syntax (Linux)");
    expect(job).toContain("runs-on: ubuntu-latest");
    expect(job).toContain("timeout-minutes: 12");
    expect(job).toContain("run: npm ci");
    for (const tool of ["rustc", "cc", "c++"]) {
      expect(job).toContain(`command -v ${tool}`);
    }
    expect(job).toContain("test -x node_modules/.bin/tsc");
    expect(job).toContain("npm run model:reference:syntax -- --run --approve-local-compilers");
    expect(job).not.toContain("continue-on-error: true");
    expect(job).not.toContain("|| true");
  });

  it("blocks VSIX candidate packaging until the real syntax audit succeeds", () => {
    expect(workflow).toContain("needs: [check, integration, reference-syntax]");
    const packageJob = workflow.split("  package:\n")[1] ?? "";
    expect(packageJob).toContain("Build genuine stable-channel VSIX and checksum");
  });
});
