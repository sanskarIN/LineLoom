import * as vscode from "vscode";
import * as path from "node:path";
import ignore, { type Ignore } from "ignore";
import { isSensitivePath } from "./rules";
export { isSensitivePath } from "./rules";
interface CachedIgnore { filters: Ignore[]; expires: number }
const cache = new Map<string, CachedIgnore>();
function userPatterns(patterns: readonly string[]): string[] {
  return patterns.filter((item) => typeof item === "string" && item.trim() && !item.includes("\0"));
}
import { ignoredByAny } from "./matching";
async function loadIgnore(folder: vscode.WorkspaceFolder, patterns: readonly string[]): Promise<Ignore[]> {
  const key = folder.uri.toString() + ":" + JSON.stringify(patterns);
  const existing = cache.get(key);
  if (existing && existing.expires > Date.now()) return existing.filters;
  const filters: Ignore[] = [];
  for (const file of [".gitignore", ".lineloomignore"]) {
    let bytes: Uint8Array;
    try { bytes = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(folder.uri, file)); }
    catch { continue; }
    if (bytes.byteLength >= 128_000) throw new Error("Ignore file too large; refusing completion.");
    filters.push(ignore().add(Buffer.from(bytes).toString("utf8")));
  }
  const custom = userPatterns(patterns);
  if (custom.length) filters.push(ignore().add(custom));
  cache.set(key, { filters, expires: Date.now() + 30_000 });
  if (cache.size > 30) cache.clear();
  return filters;
}
export async function mayComplete(document: vscode.TextDocument, patterns: readonly string[]): Promise<boolean> {
  if (!vscode.workspace.isTrusted || document.uri.scheme !== "file" || document.isClosed) return false;
  const folder = vscode.workspace.getWorkspaceFolder(document.uri);
  if (!folder) return false;
  const rel = path.relative(folder.uri.fsPath, document.uri.fsPath).replace(/\\/g, "/");
  if (!rel || rel === ".." || rel.startsWith("../") || path.isAbsolute(rel)) return false;
  if (isSensitivePath(rel)) return false;
  try { return !ignoredByAny(rel, await loadIgnore(folder, patterns)); }
  catch { return false; }
}
export function clearIgnoreCache(): void { cache.clear(); }
