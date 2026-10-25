import { describe, expect, it } from "vitest";
import { recommendedSidebarAction, sidebarSections, type SidebarSnapshot } from "../../src/ui/sidebar-model";

const snapshot: SidebarSnapshot = {
  enabled: true, autoTrigger: true, model: "qwen2.5-coder:1.5b",
  enabledLanguageCount: 9, languageOverrideCount: 1, workspaceTrusted: true,
  endpointState: "loopback",
  activeEditor: { language: "Rust", model: "rust-local", modelSource: "Language override",
    eligibility: "Allowed by settings; file rules checked on request" },
  completionState: "ready", requests: 3, completions: 2, cancelled: 1,
  failed: 0, cacheHits: 2, continuationHits: 1, emptySuggestions: 4,
  performanceDiagnosticsEnabled: false
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
    expect(entries.find(item => item.id === "check-file-privacy")).toMatchObject({
      command: "lineloom.checkActiveFilePrivacy",
      description: "Check current workspace and ignore rules locally; no model request"
    });
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
  it("offers an accessible privacy reset action only when diagnostics are enabled", () => {
    const disabled = sidebarSections(snapshot).flatMap(group => group.items);
    expect(disabled.find(item => item.id === "reset-privacy-timings")).toBeUndefined();
    const enabled = sidebarSections({ ...snapshot, performanceDiagnosticsEnabled: true })
      .flatMap(group => group.items);
    const reset = enabled.find(item => item.id === "reset-privacy-timings");
    expect(reset).toMatchObject({
      label: "Reset Privacy Timing Statistics",
      command: "lineloom.resetPrivacyTimings",
      description: "Clear in-memory privacy eligibility timing data"
    });
    expect(enabled.filter(item => item.command).every(item => /^lineloom\.[a-zA-Z]+$/.test(item.command!))).toBe(true);
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

describe("related context sidebar consent disclosure", () => {
  it("shows opt-in status, never paths, and gives a clear command only for active selections", () => {
    const off = sidebarSections({ ...snapshot, crossFileContextEnabled: false, relatedFileCount: 2 })
      .flatMap(s => s.items);
    expect(off.find(x => x.id === "related-context")?.description).toContain("Off");
    expect(off.find(x => x.id === "clear-related-context")).toBeUndefined();
    const on = sidebarSections({ ...snapshot, crossFileContextEnabled: true, relatedFileCount: 2 })
      .flatMap(s => s.items);
    expect(on.find(x => x.id === "related-context")?.command).toBe("lineloom.selectRelatedFiles");
    expect(on.find(x => x.id === "clear-related-context")?.command).toBe("lineloom.clearRelatedFiles");
    expect(JSON.stringify(on)).not.toContain("/private/");
  });
});

describe("native sidebar suggested next step", () => {
  const next = (patch: Partial<SidebarSnapshot> = {}) => recommendedSidebarAction({ ...snapshot, ...patch });
  const blocked = (eligibility: string): SidebarSnapshot["activeEditor"] => ({
    ...snapshot.activeEditor, eligibility
  });

  it("offers one command only when a user can explicitly take that action", () => {
    const groups = sidebarSections(snapshot);
    const items = groups[0].items;
    expect(items.filter(item => item.id === "next-step")).toHaveLength(1);
    expect(items.find(item => item.id === "next-step")).toMatchObject({
      command: "lineloom.trigger", label: "Next: Trigger Completion"
    });
    expect(next({ autoTrigger: false })).toMatchObject({
      command: "lineloom.trigger", label: "Next: Try Manual Completion"
    });
    expect(next({ enabled: false, completionState: "generating" })).toMatchObject({
      command: "lineloom.enable", label: "Next: Enable Autocomplete"
    });
  });

  it("prioritizes workspace trust and editor eligibility before model or network actions", () => {
    expect(next({ workspaceTrusted: false, completionState: "unavailable" }).label)
      .toBe("Next: Review Workspace Trust");
    expect(next({ workspaceTrusted: false, completionState: "unavailable" }).command)
      .toBeUndefined();
    for (const [eligibility, label] of [
      ["Open a supported code file", "Next: Open a Source File"],
      ["No inline provider for this language", "Next: Switch Language"],
      ["Only local file editors support completion", "Next: Open a Local File"]
    ]) {
      const choice = next({ activeEditor: blocked(eligibility), completionState: "unavailable" });
      expect(choice.label).toBe(label);
      expect(choice.command).toBeUndefined();
    }
    expect(next({ activeEditor: blocked("Language disabled in settings") }).command)
      .toBe("lineloom.manageLanguages");
    expect(next({ activeEditor: blocked("No model configured") }).command).toBe("lineloom.selectModel");
  });

  it.each([
    ["Invalid inference endpoint", "lineloom.openSettings"],
    ["Remote endpoint disabled", "lineloom.openSettings"],
    ["Remote endpoint approval required", "lineloom.checkConnection"]
  ])("offers an explicit user action for %s", (eligibility, command) => {
    expect(next({ activeEditor: blocked(eligibility) }).command).toBe(command);
  });

  it.each([
    ["generating", "lineloom.cancel"],
    ["unavailable", "lineloom.checkConnection"],
    ["error", "lineloom.diagnostics"]
  ] as const)("routes %s engine state to %s", (state, command) => {
    expect(next({ completionState: state }).command).toBe(command);
  });

  it("never passively validates or reveals a URL, filename or user source", () => {
    for (const endpointState of [
      "loopback", "remote-approved", "remote-needs-approval", "remote-blocked", "invalid"
    ] as const) {
      const entry = next({ endpointState });
      expect(JSON.stringify(entry)).not.toContain("https://");
      expect(JSON.stringify(entry)).not.toContain("/private/");
      expect(JSON.stringify(entry)).not.toContain("127.0.0.1");
    }
    // Exactly one click target; the pure model never starts a request.
    expect(next({ completionState: "unavailable" }).description).toContain("user-initiated");
  });

  it("distinguishes enabled but empty related-file consent from two selected references", () => {
    const entries = (value: number) =>
      sidebarSections({ ...snapshot, crossFileContextEnabled: true, relatedFileCount: value })
        .flatMap(section => section.items);
    expect(entries(0).find(item => item.id === "related-context")?.description)
      .toContain("no files selected");
    expect(entries(0).some(item => item.id === "clear-related-context")).toBe(false);
    expect(entries(2).find(item => item.id === "related-context")?.description)
      .toContain("rechecked before use");
    expect(entries(2).find(item => item.id === "clear-related-context")?.command)
      .toBe("lineloom.clearRelatedFiles");
  });
});

describe("last user-invoked Ollama model readiness", () => {
  const entries = (state: NonNullable<SidebarSnapshot["modelReadiness"]>) =>
    sidebarSections({ ...snapshot, modelReadiness: state }).flatMap(section => section.items);

  it("does not claim availability before a manual check and never exposes an endpoint", () => {
    const unknown = entries("not-checked").find(item => item.id === "model-readiness");
    expect(unknown).toMatchObject({ command: "lineloom.checkConnection" });
    expect(unknown?.description).toContain("Not checked this session");
    for (const state of ["checking", "available", "missing", "unreachable"] as const) {
      const readiness = entries(state).find(item => item.id === "model-readiness");
      expect(readiness?.description).toContain(state === "checking" ? "in progress" : "last manual check");
      expect(JSON.stringify(readiness)).not.toContain("http");
      expect(JSON.stringify(readiness)).not.toContain("/private");
    }
  });

  it("distinguishes default model validation from active editor language overrides", () => {
    const missingDefault = sidebarSections({
      ...snapshot, modelReadiness: "missing",
      activeEditor: { ...snapshot.activeEditor, modelSource: "Default model" }
    }).flatMap(section => section.items);
    expect(missingDefault.find(item => item.id === "next-step")).toMatchObject({
      label: "Next: Choose Installed Model", command: "lineloom.selectModel"
    });
    const overridden = entries("missing");
    expect(overridden.find(item => item.id === "next-step")?.command).toBe("lineloom.trigger");
  });

  it("prioritizes failed manual check recovery after editor and trust restrictions", () => {
    const failed = entries("unreachable");
    expect(failed.find(item => item.id === "next-step")).toMatchObject({
      label: "Next: Recheck Ollama", command: "lineloom.checkConnection"
    });
    const blocked = sidebarSections({
      ...snapshot, workspaceTrusted: false, modelReadiness: "unreachable"
    }).flatMap(section => section.items);
    expect(blocked.find(item => item.id === "next-step")?.command).toBeUndefined();
    const generating = sidebarSections({
      ...snapshot, completionState: "generating", modelReadiness: "missing"
    }).flatMap(section => section.items);
    expect(generating.find(item => item.id === "next-step")?.command).toBe("lineloom.cancel");
  });
});
