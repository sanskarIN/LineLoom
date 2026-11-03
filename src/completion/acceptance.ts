import { randomUUID } from "node:crypto";

/**
 * Source-free, session-only acceptance receipts. Tokens never contain editor
 * identity, source, paths, prompts or model information.
 *
 * The editor can retain a superseded inline item after the provider returns.
 * Treat its acceptance command as evidence of a recent offered suggestion,
 * never as a measure of model correctness, and never honor a token forever.
 */
export class AcceptanceTracker {
  private readonly pending = new Map<string, number>();
  private readonly maxPending = 128;
  private readonly ttlMs = 5 * 60_000;

  /** Monotonic time avoids extending stale receipts after system clock changes. */
  issue(now = performance.now()): string {
    this.prune(now);
    const token = randomUUID();
    if (this.pending.size >= this.maxPending) {
      const oldest = this.pending.keys().next().value;
      if (oldest !== undefined) this.pending.delete(oldest);
    }
    this.pending.set(token, now + this.ttlMs);
    return token;
  }

  acknowledge(token: unknown, now = performance.now()): boolean {
    if (typeof token !== "string") return false;
    const expires = this.pending.get(token);
    // A malformed, stale or replayed callback is never accepted.
    if (expires === undefined) return false;
    this.pending.delete(token);
    return now < expires;
  }

  /** Garbage collect expired receipts before issuing another bounded token. */
  private prune(now: number): void {
    for (const [token, expires] of this.pending) {
      if (now >= expires) this.pending.delete(token);
    }
  }

  clear(): void { this.pending.clear(); }
}
