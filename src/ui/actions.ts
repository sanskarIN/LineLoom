/** Pure Quick Actions model: no network requests or VS Code side effects. */
export interface QuickAction {
  id: string;
  label: string;
  description: string;
  command: string;
}
export function quickActions(enabled: boolean, automatic: boolean): QuickAction[] {
  return [
    {
      id: "toggleEnabled",
      label: enabled ? "$(circle-slash) Disable Autocomplete" : "$(check) Enable Autocomplete",
      description: enabled ? "Turn off all LineLoom suggestions" : "Turn on LineLoom suggestions",
      command: enabled ? "lineloom.disable" : "lineloom.enable"
    },
    {
      id: "toggleAutomatic",
      label: automatic ? "$(debug-pause) Pause Automatic Suggestions" : "$(play) Resume Automatic Suggestions",
      description: "Manual completion remains available while automatic suggestions are paused",
      command: "lineloom.toggleAutomatic"
    },
    { id: "trigger", label: "$(sparkle) Trigger Completion", description: "Request a suggestion at the current cursor", command: "lineloom.trigger" },
    { id: "cancel", label: "$(debug-stop) Stop Current Generation",
      description: "Cancel any queued or in-flight request without disabling future suggestions",
      command: "lineloom.cancel" },
    { id: "model", label: "$(symbol-method) Select Model", description: "Choose from models on the approved Ollama endpoint", command: "lineloom.selectModel" },
    { id: "languageModel", label: "$(settings-gear) Assign Language Model", description: "Choose a separate installed Ollama model for one language", command: "lineloom.selectLanguageModel" },
    { id: "languages", label: "$(code) Manage Languages", description: "Choose which editor languages can request suggestions", command: "lineloom.manageLanguages" },
    { id: "connection", label: "$(plug) Check Ollama Connection", description: "Contact the current endpoint only when selected", command: "lineloom.checkConnection" },
    { id: "sidebar", label: "$(layout-sidebar-left) Open Control Center", description: "Open the LineLoom Activity Bar sidebar", command: "lineloom.openSidebar" },
    { id: "diagnostics", label: "$(output) Open Diagnostics", description: "View configuration and aggregate counters, never source text", command: "lineloom.diagnostics" },
    { id: "settings", label: "$(gear) Open Settings", description: "Change LineLoom preferences in VS Code", command: "lineloom.openSettings" }
  ];
}
