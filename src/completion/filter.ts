/**
 * Reject unsafe/invisible control characters in model-generated ghost text
 * rather than silently deleting bytes and accidentally changing source code.
 * CR/LF and tab are valid in source and are handled separately below.
 */
const UNSAFE_CODEPOINTS = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/u;
function hasUnpairedSurrogate(value: string): boolean {
  // for...of visits each valid UTF-16 surrogate pair as one two-unit string.
  for (const character of value) {
    if (character.length !== 1) continue;
    const unit = character.charCodeAt(0);
    if (unit >= 0xd800 && unit <= 0xdfff) return true;
  }
  return false;
}

/** Remove chat-model artifacts; never claim that generated code is syntactically correct. */
export function cleanCompletion(raw: string, prefix: string, suffix: string, multiLine: boolean, maxLines = 8): string {
  // Even a loopback model can return malformed or direction-spoofing text.
  // Never "repair" such output into different executable source.
  if (UNSAFE_CODEPOINTS.test(raw) || hasUnpairedSurrogate(raw)) return "";
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
  if (tail && value.startsWith(tail)) value = value.slice(tail.length);
  const lastLine = prefix.slice(prefix.lastIndexOf("\n") + 1);
  if (lastLine.trim() && value.startsWith(lastLine)) value = value.slice(lastLine.length);
  // Some models echo only the end of a line, rather than the complete current line.
  if (value && prefix) {
    const limit = Math.min(160, prefix.length, value.length);
    for (let n = limit; n >= 8; n--) {
      if (prefix.endsWith(value.slice(0, n)) && value.slice(0, n).trim()) {
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
    if (value.endsWith(suffix.slice(0, length))) {
      value = value.slice(0, -length);
      break;
    }
  }
  // A UTF-16 code-unit cap must not cut a valid astral Unicode character.
  value = value.slice(0, 6000);
  if (/[\uD800-\uDBFF]$/.test(value)) value = value.slice(0, -1);
  value = value.replace(/[\t ]+$/gm, "");
  if (!value.trim()) return "";
  return value;
}
