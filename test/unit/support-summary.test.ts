import { describe, expect, it } from "vitest";
import { formatSupportSummary, type SupportSummarySnapshot } from "../../src/ui/support-summary";

const summary: SupportSummarySnapshot = {
  enabled: true, autoTrigger: true, trustedWorkspace: true,
  endpointState: "loopback", engineState: "ready",
  defaultModelCheck: "not-checked", activeModelCheck: "missing",
  activeFileCheck: "blocked", diagnosticsEnabled: false,
  relatedContextEnabled: false, relatedFileCount: 2,
  enabledLanguageCount: 5, languageOverrideCount: 1,
  stats: {
    requests: 12, completions: 8, accepted: 2, cancelled: 1, failed: 1,
    cacheHits: 1, continuationHits: 2, emptySuggestions: 1,
    suppressedEmptyRetries: 4, suppressedTransientRetries: 5,
    totalLatencyMs: 900, lastLatencyMs: 100, measuredRequests: 3,
    recentLatencySamples: 3, recentLatencyP50Ms: 55, recentLatencyP95Ms: 90
  }
};

describe("explicitly copied source-free support summary", () => {
  it("includes bounded counters and manually checked states, but not diagnostics without opt-in", () => {
    const text = formatSupportSummary(summary);
    expect(text).toContain("Requests (count): 12");
    expect(text).toContain("Deferred automatic retries (count): 5");
    expect(text).toContain("Active editor model last check: missing");
    expect(text).toContain("Active file last check: blocked");
    expect(text).toContain("Explicit selected related files (count): 0");
    expect(text).toContain("Inference timings: disabled");
    expect(text).not.toContain("Recent inference p50:");
    expect(text.length).toBeLessThan(2400);
  });
  it("includes only aggregate latency when diagnostics opted in", () => {
    const text = formatSupportSummary({ ...summary, diagnosticsEnabled: true, relatedContextEnabled: true });
    expect(text).toContain("Recent inference p50: 55 ms");
    expect(text).toContain("Recent inference p95: 90 ms");
    expect(text).toContain("Explicit selected related files (count): 2");
    expect(text).not.toContain("qwen");
  });
  it("cannot interpolate hostile source-looking strings from injected runtime fields", () => {
    const poison = "SECRET_MARKER https://invalid.example/path/private.ts\npassword";
    const input = {
      ...summary, endpointState: poison, engineState: poison,
      activeModelCheck: poison, activeFileCheck: poison,
      // an unexpected extra key should not be enumerated into output
      modelName: poison, endpoint: poison, filename: poison,
      stats: { ...summary.stats!, requests: Number.NaN, completions: -100,
        recentLatencyP50Ms: Infinity, recentLatencyP95Ms: -5 }
    } as unknown as SupportSummarySnapshot;
    const text = formatSupportSummary({ ...input, diagnosticsEnabled: true });
    expect(text).not.toContain("SECRET_MARKER");
    expect(text).not.toContain("invalid.example");
    expect(text).not.toContain("private.ts");
    expect(text).toContain("Requests (count): 0");
    expect(text).toContain("Recent inference p50: not measured");
    expect(text).toContain("Recent inference p95: not measured");
  });
  it("handles no statistics without attempting model discovery or file reads", () => {
    const text = formatSupportSummary({ ...summary, stats: undefined });
    expect(text).toContain("Requests (count): 0");
    expect(text).not.toMatch(/\/api\/tags|\/api\/generate/);
  });
});
