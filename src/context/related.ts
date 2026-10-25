import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";

// Strict first-step limit: no repository walking, no background indexing.
export const RELATED_FILE_LIMIT = 2;
export const RELATED_FILE_MAX_BYTES = 2048;

/** Deterministic, session-only explicit file selection. No automatic candidates. */
export function planRelatedFiles(activeId: string, selectedIds: readonly string[]): string[] {
  const seen = new Set([activeId]);
  const result: string[] = [];
  for (const id of selectedIds) {
    if (typeof id !== "string" || !id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    if (result.length >= RELATED_FILE_LIMIT) break;
  }
  return result;
}

/** Read only a tiny regular local UTF-8 text file; never follow a final symlink. */
export async function readBoundedRelatedFile(path: string): Promise<string> {
  const initial = await lstat(path);
  if (!initial.isFile() || initial.size < 1 || initial.size > RELATED_FILE_MAX_BYTES) {
    throw new Error("Selected context is not a bounded regular file");
  }
  const file = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const before = await file.stat();
    if (!before.isFile() || before.dev !== initial.dev || before.ino !== initial.ino ||
        before.size !== initial.size || before.size > RELATED_FILE_MAX_BYTES) {
      throw new Error("Selected context changed before read");
    }
    const bytes = Buffer.alloc(before.size);
    let offset = 0;
    while (offset < bytes.length) {
      const { bytesRead } = await file.read(bytes, offset, bytes.length - offset, offset);
      if (!bytesRead) throw new Error("Selected context was truncated");
      offset += bytesRead;
    }
    const after = await file.stat();
    if (after.size !== before.size || after.mtimeMs !== before.mtimeMs ||
        after.ino !== before.ino || after.dev !== before.dev) {
      throw new Error("Selected context changed while reading");
    }
    if (bytes.includes(0)) throw new Error("Binary selected context not allowed");
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (!text.trim()) throw new Error("Blank selected context not allowed");
    return text;
  } finally {
    await file.close();
  }
}
