/**
 * Bounded, ephemeral timings of completed Ollama requests.
 * Only non-negative finite durations are accepted. No editor/source identity,
 * model tag or endpoint is stored alongside any measurement.
 */
export interface LatencySummary {
  samples: number;
  p50Ms?: number;
  p95Ms?: number;
}

export class LatencyWindow {
  static readonly limit = 64;
  private readonly values: number[] = [];

  record(milliseconds: number): boolean {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) return false;
    if (this.values.length === LatencyWindow.limit) this.values.shift();
    this.values.push(milliseconds);
    return true;
  }

  summary(): LatencySummary {
    if (!this.values.length) return { samples: 0 };
    const sorted = [...this.values].sort((a, b) => a - b);
    const percentile = (p: number): number => sorted[Math.ceil(sorted.length * p) - 1];
    return { samples: sorted.length, p50Ms: percentile(0.5), p95Ms: percentile(0.95) };
  }

  clear(): void { this.values.length = 0; }
}
