import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("GitHub Actions pull request concurrency safety", () => {
  for (const workflow of ["ci.yml", "security.yml"]) {
    it(`${workflow} cancels obsolete PR runs without cancelling main/schedules`, () => {
      const source = readFileSync(`.github/workflows/${workflow}`, "utf8");
      expect(source).toContain("group: lineloom-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}");
      expect(source).toContain("cancel-in-progress: ${{ github.event_name == 'pull_request' }}");
      expect(source).toContain("pull_request:");
      expect(source).toContain("branches: [main]");
    });
  }

  it("owner-authorized release workflow cannot share an ordinary CI concurrency group", () => {
    const publisher = readFileSync(".github/workflows/release-v1.2.4.yml", "utf8");
    expect(publisher).toContain("group: lineloom-preview-v1.2.4");
    expect(publisher).toContain("cancel-in-progress: false");
    expect(publisher).toContain(".github/release-v1.2.4.flag");
    expect(publisher).not.toContain("group: lineloom-${{ github.workflow }}");
  });
});
