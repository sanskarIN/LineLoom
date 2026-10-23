import { afterEach, describe, expect, it } from "vitest";
import {
  getEligibilityTimingSummary, recordEligibilityTiming, resetEligibilityTimings
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

  it("rejects malformed negative and non-finite timings", () => {
    for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      recordEligibilityTiming(bad, true);
    }
    expect(getEligibilityTimingSummary().checks).toBe(0);
  });

  it("clears all counters and samples when diagnostics are disabled", () => {
    recordEligibilityTiming(25, false);
    resetEligibilityTimings();
    expect(getEligibilityTimingSummary().checks).toBe(0);
    expect(getEligibilityTimingSummary().samples).toBe(0);
  });
});
