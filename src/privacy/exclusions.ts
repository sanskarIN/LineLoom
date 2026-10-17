import * as vscode from "vscode";
import * as path from "node:path";
import ignore, { type Ignore } from "ignore";

const sensitiveSegments = new Set([".git", "node_modules", ".svn", ".hg", "vendor", "dist", "build", "target", ".idea", ".vscode-test"]);
const riskyExtensions = /\.(?:pem|p12|pfx|p8|key|asc|keystore|jks|sqlite|db|lockb)$/i;
export function isSensitivePath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  const pieces = normalized.split("/").filter(Boolean);
  if (pieces.some((segment) => sensitiveSegments.has(segment.toLowerCase()))) return true;
  const base = pieces.at(-1)?.toLowerCase() ?? "";
  return /^\.env(?:\.|$)/.test(base) ||
    /^(?:id_rsa|id_ed25519|credentials|secrets?|private_key|service-account)(?:[._-]|$)/.test(base) ||
    riskyExtensions.test(base);
}
interface CachedIgnore { filter: Ignore; expires: number }
const cache = new Map<string, CachedIgnore>();
function userPatterns(patterns: readonly string[]): string[] {
  return patterns.filter((item) => typeof item === "string" && item.trim() && !item.includes("\0"));
}
async function loadIgnore(folder: vscode.WorkspaceFolder, patterns: readonly string[]): Promise<Ignore> {
  const key = folder.uri.toString() + ":" + JSON.stringify(patterns);
  const existing = cache.get(key);
  if (existing && existing.expires > Date.now()) return existing.filter;
  const filter = ignore();
  for (const file of [".gitignore", ".lineloomignore"]) {
    try {
      const bytes = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(folder.uri, file));
      // Ignore very large or suspicious ignore files rather than blocking the extension host.
      if (bytes.byteLength < 128_000) filter.add(Buffer.from(bytes).toString("utf8"));
    } catch { /* absent ignore files are normal */ }
  }
  filter.add(userPatterns(patterns));
  cache.set(key, { filter, expires: Date.now() + 30_000 });
  if (cache.size > 30) cache.clear();
  return filter;
}
/** Fail closed for untrusted, virtual, outside-workspace or sensitive documents. */
export async function mayComplete(document: vscode.TextDocument, patterns: readonly string[]): Promise<boolean> {
  if (!vscode.workspace.isTrusted || document.uri.scheme !== "file" || document.isClosed) return false;
  const folder = vscode.workspace.getWorkspaceFolder(document.uri);
  if (!folder) return false;
  const rel = path.relative(folder.uri.fsPath, document.uri.fsPath).replace(/\\/g, "/");
  if (!rel || rel === ".." || rel.startsWith("../") || path.isAbsolute(rel)) return false;
  if (isSensitivePath(rel)) return false;
  try { return !(await loadIgnore(folder, patterns)).ignores(rel); }
  catch { return false; }
}
export function clearIgnoreCache(): void { cache.clear(); }
