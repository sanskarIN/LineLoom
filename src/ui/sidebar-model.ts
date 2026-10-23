import type { EditorContextSummary } from "./editor-context";
import type { CompletionState } from "../completion/engine";

/** Sidebar labels and actions are computed locally. This module never contacts Ollama. */
export type SidebarEndpointState =
  | "loopback"
  | "remote-approved"
  | "remote-needs-approval"
  | "remote-blocked"
  | "invalid";

export interface SidebarSnapshot {
  enabled: boolean;
  autoTrigger: boolean;
  model: string;
  enabledLanguageCount: number;
  languageOverrideCount: number;
  workspaceTrusted: boolean;
  endpointState: SidebarEndpointState;
  activeEditor: EditorContextSummary;
  completionState: CompletionState;
  requests: number;
  completions: number;
  cancelled: number;
  failed: number;
  cacheHits: number;
  continuationHits: number;
  emptySuggestions: number;
  averageLatencyMs?: number;
  performanceDiagnosticsEnabled?: boolean;
}

export interface SidebarEntry {
  id: string;
  label: string;
  description?: string;
  icon: string;
  command?: string;
}

export interface SidebarSection {
  id: string;
  label: string;
  icon: string;
  items: SidebarEntry[];
}

function modelLabel(raw: string): string {
  const normalized = raw.replace(/[\r\n\t]/g, " ").trim();
  if (!normalized) return "No model selected";
  return normalized.length > 52 ? normalized.slice(0, 49) + "..." : normalized;
}

function endpointDescription(state: SidebarEndpointState): string {
  switch (state) {
    case "loopback": return "Local loopback only";
    case "remote-approved": return "Remote HTTPS approved";
    case "remote-needs-approval": return "Approval required before inference";
    case "remote-blocked": return "Remote endpoints disabled";
    case "invalid": return "Invalid endpoint configuration";
  }
}

