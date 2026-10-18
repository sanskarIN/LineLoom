import * as vscode from "vscode";
import type { CompletionState } from "../completion/engine";
const labels: Record<CompletionState, { icon: string; label: string; tip: string }> = {
  ready: { icon: "$(sparkle)", label: "LineLoom", tip: "Ready for local code completion" },
  generating: { icon: "$(sync~spin)", label: "LineLoom", tip: "Generating a suggestion" },
  disabled: { icon: "$(circle-slash)", label: "LineLoom Off", tip: "Autocomplete is disabled" },
  unavailable: { icon: "$(warning)", label: "LineLoom", tip: "Check Ollama, the model and your endpoint approval" },
  error: { icon: "$(error)", label: "LineLoom", tip: "Review LineLoom diagnostics" }
};
export class LineLoomStatus implements vscode.Disposable {
  private readonly item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  constructor() { this.item.command = "lineloom.quickActions"; this.set("ready"); this.item.show(); }
  set(state: CompletionState, automatic = true): void {
    const item = labels[state];
    this.item.text = item.icon + " " + (state === "ready" && !automatic ? "LineLoom Manual" : item.label);
    this.item.tooltip = item.tip + " • Click for Quick Actions";
  }
  dispose(): void { this.item.dispose(); }
}
