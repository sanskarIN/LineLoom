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
  it("extracts indentation without importing another file", () => {
    expect(extractContext("fn main() {\n    let value", 25, 256).indentation).toBe("    ");
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
