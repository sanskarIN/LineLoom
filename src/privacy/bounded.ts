/**
 * Run independent filesystem reads with bounded concurrency, preserving the
 * caller's original ordering. Read-only workers never publish cache entries.
 * On failure the caller rejects/fails closed; in-flight reads may still finish.
 */
export async function mapBounded<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (!Number.isSafeInteger(limit) || limit < 1) throw new RangeError("Invalid concurrency limit.");
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(items.length, limit) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}
