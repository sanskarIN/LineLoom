/**
 * A tiny, ephemeral backoff for model responses with no insertable code.
 * Keys must be hashed request fingerprints, never source text or prompts.
 * A manual invocation should bypass this backoff and can retry immediately.
 */
export class EmptySuggestionBackoff {
  private readonly entries = new Map<string, number>();
  constructor(private readonly capacity = 16, private readonly ttlMs = 5_000) {}

  shouldSkip(key: string, now = Date.now()): boolean {
    const expiry = this.entries.get(key);
    if (expiry === undefined) return false;
    if (expiry <= now) {
      this.entries.delete(key);
      return false;
    }
    this.entries.delete(key);
    this.entries.set(key, expiry);
    return true;
  }

  rememberEmpty(key: string, now = Date.now()): void {
    if (this.capacity <= 0 || this.ttlMs <= 0) return;
    this.entries.delete(key);
    this.entries.set(key, now + this.ttlMs);
    while (this.entries.size > this.capacity) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  clear(): void { this.entries.clear(); }
}
