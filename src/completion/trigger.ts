/**
 * Automatic requests should be avoided until meaningful content is typed on
 * the active line. Explicit user triggers bypass this threshold.
 */
export function shouldAutoComplete(lineBeforeCursor: string, minChars: number, manual: boolean): boolean {
  if (manual) return true;
  const required = Math.max(0, Math.min(32, Math.trunc(minChars)));
  return lineBeforeCursor.trim().length >= required;
}

/** Minimal cursor shape, kept independent of VS Code so it can be unit-tested. */
export interface SingleCursor {
  isEmpty: boolean;
  active: { line: number; character: number };
}

/** Ignore selection replacements and multi-cursor editing: the provider inserts at one cursor. */
export function hasSingleInsertionCursor(
  selections: readonly SingleCursor[], line: number, character: number
): boolean {
  return selections.length === 1 &&
    selections[0].isEmpty &&
    selections[0].active.line === line &&
    selections[0].active.character === character;
}

/**
 * VS Code cursor columns use UTF-16 code units. Never insert ghost text
 * between the halves of a valid astral character: neither the prompt
 * extraction nor the rendered edit can safely reconstruct that character.
 * Manual invocation cannot override this editor integrity guard.
 */
export function isSafeInsertionBoundary(line: string, character: number): boolean {
  if (!Number.isSafeInteger(character) || character < 0 || character > line.length) return false;
  if (character === 0 || character === line.length) return true;
  const previous = line.charCodeAt(character - 1);
  const next = line.charCodeAt(character);
  return !(previous >= 0xd800 && previous <= 0xdbff &&
    next >= 0xdc00 && next <= 0xdfff);
}

/**
 * When automatic completion is requested within an identifier, keep normal
 * editing and native IntelliSense in control. Explicit invocations bypass it.
 * This checks only the character directly after the caret; no extra file reads.
 */
export function shouldRequestAtCursor(nextText: string, manual: boolean, suppressMidToken = true): boolean {
  if (manual || !suppressMidToken) return true;
  return !(/^[\p{L}\p{N}\p{M}\p{Pc}$]/u.test(nextText) ||
    nextText.startsWith("\u200c") || nextText.startsWith("\u200d"));
}
