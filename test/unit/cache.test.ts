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
  it("prunes expired recent entries instead of evicting a live LRU entry", () => {
    const cache = new SuggestionCache(2, 100);
    cache.put("expired", "old", 0);
    cache.put("live", "live", 80);
    expect(cache.get("expired", 90)).toBe("old"); // move the soon-expired entry to MRU
    cache.put("new", "fresh", 110);
    expect(cache.get("expired", 111)).toBeUndefined();
    expect(cache.get("live", 111)).toBe("live");
    expect(cache.get("new", 111)).toBe("fresh");
  });
  it("does not retain entries when capacity or TTL is disabled", () => {
    const disabledCapacity = new SuggestionCache(0, 100);
    disabledCapacity.put("a", "A", 0);
    expect(disabledCapacity.get("a", 1)).toBeUndefined();
    const disabledTtl = new SuggestionCache(2, 0);
    disabledTtl.put("a", "A", 0);
    expect(disabledTtl.get("a", 0)).toBeUndefined();
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
