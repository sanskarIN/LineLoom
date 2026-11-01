import type { CompletionState } from "../completion/engine";

/** Pure, source-free native status bar wording; never probes model or files. */
export interface StatusPresentation { text: string; tooltip: string; }
export function statusPresentation(state: CompletionState, automatic = true, filePaused = false): StatusPresentation {
  const action = " • Click for Quick Actions";
  if (filePaused && state !== "disabled") {
    return {
      text: "$(debug-pause) LineLoom File Paused",
      tooltip: "Manual and automatic completions are paused for this file only; other files are unaffected" + action
    };
  }
  switch (state) {
    case "ready":
      return {
        text: "$(sparkle) " + (automatic ? "LineLoom" : "LineLoom Manual"),
        tooltip: (automatic
          ? "Autocomplete enabled; Ollama model and active-file rules are not automatically verified"
          : "Automatic suggestions paused; manual completion remains available; model and file rules are not automatically verified"
        ) + action
      };
    case "generating":
      return { text: "$(sync~spin) LineLoom",
        tooltip: "Generating a suggestion; useful output is not guaranteed" + action };
    case "disabled":
      return { text: "$(circle-slash) LineLoom Off", tooltip: "Autocomplete is disabled" + action };
    case "unavailable":
      return { text: "$(warning) LineLoom",
        tooltip: "Completion unavailable; manually check Ollama, the effective model and endpoint approval" + action };
    case "error":
      return { text: "$(error) LineLoom",
        tooltip: "Completion error; open diagnostics for source-free details" + action };
  }
}
