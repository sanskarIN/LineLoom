/**
 * Deterministic, no-subprocess delimiter heuristic for GENERATED native-language
 * continuations in the fixed public synthetic FIM evaluation. Not a parser,
 * compiler, safety check or type-checker; 'clean' is NOT syntax validity.
 */
const LANGUAGES = new Set(["rust", "c", "cpp"]);
const MAX_CHARS = 16_384;
const MATCH = Object.freeze({ ")": "(", "]": "[", "}": "{" });
const OPEN = new Set(["(", "[", "{"]);
const NAME = /[A-Za-z0-9_]/;

function isName(ch) { return ch !== undefined && NAME.test(ch); }

function readQuoted(text, start, quote) {
  for (let p = start + 1; p < text.length; p++) {
    if (text[p] === "\\") { p++; continue; }
    if (text[p] === quote) return p + 1;
    if (text[p] === "\n") return -1;
  }
  return -1;
}

function readRustRaw(text, start) {
  let pos = start;
  // Rust raw strings: r"...", r#"..."#, br#"..."#, cr#"..."#.
  if (text[pos] === "b" || text[pos] === "c") pos++;
  if (text[pos] !== "r" || isName(text[start - 1])) return null;
  pos++;
  let hashes = 0;
  while (text[pos] === "#") {
    hashes++;
    if (hashes > 255) return "unchecked";
    pos++;
  }
  if (text[pos] !== '"') return null; // r#identifier is not a string.
  const delimiter = '"' + "#".repeat(hashes);
  const end = text.indexOf(delimiter, pos + 1);
  return end < 0 ? -1 : end + delimiter.length;
}

function readCppRaw(text, start) {
  if (!text.startsWith('R"', start)) return null;
  const open = text.indexOf("(", start + 2);
  if (open < 0 || open - start > 18) return "unchecked";
  const tag = text.slice(start + 2, open);
  if (/[\s()\\]/.test(tag) || tag.length > 16) return "unchecked";
  const close = ")" + tag + '"';
  const end = text.indexOf(close, open + 1);
  return end < 0 ? -1 : end + close.length;
}

function rustLifetime(text, index) {
  if (!/[A-Za-z_]/.test(text[index + 1] ?? "")) return false;
  let end = index + 2;
  while (isName(text[end])) end++;
  return text[end] !== "'";
}

export function inspectNativeGeneratedStructure(fixture, insertion) {
  if (!fixture || !LANGUAGES.has(fixture.language) ||
      typeof fixture.prefix !== "string" || typeof fixture.suffix !== "string" ||
      typeof insertion !== "string") return "unchecked";
  const text = fixture.prefix + insertion + fixture.suffix;
  if (text.length > MAX_CHARS || text.includes("\0")) return "unchecked";
  const language = fixture.language;
  const stack = [];
  for (let i = 0; i < text.length;) {
    const ch = text[i];
    if (ch === "/" && text[i + 1] === "/") {
      const end = text.indexOf("\n", i + 2);
      i = end < 0 ? text.length : end + 1;
      continue;
    }
    if (ch === "/" && text[i + 1] === "*") {
      let level = 1;
      i += 2;
      while (i < text.length && level) {
        if (text.startsWith("/*", i) && language === "rust") { level++; i += 2; }
        else if (text.startsWith("*/", i)) { level--; i += 2; }
        else i++;
      }
      if (level) return "mismatch";
      continue;
    }
    // Other preprocessor directives can intentionally have unmatched tokens.
    if (ch === "#" && language !== "rust" &&
        (text.slice(text.lastIndexOf("\n", i - 1) + 1, i).trim().length === 0)) {
      const directive = text.slice(i).match(/^#\s*(\w+)/)?.[1];
      if (directive && directive !== "include") return "unchecked";
    }
    let raw = null;
    if (language === "rust" && (ch === "r" || ch === "b" || ch === "c")) {
      raw = readRustRaw(text, i);
    } else if (language === "cpp" && ch === "R") raw = readCppRaw(text, i);
    if (raw === "unchecked") return "unchecked";
    if (raw === -1) return "mismatch";
    if (typeof raw === "number") { i = raw; continue; }
    if (ch === '"' || (ch === "'" && !(language === "rust" && rustLifetime(text, i)))) {
      const end = readQuoted(text, i, ch);
      if (end < 0) return "mismatch";
      i = end;
      continue;
    }
    if (OPEN.has(ch)) stack.push(ch);
    else if (Object.hasOwn(MATCH, ch)) {
      if (stack.pop() !== MATCH[ch]) return "mismatch";
    }
    i++;
  }
  return stack.length ? "mismatch" : "clean";
}
