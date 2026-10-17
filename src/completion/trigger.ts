/**
 * Automatic requests should be avoided until meaningful content is typed on
 * the active line. Explicit user triggers bypass this threshold.
 */
export function shouldAutoComplete(lineBeforeCursor: string, minChars: number, manual: boolean): boolean {
  if (manual) return true;
  const required = Math.max(0, Math.min(32, Math.trunc(minChars)));
  return lineBeforeCursor.trim().length >= required;
}
