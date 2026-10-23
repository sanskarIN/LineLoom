import * as vscode from "vscode";
import { policyContentDigest } from "./fingerprint";
import { mapBounded } from "./bounded";
import { safeWorkspaceRelativePaths } from "./paths";
import ignore from "ignore";
import { isSensitivePath } from "./rules";
import { ignoreScopes, ignoredByScopedRules, type ScopedIgnoreRule } from "./scoped";
export { isSensitivePath } from "./rules";

interface PolicyStamp { uri: vscode.Uri; signature: string; digest?: string }
interface CachedIgnore { rules: ScopedIgnoreRule[]; expires: number; stamps: PolicyStamp[] }
const cache = new Map<string, CachedIgnore>();
// Invalidate scans already in flight, not only entries already in the cache.
// A file watcher can fire while vscode.workspace.fs.readFile is suspended.
let ignoreRevision = 0;
const MAX_DEPTH = 24;
const MAX_CACHED_RULE_SETS = 128;
const MAX_POLICY_BYTES = 128_000;
const MAX_POLICY_READ_CONCURRENCY = 8;

/**
 * File watchers may drop events or be excluded by VS Code's watcher settings.
 * Revalidate each applicable policy file's metadata before reusing a cached
 * allow decision; missing files must also be tracked so new ignore files are
 * detected. Never log paths or policy text.
 */
async function policySignature(uri: vscode.Uri): Promise<string> {
  try {
    const info = await vscode.workspace.fs.stat(uri);
    // Check size before readFile to avoid allocating unexpectedly large policies.
    if (info.size >= MAX_POLICY_BYTES) throw new Error("Ignore file too large; refusing completion.");
    return info.type + ":" + info.size + ":" + info.mtime;
  } catch (error) {
    if (error instanceof vscode.FileSystemError && error.code === "FileNotFound") return "missing";
    throw error;
  }
}
async function readPolicyBytes(uri: vscode.Uri): Promise<Uint8Array> {
  const bytes = await vscode.workspace.fs.readFile(uri);
  if (bytes.byteLength >= MAX_POLICY_BYTES) throw new Error("Ignore file too large; refusing completion.");
  return bytes;
}
async function signaturesMatch(stamps: readonly PolicyStamp[]): Promise<boolean> {
  const matches = await mapBounded(stamps, MAX_POLICY_READ_CONCURRENCY, async (stamp) => {
    const before = await policySignature(stamp.uri);
    if (before !== stamp.signature) return false;
    if (before === "missing") return stamp.digest === undefined;
    // Watchers and metadata can both miss a same-size/same-mtime rewrite.
    // Compare actual rule bytes before reusing any cached allow decision.
    const bytes = await readPolicyBytes(stamp.uri);
    const after = await policySignature(stamp.uri);
    return before === after && stamp.digest === policyContentDigest(bytes);
  });
  return matches.every(Boolean);
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

  // Each ancestor source is independent. Fetch a small bounded batch at a
  // time instead of serializing up to 48 local stat/read operations. Preserve
  // root-to-leaf order for repeatable policy snapshots and diagnostics.
  const sources = scopes.flatMap((scope) =>
    ([".gitignore", ".lineloomignore"] as const).map((file) => ({ scope, file }))
  );
  const snapshots = await mapBounded(sources, MAX_POLICY_READ_CONCURRENCY, async ({ scope, file }) => {
    const uri = scope.directory
      ? vscode.Uri.joinPath(folder.uri, scope.directory, file)
      : vscode.Uri.joinPath(folder.uri, file);
    const signature = await policySignature(uri);
    const stamp: PolicyStamp = { uri, signature };
    if (signature === "missing") return { stamp, rule: undefined };
    // Unreadable, oversized or disappearing rule sources fail closed.
    const bytes = await readPolicyBytes(uri);
    stamp.digest = policyContentDigest(bytes);
    const rule: ScopedIgnoreRule = {
      directory: scope.directory, source: file,
      matcher: ignore().add(Buffer.from(bytes).toString("utf8"))
    };
    return { stamp, rule };
  });
  const rules: ScopedIgnoreRule[] = snapshots.flatMap(({ rule }) => rule ? [rule] : []);
  const stamps = snapshots.map(({ stamp }) => stamp);
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
