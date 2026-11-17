import { describe, expect, it, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readBoundedRelatedFile } from "../../src/context/related";

// Emulate a pathname that now resolves to a different inode at the final
// lstat. The real open descriptor remains stable. Mocking only this boundary
// makes the race reproducible on Windows, macOS and Linux without timers or
// attempting to rename a file held open by another process.
const race = vi.hoisted(() => ({ selected: "", stats: 0 }));
vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    lstat: async (...args: Parameters<typeof actual.lstat>) => {
      const info = await actual.lstat(...args);
      if (args[0] !== race.selected || ++race.stats !== 2) return info;
      return new Proxy(info, {
        get(target, key, receiver) {
          if (key === "ino") return Number(target.ino) + 1;
          return Reflect.get(target, key, receiver);
        }
      });
    }
  };
});

describe("selected related-file pathname identity", () => {
  it("refuses an identity mismatch discovered after a valid bounded read", async () => {
    const folder = await mkdtemp(join(tmpdir(), "lineloom-context-race-"));
    try {
      race.selected = join(folder, "selected.ts");
      race.stats = 0;
      await writeFile(race.selected, "const answer = 42;\n");
      await expect(readBoundedRelatedFile(race.selected))
        .rejects.toThrow("Selected context path changed while reading");
      expect(race.stats).toBe(2);
    } finally {
      race.selected = "";
      race.stats = 0;
      await rm(folder, { recursive: true, force: true });
    }
  });
});
