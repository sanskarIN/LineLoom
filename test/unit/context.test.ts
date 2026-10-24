import { describe, expect, it } from "vitest";
import { extractContext, extractContextWindow } from "../../src/context/extract";
describe("active-document context", () => {
  it("contains bounded prefix and suffix around cursor", () => {
    const value = extractContext("alpha\nbeta\ngamma", 8, 128);
    expect(value.prefix).toBe("alpha\nbe");
    expect(value.suffix).toBe("ta\ngamma");
    expect(value.cursorOffset).toBe(8);
  });
  it("clamps cursor offsets and never exceeds configured budget", () => {
    const text = "x".repeat(400) + "y".repeat(400);
    const ctx = extractContext(text, 400, 150);
    expect(ctx.prefix.length + ctx.suffix.length).toBeLessThanOrEqual(150);
    expect(extractContext("abc", -3, 128).prefix).toBe("");
    expect(extractContext("abc", 900, 128).suffix).toBe("");
  });
  it("fails closed for non-finite editor offsets, document lengths and budgets", () => {
    for (const [offset, length, budget] of [
      [Number.NaN, 200, 512],
      [Number.POSITIVE_INFINITY, 200, 512],
      [Number.NEGATIVE_INFINITY, 200, 512],
      [50, Number.NaN, 512],
      [50, Number.POSITIVE_INFINITY, 512],
      [50, 200, Number.NaN],
      [50, 200, Number.POSITIVE_INFINITY],
      [50, 200, Number.NEGATIVE_INFINITY]
    ]) {
      let reads = 0;
      const value = extractContextWindow(() => {
        reads++;
        return "should not read";
      }, offset, length, budget);
      expect(value).toEqual({ prefix: "", suffix: "", indentation: "", cursorOffset: 0 });
      expect(reads).toBe(0);
    }
  });

  it("clamps oversized direct caller budgets to the 30,000-unit setting maximum", () => {
    const text = "p".repeat(80_000);
    const reads: Array<[number, number]> = [];
    const value = extractContextWindow((start, end) => {
      reads.push([start, end]);
      return text.slice(start, end);
    }, 40_000, text.length, Number.MAX_SAFE_INTEGER);
    expect(value.cursorOffset).toBe(40_000);
    expect(value.prefix.length + value.suffix.length).toBe(30_000);
    expect(reads).toHaveLength(2);
    expect(reads.every(([start, end]) => end >= start && end - start <= 30_000)).toBe(true);
  });

  it("extracts indentation without importing another file", () => {
    expect(extractContext("fn main() {\n    let value", 25, 256).indentation).toBe("    ");
  });
  // Cursor offsets and configured budgets are measured in UTF-16 code units.
  // Never hand malformed surrogate halves to a local or approved remote model.
  function expectValidSurrogates(value: string): void {
    for (let index = 0; index < value.length; index++) {
      const code = value.charCodeAt(index);
      if (code >= 0xd800 && code <= 0xdbff) {
        expect(index + 1).toBeLessThan(value.length);
        expect(value.charCodeAt(++index)).toBeGreaterThanOrEqual(0xdc00);
        expect(value.charCodeAt(index)).toBeLessThanOrEqual(0xdfff);
      } else {
        expect(code < 0xdc00 || code > 0xdfff).toBe(true);
      }
    }
  }

  it("drops an orphan low surrogate at the left edge of a prefix window", () => {
    // 128 units -> 90-unit prefix; cursor 200 -> start 110, inside 🚀.
    const text = "a".repeat(109) + "🚀" + "b".repeat(350);
    const context = extractContext(text, 200, 128);
    expect(context.prefix).toBe("b".repeat(89));
    expect(context.prefix.length + context.suffix.length).toBeLessThanOrEqual(128);
    expectValidSurrogates(context.prefix);
    expectValidSurrogates(context.suffix);
  });

  it("drops an orphan high surrogate at the right edge of a suffix window", () => {
    // Cursor 50 -> suffix ends at 128, halfway through the emoji at 127.
    const text = "a".repeat(127) + "🚀" + "b".repeat(300);
    const context = extractContext(text, 50, 128);
    expect(context.suffix).toBe("a".repeat(77));
    expect(context.prefix.length + context.suffix.length).toBeLessThanOrEqual(128);
    expectValidSurrogates(context.prefix);
    expectValidSurrogates(context.suffix);
  });

  it("refuses to include halves of a character when the caret is inside it", () => {
    const text = "return 🚀;\n";
    const context = extractContext(text, "return ".length + 1, 128);
    expect(context.prefix).toBe("return ");
    expect(context.suffix).toBe(";\n");
    expectValidSurrogates(context.prefix);
    expectValidSurrogates(context.suffix);
  });

  it("preserves intact Unicode on both sides of the caret", () => {
    const text = "🚀 code 🚀 done";
    const context = extractContext(text, "🚀 code ".length, 128);
    expect(context.prefix).toBe("🚀 code ");
    expect(context.suffix).toBe("🚀 done");
    expectValidSurrogates(context.prefix);
    expectValidSurrogates(context.suffix);
  });

  it("reads only bounded slices instead of a full large buffer", () => {
    const text = "p".repeat(250_000) + "cursor" + "s".repeat(250_000);
    const reads: Array<[number, number]> = [];
    const result = extractContextWindow((start, end) => {
      reads.push([start, end]);
      return text.slice(start, end);
    }, 250_006, text.length, 512);
    expect(result.prefix.length + result.suffix.length).toBeLessThanOrEqual(512);
    expect(reads).toHaveLength(2);
    expect(reads.every(([start, end]) => end - start <= 512)).toBe(true);
  });

});
