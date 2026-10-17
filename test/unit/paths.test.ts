import { describe, expect, it } from "vitest";
import * as os from "node:os";
import * as path from "node:path";
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { relativeInside, safeWorkspaceRelativePaths } from "../../src/privacy/paths";

describe("workspace path protection", () => {
  it("rejects outside paths and sibling prefix collisions", () => {
    const root = path.join(os.tmpdir(), "lineloom-root");
    expect(relativeInside(root, path.join(root, "source.ts"))).toBe("source.ts");
    expect(relativeInside(root, root)).toBeUndefined();
    expect(relativeInside(root, path.join(os.tmpdir(), "lineloom-root-other", "secrets.ts"))).toBeUndefined();
    expect(relativeInside(root, path.join(root, "..", "secrets.ts"))).toBeUndefined();
  });
  it("denies symlinks to files outside the workspace and tracks canonical in-workspace aliases", async () => {
    if (process.platform === "win32") return; // symlink privileges vary on Windows runners
    const parent = await mkdtemp(path.join(os.tmpdir(), "lineloom-paths-"));
    const root = path.join(parent, "workspace");
    try {
      await mkdir(root);
      await mkdir(path.join(root, "private"));
      await writeFile(path.join(parent, "outside.ts"), "secret");
      await writeFile(path.join(root, "private", ".env"), "token");
      await symlink(path.join(parent, "outside.ts"), path.join(root, "visible.ts"));
      await symlink(path.join(root, "private", ".env"), path.join(root, "safe.ts"));
      expect(await safeWorkspaceRelativePaths(root, path.join(root, "visible.ts"))).toBeUndefined();
      expect(await safeWorkspaceRelativePaths(root, path.join(root, "safe.ts"))).toEqual(["safe.ts", "private/.env"]);
    } finally {
      await rm(parent, { force: true, recursive: true });
    }
  });
});
