export interface DocumentContext {
  prefix: string;
  suffix: string;
  indentation: string;
  cursorOffset: number;
}
/** Never walks the file system; operates only on a caller-provided active document. */
export function extractContext(text: string, offset: number, budget: number): DocumentContext {
  const cursorOffset = Math.max(0, Math.min(text.length, Math.trunc(offset)));
  const cap = Math.max(128, Math.trunc(budget));
  const before = text.slice(0, cursorOffset);
  const after = text.slice(cursorOffset);
  const suffixCap = Math.min(after.length, Math.floor(cap * 0.3));
  const prefixCap = Math.min(before.length, cap - suffixCap);
  const prefix = before.slice(-prefixCap);
  const suffix = after.slice(0, Math.min(after.length, cap - prefix.length));
  const currentLine = before.slice(before.lastIndexOf("\n") + 1);
  const indentation = /^\s*/.exec(currentLine)?.[0].replace(/\r/g, "") ?? "";
  return { prefix, suffix, indentation, cursorOffset };
}
