import { createHash } from "node:crypto";

/**
 * Session-only source-free per-file revocation.
 * Store digests rather than raw URI strings. At capacity, fail closed
 * instead of evicting an older pause and silently resuming that file.
 */
export class SessionFilePause {
  private readonly paused = new Set<string>();
  constructor(private readonly capacity = 128) {}
  get count(): number { return this.paused.size; }
  private digest(uri: string): string {
    return createHash("sha256").update(uri).digest("hex");
  }
  isPaused(uri: string): boolean { return this.paused.has(this.digest(uri)); }
  setPaused(uri: string, paused: boolean): boolean {
    const key = this.digest(uri);
    if (!paused) { this.paused.delete(key); return true; }
    if (this.paused.has(key)) return true;
    if (this.paused.size >= this.capacity) return false;
    this.paused.add(key);
    return true;
  }
  clear(): void { this.paused.clear(); }
}
