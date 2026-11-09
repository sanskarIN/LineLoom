import { describe, expect, it } from "vitest";
import { EmptySuggestionBackoff } from "../../src/completion/backoff";

describe("empty response backoff", () => {
  it("suppresses the same fingerprint until the short TTL expires", () => {
    const cache = new EmptySuggestionBackoff(8, 5000);
    cache.rememberEmpty("hashed-key", 100);
    expect(cache.shouldSkip("hashed-key", 5099)).toBe(true);
    expect(cache.shouldSkip("hashed-key", 5100)).toBe(false);
  });
  it("does not suppress a different cursor, model or prompt fingerprint", () => {
    const cache = new EmptySuggestionBackoff();
    cache.rememberEmpty("a", 1000);
    expect(cache.shouldSkip("b", 1001)).toBe(false);
  });
  it("evicts the least recently used failed fingerprint", () => {
    const cache = new EmptySuggestionBackoff(2, 5000);
    cache.rememberEmpty("a", 100);
    cache.rememberEmpty("b", 100);
    expect(cache.shouldSkip("a", 101)).toBe(true);
    cache.rememberEmpty("c", 102);
    expect(cache.shouldSkip("b", 103)).toBe(false);
    expect(cache.shouldSkip("a", 103)).toBe(true);
  });
  it("prunes expired recent fingerprints before evicting live cooldowns", () => {
    const cache = new EmptySuggestionBackoff(2, 100);
    cache.rememberEmpty("expired", 0);
    cache.rememberEmpty("live", 80);
    expect(cache.shouldSkip("expired", 90)).toBe(true); // move near-expiry item to MRU
    cache.rememberEmpty("new", 110);
    expect(cache.shouldSkip("expired", 111)).toBe(false);
    expect(cache.shouldSkip("live", 111)).toBe(true);
    expect(cache.shouldSkip("new", 111)).toBe(true);
  });
  it("clears all fingerprints when settings or workspace state changes", () => {
    const cache = new EmptySuggestionBackoff();
    cache.rememberEmpty("a", 100);
    cache.clear();
    expect(cache.shouldSkip("a", 101)).toBe(false);
  });
});
