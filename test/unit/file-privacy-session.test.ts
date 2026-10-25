import { describe, expect, it } from "vitest";
import { FilePrivacySession } from "../../src/ui/file-privacy-session";

describe("session-only manual active-file privacy status", () => {
  it("does not assume privacy eligibility before the user requests inspection", () => {
    const session = new FilePrivacySession();
    expect(session.state).toBe("not-checked");
    const token = session.begin();
    expect(session.state).toBe("checking");
    expect(session.isCurrent(token)).toBe(true);
    expect(session.finish(token, "allowed")).toBe(true);
    expect(session.state).toBe("allowed");
    expect(session.finish(token, "blocked")).toBe(false);
  });

  it("ignores a late permission result from an overlapping check", () => {
    const session = new FilePrivacySession();
    const first = session.begin();
    const second = session.begin();
    expect(session.finish(first, "allowed")).toBe(false);
    expect(session.finish(second, "blocked")).toBe(true);
    expect(session.state).toBe("blocked");
  });

  it("clears pending and completed statuses after an editor or policy change", () => {
    const session = new FilePrivacySession();
    const obsolete = session.begin();
    session.clear();
    expect(session.finish(obsolete, "allowed")).toBe(false);
    expect(session.state).toBe("not-checked");
    const next = session.begin();
    expect(session.finish(next, "allowed")).toBe(true);
    session.clear();
    expect(session.state).toBe("not-checked");
  });

  it("supports a no-editor outcome without retaining any path or source", () => {
    const session = new FilePrivacySession();
    const token = session.begin();
    expect(session.finish(token, "no-editor")).toBe(true);
    expect(session.state).toBe("no-editor");
    expect(JSON.stringify(session)).not.toContain("/home/");
    expect(JSON.stringify(session)).not.toContain("example.ts");
  });
});
