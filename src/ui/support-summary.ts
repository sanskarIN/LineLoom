import type { CompletionStats, CompletionState } from "../completion/engine";
import type { ModelReadiness } from "./model-readiness";
import type { ManualFilePrivacy } from "./file-privacy-session";
import type { SidebarEndpointState } from "./sidebar-model";

/**
 * Safe-to-copy aggregate support note. Deliberately accepts no raw document,
 * path, language, model tag, endpoint URL, prompt, or generated content.
 * This is local, ephemeral and built only after a user invokes the command.
 */
export interface SupportSummarySnapshot {
  enabled: boolean;
  autoTrigger: boolean;
  trustedWorkspace: boolean;
  endpointState: SidebarEndpointState;
  engineState: CompletionState;
  defaultModelCheck: ModelReadiness;
  activeModelCheck: ModelReadiness;
  activeFileCheck: ManualFilePrivacy;
  diagnosticsEnabled: boolean;
  relatedContextEnabled: boolean;
  relatedFileCount: number;
  enabledLanguageCount: number;
  languageOverrideCount: number;
  stats?: Readonly<CompletionStats>;
}

/** Validate numbers even if a future caller accidentally passes invalid stats. */
function count(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? Math.min(value, 1_000_000_000) : 0;
}
function duration(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.round(Math.min(value, 1_000_000_000)) + " ms" : "not measured";
}
const modelStates: readonly ModelReadiness[] =
  ["not-checked", "checking", "available", "missing", "unreachable"];
const fileStates: readonly ManualFilePrivacy[] =
  ["not-checked", "checking", "allowed", "blocked", "no-editor"];
const engineStates: readonly CompletionState[] =
  ["ready", "generating", "disabled", "unavailable", "error"];
const endpointStates: readonly SidebarEndpointState[] =
  ["loopback", "remote-approved", "remote-needs-approval", "remote-blocked", "invalid"];

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? value as T : fallback;
}

/** No timestamp, hostname, model name or mutable editor identity enters this report. */
export function formatSupportSummary(snapshot: SupportSummarySnapshot): string {
  const stats = snapshot.stats;
  const lines = [
    "LineLoom sanitized support summary",
    "Extension ID: SanskarCodes.lineloom",
    "Scope: session counters and manually checked states only",
    "Autocomplete enabled: " + String(snapshot.enabled === true),
    "Automatic suggestions enabled: " + String(snapshot.autoTrigger === true),
    "Workspace trusted: " + String(snapshot.trustedWorkspace === true),
    "Endpoint category: " + oneOf(snapshot.endpointState, endpointStates, "invalid"),
    "Engine state: " + oneOf(snapshot.engineState, engineStates, "error"),
    "Default model last check: " + oneOf(snapshot.defaultModelCheck, modelStates, "not-checked"),
    "Active editor model last check: " + oneOf(snapshot.activeModelCheck, modelStates, "not-checked"),
    "Active file last check: " + oneOf(snapshot.activeFileCheck, fileStates, "not-checked"),
    "Enabled languages (count): " + count(snapshot.enabledLanguageCount),
    "Language overrides (count): " + count(snapshot.languageOverrideCount),
    "Related-file context enabled: " + String(snapshot.relatedContextEnabled === true),
    "Explicit selected related files (count): " +
      (snapshot.relatedContextEnabled === true ? Math.min(2, count(snapshot.relatedFileCount)) : 0),
    "Requests (count): " + count(stats?.requests),
    "Suggestions offered (count): " + count(stats?.completions),
    "Accepted-item callbacks (count): " + count(stats?.accepted),
    "Cancelled (count): " + count(stats?.cancelled),
    "Failed (count): " + count(stats?.failed),
    "Cache hits (count): " + count(stats?.cacheHits),
    "Continuation reuses (count): " + count(stats?.continuationHits),
    "Empty responses (count): " + count(stats?.emptySuggestions),
    "Deferred automatic retries (count): " + count(stats?.suppressedTransientRetries)
  ];
  if (snapshot.diagnosticsEnabled === true) {
    lines.push(
      "Measured inference samples (count): " + count(stats?.recentLatencySamples),
      "Recent inference p50: " + duration(stats?.recentLatencyP50Ms),
      "Recent inference p95: " + duration(stats?.recentLatencyP95Ms)
    );
  } else {
    lines.push("Inference timings: disabled (no timing data included)");
  }
  lines.push(
    "Caution: model presence is from the last explicit check, not live health.",
    "Caution: file status is not a guarantee of future privacy eligibility.",
    "Caution: callback counts and mock tests do not establish completion quality.",
    "No source, file paths, prompts, model names, hostnames or endpoint URLs included."
  );
  return lines.join("\n") + "\n";
}
