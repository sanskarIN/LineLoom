import { describe, expect, it } from "vitest";
import { ContinuationCache, type ContinuationPoint } from "../../src/completion/continuation";

function sample(overrides: Partial<ContinuationPoint> = {}): ContinuationPoint {
  return {
    documentId: "file:///sample.ts", languageId: "typescript", version: 4, offset: 15,
    prefix: "const answer = ", suffix: "\nconsole.log(answer);", profileDigest: "profile-a",
    ...overrides
  };
}
describe("typed suggestion continuation", () => {
  it("offers the exact untyped remainder after a single forward edit", () => {
    const cache = new ContinuationCache();
    cache.remember(sample(), "42", 100);
    expect(cache.remainder(sample({ version: 5, offset: 16, prefix: "const answer = 4" }), 200)).toBe("2");
    cache.remember(sample({ version: 5, offset: 16, prefix: "const answer = 4" }), "2", 200);
    expect(cache.remainder(sample({ version: 6, offset: 17, prefix: "const answer = 42" }), 201)).toBeUndefined();
  });
  it("rejects altered prefix, suffix, language, model settings and document", () => {
    const cache = new ContinuationCache();
    cache.remember(sample(), "123", 100);
    const next = sample({ version: 5, offset: 16, prefix: "const answer = 1" });
    expect(cache.remainder({ ...next, prefix: "const result = 1" }, 200)).toBeUndefined();
    expect(cache.remainder({ ...next, suffix: "\nmodified()" }, 200)).toBeUndefined();
    expect(cache.remainder({ ...next, languageId: "javascript" }, 200)).toBeUndefined();
    expect(cache.remainder({ ...next, profileDigest: "profile-b" }, 200)).toBeUndefined();
    expect(cache.remainder({ ...next, documentId: "file:///other.ts" }, 200)).toBeUndefined();
  });
  it("refuses skipped versions, edits at another cursor and mismatched typed code", () => {
    const cache = new ContinuationCache();
    cache.remember(sample(), "answer", 100);
    expect(cache.remainder(sample({ version: 6, offset: 16, prefix: "const answer = a" }), 200)).toBeUndefined();
    expect(cache.remainder(sample({ version: 5, offset: 15, prefix: "const answer = " }), 200)).toBeUndefined();
    expect(cache.remainder(sample({ version: 5, offset: 16, prefix: "const answer = x" }), 200)).toBeUndefined();
  });
  it("expires promptly and clears state", () => {
    const cache = new ContinuationCache(1000);
    const next = sample({ version: 5, offset: 16, prefix: "const answer = a" });
    cache.remember(sample(), "abc", 100);
    expect(cache.remainder(next, 1099)).toBe("bc");
    expect(cache.remainder(next, 1100)).toBeUndefined();
    cache.remember(sample(), "abc", 1200);
    cache.clear();
    expect(cache.remainder(next, 1201)).toBeUndefined();
  });
  it("rejects full acceptance, oversized typed runs and oversized suggestions", () => {
    const cache = new ContinuationCache(2000, 2);
    cache.remember(sample(), "abcde", 100);
    expect(cache.remainder(sample({ version: 5, offset: 18, prefix: "const answer = abc" }), 200)).toBeUndefined();
    cache.remember(sample(), "abc", 100);
    expect(cache.remainder(sample({ version: 5, offset: 18, prefix: "const answer = abc" }), 200)).toBeUndefined();
    cache.remember(sample(), "x".repeat(6001), 100);
    expect(cache.remainder(sample({ version: 5, offset: 16, prefix: "const answer = x" }), 200)).toBeUndefined();
  });
  it("keeps the candidate only for one actual forward insertion of generated text", () => {
    const cache = new ContinuationCache();
    cache.remember(sample(), "42", 100);
    cache.invalidateOnEdit("file:///sample.ts", 5, [{ rangeOffset: 15, rangeLength: 0, text: "4" }]);
    expect(cache.remainder(sample({ version: 5, offset: 16, prefix: "const answer = 4" }), 200)).toBe("2");
  });
  it("invalidates candidates on replacements, other-position edits, bulk edits and incorrect text", () => {
    const badEdits = [
      [{ rangeOffset: 15, rangeLength: 1, text: "4" }],
      [{ rangeOffset: 3, rangeLength: 0, text: "4" }],
      [{ rangeOffset: 15, rangeLength: 0, text: "4" }, { rangeOffset: 0, rangeLength: 0, text: "x" }],
      [{ rangeOffset: 15, rangeLength: 0, text: "x" }],
      [{ rangeOffset: 15, rangeLength: 0, text: "" }],
      [{ rangeOffset: 15, rangeLength: 0, text: "42" }]
    ];
    const next = sample({ version: 5, offset: 16, prefix: "const answer = 4" });
    for (const edits of badEdits) {
      const cache = new ContinuationCache();
      cache.remember(sample(), "42", 100);
      cache.invalidateOnEdit("file:///sample.ts", 5, edits);
      expect(cache.remainder(next, 200)).toBeUndefined();
    }
  });
  it("invalidates non-consecutive updates and leaves unrelated documents alone", () => {
    const cache = new ContinuationCache();
    cache.remember(sample(), "42", 100);
    cache.invalidateOnEdit("file:///other.ts", 5, [{ rangeOffset: 15, rangeLength: 0, text: "x" }]);
    expect(cache.remainder(sample({ version: 5, offset: 16, prefix: "const answer = 4" }), 200)).toBe("2");
    cache.invalidateOnEdit("file:///sample.ts", 8, [{ rangeOffset: 15, rangeLength: 0, text: "4" }]);
    expect(cache.remainder(sample({ version: 5, offset: 16, prefix: "const answer = 4" }), 201)).toBeUndefined();
  });

});
