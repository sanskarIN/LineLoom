import * as vscode from "vscode";
import { safeWorkspaceRelativePaths } from "./paths";
import ignore from "ignore";
import { isSensitivePath } from "./rules";
import { ignoreScopes, ignoredByScopedRules, type ScopedIgnoreRule } from "./scoped";
export { isSensitivePath } from "./rules";

interface CachedIgnore { rules: ScopedIgnoreRule[]; expires: number }
const cache = new Map<string, CachedIgnore>();
// Invalidate scans already in flight, not only entries already in the cache.
// A file watcher can fire while vscode.workspace.fs.readFile is suspended.
let ignoreRevision = 0;
const MAX_DEPTH = 24;
const MAX_CACHED_RULE_SETS = 128;

function userPatterns(patterns: readonly string[]): string[] {
  return patterns.filter((item) => typeof item === "string" && item.trim() && !item.includes("\0"));
}

async function loadIgnore(folder: vscode.WorkspaceFolder, relative: string, patterns: readonly string[]): Promise<ScopedIgnoreRule[]> {
  const scopes = ignoreScopes(relative);
  // Refuse unexpectedly deep traversal rather than silently bypassing ignore rules.
  if (scopes.length < 1 || scopes.length > MAX_DEPTH) throw new Error("Workspace nesting exceeds safe ignore limit.");
  const key = folder.uri.toString() + ":" + JSON.stringify(patterns) + ":" + relative;
  const existing = cache.get(key);
  if (existing && existing.expires > Date.now()) return existing.rules;
  const startedAtRevision = ignoreRevision;

  const rules: ScopedIgnoreRule[] = [];
  for (const scope of scopes) {
    for (const file of [".gitignore", ".lineloomignore"] as const) {
      const uri = scope.directory
        ? vscode.Uri.joinPath(folder.uri, scope.directory, file)
        : vscode.Uri.joinPath(folder.uri, file);
      let bytes: Uint8Array;
      try { bytes = await vscode.workspace.fs.readFile(uri); }
      catch (error) {
        // Missing files are optional; unreadable files must not weaken exclusions.
        if (error instanceof vscode.FileSystemError && error.code === "FileNotFound") continue;
        throw error;
      }
      if (bytes.byteLength >= 128_000) throw new Error("Ignore file too large; refusing completion.");
      rules.push({ directory: scope.directory, source: file, matcher: ignore().add(Buffer.from(bytes).toString("utf8")) });
    }
  }
  const custom = userPatterns(patterns);
  if (custom.length) rules.push({ directory: "", source: "user", matcher: ignore().add(custom) });
  // A superseded async read must not restore stale rules after an edit.
  if (startedAtRevision === ignoreRevision) {
    cache.set(key, { rules, expires: Date.now() + 20_000 });
    if (cache.size > MAX_CACHED_RULE_SETS) cache.clear();
  }
  return rules;
}

export async function mayComplete(document: vscode.TextDocument, patterns: readonly string[]): Promise<boolean> {
  if (!vscode.workspace.isTrusted || document.uri.scheme !== "file" || document.isClosed) return false;
  const startedAtRevision = ignoreRevision;
  const folder = vscode.workspace.getWorkspaceFolder(document.uri);
  if (!folder) return false;
  try {
    const relatives = await safeWorkspaceRelativePaths(folder.uri.fsPath, document.uri.fsPath);
    if (!relatives) return false;
    if (relatives.some(isSensitivePath)) return false;
    for (const relative of relatives) {
      if (ignoredByScopedRules(relative, await loadIgnore(folder, relative, patterns))) return false;
    }
    // Ignore rules may have changed during an async filesystem read. Fail
    // closed rather than approving a document using an obsolete scan.
    return startedAtRevision === ignoreRevision;
  } catch {
    // Fail closed when ignore files, canonical paths or rules cannot be trusted.
    return false;
  }
}
export function clearIgnoreCache(): void {
  ignoreRevision++;
  cache.clear();
}
