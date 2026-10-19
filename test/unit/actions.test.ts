import { describe, expect, it } from "vitest";
import { quickActions } from "../../src/ui/actions";

describe("LineLoom Quick Actions", () => {
  it("offers disabled/enabled actions without losing the other commands", () => {
    const enabled = quickActions(true, true);
    const disabled = quickActions(false, true);
    expect(enabled[0].command).toBe("lineloom.disable");
    expect(disabled[0].command).toBe("lineloom.enable");
    expect(enabled).toHaveLength(9);
    expect(new Set(enabled.map(action => action.id)).size).toBe(9);
  });
  it("offers an automatic pause/resume toggle, keeping manual triggering accessible", () => {
    expect(quickActions(true, true)[1].label).toMatch(/Pause Automatic/);
    expect(quickActions(true, false)[1].label).toMatch(/Resume Automatic/);
    expect(quickActions(true, false).some(action => action.command === "lineloom.trigger")).toBe(true);
  });
  it("has only known LineLoom commands, with no implicit network side effects", () => {
    const actions = quickActions(false, false);
    expect(actions.every(action => /^lineloom\.[a-zA-Z]+$/.test(action.command))).toBe(true);
    expect(actions.some(action => action.command === "lineloom.selectModel")).toBe(true);
    expect(actions.some(action => action.command === "lineloom.selectLanguageModel")).toBe(true);
    expect(actions.some(action => action.command === "lineloom.checkConnection")).toBe(true);
  });
});
