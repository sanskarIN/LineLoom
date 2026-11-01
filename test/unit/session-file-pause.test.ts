import { describe, expect, it } from "vitest";
import { SessionFilePause } from "../../src/completion/session-file-pause";

describe("session-only pause of suggestions for individual files", () => {
  it("does not block other files and allows explicit resume", () => {
    const paused = new SessionFilePause();
    expect(paused.setPaused("file:///a.ts", true)).toBe(true);
    expect(paused.isPaused("file:///a.ts")).toBe(true);
    expect(paused.isPaused("file:///b.ts")).toBe(false);
    expect(paused.count).toBe(1);
    expect(paused.setPaused("file:///a.ts", false)).toBe(true);
    expect(paused.isPaused("file:///a.ts")).toBe(false);
  });
  it("never silently evicts a paused file at capacity", () => {
    const paused = new SessionFilePause(2);
    expect(paused.setPaused("file:///a.ts", true)).toBe(true);
    expect(paused.setPaused("file:///b.ts", true)).toBe(true);
    expect(paused.setPaused("file:///b.ts", true)).toBe(true);
    expect(paused.setPaused("file:///c.ts", true)).toBe(false);
    expect(paused.isPaused("file:///a.ts")).toBe(true);
    paused.setPaused("file:///a.ts", false);
    expect(paused.setPaused("file:///c.ts", true)).toBe(true);
  });
  it("never keeps a raw path and clears all pauses after session reset", () => {
    const paused = new SessionFilePause();
    const uri = "file:///private/sensitive-workspace/app.ts";
    paused.setPaused(uri, true);
    expect(JSON.stringify(paused)).not.toContain(uri);
    paused.clear();
    expect(paused.count).toBe(0);
    expect(paused.isPaused(uri)).toBe(false);
  });
});
