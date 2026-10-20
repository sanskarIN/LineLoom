import { describe, expect, it } from "vitest";
import { sidebarSections, type SidebarSnapshot } from "../../src/ui/sidebar-model";

const snapshot: SidebarSnapshot = {
  enabled: true, autoTrigger: true, model: "qwen2.5-coder:1.5b",
  enabledLanguageCount: 9, languageOverrideCount: 1, workspaceTrusted: true,
  endpointState: "loopback", requests: 3, completions: 2, failed: 0
};
describe("LineLoom local sidebar model", () => {
  it("exposes fixed command actions and useful offline state", () => {
    const groups = sidebarSections(snapshot);
    expect(groups.map(group => group.id)).toEqual(["status", "models", "privacy", "activity", "actions"]);
    const entries = groups.flatMap(group => group.items);
    expect(new Set(entries.map(entry => entry.id)).size).toBe(entries.length);
    expect(entries.find(item => item.id === "enabled")?.command).toBe("lineloom.disable");
    expect(entries.find(item => item.id === "model")?.description).toBe("qwen2.5-coder:1.5b");
    expect(entries.find(item => item.id === "requests")?.description).toBe("3");
    expect(entries.filter(item => item.command).every(item => /^lineloom\.[a-zA-Z]+$/.test(item.command!))).toBe(true);
  });
  it("uses enable and resume actions when completion is paused", () => {
    const items = sidebarSections({ ...snapshot, enabled: false, autoTrigger: false })
      .flatMap(group => group.items);
    expect(items.find(item => item.id === "enabled")?.command).toBe("lineloom.enable");
    expect(items.find(item => item.id === "automatic")?.label).toBe("Manual Suggestions Only");
  });
  it("never displays endpoint origin or remote credentials", () => {
    for (const state of ["loopback", "remote-approved", "remote-needs-approval", "remote-blocked", "invalid"] as const) {
      const text = JSON.stringify(sidebarSections({ ...snapshot, endpointState: state }));
      expect(text).not.toContain("https://");
      expect(text).not.toContain("127.0.0.1");
    }
    const untrusted = sidebarSections({ ...snapshot, workspaceTrusted: false });
    expect(JSON.stringify(untrusted)).toContain("Restricted (completion blocked)");
  });
  it("bounds untrusted model labels and strips control characters", () => {
    const model = "secret\n" + "x".repeat(200);
    const entry = sidebarSections({ ...snapshot, model })[1].items[0];
    expect(entry.description?.length).toBeLessThanOrEqual(52);
    expect(entry.description).not.toContain("\n");
  });
});
