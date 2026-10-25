import { describe, expect, it } from "vitest";
import { AcceptanceTracker } from "../../src/completion/acceptance";

describe("private, ephemeral suggestion acceptance acknowledgements", () => {
  it("issues unique opaque tokens, ignores malformed inputs and replay", () => {
    const tracker = new AcceptanceTracker();
    const first = tracker.issue();
    const second = tracker.issue();
    expect(first).not.toBe(second);
    expect(first).toMatch(/^[a-f0-9-]{36}$/);
    for (const invalid of [undefined, null, {}, [], 7, "", "made-up", { token: first }]) {
      expect(tracker.acknowledge(invalid)).toBe(false);
    }
    expect(tracker.acknowledge(first)).toBe(true);
    expect(tracker.acknowledge(first)).toBe(false);
    expect(tracker.acknowledge(second)).toBe(true);
  });

  it("caps outstanding tokens at 128 to prevent unbounded memory growth", () => {
    const tracker = new AcceptanceTracker();
    const tokens = Array.from({ length: 130 }, () => tracker.issue());
    expect(tracker.acknowledge(tokens[0])).toBe(false);
    expect(tracker.acknowledge(tokens[1])).toBe(false);
    expect(tracker.acknowledge(tokens[2])).toBe(true);
    expect(tracker.acknowledge(tokens[129])).toBe(true);
  });

  it("clears tokens without storing content, files or editor identity", () => {
    const tracker = new AcceptanceTracker();
    const token = tracker.issue();
    tracker.clear();
    expect(tracker.acknowledge(token)).toBe(false);
    expect(tracker.acknowledge(tracker.issue())).toBe(true);
  });
});
