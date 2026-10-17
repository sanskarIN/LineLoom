import { describe, expect, it } from "vitest";
import { shouldAutoComplete } from "../../src/completion/trigger";
describe("automatic suggestion throttling", () => {
  it("defers suggestions until meaningful text is present", () => {
    expect(shouldAutoComplete("   ", 2, false)).toBe(false);
    expect(shouldAutoComplete("    x", 2, false)).toBe(false);
    expect(shouldAutoComplete("    xy", 2, false)).toBe(true);
  });
  it("allows explicit triggers even on blank lines", () => {
    expect(shouldAutoComplete("    ", 32, true)).toBe(true);
  });
  it("handles a configured zero threshold", () => {
    expect(shouldAutoComplete("", 0, false)).toBe(true);
  });
});
