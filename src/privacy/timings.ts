/**
 * Opt-in, session-only privacy eligibility timings.
 * No paths, patterns, source bytes, prompts or model responses are stored.
 */
const MAX_SAMPLES = 64;
const samples: number[] = [];
let sampleCursor = 0;
let checks = 0;
let allowed = 0;
let totalMs = 0;
let lastMs = 0;
let maxMs = 0;

export interface EligibilityTimingSummary {
  checks: number;
  allowed: number;
  denied: number;
  samples: number;
  lastMs: number;
  averageMs: number;
  p95Ms: number;
  maxMs: number;
}

export function recordEligibilityTiming(durationMs: number, permitted: boolean): void {
  if (!Number.isFinite(durationMs) || durationMs < 0) return;
  checks++;
  if (permitted) allowed++;
  totalMs += durationMs;
  lastMs = durationMs;
  maxMs = Math.max(maxMs, durationMs);
  if (samples.length < MAX_SAMPLES) samples.push(durationMs);
  else samples[sampleCursor] = durationMs;
  sampleCursor = (sampleCursor + 1) % MAX_SAMPLES;
}

export function getEligibilityTimingSummary(): EligibilityTimingSummary {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    checks, allowed, denied: checks - allowed, samples: samples.length,
    lastMs,
    averageMs: checks ? totalMs / checks : 0,
    p95Ms: sorted.length ? sorted[Math.ceil(sorted.length * 0.95) - 1] : 0,
    maxMs
  };
}

export function resetEligibilityTimings(): void {
  samples.length = 0;
  sampleCursor = 0;
  checks = 0;
  allowed = 0;
  totalMs = 0;
  lastMs = 0;
  maxMs = 0;
}
