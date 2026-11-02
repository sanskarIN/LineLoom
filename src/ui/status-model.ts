import type { CompletionState } from "../completion/engine";

/**
 * Pure native status bar presentation: never reads editor source or connects to Ollama.
 * Accessible names are icon-free and explicitly describe the action and state.
 */
export interface StatusPresentation {
  text: string;
  tooltip: string;
  accessibilityLabel: string;
}
export function statusPresentation(
  state: CompletionState, automatic = true, filePaused = false,
  workspaceTrusted = true
): StatusPresentation {
  const action = " • Click for Quick Actions";
  const present = (text: string, message: string): StatusPresentation => ({
    text,
    tooltip: message + action,
    accessibilityLabel: "LineLoom: " + message + ". Open Quick Actions"
  });
  // The setting is authoritative when the entire extension is disabled.
  if (state === "disabled") {
    return present("$(circle-slash) LineLoom Off", "Autocomplete is disabled");
  }
  // Workspace Trust blocks both manual and automatic requests even if
  // the last engine state was ready, generating or temporarily unavailable.
  if (!workspaceTrusted) {
    return present("$(lock) LineLoom Restricted",
      "Workspace is restricted; manual and automatic completions are blocked until trusted");
  }
  if (filePaused) {
    return present("$(debug-pause) LineLoom File Paused",
      "Manual and automatic completions are paused for this file only; other files are unaffected");
  }
  switch (state) {
    case "ready":
      return present("$(sparkle) " + (automatic ? "LineLoom" : "LineLoom Manual"),
        automatic
          ? "Autocomplete enabled; Ollama model and active-file rules are not automatically verified"
          : "Automatic suggestions paused; manual completion remains available; model and file rules are not automatically verified");
    case "generating":
      return present("$(sync~spin) LineLoom",
        "Generating a suggestion; useful output is not guaranteed");
    case "unavailable":
      return present("$(warning) LineLoom",
        "Completion unavailable; manually check Ollama, the effective model and endpoint approval");
    case "error":
      return present("$(error) LineLoom",
        "Completion error; open diagnostics for source-free details");
  }
}
