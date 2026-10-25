import { describe, expect, it } from "vitest";
import { LatencyWindow } from "../../src/completion/latency-window";

describe("privacy-safe rolling inference latency", () => {
  it("records finite nonnegative values only and never invents empty percentiles", () => {
    const window = new LatencyWindow();
    expect(window.summary()).toEqual({ samples: 0 });
    for (const sample of [-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(window.record(sample)).toBe(false);
    }
    expect(window.summary()).toEqual({ samples: 0 });
    expect(window.record(0)).toBe(true);
    expect(window.summary()).toEqual({ samples: 1, p50Ms: 0, p95Ms: 0 });
  });

  it("uses exact nearest-rank p50/p95 rather than averages", () => {
    const window = new LatencyWindow();
    for (const sample of [100, 10, 30, 20, 60, 40, 50, 80, 90, 70]) window.record(sample);
    expect(window.summary()).toEqual({ samples: 10, p50Ms: 50, p95Ms: 100 });
  });

  it("retains only 64 recent request durations even for long-running sessions", () => {
    const window = new LatencyWindow();
    for (let i = 1; i <= 100; i++) expect(window.record(i)).toBe(true);
    expect(window.summary()).toEqual({ samples: 64, p50Ms: 68, p95Ms: 97 });
    window.clear();
    expect(window.summary()).toEqual({ samples: 0 });
    expect(window.record(42)).toBe(true);
    expect(window.summary()).toEqual({ samples: 1, p50Ms: 42, p95Ms: 42 });
  });

  it("returns independent snapshots without mutable timing history", () => {
    const window = new LatencyWindow();
    window.record(9);
    const old = window.summary();
    window.record(25);
    expect(old).toEqual({ samples: 1, p50Ms: 9, p95Ms: 9 });
    expect(window.summary()).toEqual({ samples: 2, p50Ms: 9, p95Ms: 25 });
  });
});
