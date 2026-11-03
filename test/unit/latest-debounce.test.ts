import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LatestDebounce, type DebounceToken } from "../../src/completion/latest-debounce";

function cancellation() {
  let cancelled = false;
  const listeners = new Set<() => void>();
  const token: DebounceToken = {
    get isCancellationRequested() { return cancelled; },
    onCancellationRequested(listener) {
      listeners.add(listener);
      return { dispose() { listeners.delete(listener); } };
    }
  };
  return {
    token,
    cancel() {
      cancelled = true;
      for (const listener of [...listeners]) listener();
    },
    get listenerCount() { return listeners.size; }
  };
}

describe("latest-only automatic debounce", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it("settles an obsolete request without waiting for its timer or touching the latest one", async () => {
    const queue = new LatestDebounce();
    const old = cancellation();
    const next = cancellation();
    const first = queue.wait(1_000, old.token);
    expect(old.listenerCount).toBe(1);
    expect(vi.getTimerCount()).toBe(1);
    const second = queue.wait(50, next.token);
    expect(await first).toBe(false);
    expect(old.listenerCount).toBe(0);
    expect(next.listenerCount).toBe(1);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(49);
    expect(next.listenerCount).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(await second).toBe(true);
    expect(next.listenerCount).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("manual zero-delay requests supersede pending automatic requests", async () => {
    const queue = new LatestDebounce();
    const automatic = cancellation();
    const first = queue.wait(3_000, automatic.token);
    expect(await queue.wait(0, cancellation().token)).toBe(true);
    expect(await first).toBe(false);
    expect(automatic.listenerCount).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("explicit Stop immediately resolves and clears pending resources", async () => {
    const queue = new LatestDebounce();
    const source = cancellation();
    const result = queue.wait(3_000, source.token);
    queue.cancel();
    queue.cancel();
    expect(await result).toBe(false);
    expect(source.listenerCount).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancellation tokens immediately stop their associated waits", async () => {
    const queue = new LatestDebounce();
    const source = cancellation();
    const result = queue.wait(500, source.token);
    source.cancel();
    expect(await result).toBe(false);
    expect(source.listenerCount).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(await queue.wait(1_000, source.token)).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("respects timeout completion and cleans listeners after normal completion", async () => {
    const queue = new LatestDebounce();
    const source = cancellation();
    const result = queue.wait(100, source.token);
    await vi.advanceTimersByTimeAsync(100);
    expect(await result).toBe(true);
    expect(source.listenerCount).toBe(0);
    source.cancel();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("handles cancellation fired synchronously by an unusual token adapter", async () => {
    let disposed = false;
    const source: DebounceToken = {
      isCancellationRequested: false,
      onCancellationRequested(listener) {
        listener();
        return { dispose() { disposed = true; } };
      }
    };
    const queue = new LatestDebounce();
    expect(await queue.wait(100, source)).toBe(false);
    expect(disposed).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
