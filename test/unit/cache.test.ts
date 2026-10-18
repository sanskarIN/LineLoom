import { describe, expect, it } from "vitest";
import { SuggestionCache } from "../../src/completion/cache";

describe("bounded in-memory suggestion cache", () => {
  it("reuses exact results only before expiry", () => {
    const cache = new SuggestionCache(2, 100);
    cache.put("hash1", "code", 1000);
    expect(cache.get("hash1", 1050)).toBe("code");
    expect(cache.get("hash1", 1100)).toBeUndefined();
  });
  it("evicts least-recently-used results", () => {
    const cache = new SuggestionCache(2, 1000);
    cache.put("a", "A", 0);
    cache.put("b", "B", 0);
    expect(cache.get("a", 10)).toBe("A");
    cache.put("c", "C", 10);
    expect(cache.get("b", 11)).toBeUndefined();
    expect(cache.get("a", 11)).toBe("A");
  });
  it("never stores empty suggestions and can be cleared", () => {
    const cache = new SuggestionCache();
    cache.put("a", "");
    expect(cache.get("a")).toBeUndefined();
    cache.put("a", "code");
    cache.clear();
    expect(cache.get("a")).toBeUndefined();
  });
});
