import { describe, expect, it } from "vitest";
import { AcceptanceTracker } from "../../src/completion/acceptance";

describe("private, ephemeral suggestion acceptance acknowledgements", () => {
  it("issues unique opaque tokens, ignores malformed inputs and replay", () => {
    const tracker = new AcceptanceTracker();
    const first = tracker.issue(100);
    const second = tracker.issue(101);
    expect(first).not.toBe(second);
    expect(first).toMatch(/^[a-f0-9-]{36}$/);
    for (const invalid of [undefined, null, {}, [], 7, "", "made-up", { token: first }]) {
      expect(tracker.acknowledge(invalid, 102)).toBe(false);
    }
    expect(tracker.acknowledge(first, 103)).toBe(true);
    expect(tracker.acknowledge(first, 104)).toBe(false);
    expect(tracker.acknowledge(second, 105)).toBe(true);
  });

  it("expires old offered-item callbacks without counting stale acceptances", () => {
    const tracker = new AcceptanceTracker();
    const first = tracker.issue(100);
    expect(tracker.acknowledge(first, 300_099)).toBe(true);
    const expired = tracker.issue(200);
    // A callback at the exact expiration boundary must not count.
    expect(tracker.acknowledge(expired, 300_200)).toBe(false);
    expect(tracker.acknowledge(expired, 300_201)).toBe(false);
    const later = tracker.issue(400);
    expect(tracker.acknowledge(later, 300_401)).toBe(false);
  });

  it("prunes stale tokens before applying the 128-item capacity bound", () => {
    const tracker = new AcceptanceTracker();
    const old = Array.from({ length: 128 }, () => tracker.issue(0));
    const recent = tracker.issue(300_001);
    for (const token of old) expect(tracker.acknowledge(token, 300_002)).toBe(false);
    expect(tracker.acknowledge(recent, 300_002)).toBe(true);
  });

  it("caps outstanding tokens at 128 to prevent unbounded memory growth", () => {
    const tracker = new AcceptanceTracker();
    const tokens = Array.from({ length: 130 }, () => tracker.issue(0));
    expect(tracker.acknowledge(tokens[0], 1)).toBe(false);
    expect(tracker.acknowledge(tokens[1], 1)).toBe(false);
    expect(tracker.acknowledge(tokens[2], 1)).toBe(true);
    expect(tracker.acknowledge(tokens[129], 1)).toBe(true);
  });

  it("does not extend old receipt expiry when new tokens are issued", () => {
    const tracker = new AcceptanceTracker();
    const older = tracker.issue(1_000);
    const newer = tracker.issue(250_000);
    expect(tracker.acknowledge(older, 301_000)).toBe(false);
    expect(tracker.acknowledge(newer, 301_000)).toBe(true);
  });

  it("clears tokens without storing content, files or editor identity", () => {
    const tracker = new AcceptanceTracker();
    const token = tracker.issue(10);
    tracker.clear();
    expect(tracker.acknowledge(token, 11)).toBe(false);
    expect(tracker.acknowledge(tracker.issue(12), 13)).toBe(true);
  });
});
