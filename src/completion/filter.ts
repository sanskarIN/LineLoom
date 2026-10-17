/** Remove chat-model artifacts; never claim that generated code is syntactically correct. */
export function cleanCompletion(raw: string, prefix: string, suffix: string, multiLine: boolean, maxLines = 8): string {
  // Normalise line endings without trimming meaningful leading Python indentation.
  let value = raw.replace(/\r\n?/g, "\n").replace(/\0/g, "");
  value = value.replace(/^\s*```(?:[a-zA-Z0-9+#_-]+)?[^\n]*\n/, "").replace(/\n?```\s*$/, "");
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
  value = value.slice(0, 6000).replace(/[\t ]+$/gm, "");
  if (!value.trim()) return "";
  return value;
}
