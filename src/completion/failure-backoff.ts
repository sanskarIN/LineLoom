/**
 * Bounded, session-only cooldown for transient Ollama generation failures.
 * The caller passes a hash of endpoint origin + selected model only: never
 * prompts, filenames, source, raw model names or full endpoint URLs.
 * Manual requests bypass this guard; normal privacy checks still apply.
 */
export class TransientFailureBackoff {
  private readonly entries = new Map<string, { attempts: number; until: number }>();

  constructor(
    private readonly capacity = 16,
    private readonly baseMs = 1_000,
    private readonly maxMs = 30_000
  ) {}

  shouldSkip(fingerprint: string, now = Date.now()): boolean {
    const entry = this.entries.get(fingerprint);
    if (!entry) return false;
    // Preserve the failure streak after the timer expires. A genuine
    // successful response, explicit reset or LRU eviction ends that streak.
    return now < entry.until;
  }

  recordFailure(fingerprint: string, now = Date.now()): number {
    if (!fingerprint || this.capacity <= 0 || this.baseMs <= 0 || this.maxMs <= 0) return 0;
    const previous = this.entries.get(fingerprint);
    const attempts = Math.min((previous?.attempts ?? 0) + 1, 32);
    const delay = Math.min(this.maxMs, this.baseMs * 2 ** Math.min(attempts - 1, 20));
    this.entries.delete(fingerprint);
    this.entries.set(fingerprint, { attempts, until: now + delay });
    while (this.entries.size > this.capacity) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
    return delay;
  }

  recordSuccess(fingerprint: string): void { this.entries.delete(fingerprint); }
  clear(): void { this.entries.clear(); }
}

/** Only temporary transport/server failures merit an automatic retry pause. */
export function isTransientGenerationFailure(error: unknown, timedOut = false): boolean {
  if (timedOut) return true;
  if (error instanceof TypeError) return true; // fetch transport failure
  return error instanceof Error &&
    /^Ollama returned HTTP (?:429|5[0-9]{2})\.$/.test(error.message);
}
