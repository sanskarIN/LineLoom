/**
 * Reject unsafe/invisible control characters in model-generated ghost text
 * rather than silently deleting bytes and accidentally changing source code.
 * CR/LF and tab are valid in source and are handled separately below.
 */
function containsUnsafeUnicode(value: string): boolean {
  // Code-point iteration preserves legitimate Unicode surrogate pairs. Check
  // numeric ranges to avoid a regex with literal-control escapes in source.
  for (const character of value) {
    const point = character.codePointAt(0);
    if (point === undefined) continue;
    // Reject additional visually hidden format/direction markers in generated
    // source. Keep ZWNJ (U+200C) and ZWJ (U+200D): they are meaningful in
    // international identifiers and joined emoji sequences.
    if ((point <= 0x1f && point !== 0x09 && point !== 0x0a && point !== 0x0d) ||
        (point >= 0x7f && point <= 0x9f) ||
        point === 0x00ad || point === 0x061c || point === 0x180e ||
        point === 0x200b || point === 0x200e || point === 0x200f ||
        (point >= 0x2028 && point <= 0x202e) ||
        (point >= 0x2060 && point <= 0x2064) ||
        (point >= 0x2066 && point <= 0x206f) ||
        point === 0xfeff ||
        (point >= 0xd800 && point <= 0xdfff)) return true;
  }
  return false;
}

/**
 * A response sharing the start of a token with the current line is not
 * necessarily an echo: "function" before "functionality()" must not turn
 * the generated identifier into "ality()". Only remove sufficiently
 * distinctive echoes at a real insertion boundary.
 */
function hasCompleteEchoBoundary(value: string, end: number): boolean {
  const previous = value[end - 1] ?? "";
  const next = value[end] ?? "";
  const identifierPart = /[\p{L}\p{M}\p{N}\p{Pc}$\u200c\u200d]/u;
  // UTF-16 slicing must not divide a valid astral code point.
  const previousUnit = value.charCodeAt(end - 1);
  const nextUnit = value.charCodeAt(end);
  if (previousUnit >= 0xd800 && previousUnit <= 0xdbff &&
      nextUnit >= 0xdc00 && nextUnit <= 0xdfff) return false;
  return !(identifierPart.test(previous) && identifierPart.test(next));
}
function isConfidentPrefixEcho(value: string, echo: string): boolean {
  if (!echo.trim() || !value.startsWith(echo)) return false;
  // Short plain identifier matches are too ambiguous to delete.
  const structured = /[\s=;:(){}.,]/u.test(echo) || echo.includes("[") || echo.includes("]");
  if (echo.length < 8 && !(echo.length >= 4 && structured)) return false;
  return hasCompleteEchoBoundary(value, echo.length);
}

/** Remove chat-model artifacts; never claim that generated code is syntactically correct. */
export function cleanCompletion(raw: string, prefix: string, suffix: string, multiLine: boolean, maxLines = 8): string {
  // Even a loopback model can return malformed or direction-spoofing text.
  // Never "repair" such output into different executable source.
  if (containsUnsafeUnicode(raw)) return "";
  // Normalise line endings without trimming meaningful leading Python indentation.
  let value = raw.replace(/\r\n?/g, "\n");
  // Remove boundary-only control tokens without touching tokens inside code literals.
  value = value.replace(/^(?:<\|(?:fim_prefix|fim_middle)\|>)+/, "");
  value = value.replace(/(?:<\|(?:fim_suffix|endoftext|im_end)\|>)+\s*$/, "");
  value = value.replace(/^<\|im_start\|>assistant[^\n]*\n/, "");
  // Prefer the first fenced code block, dropping explanations that follow it.
  const fenced = /^\s*```(?:[a-zA-Z0-9+#_-]+)?[^\n]*\n([\s\S]*?)\n?```/.exec(value);
  if (fenced) value = fenced[1];
  else value = value.replace(/^\s*```(?:[a-zA-Z0-9+#_-]+)?[^\n]*\n/, "").replace(/\n?```\s*$/, "");
  value = value.replace(/^(?:Here(?:'s| is) (?:the )?code:?|Completion:?)\s*\n/i, "");
  if (/^(?:Certainly|Sure[,!]|As an AI|I can help)/i.test(value.trimStart())) return "";
  // A model may return a large part of code already present before the cursor.
  const tail = prefix.slice(-160);
  if (isConfidentPrefixEcho(value, tail)) value = value.slice(tail.length);
  const lastLine = prefix.slice(prefix.lastIndexOf("\n") + 1);
  if (isConfidentPrefixEcho(value, lastLine)) value = value.slice(lastLine.length);
  // Some models echo only the end of a line, rather than the complete current line.
  if (value && prefix) {
    const limit = Math.min(160, prefix.length, value.length);
    for (let n = limit; n >= 8; n--) {
      if (prefix.endsWith(value.slice(0, n)) && value.slice(0, n).trim() &&
          hasCompleteEchoBoundary(value, n)) {
        value = value.slice(n);
        break;
      }
    }
  }
  const lineCap = multiLine ? Math.max(1, Math.min(20, Math.floor(maxLines))) : 1;
  value = value.split("\n").slice(0, lineCap).join("\n");
  // Respect code after the cursor: avoid inserting content that is already there.
  const maxOverlap = Math.min(suffix.length, value.length);
  for (let length = maxOverlap; length > 0; length--) {
    const overlap = suffix.slice(0, length);
    if (!value.endsWith(overlap)) continue;
    // A one-/two-character identifier overlap is often coincidental:
    // "return value" before "else" must not become "return valu".
    // Also avoid cutting either identifier *mid-token* on longer matches:
    // "some" before "omega" or "ome;" must not become "s". Only
    // complete-word matches of length >= 3 or punctuation can be removed.
    const identifier = /[\p{L}\p{M}\p{N}_$]/u;
    const onlyIdentifier = /^[\p{L}\p{M}\p{N}_$]+$/u.test(overlap);
    const cutsGeneratedWord = onlyIdentifier &&
      identifier.test(value.at(-length - 1) ?? "");
    const cutsFollowingWord = identifier.test(overlap.at(-1) ?? "") &&
      length < suffix.length && identifier.test(suffix[length]);
    if ((length <= 2 && onlyIdentifier) || cutsGeneratedWord || cutsFollowingWord) continue;
    value = value.slice(0, -length);
    break;
  }
  // A UTF-16 code-unit cap must not cut a valid astral Unicode character.
  value = value.slice(0, 6000);
  if (/[\uD800-\uDBFF]$/.test(value)) value = value.slice(0, -1);
  // Code already after the caret may need the generated trailing separator
  // ("return " + "result") or indentation ("if ready:\n    " + "pass").
  // Trim completed lines, but keep the final whitespace run if the suffix
  // starts immediately with non-whitespace source text (which can be a
  // token, punctuation or a comment). Whitespace-only suggestions still fail.
  const preserveCursorSpacing = /^\S/u.test(suffix) &&
    /[\t ]$/.test(value) && /\S/u.test(value);
  const cursorSpacing = preserveCursorSpacing ? /[\t ]+$/.exec(value)?.[0] ?? "" : "";
  value = value.replace(/[\t ]+$/gm, "");
  if (cursorSpacing) value += cursorSpacing;
  if (!value.trim()) return "";
  return value;
}
