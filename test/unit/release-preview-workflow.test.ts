import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Version-scoped GitHub pre-release guards: catch stale copied version names
 * before an owner creates the separate publishing flag.
 */
describe("historical v1.4.1 GitHub-only preview publisher integrity", () => {
  const workflow = readFileSync(".github/workflows/release-v1.4.1.yml", "utf8");
  const notes = readFileSync("docs/releases/v1.4.1.md", "utf8");
  const manifest = JSON.parse(readFileSync("package.json", "utf8"));
  const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));

  it("locks the extension and package metadata to the expected preview version", () => {
    expect(manifest.version).toBe("1.4.2");
    expect(lock.version).toBe("1.4.2");
    expect(lock.packages[""].version).toBe("1.4.2");
    expect(manifest.name).toBe("lineloom");
    expect(manifest.publisher).toBe("SanskarCodes");
    expect(workflow).toContain("p.version !== '1.4.1'");
    expect(workflow).toContain("OWNER_AUTHORIZED_GITHUB_PRE_RELEASE_V1.4.1_MANUAL_QA_DISCLOSED");
    expect(workflow).not.toContain("LineLoom-1.3.1.");
  });
  it("packages only genuine preview-channel GitHub assets with independent checksum", () => {
    expect(workflow).toContain("vsce package --pre-release");
    expect(workflow).toContain("LINELOOM_EXPECT_PRE_RELEASE=1");
    expect(workflow).toContain("LineLoom-1.4.1.vsix");
    expect(workflow).toContain("LineLoom-1.4.1.sha256");
    expect(workflow).toContain("sha256sum --check");
    expect(workflow).toContain("gh release create v1.4.1");
    expect(workflow).toContain("--prerelease --latest=false");
    expect(workflow).toContain('releases/tags/v1.4.1');
    expect(workflow).toContain("Reject existing v1.4.1 tag or release");
    expect(workflow).not.toMatch(/(?:ovsx\s+publish|vsce\s+publish|npm\s+publish)/);
  });
  it("discloses unavailable human QA and keeps stable rollback pinned", () => {
    expect(notes).toContain("Manual QA outstanding");
    expect(notes).toContain("NOT RUN");
    expect(notes).toContain("Four moderate");
    expect(notes).toContain("not a stable release");
    expect(workflow).toContain("LineLoom-1.3.0.vsix");
    expect(workflow).toContain("6af67d3caab5ae7a86dda574870cccb210fc20fbf105e014ce6532c0ff793e25");
  });
});

describe("v1.4.2 GitHub-only preview publisher integrity", () => {
  const workflow = readFileSync(".github/workflows/release-v1.4.2.yml", "utf8");
  const notes = readFileSync("docs/releases/v1.4.2.md", "utf8");
  const manifest = JSON.parse(readFileSync("package.json", "utf8"));
  const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));

  it("pins reviewed package identity while preserving historical v1.4.1", () => {
    expect(manifest.version).toBe("1.4.2");
    expect(lock.version).toBe("1.4.2");
    expect(lock.packages[""].version).toBe("1.4.2");
    expect(manifest.publisher).toBe("SanskarCodes");
    expect(workflow).toContain("p.version !== '1.4.2'");
    expect(workflow).toContain("OWNER_AUTHORIZED_GITHUB_PRE_RELEASE_V1.4.2_MANUAL_QA_DISCLOSED");
    expect(workflow).toContain(".github/release-v1.4.2.flag");
    expect(workflow).toContain("on:");
  });
  it("builds only a pre-release VSIX, verifies pinned stable AND prior preview upgrades", () => {
    expect(workflow).toContain("vsce package --pre-release");
    expect(workflow).toContain("LINELOOM_EXPECT_PRE_RELEASE=1");
    expect(workflow).toContain("LineLoom-1.4.2.vsix");
    expect(workflow).toContain("LineLoom-1.4.2.sha256");
    expect(workflow).toContain("sha256sum --check");
    expect(workflow).toContain("6af67d3caab5ae7a86dda574870cccb210fc20fbf105e014ce6532c0ff793e25");
    expect(workflow).toContain("d69705cd7f2cc273e455730d8a63b41a8a617e39d02f343bfdb1bf3f9d503c3b");
    expect(workflow).toContain("test:upgrade-vsix -- LineLoom-1.4.1.vsix LineLoom-1.4.2.vsix");
    expect(workflow).toContain("--prerelease --latest=false");
    expect(workflow).toContain("gh release create v1.4.2");
    expect(workflow).toContain("Reject existing v1.4.2 tag or release");
    expect(workflow).not.toMatch(/(?:ovsx\s+publish|vsce\s+publish|npm\s+publish)/);
  });
  it("clearly discloses outstanding manual, model and dependency safety gates", () => {
    expect(notes).toContain("Manual QA outstanding");
    expect(notes).toContain("NOT RUN");
    expect(notes).toContain("Development dependency advisories");
    expect(notes).toContain("not a stable release");
    expect(notes).toContain("No first-party model weights");
    expect(workflow).toContain("npm audit --audit-level=high");
    expect(workflow).toContain("npm audit --omit=dev --audit-level=moderate");
  });
});
