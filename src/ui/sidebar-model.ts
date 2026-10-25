import type { EditorContextSummary } from "./editor-context";
import type { CompletionState } from "../completion/engine";
import type { ModelReadiness } from "./model-readiness";
import type { ManualFilePrivacy } from "./file-privacy-session";

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
  modelReadiness?: ModelReadiness;
  filePrivacy?: ManualFilePrivacy;
  crossFileContextEnabled?: boolean;
  relatedFileCount?: number;
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

function readinessDescription(state: ModelReadiness | undefined): string {
  switch (state) {
    case "checking": return "Manual model check in progress";
    case "available": return "Default model found at last manual check (not live monitoring)";
    case "missing": return "Default model missing at last manual check";
    case "unreachable": return "Connection failed at last manual check";
    default: return "Not checked this session — click Check Ollama Connection";
  }
}

function manualFilePrivacyDescription(state: ManualFilePrivacy | undefined): string {
  switch (state) {
    case "checking": return "Checking local path and ignore rules (on demand)";
    case "allowed": return "Last manual check passed path/ignore rules; rechecked before inference";
    case "blocked": return "Last manual check blocked this file; no inference requested";
    case "no-editor": return "No active local file to inspect";
    default: return "Not checked for this editor — click to inspect locally";
  }
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

/**
 * One suggested next action, derived from settings and *provisional* editor
 * eligibility only. This never tests the model, reads source or changes consent.
 * Interactive checks are performed only when the developer clicks the action.
 */
export function recommendedSidebarAction(snapshot: SidebarSnapshot): SidebarEntry {
  const entry = (label: string, description: string, icon: string, command?: string): SidebarEntry =>
    ({ id: "next-step", label, description, icon, ...(command ? { command } : {}) });

  if (!snapshot.enabled) return entry("Next: Enable Autocomplete",
    "Suggestions are off; enabling does not contact Ollama.", "play", "lineloom.enable");
  if (!snapshot.workspaceTrusted) return entry("Next: Review Workspace Trust",
    "Use VS Code's Workspace Trust controls; inference is blocked in restricted workspaces.", "shield");

  // Match the deliberately bounded, settings-only messages from editor-context.ts.
  // Never mistake "Allowed by settings" for a verified file privacy decision.
  const eligibility = snapshot.activeEditor.eligibility;
  switch (eligibility) {
    case "Open a supported code file":
      return entry("Next: Open a Source File", "Open a supported local source file to enable suggestions.", "symbol-file");
    case "No inline provider for this language":
      return entry("Next: Switch Language", "Choose a supported code language; unsupported editors cannot receive suggestions.", "code");
    case "Only local file editors support completion":
      return entry("Next: Open a Local File", "Virtual, untitled and remote URI editors are not eligible.", "symbol-file");
    case "Language disabled in settings":
      return entry("Next: Enable This Language", "Review the enabled language list.", "gear", "lineloom.manageLanguages");
    case "No model configured":
      return entry("Next: Select a Model", "Choose an installed model; discovery runs only after you click.", "symbol-method", "lineloom.selectModel");
    case "Invalid inference endpoint":
    case "Remote endpoint disabled":
      return entry("Next: Review Endpoint Settings", "Check endpoint and remote-inference preferences.", "gear", "lineloom.openSettings");
    case "Remote endpoint approval required":
      return entry("Next: Review Remote Approval",
        "An explicit connection check may ask you to approve this HTTPS origin.", "lock", "lineloom.checkConnection");
  }
  if (snapshot.completionState === "generating") return entry("Next: Stop Generation",
    "Cancel the active request without disabling future suggestions.", "debug-stop", "lineloom.cancel");
  if (snapshot.filePrivacy === "blocked") return entry("Next: Review File Exclusions",
    "The last manual path/ignore check blocked the active file; inspect exclusions or open another file.",
    "shield");
  if (snapshot.modelReadiness === "missing" && snapshot.activeEditor.modelSource === "Default model")
    return entry("Next: Choose Installed Model",
      "The default model was not present at the last manual check.", "symbol-method", "lineloom.selectModel");
  if (snapshot.modelReadiness === "unreachable")
    return entry("Next: Recheck Ollama",
      "The last manual connection check failed; retry explicitly.", "plug", "lineloom.checkConnection");
  if (snapshot.completionState === "unavailable") return entry("Next: Check Ollama",
    "Run a user-initiated connection check; this view does not ping models.", "plug", "lineloom.checkConnection");
  if (snapshot.completionState === "error") return entry("Next: Open Diagnostics",
    "Review source-free status details and troubleshoot the failed request.", "output", "lineloom.diagnostics");
  return entry(snapshot.autoTrigger ? "Next: Trigger Completion" : "Next: Try Manual Completion",
    "Manually request a suggestion; model availability and file privacy are not pre-verified here.",
    "wand", "lineloom.trigger");
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
        recommendedSidebarAction(snapshot),
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
          id: "model-readiness", label: "Last Manual Model Check",
          description: readinessDescription(snapshot.modelReadiness), icon: "plug",
          command: "lineloom.checkConnection"
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
          id: "check-file-privacy", label: "Check Active File Privacy",
          description: "Check current workspace and ignore rules locally; no model request",
          icon: "shield", command: "lineloom.checkActiveFilePrivacy"
        },
        {
          id: "last-file-privacy", label: "Last Manual File Check",
          description: manualFilePrivacyDescription(snapshot.filePrivacy),
          icon: snapshot.filePrivacy === "blocked" ? "warning" :
            snapshot.filePrivacy === "allowed" ? "check" : "shield",
          command: "lineloom.checkActiveFilePrivacy"
        },
        {
          id: "related-context", label: "Related-File Context (Experimental)",
          description: snapshot.crossFileContextEnabled
            ? (snapshot.relatedFileCount ?? 0) > 0
              ? (snapshot.relatedFileCount ?? 0) + " selected for this session (max two; rechecked before use)"
              : "Enabled, but no files selected — choose up to two explicitly"
            : "Off — opt in under LineLoom settings",
          icon: "files",
          command: snapshot.crossFileContextEnabled ? "lineloom.selectRelatedFiles" : "lineloom.openSettings"
        },
        ...(snapshot.crossFileContextEnabled && (snapshot.relatedFileCount ?? 0) > 0 ? [{
          id: "clear-related-context", label: "Clear Related Files",
          description: "Revoke additional source context selection immediately",
          icon: "clear-all", command: "lineloom.clearRelatedFiles"
        }] : []),
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
