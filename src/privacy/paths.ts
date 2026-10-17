import * as path from "node:path";
import { realpath } from "node:fs/promises";

/** An absolute path must be a descendant, not merely a string prefix, of the root. */
export function relativeInside(root: string, candidate: string): string | undefined {
  const rel = path.relative(root, candidate);
  if (!rel || rel === ".." || rel.startsWith(".." + path.sep) || path.isAbsolute(rel)) return;
  return rel.split(path.sep).join("/");
}

/** Both named and canonical paths are checked to prevent symlinks exposing excluded files. */
export async function safeWorkspaceRelativePaths(root: string, candidate: string): Promise<string[] | undefined> {
  const requested = relativeInside(root, candidate);
  if (!requested) return;
  const [realRoot, realCandidate] = await Promise.all([realpath(root), realpath(candidate)]);
  const canonical = relativeInside(realRoot, realCandidate);
  if (!canonical) return;
  return requested === canonical ? [requested] : [requested, canonical];
}
