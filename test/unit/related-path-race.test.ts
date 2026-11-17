import { describe, expect, it, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readBoundedRelatedFile } from "../../src/context/related";

// Rebind the selected path precisely after the descriptor has returned bytes.
// A race driven by timers against a 2 KiB read would be nondeterministic.
const race = vi.hoisted(() => ({ selected: "", moved: "", swapped: false }));
vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    open: async (...args: Parameters<typeof actual.open>) => {
      const handle = await actual.open(...args);
      if (args[0] !== race.selected) return handle;
      return {
        stat: () => handle.stat(),
        read: async (buffer: Buffer, offset: number, length: number, position: number) => {
          const result = await handle.read(buffer, offset, length, position);
          if (!race.swapped) {
            // Keep the original open descriptor stable, but give the same
            // pathname a different inode and same-size valid UTF-8 source.
            await actual.rename(race.selected, race.moved);
            await actual.writeFile(race.selected, "const answer = 43;\n");
            race.swapped = true;
          }
          return result;
        },
        close: () => handle.close()
      };
    }
  };
});

describe("selected related-file pathname identity", () => {
  it("fails closed when a same-size replacement occurs during a descriptor read", async () => {
    const folder = await mkdtemp(join(tmpdir(), "lineloom-context-race-"));
    try {
      race.selected = join(folder, "selected.ts");
      race.moved = join(folder, "original.ts");
      race.swapped = false;
      await writeFile(race.selected, "const answer = 42;\n");
      await expect(readBoundedRelatedFile(race.selected))
        .rejects.toThrow("Selected context path changed while reading");
      expect(race.swapped).toBe(true);
    } finally {
      race.selected = "";
      race.moved = "";
      race.swapped = false;
      await rm(folder, { recursive: true, force: true });
    }
  });
});
