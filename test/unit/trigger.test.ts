import { describe, expect, it } from "vitest";
import { shouldAutoComplete, shouldRequestAtCursor, hasSingleInsertionCursor } from "../../src/completion/trigger";
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

describe("inline insertion cursor gate", () => {
  const cursor = (line: number, character: number, isEmpty = true) =>
    ({ isEmpty, active: { line, character } });
  it("allows one empty selection at the requested position", () => {
    expect(hasSingleInsertionCursor([cursor(2, 4)], 2, 4)).toBe(true);
  });
  it("rejects selection replacement and multiple cursors", () => {
    expect(hasSingleInsertionCursor([cursor(2, 4, false)], 2, 4)).toBe(false);
    expect(hasSingleInsertionCursor([cursor(2, 4), cursor(3, 4)], 2, 4)).toBe(false);
  });
  it("rejects stale positions and missing selections", () => {
    expect(hasSingleInsertionCursor([cursor(2, 4)], 2, 5)).toBe(false);
    expect(hasSingleInsertionCursor([], 2, 4)).toBe(false);
  });
});

describe("mid-token automatic request gate", () => {
  it("blocks suggestions immediately before identifier characters", () => {
    for (const next of ["foo", "42", "_value", "$amount", "变量", "école", "\u0301accent", "\u093e", "\u200cword", "\u200dword", "\u203fconnector"]) {
      expect(shouldRequestAtCursor(next, false)).toBe(false);
    }
  });
  it("allows end-of-line and punctuation boundaries", () => {
    for (const next of ["", "\\nnext", ")finish", ";", " next", ".", "{"]) {
      expect(shouldRequestAtCursor(next, false)).toBe(true);
    }
  });
  it("allows manual invocation and configurable opt-out", () => {
    expect(shouldRequestAtCursor("identifier", true)).toBe(true);
    expect(shouldRequestAtCursor("identifier", false, false)).toBe(true);
  });
});
