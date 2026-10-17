/** Remove common chat-model artifacts; never claim a completion is syntax-valid. */
export function cleanCompletion(raw: string, prefix: string, suffix: string, multiLine: boolean): string {
  let value = raw.replace(/\r\n/g, "\n").replace(/^\s*```(?:[a-zA-Z0-9+#_-]+)?\s*\n/, "").replace(/\n?```\s*$/, "");
  value = value.replace(/^(?:Here(?:'s| is) (?:the )?code:?|Completion:?)\s*\n/i, "");
  // A model sometimes echoes the last part of a prompt or the line already in the editor.
  const tail = prefix.slice(-160);
  if (tail && value.startsWith(tail)) value = value.slice(tail.length);
  const lastLine = prefix.slice(prefix.lastIndexOf("\n") + 1);
  if (lastLine.trim() && value.startsWith(lastLine)) value = value.slice(lastLine.length);
  if (!multiLine) value = value.split("\n", 1)[0];
  // Never replace existing code after the cursor; strip only an exact overlap.
  const maxOverlap = Math.min(suffix.length, value.length);
  for (let length = maxOverlap; length > 0; length--) {
    if (value.endsWith(suffix.slice(0, length))) {
      value = value.slice(0, -length);
      break;
    }
  }
  value = value.slice(0, 6000).replace(/[\t ]+$/gm, "");
  if (!value.trim()) return "";
  if (/^(?:Certainly|Sure[,!]|As an AI|I can help)/i.test(value.trimStart())) return "";
  return value;
}
