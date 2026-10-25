import { randomUUID } from "node:crypto";

/** Bounded, in-memory, source-free VS Code accepted-inline-item acknowledgements. */
export class AcceptanceTracker {
  private readonly pending = new Set<string>();
  private readonly maxPending = 128;

  issue(): string {
    const token = randomUUID();
    if (this.pending.size >= this.maxPending) {
      const oldest = this.pending.values().next().value;
      if (oldest !== undefined) this.pending.delete(oldest);
    }
    this.pending.add(token);
    return token;
  }

  acknowledge(token: unknown): boolean {
    return typeof token === "string" && this.pending.delete(token);
  }

  clear(): void { this.pending.clear(); }
}
