import * as vscode from "vscode";
import type { CompletionState, CompletionStats } from "../completion/engine";
import type { ModelReadiness } from "./model-readiness";
import type { ManualFilePrivacy } from "./file-privacy-session";
import { summarizeActiveEditor } from "./editor-context";
import { readConfig, validateEndpoint } from "../settings/config";
import { sidebarSections, type SidebarEndpointState, type SidebarEntry, type SidebarSection } from "./sidebar-model";

type SidebarNode =
  | { kind: "section"; section: SidebarSection }
  | { kind: "item"; item: SidebarEntry };

function endpointState(isApproved: (origin: string) => boolean): SidebarEndpointState {
  const config = readConfig();
  try {
    const endpoint = validateEndpoint(config.endpoint);
    if (!endpoint.remote) return "loopback";
    if (!config.allowRemoteEndpoints) return "remote-blocked";
    return isApproved(endpoint.origin) ? "remote-approved" : "remote-needs-approval";
  } catch {
    return "invalid";
  }
}

/** Native VS Code Tree View. Rendering never queries Ollama or reads editor text. */
export class LineLoomSidebar implements vscode.TreeDataProvider<SidebarNode>, vscode.Disposable {
  private readonly changes = new vscode.EventEmitter<SidebarNode | undefined>();
  readonly onDidChangeTreeData = this.changes.event;

  constructor(
    private readonly getStats: () => Readonly<CompletionStats> | undefined,
    private readonly isApproved: (origin: string) => boolean,
    private readonly getState: () => CompletionState = () => "ready",
    private readonly getRelatedFileCount: () => number = () => 0,
    private readonly getModelReadiness: () => ModelReadiness = () => "not-checked",
    private readonly getFilePrivacy: () => ManualFilePrivacy = () => "not-checked",
    private readonly getActiveModelReadiness: () => ModelReadiness = () => "not-checked"
  ) {}

  refresh(): void { this.changes.fire(undefined); }

  getChildren(node?: SidebarNode): SidebarNode[] {
    if (node?.kind === "item") return [];
    if (node?.kind === "section") {
      return node.section.items.map((item): SidebarNode => ({ kind: "item", item }));
    }
    const config = readConfig();
    const stats = this.getStats();
    const originState = endpointState(this.isApproved);
    // Only the VS Code language ID and non-identifying URI scheme are inspected.
    // No full URI, filename, file path or contents are accessed.
    const activeEditor = summarizeActiveEditor({
      languageId: vscode.window.activeTextEditor?.document.languageId,
      scheme: vscode.window.activeTextEditor?.document.uri.scheme,
      enabled: config.enabled,
      workspaceTrusted: vscode.workspace.isTrusted,
      enabledLanguages: config.enabledLanguages,
      defaultModel: config.model,
      languageModels: config.languageModels,
      endpointState: originState
    });
    return sidebarSections({
      enabled: config.enabled,
      autoTrigger: config.autoTrigger,
      model: config.model,
      enabledLanguageCount: config.enabledLanguages.length,
      languageOverrideCount: Object.keys(config.languageModels).length,
      workspaceTrusted: vscode.workspace.isTrusted,
      endpointState: originState,
      activeEditor,
      completionState: this.getState(),
      requests: stats?.requests ?? 0,
      completions: stats?.completions ?? 0,
      accepted: stats?.accepted ?? 0,
      cancelled: stats?.cancelled ?? 0,
      failed: stats?.failed ?? 0,
      cacheHits: stats?.cacheHits ?? 0,
      continuationHits: stats?.continuationHits ?? 0,
      emptySuggestions: stats?.emptySuggestions ?? 0,
      performanceDiagnosticsEnabled: config.performanceDiagnostics,
      modelReadiness: this.getModelReadiness(),
      filePrivacy: this.getFilePrivacy(),
      activeModelReadiness: this.getActiveModelReadiness(),
      crossFileContextEnabled: config.crossFileContext,
      relatedFileCount: this.getRelatedFileCount(),
      averageLatencyMs: config.performanceDiagnostics && stats?.measuredRequests
        ? stats.totalLatencyMs / stats.measuredRequests : undefined
    }).map((section): SidebarNode => ({ kind: "section", section }));
  }

  getTreeItem(node: SidebarNode): vscode.TreeItem {
    if (node.kind === "section") {
      const collapsed = node.section.id === "privacy" || node.section.id === "activity";
      const item = new vscode.TreeItem(
        node.section.label,
        collapsed ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.Expanded
      );
      item.id = "lineloom.section." + node.section.id;
      item.iconPath = new vscode.ThemeIcon(node.section.icon);
      item.accessibilityInformation = { label: node.section.label + " section" };
      return item;
    }
    const data = node.item;
    const item = new vscode.TreeItem(data.label, vscode.TreeItemCollapsibleState.None);
    item.id = "lineloom.action." + data.id;
    item.iconPath = new vscode.ThemeIcon(data.icon);
    item.description = data.description;
    item.tooltip = data.description ? data.label + " — " + data.description : data.label;
    item.accessibilityInformation = {
      label: data.description ? data.label + ": " + data.description : data.label,
      role: data.command ? "button" : undefined
    };
    if (data.command) {
      item.command = { command: data.command, title: data.label };
    }
    return item;
  }

  dispose(): void { this.changes.dispose(); }
}
