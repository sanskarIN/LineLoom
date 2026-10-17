/** Short-lived, bounded memory-only cache. Keys must be digests, not raw code context. */
export class SuggestionCache {
  private readonly entries = new Map<string, { value: string; expires: number }>();
  constructor(private readonly capacity = 8, private readonly ttlMs = 15_000) {}
  get(key: string, now = Date.now()): string | undefined {
    const entry = this.entries.get(key);
    if (!entry) return;
    if (entry.expires <= now) {
      this.entries.delete(key);
      return;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }
  put(key: string, value: string, now = Date.now()): void {
    if (!value) return;
    this.entries.delete(key);
    this.entries.set(key, { value, expires: now + this.ttlMs });
    while (this.entries.size > this.capacity) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }
  clear(): void { this.entries.clear(); }
}
