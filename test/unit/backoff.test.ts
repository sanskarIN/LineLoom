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
  it("clears all fingerprints when settings or workspace state changes", () => {
    const cache = new EmptySuggestionBackoff();
    cache.rememberEmpty("a", 100);
    cache.clear();
    expect(cache.shouldSkip("a", 101)).toBe(false);
  });
});
