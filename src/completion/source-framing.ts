/**
 * Present user-controlled source only inside line-prefixed, untrusted data.
 *
 * This is a VISUAL boundary for instruction-prompt models, not a guarantee
 * against prompt injection or a source-code transformation. Native FIM models
 * receive the original UTF-16 content unchanged from buildPrompt().
 *
 * Escape hidden formatting characters that could visually reverse, obscure or
 * merge lines of quoted source with top-level instructions. Preserve visible
 * Unicode, meaningful combining marks, ZWNJ/ZWJ and legitimate emoji.
 */

const isInvisibleOrUnsafeFormat = (point: number): boolean =>
  // Preserve tab for indentation and LF for frame boundaries. CR is normalized
  // before this function is used.
  (point <= 0x001f && point !== 0x0009 && point !== 0x000a) ||
  (point >= 0x007f && point <= 0x009f) ||
  point === 0x00ad ||
  point === 0x061c ||
  point === 0x180e ||
  point === 0x200b ||
  point === 0x200e ||
  point === 0x200f ||
  (point >= 0x2028 && point <= 0x202e) ||
  (point >= 0x2060 && point <= 0x2064) ||
  (point >= 0x2066 && point <= 0x206f) ||
  point === 0xfeff ||
  // The JavaScript string may contain an unpaired UTF-16 surrogate.
  // It must not silently become the U+FFFD replacement character.
  (point >= 0xd800 && point <= 0xdfff) ||
  // Supplementary Unicode tag characters are invisible but can disguise
  // source comments and strings. Astral letters and emoji remain visible.
  (point >= 0xe0000 && point <= 0xe007f);

/** Return a visible escape with a stable, lower-case hex representation. */
export function visibleCodePoint(point: number): string {
  const hex = point.toString(16);
  return point <= 0xffff
    ? "\\u" + hex.padStart(4, "0")
    : "\\u{" + hex + "}";
}

/**
 * The output begins with a pipe-space on every actual LF-delimited line.
 * Hidden direction and format controls are represented as printable escapes;
 * a literal newline in source is the only way to create another quoted line.
 */
export function frameUntrustedSource(source: string): string {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  return lines.map((line) => {
    let quoted = "| ";
    // Code-point iteration keeps valid surrogate pairs intact while exposing
    // lone surrogates as individual, malformed code points for escaping.
    for (const character of line) {
      const point = character.codePointAt(0);
      quoted += point !== undefined && isInvisibleOrUnsafeFormat(point)
        ? visibleCodePoint(point) : character;
    }
    return quoted;
  }).join("\n");
}
