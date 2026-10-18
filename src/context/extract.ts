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
  const total = Math.max(0, Math.trunc(length));
  const cursorOffset = Math.max(0, Math.min(total, Math.trunc(offset)));
  const cap = Math.max(128, Math.trunc(budget));
  const after = total - cursorOffset;
  const suffixCap = Math.min(after, Math.floor(cap * 0.3));
  const prefixCap = Math.min(cursorOffset, cap - suffixCap);
  const prefix = readRange(cursorOffset - prefixCap, cursorOffset);
  const suffix = readRange(cursorOffset, Math.min(total, cursorOffset + cap - prefix.length));
  const currentLine = prefix.slice(prefix.lastIndexOf("\n") + 1);
  const indentation = /^\s*/.exec(currentLine)?.[0].replace(/\r/g, "") ?? "";
  return { prefix, suffix, indentation, cursorOffset };
}

/** Backwards-compatible, pure string version for synthetic tests and benchmarks. */
export function extractContext(text: string, offset: number, budget: number): DocumentContext {
  return extractContextWindow((start, end) => text.slice(start, end), offset, text.length, budget);
}
