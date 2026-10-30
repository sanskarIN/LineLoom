/**
 * Strict JSON decoder for explicitly supplied, bounded private corpus metadata.
 * Native JSON.parse silently keeps the last duplicate object key; in a rights
 * manifest that could overwrite a reviewed=false or a different split.
 *
 * Scan quoted JSON strings and object nesting to reject duplicate decoded
 * names BEFORE native JSON.parse validates the entire document. Keys are
 * compared after JSON escape decoding (e.g. "rightsReviewed" and
 * "rights\\u0052eviewed" are the same key). No source or field values
 * are included in error messages.
 */
export function parseNoDuplicateKeys(source) {
  if (typeof source !== "string" || source.length < 1 ||
      source.length > 1_048_576) throw Error("invalid-json-size");
  const stack = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (char === '"') {
      const start = index++;
      let closed = false;
      while (index < source.length) {
        if (source[index] === "\\") {
          index += 2;
        } else if (source[index] === '"') {
          index++;
          closed = true;
          break;
        } else {
          index++;
        }
      }
      if (!closed) throw Error("invalid-json-string");
      let next = index;
      while (next < source.length && /[ \t\r\n]/.test(source[next])) next++;
      const frame = stack.at(-1);
      if (source[next] === ":" && frame?.kind === "object") {
        // JSON.parse also validates escapes inside the key; never echo them.
        const key = JSON.parse(source.slice(start, index));
        if (frame.keys.has(key)) throw Error("duplicate-json-field");
        frame.keys.add(key);
      }
      continue;
    }
    if (char === "{") stack.push({ kind: "object", keys: new Set() });
    if (char === "[") stack.push({ kind: "array" });
    if (char === "}" || char === "]") {
      const frame = stack.pop();
      if (!frame || frame.kind !== (char === "}" ? "object" : "array")) {
        throw Error("invalid-json-structure");
      }
    }
    index++;
  }
  if (stack.length) throw Error("invalid-json-structure");
  // Defer all remaining grammar, numbers, encodings and trailing-token
  // validation to the runtime's standards-compliant JSON parser.
  return JSON.parse(source);
}
