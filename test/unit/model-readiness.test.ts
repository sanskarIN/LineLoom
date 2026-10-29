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

  it("cancels superseded network signals when another manual check begins", () => {
    const session = new ModelReadinessSession();
    const old = session.begin();
    const oldSignal = session.signalFor(old);
    expect(oldSignal.aborted).toBe(false);
    const current = session.begin();
    expect(oldSignal.aborted).toBe(true);
    expect(session.signalFor(old).aborted).toBe(true);
    expect(session.signalFor(current).aborted).toBe(false);
    expect(session.finish(old, "available")).toBe(false);
    expect(session.finish(current, "missing")).toBe(true);
    expect(session.signalFor(current).aborted).toBe(true);
  });

  it("aborts an unfinished network check after an editor or settings change", () => {
    const session = new ModelReadinessSession();
    const token = session.begin();
    const signal = session.signalFor(token);
    session.clear();
    expect(signal.aborted).toBe(true);
    expect(session.signalFor(token).aborted).toBe(true);
    expect(session.finish(token, "available")).toBe(false);
    const another = session.begin();
    expect(session.signalFor(another).aborted).toBe(false);
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
