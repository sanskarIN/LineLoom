import * as vscode from "vscode";
import { safeWorkspaceRelativePaths } from "./paths";
import ignore from "ignore";
import { isSensitivePath } from "./rules";
import { ignoreScopes, ignoredByScopedRules, type ScopedIgnoreRule } from "./scoped";
export { isSensitivePath } from "./rules";

interface PolicyStamp { uri: vscode.Uri; signature: string }
interface CachedIgnore { rules: ScopedIgnoreRule[]; expires: number; stamps: PolicyStamp[] }
const cache = new Map<string, CachedIgnore>();
// Invalidate scans already in flight, not only entries already in the cache.
// A file watcher can fire while vscode.workspace.fs.readFile is suspended.
let ignoreRevision = 0;
const MAX_DEPTH = 24;
const MAX_CACHED_RULE_SETS = 128;

/**
 * File watchers may drop events or be excluded by VS Code's watcher settings.
 * Revalidate each applicable policy file's metadata before reusing a cached
 * allow decision; missing files must also be tracked so new ignore files are
 * detected. Never log paths or policy text.
 */
async function policySignature(uri: vscode.Uri): Promise<string> {
  try {
    const info = await vscode.workspace.fs.stat(uri);
    return info.type + ":" + info.size + ":" + info.mtime;
  } catch (error) {
    if (error instanceof vscode.FileSystemError && error.code === "FileNotFound") return "missing";
    throw error;
  }
}
async function signaturesMatch(stamps: readonly PolicyStamp[]): Promise<boolean> {
  const current = await Promise.all(stamps.map((stamp) => policySignature(stamp.uri)));
  return current.every((value, index) => value === stamps[index].signature);
}

function userPatterns(patterns: readonly string[]): string[] {
  return patterns.filter((item) => typeof item === "string" && item.trim() && !item.includes("\0"));
}

async function loadIgnore(folder: vscode.WorkspaceFolder, relative: string, patterns: readonly string[]): Promise<ScopedIgnoreRule[]> {
  const scopes = ignoreScopes(relative);
  // Refuse unexpectedly deep traversal rather than silently bypassing ignore rules.
  if (scopes.length < 1 || scopes.length > MAX_DEPTH) throw new Error("Workspace nesting exceeds safe ignore limit.");
  const key = folder.uri.toString() + ":" + JSON.stringify(patterns) + ":" + relative;
  const startedAtRevision = ignoreRevision;
  const existing = cache.get(key);
  if (existing && existing.expires > Date.now()) {
    const matches = await signaturesMatch(existing.stamps);
    if (startedAtRevision !== ignoreRevision) throw new Error("Ignore policy changed during validation.");
    if (matches) return existing.rules;
  }

  const rules: ScopedIgnoreRule[] = [];
  const stamps: PolicyStamp[] = [];
  for (const scope of scopes) {
    for (const file of [".gitignore", ".lineloomignore"] as const) {
      const uri = scope.directory
        ? vscode.Uri.joinPath(folder.uri, scope.directory, file)
        : vscode.Uri.joinPath(folder.uri, file);
      const signature = await policySignature(uri);
      stamps.push({ uri, signature });
      if (signature === "missing") continue;
      // An unreadable file or one removed during this scan must deny
      // completion, rather than treating it as an optional absent file.
      const bytes = await vscode.workspace.fs.readFile(uri);
      if (bytes.byteLength >= 128_000) throw new Error("Ignore file too large; refusing completion.");
      rules.push({ directory: scope.directory, source: file, matcher: ignore().add(Buffer.from(bytes).toString("utf8")) });
    }
  }
  const custom = userPatterns(patterns);
  if (custom.length) rules.push({ directory: "", source: "user", matcher: ignore().add(custom) });
  // Confirm no policy changed *during* the scan, including a file created
  // after it was initially missing. Avoid caching any inconsistent snapshot.
  if (startedAtRevision !== ignoreRevision || !await signaturesMatch(stamps))
    throw new Error("Ignore policy changed during validation.");
  cache.set(key, { rules, stamps, expires: Date.now() + 20_000 });
  if (cache.size > MAX_CACHED_RULE_SETS) cache.clear();
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
