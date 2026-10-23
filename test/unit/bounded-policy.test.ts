import { describe, expect, it } from "vitest";
import { mapBounded } from "../../src/privacy/bounded";

describe("bounded policy I/O scheduler", () => {
  it("preserves source order even if reads finish in a different order", async () => {
    const received = await mapBounded([0, 1, 2, 3], 4, async (value) => {
      await new Promise<void>((resolve) => setTimeout(resolve, (4 - value) * 3));
      return value * 2;
    });
    expect(received).toEqual([0, 2, 4, 6]);
  });

  it("caps concurrent reads while processing every source once", async () => {
    const seen: number[] = [];
    let inFlight = 0;
    let maxInFlight = 0;
    const values = await mapBounded(Array.from({ length: 24 }, (_, i) => i), 6, async (item) => {
      seen.push(item);
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      try {
        await new Promise<void>((resolve) => setTimeout(resolve, 2));
        return item;
      } finally {
        inFlight--;
      }
    });
    expect(values).toEqual(Array.from({ length: 24 }, (_, i) => i));
    expect(seen).toHaveLength(24);
    expect(new Set(seen).size).toBe(24);
    expect(maxInFlight).toBe(6);
  });

  it("rejects a failed file read instead of returning partial allow results", async () => {
    await expect(mapBounded([1, 2, 3], 2, async (item) => {
      if (item === 2) throw new Error("Synthetic unreadable policy");
      return item;
    })).rejects.toThrow("Synthetic unreadable policy");
  });

  it("handles empty policy lists and refuses invalid concurrency limits", async () => {
    expect(await mapBounded([], 8, async (value: number) => value)).toEqual([]);
    for (const bad of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      await expect(mapBounded([1], bad, async (value) => value)).rejects.toThrow(RangeError);
    }
  });
});
