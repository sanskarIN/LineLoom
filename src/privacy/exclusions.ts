import * as vscode from "vscode";
import { safeWorkspaceRelativePaths } from "./paths";
import ignore, { type Ignore } from "ignore";
import { isSensitivePath } from "./rules";
import { ignoredByAny } from "./matching";
export { isSensitivePath } from "./rules";
interface CachedIgnore { filters: Ignore[]; expires: number }
const cache = new Map<string, CachedIgnore>();
function userPatterns(patterns: readonly string[]): string[] {
  return patterns.filter((item) => typeof item === "string" && item.trim() && !item.includes("\0"));
}
async function loadIgnore(folder: vscode.WorkspaceFolder, patterns: readonly string[]): Promise<Ignore[]> {
  const key = folder.uri.toString() + ":" + JSON.stringify(patterns);
  const existing = cache.get(key);
  if (existing && existing.expires > Date.now()) return existing.filters;
  const filters: Ignore[] = [];
  for (const file of [".gitignore", ".lineloomignore"]) {
    let bytes: Uint8Array;
    try { bytes = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(folder.uri, file)); }
    catch (error) {
      // Treat absent ignore files normally; other read errors must not bypass privacy policy.
      if (error instanceof vscode.FileSystemError && error.code === "FileNotFound") continue;
      throw error;
    }
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
  try {
    const relatives = await safeWorkspaceRelativePaths(folder.uri.fsPath, document.uri.fsPath);
    if (!relatives) return false;
    if (relatives.some(isSensitivePath)) return false;
    const filters = await loadIgnore(folder, patterns);
    return !relatives.some((relative) => ignoredByAny(relative, filters));
  } catch {
    // Fail closed for inaccessible paths, symlink resolution errors and invalid ignore rules.
    return false;
  }
}
export function clearIgnoreCache(): void { cache.clear(); }
