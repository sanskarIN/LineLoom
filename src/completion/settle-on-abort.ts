/**
 * End a live completion wait promptly if its AbortSignal is revoked, even
 * when a non-compliant endpoint ignores fetch/stream abort.
 *
 * The work retains the original signal for best-effort network cancellation.
 * A late result can never be offered after the abort branch wins. Errors
 * contain no source, model name, response or endpoint details.
 */
export async function settleOnAbort<T>(
  signal: AbortSignal, work: () => Promise<T>
): Promise<T> {
  const cancelled = (): DOMException => new DOMException("Generation cancelled.", "AbortError");
  if (signal.aborted) throw cancelled();
  let onAbort: () => void = () => {};
  const aborted = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(cancelled());
    signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    // Refuse to start transport work if cancellation arrives just before
    // its microtask begins.
    const running = Promise.resolve().then(() => {
      if (signal.aborted) throw cancelled();
      return work();
    });
    return await Promise.race([running, aborted]);
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}
