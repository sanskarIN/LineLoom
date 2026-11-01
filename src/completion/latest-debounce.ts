/**
 * A single cancellable trailing-edge debounce for automatic inline requests.
 * New waits supersede old ones: no delayed stale timers or listeners remain.
 * There is no source, URI, prompt, or model state in this queue.
 */
export interface DebounceToken {
  readonly isCancellationRequested: boolean;
  onCancellationRequested(listener: () => void): { dispose(): void };
}

export class LatestDebounce {
  private pending: { stop: () => void } | undefined;

  wait(ms: number, token: DebounceToken): Promise<boolean> {
    // A zero-delay manual invoke also revokes a pending automatic wait.
    this.cancel();
    if (token.isCancellationRequested) return Promise.resolve(false);
    if (ms <= 0) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      let settled = false;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      let subscription: { dispose(): void } | undefined;
      const finish = (allowed: boolean): void => {
        if (settled) return;
        settled = true;
        if (timeout !== undefined) clearTimeout(timeout);
        subscription?.dispose();
        if (this.pending?.stop === stop) this.pending = undefined;
        resolve(allowed && !token.isCancellationRequested);
      };
      const stop = (): void => finish(false);
      this.pending = { stop };
      // Some token adapters fire synchronously during subscription. Handle
      // that case without retaining a listener or scheduling a stale timer.
      subscription = token.onCancellationRequested(stop);
      if (settled) {
        subscription.dispose();
        return;
      }
      timeout = setTimeout(() => finish(true), ms);
      if (token.isCancellationRequested) stop();
    });
  }

  cancel(): void { this.pending?.stop(); }
}
