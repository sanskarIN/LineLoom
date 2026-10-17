import type { Ignore } from "ignore";
/** A negation can only override patterns in its own source file or setting. */
export function ignoredByAny(relativePath: string, filters: readonly Ignore[]): boolean {
  return filters.some((filter) => filter.ignores(relativePath));
}
