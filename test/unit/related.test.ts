import { describe, expect, it } from "vitest";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { planRelatedFiles, readBoundedRelatedFile, validateRelatedSelection, hasBoundedRelatedMetadata } from "../../src/context/related";

describe("explicit bounded related-file context", () => {
  it("deduplicates, ignores current file and never expands past two selections", () => {
    expect(planRelatedFiles("active", ["active", "a", "a", "b", "c"])).toEqual(["a", "b"]);
    expect(planRelatedFiles("active", [])).toEqual([]);
  });
  it("rejects active-file reuse, duplicates and more than two selections instead of truncating", () => {
    expect(validateRelatedSelection("active", ["a"])).toBe(true);
    expect(validateRelatedSelection("active", ["a", "b"])).toBe(true);
    for (const chosen of [[], ["active"], ["a", "a"], ["a", "b", "c"], [""]]) {
      expect(validateRelatedSelection("active", chosen)).toBe(false);
    }
  });
  it("reads small UTF-8 text while denying symlinks, binary, oversized and malformed files", async () => {
    const folder = await mkdtemp(join(tmpdir(), "lineloom-context-"));
    try {
      const good = join(folder, "good.ts");
      await writeFile(good, "const café = 1;\n");
      expect(await readBoundedRelatedFile(good)).toContain("café");
      expect(await hasBoundedRelatedMetadata(good)).toBe(true);
      const upperBound = join(folder, "exact-limit.ts");
      await writeFile(upperBound, Buffer.alloc(2048, 65));
      expect(await hasBoundedRelatedMetadata(upperBound)).toBe(true);
      expect((await readBoundedRelatedFile(upperBound)).length).toBe(2048);
      const link = join(folder, "link.ts");
      await symlink(good, link);
      expect(await hasBoundedRelatedMetadata(link)).toBe(false);
      await expect(readBoundedRelatedFile(link)).rejects.toThrow();
      const binary = join(folder, "binary.ts");
      await writeFile(binary, Buffer.from([0, 1, 2]));
      await expect(readBoundedRelatedFile(binary)).rejects.toThrow();
      const malformed = join(folder, "malformed.ts");
      await writeFile(malformed, Buffer.from([0xc3, 0x28]));
      await expect(readBoundedRelatedFile(malformed)).rejects.toThrow();
      const huge = join(folder, "huge.ts");
      await writeFile(huge, Buffer.alloc(2049, 65));
      expect(await hasBoundedRelatedMetadata(huge)).toBe(false);
      await expect(readBoundedRelatedFile(huge)).rejects.toThrow();
      expect(await hasBoundedRelatedMetadata(join(folder, "missing.ts"))).toBe(false);
      await expect(readBoundedRelatedFile(join(folder, "missing.ts"))).rejects.toThrow();
    } finally { await rm(folder, { recursive: true, force: true }); }
  });
});
