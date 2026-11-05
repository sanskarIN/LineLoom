import { describe, expect, it, vi } from "vitest";
import { SuggestionCache } from "../../src/completion/cache";
import { EmptySuggestionBackoff } from "../../src/completion/backoff";
import { TransientFailureBackoff } from "../../src/completion/failure-backoff";
import { ContinuationCache, type ContinuationPoint } from "../../src/completion/continuation";

describe("monotonic autocomplete cache lifetimes", () => {
  it("does not extend or prematurely end ephemeral state when the OS clock changes", () => {
    const monotonic = vi.spyOn(performance, "now").mockReturnValue(1_000);
    const wallClock = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    try {
      const cache = new SuggestionCache(2, 100);
      const empty = new EmptySuggestionBackoff(2, 100);
      const transient = new TransientFailureBackoff(2, 100, 1_000);
      const continuation = new ContinuationCache(100);
      const point: ContinuationPoint = {
        documentId: "file:///example.ts", languageId: "typescript",
        version: 4, offset: 4, prefix: "let ", suffix: ";", profileDigest: "opaque"
      };
      const next: ContinuationPoint = {
        ...point, version: 5, offset: 5, prefix: "let a"
      };
      cache.put("fingerprint", "suggestion");
      empty.rememberEmpty("fingerprint");
      expect(transient.recordFailure("profile")).toBe(100);
      continuation.remember(point, "abc");
      continuation.invalidateOnEdit(point.documentId, 5, [
        { rangeOffset: 4, rangeLength: 0, text: "a" }
      ]);

      // A backward wall-clock adjustment must not prolong an expired result.
      wallClock.mockReturnValue(-1_000_000);
      monotonic.mockReturnValue(1_099);
      expect(cache.get("fingerprint")).toBe("suggestion");
      expect(empty.shouldSkip("fingerprint")).toBe(true);
      expect(transient.shouldSkip("profile")).toBe(true);
      expect(continuation.remainder(next)).toBe("bc");

      // A forward wall-clock adjustment must not expire still-live state.
      wallClock.mockReturnValue(9_000_000);
      expect(cache.get("fingerprint")).toBe("suggestion");
      expect(empty.shouldSkip("fingerprint")).toBe(true);
      expect(transient.shouldSkip("profile")).toBe(true);
      expect(continuation.remainder(next)).toBe("bc");

      // The exact monotonic deadline expires all four independent caches.
      monotonic.mockReturnValue(1_100);
      expect(cache.get("fingerprint")).toBeUndefined();
      expect(empty.shouldSkip("fingerprint")).toBe(false);
      expect(transient.shouldSkip("profile")).toBe(false);
      expect(continuation.remainder(next)).toBeUndefined();
      // An expired transport-failure cooldown retains the failure streak.
      expect(transient.recordFailure("profile")).toBe(200);
    } finally {
      monotonic.mockRestore();
      wallClock.mockRestore();
    }
  });
});
