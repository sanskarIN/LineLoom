export interface DocumentContext {
  prefix: string;
  suffix: string;
  indentation: string;
  cursorOffset: number;
}

/** Extract bounded context via a range reader, without copying an entire editor document. */
export function extractContextWindow(
  readRange: (start: number, end: number) => string,
  offset: number,
  length: number,
  budget: number
): DocumentContext {
  // Unexpected non-finite metadata must not propagate NaN/Infinity into
  // editor range reads or accidentally request an unbounded source window.
  if (!Number.isFinite(length) || !Number.isFinite(offset) || !Number.isFinite(budget)) {
    return { prefix: "", suffix: "", indentation: "", cursorOffset: 0 };
  }
  const total = Math.max(0, Math.trunc(length));
  const cursorOffset = Math.max(0, Math.min(total, Math.trunc(offset)));
  // Match the published maxContextChars setting even for direct API callers
  // (including synthetic tests), without changing the normal 128-unit floor.
  const cap = Math.min(30_000, Math.max(128, Math.trunc(budget)));
  const after = total - cursorOffset;
  const suffixCap = Math.min(after, Math.floor(cap * 0.3));
  const prefixCap = Math.min(cursorOffset, cap - suffixCap);
  let prefix = readRange(cursorOffset - prefixCap, cursorOffset);
  let suffix = readRange(cursorOffset, Math.min(total, cursorOffset + cap - prefix.length));
  // VS Code uses UTF-16 offsets. A bounded slice can begin at the low half
  // or end at the high half of a valid astral character. Drop just those
  // partial code units rather than sending malformed JSON/source context.
  // A caret positioned *inside* a surrogate pair is guarded at both sides.
  const high = (code: number): boolean => code >= 0xd800 && code <= 0xdbff;
  const low = (code: number): boolean => code >= 0xdc00 && code <= 0xdfff;
  if (prefix && low(prefix.charCodeAt(0))) prefix = prefix.slice(1);
  if (prefix && high(prefix.charCodeAt(prefix.length - 1))) prefix = prefix.slice(0, -1);
  if (suffix && low(suffix.charCodeAt(0))) suffix = suffix.slice(1);
  if (suffix && high(suffix.charCodeAt(suffix.length - 1))) suffix = suffix.slice(0, -1);
  const currentLine = prefix.slice(prefix.lastIndexOf("\n") + 1);
  const indentation = /^\s*/.exec(currentLine)?.[0].replace(/\r/g, "") ?? "";
  return { prefix, suffix, indentation, cursorOffset };
}

/** Backwards-compatible, pure string version for synthetic tests and benchmarks. */
export function extractContext(text: string, offset: number, budget: number): DocumentContext {
  return extractContextWindow((start, end) => text.slice(start, end), offset, text.length, budget);
}
