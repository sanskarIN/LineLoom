/**
 * Decode privacy ignore files without lossy UTF-8 replacement.
 *
 * Buffer.toString("utf8") silently replaces malformed bytes with U+FFFD.
 * That can change an intended filename exclusion into a different pattern,
 * so the eligibility gate must reject the entire policy instead.
 * The decoder permits ordinary UTF-8, strips an optional UTF-8 BOM, and
 * refuses embedded NUL bytes common in binary or corrupted rule files.
 */
export function decodeIgnorePolicy(bytes: Uint8Array): string {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (text.includes("\0")) throw new Error("Invalid binary ignore policy.");
  return text;
}