/** Deliberately omit endpoint URLs, file names, document contents and prompts. */
export function sidebarSections(snapshot: SidebarSnapshot): SidebarSection[] {
  return [
    {
      id: "status", label: "Completion", icon: "sparkle", items: [
        {
          id: "state", label: "Engine Status",
          description: !snapshot.enabled ? "Disabled" :
            snapshot.completionState === "ready" ? "Ready (model not automatically verified)" :
            snapshot.completionState === "generating" ? "Generating" :
            snapshot.completionState === "disabled" ? "Disabled" :
            snapshot.completionState === "unavailable" ? "Unavailable — check Ollama" :
            "Error — open diagnostics",
          icon: snapshot.completionState === "generating" ? "sync" :
            snapshot.completionState === "error" ? "error" :
            snapshot.completionState === "unavailable" ? "warning" : "info"
        },
        {
          id: "enabled", label: snapshot.enabled ? "Autocomplete On" : "Autocomplete Off",
          description: "Click to " + (snapshot.enabled ? "disable" : "enable"),
          icon: snapshot.enabled ? "check" : "circle-slash",
          command: snapshot.enabled ? "lineloom.disable" : "lineloom.enable"
        },
        {
          id: "automatic", label: snapshot.autoTrigger ? "Automatic Suggestions On" : "Manual Suggestions Only",
          description: "Click to " + (snapshot.autoTrigger ? "pause" : "resume") + " automatic suggestions",
          icon: snapshot.autoTrigger ? "play" : "debug-pause",
          command: "lineloom.toggleAutomatic"
        },
        {
          id: "trigger", label: "Trigger Completion", icon: "wand",
          command: "lineloom.trigger"
        },
        {
          id: "cancel", label: "Stop Current Generation", icon: "debug-stop",
          description: snapshot.completionState === "generating"
            ? "Stop the current Ollama request" : "Cancel any pending request; future suggestions stay enabled",
          command: "lineloom.cancel"
        }
      ]
    },
    {
      id: "models", label: "Models & Languages", icon: "symbol-method", items: [
        {
          id: "model", label: "Default Model",
          description: modelLabel(snapshot.model), icon: "symbol-method",
          command: "lineloom.selectModel"
        },
        {
          id: "language-models", label: "Language Overrides",
          description: snapshot.languageOverrideCount + " configured", icon: "settings-gear",
          command: "lineloom.selectLanguageModel"
        },
        {
          id: "languages", label: "Enabled Languages",
          description: snapshot.enabledLanguageCount + " selected", icon: "code",
          command: "lineloom.manageLanguages"
        }
      ]
    },
    {
      id: "editor", label: "Active Editor", icon: "symbol-file", items: [
        { id: "editor-language", label: "Language", description: snapshot.activeEditor.language, icon: "code" },
        { id: "editor-model", label: "Effective Model",
          description: modelLabel(snapshot.activeEditor.model) +
            (snapshot.activeEditor.modelSource ? " (" + snapshot.activeEditor.modelSource + ")" : ""),
          icon: "symbol-method" },
        { id: "editor-eligibility", label: "Completion Status",
          description: snapshot.activeEditor.eligibility,
          icon: snapshot.activeEditor.eligibility.startsWith("Allowed by settings") ? "check" : "info" },
        { id: "editor-languages", label: "Manage Language Settings", icon: "gear",
          command: "lineloom.manageLanguages" }
      ]
    },
    {
      id: "privacy", label: "Privacy & Connection", icon: "shield", items: [
        {
          id: "workspace", label: "Workspace",
          description: snapshot.workspaceTrusted ? "Trusted" : "Restricted (completion blocked)",
          icon: snapshot.workspaceTrusted ? "check" : "warning"
        },
        {
          id: "endpoint", label: "Inference Endpoint",
          description: endpointDescription(snapshot.endpointState),
          icon: snapshot.endpointState === "loopback" ? "home" : "lock"
        },
        {
          id: "check", label: "Check Ollama Connection", icon: "plug",
          command: "lineloom.checkConnection"
        }
      ]
    },
    {
      id: "activity", label: "Session Activity", icon: "pulse", items: [
        { id: "requests", label: "Requests", description: String(snapshot.requests), icon: "arrow-up" },
        { id: "completions", label: "Suggestions", description: String(snapshot.completions), icon: "check" },
        { id: "failed", label: "Failed", description: String(snapshot.failed), icon: "warning" },
        { id: "cancelled", label: "Cancelled", description: String(snapshot.cancelled), icon: "circle-slash" },
        { id: "cache-hits", label: "Cache Hits", description: String(snapshot.cacheHits), icon: "database" },
        { id: "continuations", label: "Continuation Reuses", description: String(snapshot.continuationHits), icon: "history" },
        { id: "empty-results", label: "Empty Results", description: String(snapshot.emptySuggestions), icon: "circle" },
        ...(snapshot.averageLatencyMs === undefined ? [] : [
          { id: "latency", label: "Average Measured Latency",
            description: Math.round(snapshot.averageLatencyMs) + " ms",
            icon: "clock" }
        ]),
        { id: "diagnostics", label: "Open Diagnostics", icon: "output", command: "lineloom.diagnostics" },
        ...(snapshot.performanceDiagnosticsEnabled ? [{
          id: "reset-privacy-timings", label: "Reset Privacy Timing Statistics",
          description: "Clear in-memory privacy eligibility timing data",
          icon: "trash", command: "lineloom.resetPrivacyTimings"
        }] : []),
        { id: "refresh", label: "Refresh Sidebar", icon: "refresh", command: "lineloom.refreshSidebar" }
      ]
    },
    {
      id: "actions", label: "More Actions", icon: "list-unordered", items: [
        { id: "settings", label: "Open Settings", icon: "gear", command: "lineloom.openSettings" },
        { id: "setup", label: "Setup Guide", icon: "book", command: "lineloom.setup" },
        { id: "quick", label: "Quick Actions", icon: "list-unordered", command: "lineloom.quickActions" }
      ]
    }
  ];
}
