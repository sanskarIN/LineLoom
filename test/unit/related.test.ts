import { describe, expect, it } from "vitest";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { planRelatedFiles, readBoundedRelatedFile } from "../../src/context/related";

describe("explicit bounded related-file context", () => {
  it("deduplicates, ignores current file and never expands past two selections", () => {
    expect(planRelatedFiles("active", ["active", "a", "a", "b", "c"])).toEqual(["a", "b"]);
    expect(planRelatedFiles("active", [])).toEqual([]);
  });
  it("reads small UTF-8 text while denying symlinks, binary, oversized and malformed files", async () => {
    const folder = await mkdtemp(join(tmpdir(), "lineloom-context-"));
    try {
      const good = join(folder, "good.ts");
      await writeFile(good, "const café = 1;\n");
      expect(await readBoundedRelatedFile(good)).toContain("café");
      const link = join(folder, "link.ts");
      await symlink(good, link);
      await expect(readBoundedRelatedFile(link)).rejects.toThrow();
      const binary = join(folder, "binary.ts");
      await writeFile(binary, Buffer.from([0, 1, 2]));
      await expect(readBoundedRelatedFile(binary)).rejects.toThrow();
      const malformed = join(folder, "malformed.ts");
      await writeFile(malformed, Buffer.from([0xc3, 0x28]));
      await expect(readBoundedRelatedFile(malformed)).rejects.toThrow();
      const huge = join(folder, "huge.ts");
      await writeFile(huge, Buffer.alloc(2049, 65));
      await expect(readBoundedRelatedFile(huge)).rejects.toThrow();
      await expect(readBoundedRelatedFile(join(folder, "missing.ts"))).rejects.toThrow();
    } finally { await rm(folder, { recursive: true, force: true }); }
  });
});
