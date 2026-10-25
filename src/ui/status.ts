import * as vscode from "vscode";
import type { CompletionState } from "../completion/engine";
import { statusPresentation } from "./status-model";

export class LineLoomStatus implements vscode.Disposable {
  private readonly item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  constructor() { this.item.command = "lineloom.quickActions"; this.set("ready"); this.item.show(); }
  set(state: CompletionState, automatic = true): void {
    const display = statusPresentation(state, automatic);
    this.item.text = display.text;
    this.item.tooltip = display.tooltip;
  }
  dispose(): void { this.item.dispose(); }
}
