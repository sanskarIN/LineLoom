import { describe, expect, it } from "vitest";
import { sidebarSections, type SidebarSnapshot } from "../../src/ui/sidebar-model";

const snapshot: SidebarSnapshot = {
  enabled: true, autoTrigger: true, model: "qwen2.5-coder:1.5b",
  enabledLanguageCount: 9, languageOverrideCount: 1, workspaceTrusted: true,
  endpointState: "loopback",
  activeEditor: { language: "Rust", model: "rust-local", modelSource: "Language override",
    eligibility: "Allowed by settings; file rules checked on request" },
  completionState: "ready", requests: 3, completions: 2, cancelled: 1,
  failed: 0, cacheHits: 2, continuationHits: 1, emptySuggestions: 4
};
describe("LineLoom local sidebar model", () => {
  it("exposes fixed command actions and useful offline state", () => {
    const groups = sidebarSections(snapshot);
    expect(groups.map(group => group.id)).toEqual(["status", "models", "editor", "privacy", "activity", "actions"]);
    const entries = groups.flatMap(group => group.items);
    expect(new Set(entries.map(entry => entry.id)).size).toBe(entries.length);
    expect(entries.find(item => item.id === "enabled")?.command).toBe("lineloom.disable");
    expect(entries.find(item => item.id === "model")?.description).toBe("qwen2.5-coder:1.5b");
    expect(entries.find(item => item.id === "requests")?.description).toBe("3");
    expect(entries.find(item => item.id === "cancel")?.command).toBe("lineloom.cancel");
    expect(entries.find(item => item.id === "state")?.description).toBe("Ready (model not automatically verified)");
    expect(entries.find(item => item.id === "cancelled")?.description).toBe("1");
    expect(entries.find(item => item.id === "cache-hits")?.description).toBe("2");
    expect(entries.find(item => item.id === "continuations")?.description).toBe("1");
    expect(entries.find(item => item.id === "empty-results")?.description).toBe("4");
    expect(entries.find(item => item.id === "latency")).toBeUndefined();
    expect(entries.find(item => item.id === "editor-language")?.description).toBe("Rust");
    expect(entries.find(item => item.id === "editor-model")?.description).toBe("rust-local (Language override)");
    expect(entries.find(item => item.id === "editor-eligibility")?.description).toMatch(/file rules checked on request/);
    expect(entries.filter(item => item.command).every(item => /^lineloom\.[a-zA-Z]+$/.test(item.command!))).toBe(true);
  });
  it("uses enable and resume actions when completion is paused", () => {
    const items = sidebarSections({ ...snapshot, enabled: false, autoTrigger: false })
      .flatMap(group => group.items);
    expect(items.find(item => item.id === "enabled")?.command).toBe("lineloom.enable");
    expect(items.find(item => item.id === "automatic")?.label).toBe("Manual Suggestions Only");
  });
  it("shows explicit runtime states and optional measured performance", () => {
    const entries = sidebarSections({
      ...snapshot, completionState: "generating", averageLatencyMs: 12.6
    }).flatMap(group => group.items);
    expect(entries.find(item => item.id === "state")?.description).toBe("Generating");
    expect(entries.find(item => item.id === "cancel")?.description).toContain("Stop the current Ollama request");
    expect(entries.find(item => item.id === "latency")?.description).toBe("13 ms");
    const unavailable = sidebarSections({ ...snapshot, completionState: "unavailable" })
      .flatMap(group => group.items);
    expect(unavailable.find(item => item.id === "state")?.description).toContain("Unavailable");
    const off = sidebarSections({ ...snapshot, enabled: false, completionState: "generating" })
      .flatMap(group => group.items);
    expect(off.find(item => item.id === "state")?.description).toBe("Disabled");
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
  it("treats editor eligibility as provisional and does not show filenames", () => {
    const entries = sidebarSections({
      ...snapshot,
      activeEditor: { language: "Unsupported language", model: "Not applicable",
        modelSource: "", eligibility: "No inline provider for this language" }
    }).flatMap(group => group.items);
    expect(entries.find(item => item.id === "editor-eligibility")?.description)
      .toBe("No inline provider for this language");
    expect(JSON.stringify(entries)).not.toContain("/project/src/");
  });
  it("bounds untrusted model labels and strips control characters", () => {
    const model = "secret\n" + "x".repeat(200);
    const entry = sidebarSections({ ...snapshot, model })[1].items[0];
    expect(entry.description?.length).toBeLessThanOrEqual(52);
    expect(entry.description).not.toContain("\n");
  });
});
