import { describe, expect, it } from "vitest";
import { isTransientGenerationFailure, TransientFailureBackoff } from "../../src/completion/failure-backoff";

describe("transient Ollama failure cooldown", () => {
  it("doubles after repeated failures, caps delays, and expires without forgetting the streak", () => {
    const backoff = new TransientFailureBackoff(4, 1000, 8000);
    expect(backoff.shouldSkip("opaque", 10)).toBe(false);
    expect(backoff.recordFailure("opaque", 100)).toBe(1000);
    expect(backoff.shouldSkip("opaque", 1099)).toBe(true);
    expect(backoff.shouldSkip("opaque", 1100)).toBe(false);
    expect(backoff.recordFailure("opaque", 1100)).toBe(2000);
    expect(backoff.recordFailure("opaque", 3100)).toBe(4000);
    expect(backoff.recordFailure("opaque", 7100)).toBe(8000);
    expect(backoff.recordFailure("opaque", 15100)).toBe(8000);
    expect(backoff.shouldSkip("opaque", 23099)).toBe(true);
    expect(backoff.shouldSkip("opaque", 23100)).toBe(false);
  });
  it("isolates hashed endpoint+model profiles and resets on success or explicit policy reset", () => {
    const backoff = new TransientFailureBackoff();
    backoff.recordFailure("profile-a", 0);
    expect(backoff.shouldSkip("profile-b", 1)).toBe(false);
    backoff.recordSuccess("profile-a");
    expect(backoff.recordFailure("profile-a", 10)).toBe(1000);
    backoff.clear();
    expect(backoff.shouldSkip("profile-a", 11)).toBe(false);
  });
  it("evicts only the oldest profile and ignores empty keys / disabled capacity", () => {
    const backoff = new TransientFailureBackoff(2, 1000, 2000);
    backoff.recordFailure("a", 100);
    backoff.recordFailure("b", 100);
    backoff.recordFailure("c", 100);
    expect(backoff.shouldSkip("a", 101)).toBe(false);
    expect(backoff.shouldSkip("b", 101)).toBe(true);
    expect(backoff.shouldSkip("c", 101)).toBe(true);
    expect(backoff.recordFailure("", 100)).toBe(0);
    expect(new TransientFailureBackoff(0).recordFailure("x", 1)).toBe(0);
  });
  it("suppresses only transient server, transport or timeout failures", () => {
    for (const status of [429, 500, 503, 599]) {
      expect(isTransientGenerationFailure(new Error("Ollama returned HTTP " + status + "."))).toBe(true);
    }
    expect(isTransientGenerationFailure(new TypeError("fetch failed"))).toBe(true);
    expect(isTransientGenerationFailure(new Error("unused"), true)).toBe(true);
    for (const status of [400, 401, 403, 404, 422]) {
      expect(isTransientGenerationFailure(new Error("Ollama returned HTTP " + status + "."))).toBe(false);
    }
    expect(isTransientGenerationFailure(new DOMException("Cancelled", "AbortError"))).toBe(false);
    expect(isTransientGenerationFailure(new Error("Invalid Ollama response event."))).toBe(false);
    expect(isTransientGenerationFailure(null)).toBe(false);
  });
});
