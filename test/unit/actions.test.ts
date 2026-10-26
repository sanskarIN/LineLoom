import { describe, expect, it } from "vitest";
import { quickActions } from "../../src/ui/actions";

describe("LineLoom Quick Actions", () => {
  it("offers disabled/enabled actions without losing the other commands", () => {
    const enabled = quickActions(true, true);
    const disabled = quickActions(false, true);
    expect(enabled[0].command).toBe("lineloom.disable");
    expect(disabled[0].command).toBe("lineloom.enable");
    expect(enabled).toHaveLength(13);
    expect(new Set(enabled.map(action => action.id)).size).toBe(13);
  });
  it("offers an automatic pause/resume toggle, keeping manual triggering accessible", () => {
    expect(quickActions(true, true)[1].label).toMatch(/Pause Automatic/);
    expect(quickActions(true, false)[1].label).toMatch(/Resume Automatic/);
    expect(quickActions(true, false).some(action => action.command === "lineloom.trigger")).toBe(true);
  });
  it("shows privacy timing reset in Quick Actions only after diagnostics opt-in", () => {
    for (const off of [quickActions(true, false), quickActions(true, true, false)]) {
      expect(off.some(item => item.command === "lineloom.resetPrivacyTimings")).toBe(false);
      expect(off).toHaveLength(13);
    }
    const on = quickActions(true, true, true);
    const reset = on.find(item => item.command === "lineloom.resetPrivacyTimings");
    expect(on).toHaveLength(15);
    expect(reset).toMatchObject({
      id: "resetPrivacyTimings",
      label: "$(trash) Reset Privacy Timing Statistics"
    });
    expect(reset?.description).not.toMatch(/path|prompt|source/i);
    expect(new Set(on.map(item => item.id)).size).toBe(15);
    expect(on.find(item => item.command === "lineloom.resetInferenceTimings")).toMatchObject({
      id: "resetInferenceTimings",
      label: "$(trash) Reset Inference Timing Samples"
    });
    expect(quickActions(true, true, false).every(action => action.command !== "lineloom.resetInferenceTimings")).toBe(true);
  });
  it("has only known LineLoom commands, with no implicit network side effects", () => {
    const actions = quickActions(false, false);
    expect(actions.every(action => /^lineloom\.[a-zA-Z]+$/.test(action.command))).toBe(true);
    expect(actions.some(action => action.command === "lineloom.selectModel")).toBe(true);
    expect(actions.some(action => action.command === "lineloom.selectLanguageModel")).toBe(true);
    expect(actions.some(action => action.command === "lineloom.checkConnection")).toBe(true);
    expect(actions.find(action => action.id === "filePrivacy")).toMatchObject({
      command: "lineloom.checkActiveFilePrivacy",
      label: "$(shield) Check Active File Privacy"
    });
    expect(actions.some(action => action.command === "lineloom.openSidebar")).toBe(true);
    expect(actions.some(action => action.command === "lineloom.resetSessionActivity")).toBe(true);
    const cancel = actions.find(action => action.command === "lineloom.cancel");
    expect(cancel?.description).toMatch(/without disabling future suggestions/);
    expect(cancel?.label).toMatch(/Stop Current Generation/);
  });
});

describe("opt-in related-file Quick Actions", () => {
  it("adds no actions when cross-file context is off, but exposes selective commands when enabled", () => {
    expect(quickActions(true, true, false, false, 2).some(a =>
      a.command === "lineloom.selectRelatedFiles")).toBe(false);
    const enabled = quickActions(true, true, false, true, 2);
    expect(enabled.some(a => a.command === "lineloom.selectRelatedFiles")).toBe(true);
    expect(enabled.some(a => a.command === "lineloom.clearRelatedFiles")).toBe(true);
    expect(new Set(enabled.map(a => a.id)).size).toBe(enabled.length);
    expect(quickActions(true, true, false, true, 0).some(a =>
      a.command === "lineloom.clearRelatedFiles")).toBe(false);
  });
});
