import * as vscode from "vscode";
import { mayReadRelatedFile } from "../privacy/exclusions";
import { planRelatedFiles, readBoundedRelatedFile } from "./related";

// Deliberately limited to source-like files: never read arbitrary local documents.
const SUPPORTED_SOURCE = /\.(?:py|js|jsx|ts|tsx|rs|kt|go|java|c|h|cpp|cc|hpp|hh)$/i;

/**
 * Fail closed for the entire selected context set if anything is denied,
 * modified, cancelled or ambiguous. Returning [] means no user selection.
 * Source and paths exist only in memory and the user's explicit Ollama prompt.
 */
export async function collectRelatedText(
  active: vscode.TextDocument,
  selected: readonly vscode.Uri[],
  patterns: readonly string[],
  stillCurrent: () => boolean
): Promise<string[] | undefined> {
  if (!selected.length) return [];
  if (!vscode.workspace.isTrusted || !stillCurrent()) return;
  const root = vscode.workspace.getWorkspaceFolder(active.uri);
  if (!root || active.uri.scheme !== "file") return;
  const selectedById = new Map(selected.map(uri => [uri.toString(), uri]));
  const ids = planRelatedFiles(active.uri.toString(), [...selectedById.keys()]);
  const result: string[] = [];
  for (const id of ids) {
    if (!stillCurrent() || !vscode.workspace.isTrusted) return;
    const uri = selectedById.get(id);
    if (!uri || uri.scheme !== "file" || !SUPPORTED_SOURCE.test(uri.path) ||
        vscode.workspace.getWorkspaceFolder(uri)?.uri.toString() !== root.uri.toString()) return;
    if (!await mayReadRelatedFile(uri, patterns) || !stillCurrent()) return;
    try {
      const text = await readBoundedRelatedFile(uri.fsPath);
      if (!stillCurrent() || !await mayReadRelatedFile(uri, patterns) || !stillCurrent()) return;
      result.push(text);
    } catch {
      return; // no partial prompt when a chosen file is invalid or unreadable
    }
  }
  return result;
}
