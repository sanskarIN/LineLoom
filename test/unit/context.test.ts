import { describe, expect, it } from "vitest";
import { extractContext } from "../../src/context/extract";
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
});
