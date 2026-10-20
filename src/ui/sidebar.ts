import * as vscode from "vscode";
import type { CompletionStats } from "../completion/engine";
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
    private readonly isApproved: (origin: string) => boolean
  ) {}

  refresh(): void { this.changes.fire(undefined); }

  getChildren(node?: SidebarNode): SidebarNode[] {
    if (node?.kind === "item") return [];
    if (node?.kind === "section") {
      return node.section.items.map((item): SidebarNode => ({ kind: "item", item }));
    }
    const config = readConfig();
    const stats = this.getStats();
    return sidebarSections({
      enabled: config.enabled,
      autoTrigger: config.autoTrigger,
      model: config.model,
      enabledLanguageCount: config.enabledLanguages.length,
      languageOverrideCount: Object.keys(config.languageModels).length,
      workspaceTrusted: vscode.workspace.isTrusted,
      endpointState: endpointState(this.isApproved),
      requests: stats?.requests ?? 0,
      completions: stats?.completions ?? 0,
      failed: stats?.failed ?? 0
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
      return item;
    }
    const data = node.item;
    const item = new vscode.TreeItem(data.label, vscode.TreeItemCollapsibleState.None);
    item.id = "lineloom.action." + data.id;
    item.iconPath = new vscode.ThemeIcon(data.icon);
    item.description = data.description;
    item.tooltip = data.description ? data.label + " — " + data.description : data.label;
    if (data.command) {
      item.command = { command: data.command, title: data.label };
    }
    return item;
  }

  dispose(): void { this.changes.dispose(); }
}
