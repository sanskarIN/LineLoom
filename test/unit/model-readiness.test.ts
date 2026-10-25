import { describe, expect, it } from "vitest";
import { ModelReadinessSession } from "../../src/ui/model-readiness";

describe("manual model readiness session", () => {
  it("starts unverified and only changes after an explicit begin/finish", () => {
    const session = new ModelReadinessSession();
    expect(session.state).toBe("not-checked");
    const token = session.begin();
    expect(session.isCurrent(token)).toBe(true);
    expect(session.state).toBe("checking");
    expect(session.finish(token, "available")).toBe(true);
    expect(session.state).toBe("available");
    expect(session.isCurrent(token)).toBe(false);
    expect(session.finish(token, "unreachable")).toBe(false);
    expect(session.state).toBe("available");
  });

  it("discards an older out-of-order check when a newer one starts", () => {
    const session = new ModelReadinessSession();
    const old = session.begin();
    const current = session.begin();
    expect(session.finish(old, "missing")).toBe(false);
    expect(session.state).toBe("checking");
    expect(session.finish(current, "available")).toBe(true);
    expect(session.state).toBe("available");
  });

  it("clears results on settings or consent changes and rejects late completions", () => {
    const session = new ModelReadinessSession();
    const pending = session.begin();
    session.clear();
    expect(session.state).toBe("not-checked");
    expect(session.finish(pending, "available")).toBe(false);
    const again = session.begin();
    expect(session.finish(again, "unreachable")).toBe(true);
    session.clear();
    expect(session.state).toBe("not-checked");
  });

  it("handles missing model and declined approval without persisting endpoint data", () => {
    const session = new ModelReadinessSession();
    const one = session.begin();
    expect(session.finish(one, "missing")).toBe(true);
    expect(session.state).toBe("missing");
    const two = session.begin();
    expect(session.finish(two, "not-checked")).toBe(true);
    expect(session.state).toBe("not-checked");
    expect(JSON.stringify(session)).not.toContain("http");
  });
});
