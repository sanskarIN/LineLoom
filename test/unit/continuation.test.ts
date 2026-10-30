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
    cache.invalidateOnEdit("file:///sample.ts", 5, [
      { rangeOffset: 15, rangeLength: 0, text: "4" }
    ]);
    expect(cache.remainder(sample({ version: 5, offset: 16, prefix: "const answer = 4" }), 200)).toBe("2");
    cache.remember(sample({ version: 5, offset: 16, prefix: "const answer = 4" }), "2", 200);
    expect(cache.remainder(sample({ version: 6, offset: 17, prefix: "const answer = 42" }), 201)).toBeUndefined();
  });
  it("rejects altered prefix, suffix, language, model settings and document", () => {
    const cache = new ContinuationCache();
    cache.remember(sample(), "123", 100);
    cache.invalidateOnEdit("file:///sample.ts", 5, [
      { rangeOffset: 15, rangeLength: 0, text: "1" }
    ]);
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
    cache.invalidateOnEdit("file:///sample.ts", 5, [
      { rangeOffset: 15, rangeLength: 0, text: "a" }
    ]);
    expect(cache.remainder(sample({ version: 6, offset: 16, prefix: "const answer = a" }), 200)).toBeUndefined();
    expect(cache.remainder(sample({ version: 5, offset: 15, prefix: "const answer = " }), 200)).toBeUndefined();
    expect(cache.remainder(sample({ version: 5, offset: 16, prefix: "const answer = x" }), 200)).toBeUndefined();
  });
  it("expires promptly and clears state", () => {
    const cache = new ContinuationCache(1000);
    const next = sample({ version: 5, offset: 16, prefix: "const answer = a" });
    cache.remember(sample(), "abc", 100);
    cache.invalidateOnEdit("file:///sample.ts", 5, [
      { rangeOffset: 15, rangeLength: 0, text: "a" }
    ]);
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
  it("does not reuse a forged matching version and source snapshot without an editor edit", () => {
    const cache = new ContinuationCache();
    cache.remember(sample(), "42", 100);
    const phantom = sample({ version: 5, offset: 16, prefix: "const answer = 4" });
    expect(cache.remainder(phantom, 200)).toBeUndefined();
    // Metadata notifications or edits of other documents cannot authorize
    // a continuation of this document.
    cache.invalidateOnEdit("file:///sample.ts", 5, []);
    cache.invalidateOnEdit("file:///other.ts", 5, [
      { rangeOffset: 15, rangeLength: 0, text: "4" }
    ]);
    expect(cache.remainder(phantom, 201)).toBeUndefined();
    // A real single insertion may still authorize the same fast path.
    cache.invalidateOnEdit("file:///sample.ts", 5, [
      { rangeOffset: 15, rangeLength: 0, text: "4" }
    ]);
    expect(cache.remainder(phantom, 202)).toBe("2");
  });

  it("ties the verified edit to its exact version and inserted character count", () => {
    const cache = new ContinuationCache();
    cache.remember(sample(), "example", 100);
    cache.invalidateOnEdit("file:///sample.ts", 5, [
      { rangeOffset: 15, rangeLength: 0, text: "ex" }
    ]);
    expect(cache.remainder(sample({
      version: 5, offset: 16, prefix: "const answer = e"
    }), 200)).toBeUndefined();
    expect(cache.remainder(sample({
      version: 6, offset: 17, prefix: "const answer = ex"
    }), 200)).toBeUndefined();
    expect(cache.remainder(sample({
      version: 5, offset: 17, prefix: "const answer = ex"
    }), 200)).toBe("ample");
  });

  it("never grants edit proof to an invalid replacement even if the text matches", () => {
    const cache = new ContinuationCache();
    const point = sample({ version: 5, offset: 16, prefix: "const answer = 4" });
    cache.remember(sample(), "42", 100);
    cache.invalidateOnEdit("file:///sample.ts", 5, [
      { rangeOffset: 15, rangeLength: 1, text: "4" }
    ]);
    expect(cache.remainder(point, 200)).toBeUndefined();
    // A cleared cache cannot be resurrected by a delayed matching event.
    cache.invalidateOnEdit("file:///sample.ts", 5, [
      { rangeOffset: 15, rangeLength: 0, text: "4" }
    ]);
    expect(cache.remainder(point, 201)).toBeUndefined();
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
    expect(cache.remainder(sample({ version: 5, offset: 16, prefix: "const answer = 4" }), 200)).toBeUndefined();
    cache.invalidateOnEdit("file:///sample.ts", 5, [{ rangeOffset: 15, rangeLength: 0, text: "4" }]);
    expect(cache.remainder(sample({ version: 5, offset: 16, prefix: "const answer = 4" }), 200)).toBe("2");
    cache.invalidateOnEdit("file:///sample.ts", 8, [{ rangeOffset: 15, rangeLength: 0, text: "4" }]);
    expect(cache.remainder(sample({ version: 5, offset: 16, prefix: "const answer = 4" }), 201)).toBeUndefined();
  });

  it("reuses a whole astral code point only when both UTF-16 units were inserted", () => {
    const cache = new ContinuationCache();
    cache.remember(sample(), "🚀launch()", 100);
    const actualEdit = [{ rangeOffset: 15, rangeLength: 0, text: "🚀" }];
    cache.invalidateOnEdit("file:///sample.ts", 5, actualEdit);
    expect(cache.remainder(sample({
      version: 5, offset: 17, prefix: "const answer = 🚀"
    }), 200)).toBe("launch()");
  });

  it("refuses ghost-text remainders split between Unicode surrogate halves", () => {
    const cache = new ContinuationCache();
    cache.remember(sample(), "🚀launch()", 100);
    const high = "🚀".slice(0, 1);
    // The editor event must immediately revoke this typed continuation.
    cache.invalidateOnEdit("file:///sample.ts", 5, [
      { rangeOffset: 15, rangeLength: 0, text: high }
    ]);
    expect(cache.remainder(sample({
      version: 5, offset: 16, prefix: "const answer = " + high
    }), 200)).toBeUndefined();

    // Do not rely solely on receiving a timely VS Code document event:
    // the remainder check itself must reject a half-code-point boundary.
    cache.remember(sample(), "🚀launch()", 300);
    expect(cache.remainder(sample({
      version: 5, offset: 16, prefix: "const answer = " + high
    }), 400)).toBeUndefined();
  });

  it("never caches malformed Unicode, including lone surrogates within suggestions", () => {
    for (const invalid of [
      "hi" + String.fromCharCode(0xd800),
      String.fromCharCode(0xdc00) + "abc",
      "a" + String.fromCharCode(0xd800) + "b",
      "a" + String.fromCharCode(0xdc00) + String.fromCharCode(0xd800)
    ]) {
      const cache = new ContinuationCache();
      cache.remember(sample(), invalid, 100);
      expect(cache.remainder(sample({
        version: 5, offset: 16, prefix: "const answer = " + invalid.slice(0, 1)
      }), 200)).toBeUndefined();
    }
    const valid = new ContinuationCache();
    valid.remember(sample(), "name🚀tail", 100);
    valid.invalidateOnEdit("file:///sample.ts", 5, [
      { rangeOffset: 15, rangeLength: 0, text: "n" }
    ]);
    // Boundary after the letter 'n' remains valid even with an astral character later.
    expect(valid.remainder(sample({
      version: 5, offset: 16, prefix: "const answer = n"
    }), 200)).toBe("ame🚀tail");
  });

  it("refuses an edit ending at a surrogate split even with other valid text before it", () => {
    const cache = new ContinuationCache();
    const original = "let🚀value";
    cache.remember(sample(), original, 100);
    const partial = original.slice(0, 4); // 'let' + high surrogate only.
    cache.invalidateOnEdit("file:///sample.ts", 5, [
      { rangeOffset: 15, rangeLength: 0, text: partial }
    ]);
    expect(cache.remainder(sample({
      version: 5, offset: 19, prefix: "const answer = " + partial
    }), 200)).toBeUndefined();
    cache.remember(sample(), original, 300);
    cache.invalidateOnEdit("file:///sample.ts", 5, [
      { rangeOffset: 15, rangeLength: 0, text: original.slice(0, 5) }
    ]);
    expect(cache.remainder(sample({
      version: 5, offset: 20, prefix: "const answer = let🚀"
    }), 400)).toBe("value");
  });

  it("ignores metadata-only VS Code notifications following a valid edit", () => {
    const cache = new ContinuationCache();
    cache.remember(sample(), "42", 100);
    cache.invalidateOnEdit("file:///sample.ts", 5, [{ rangeOffset: 15, rangeLength: 0, text: "4" }]);
    cache.invalidateOnEdit("file:///sample.ts", 5, []);
    expect(cache.remainder(sample({ version: 5, offset: 16, prefix: "const answer = 4" }), 200)).toBe("2");
  });

});
