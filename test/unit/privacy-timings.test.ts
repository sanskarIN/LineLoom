import { afterEach, describe, expect, it } from "vitest";
import {
  currentEligibilityTimingEpoch, getEligibilityTimingSummary, recordEligibilityTiming, resetEligibilityTimings
} from "../../src/privacy/timings";

afterEach(() => resetEligibilityTimings());

describe("session-only privacy eligibility timing statistics", () => {
  it("starts at zero and records allow/deny counts without file identifiers", () => {
    expect(getEligibilityTimingSummary()).toEqual({
      checks: 0, allowed: 0, denied: 0, samples: 0,
      lastMs: 0, averageMs: 0, p95Ms: 0, maxMs: 0
    });
    recordEligibilityTiming(5, true);
    recordEligibilityTiming(15, false);
    const result = getEligibilityTimingSummary();
    expect(result).toEqual({
      checks: 2, allowed: 1, denied: 1, samples: 2,
      lastMs: 15, averageMs: 10, p95Ms: 15, maxMs: 15
    });
    expect(Object.keys(result)).not.toContain("path");
  });

  it("keeps only the latest 64 timings for p95 while totals remain session-wide", () => {
    recordEligibilityTiming(5000, false);
    for (let index = 0; index < 64; index++) recordEligibilityTiming(10, true);
    const result = getEligibilityTimingSummary();
    expect(result.checks).toBe(65);
    expect(result.samples).toBe(64);
    expect(result.p95Ms).toBe(10);
    expect(result.maxMs).toBe(5000);
    expect(result.allowed).toBe(64);
    expect(result.denied).toBe(1);
  });

  it("drops late asynchronous samples from before a manual reset", () => {
    const beforeReset = currentEligibilityTimingEpoch();
    recordEligibilityTiming(25, true, beforeReset);
    resetEligibilityTimings();
    expect(currentEligibilityTimingEpoch()).not.toBe(beforeReset);
    recordEligibilityTiming(500, false, beforeReset);
    expect(getEligibilityTimingSummary().checks).toBe(0);
    const afterReset = currentEligibilityTimingEpoch();
    recordEligibilityTiming(3, true, afterReset);
    expect(getEligibilityTimingSummary()).toMatchObject({
      checks: 1, allowed: 1, denied: 0, lastMs: 3, maxMs: 3
    });
  });

  it("rejects malformed negative and non-finite timings", () => {
    for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      recordEligibilityTiming(bad, true);
    }
    expect(getEligibilityTimingSummary().checks).toBe(0);
  });

  it("resets statistics on demand and accepts fresh samples afterwards", () => {
    recordEligibilityTiming(25, false);
    recordEligibilityTiming(40, true);
    resetEligibilityTimings();
    expect(getEligibilityTimingSummary()).toEqual({
      checks: 0, allowed: 0, denied: 0, samples: 0,
      lastMs: 0, averageMs: 0, p95Ms: 0, maxMs: 0
    });
    recordEligibilityTiming(2.5, true);
    expect(getEligibilityTimingSummary()).toEqual({
      checks: 1, allowed: 1, denied: 0, samples: 1,
      lastMs: 2.5, averageMs: 2.5, p95Ms: 2.5, maxMs: 2.5
    });
  });
});
