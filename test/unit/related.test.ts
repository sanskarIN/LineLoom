import { describe, expect, it } from "vitest";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  isRelatedSourcePath, planRelatedFiles, readBoundedRelatedFile,
  validateRelatedSelection, hasBoundedRelatedMetadata, isUnchangedRelatedFileSnapshot
} from "../../src/context/related";
import { LANGUAGES } from "../../src/languages/registry";

describe("explicit bounded related-file context", () => {
  it("accepts exactly the registered source suffixes, including opt-in languages", () => {
    for (const { id, extensions } of LANGUAGES) {
      for (const suffix of extensions) {
        expect(isRelatedSourcePath("src/nested/sample" + suffix), id + " " + suffix).toBe(true);
        expect(isRelatedSourcePath("src/nested/SAMPLE" + suffix.toUpperCase()), id + " uppercase " + suffix).toBe(true);
      }
    }
    for (const file of [
      "src/notes.md", ".env", "src/data.json", "src/book.ipynb",
      "src/image.png", "src/main.ts.bak", "src/README", "src/config.toml"
    ]) expect(isRelatedSourcePath(file), file).toBe(false);
  });

  it("does not treat a source-like substring as a supported extension", () => {
    expect(isRelatedSourcePath("folder/python.py.txt")).toBe(false);
    expect(isRelatedSourcePath("folder/typescript.ts.json")).toBe(false);
    expect(isRelatedSourcePath("folder/rs")).toBe(false);
  });

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
  it("fails closed on selected-file metadata changes, including restored mtime", () => {
    const original = { dev: 1, ino: 2, size: 128, mtimeMs: 100, ctimeMs: 101 };
    expect(isUnchangedRelatedFileSnapshot(original, { ...original })).toBe(true);
    // An in-place rewrite can keep the same byte length and restore mtime.
    // ctime still changes on filesystems that expose change-time metadata.
    for (const change of [
      { ctimeMs: 102 },
      { mtimeMs: 99 },
      { size: 129 },
      { ino: 3 },
      { dev: 4 }
    ]) {
      expect(isUnchangedRelatedFileSnapshot(original, { ...original, ...change }), JSON.stringify(change))
        .toBe(false);
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
