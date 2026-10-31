/**
 * Deterministic Rust-only prompt hints. Never execute, compile, parse files,
 * traverse imports, read Cargo metadata or quote editor content into hints.
 * The caller already owns an approved bounded context window.
 */
const MAX_SCAN_CHARS = 30_000;
const MAX_HINTS = 4;

type LexicalState = "code" | "line-comment" | "block-comment" |
  "string" | "raw-string";
interface RustScan { code: string; state: LexicalState }

/**
 * Mask comment and literal payloads before looking for Rust constructs.
 * Preserve newlines so the active line can be recognized. Nested
 * block comments and raw strings need their own delimiters; an apostrophe
 * starting a lifetime ('a, 'static) must not be mistaken for a char literal.
 */
export function scanRustCode(source: string): RustScan {
  const text = source.slice(-MAX_SCAN_CHARS);
  const masked: string[] = [];
  let state: LexicalState = "code";
  let blockDepth = 0;
  let rawHashes = "";
  let index = 0;
  const mask = (part: string): void => {
    for (const c of part) masked.push(c === "\n" ? "\n" : " ");
  };
  while (index < text.length) {
    // Read at the cursor without allocating the remaining ~30 KB suffix
    // for every token (particularly expensive on long Rust files).
    const current = text[index];
    if (state === "line-comment") {
      if (current === "\n") {
        masked.push("\n");
        state = "code";
      } else masked.push(" ");
      index++;
      continue;
    }
    if (state === "block-comment") {
      if (text.startsWith("/*", index)) {
        blockDepth++;
        mask("/*");
        index += 2;
      } else if (text.startsWith("*/", index)) {
        blockDepth--;
        mask("*/");
        index += 2;
        if (blockDepth === 0) state = "code";
      } else {
        mask(current);
        index++;
      }
      continue;
    }
    if (state === "raw-string") {
      const end = '"' + rawHashes;
      if (text.startsWith(end, index)) {
        mask(end);
        index += end.length;
        state = "code";
      } else {
        mask(current);
        index++;
      }
      continue;
    }
    if (state === "string") {
      if (current === "\\") {
        mask(text.slice(index, index + 2));
        index += Math.min(2, text.length - index);
        continue;
      }
      mask(current);
      if (current === '"') state = "code";
      index++;
      continue;
    }
    if (text.startsWith("//", index)) {
      mask("//");
      index += 2;
      state = "line-comment";
      continue;
    }
    if (text.startsWith("/*", index)) {
      mask("/*");
      index += 2;
      state = "block-comment";
      blockDepth = 1;
      continue;
    }
    // Recognize ordinary, byte, and C raw strings through Rust's 255-hash
    // delimiter limit; do not treat raw identifiers like r#type as strings.
    // Only inspect at most 255 delimiter chars, not the whole suffix.
    // Keep the previous lexical behavior for r, br and cr prefixes.
    const rawLead = current === "r" ? 1 :
      ((current === "b" || current === "c") && text[index + 1] === "r" ? 2 : 0);
    if (rawLead) {
      let quote = index + rawLead;
      let hashes = 0;
      while (hashes < 255 && text[quote] === "#") { hashes++; quote++; }
      if (text[quote] === '"') {
        rawHashes = text.slice(index + rawLead, quote);
        mask(text.slice(index, quote + 1));
        index = quote + 1;
        state = "raw-string";
        continue;
      }
    }
    if (current === '"' || ((current === "b" || current === "c") && text[index + 1] === '"')) {
      const opening = current === '"' ? '"' : current + '"';
      mask(opening);
      index += opening.length;
      state = "string";
      continue;
    }
    // Complete Rust char or byte-char tokens are masked; lifetimes are not.
    const character = /^(?:b)?'(?:\\.|[^'\\\n])'/u.exec(text.slice(index, index + 5));
    if (character && character[0]) {
      mask(character[0]);
      index += character[0].length;
      continue;
    }
    masked.push(current);
    index++;
  }
  return { code: masked.join(""), state };
}

const HINTS = {
  match: "Rust match arms: preserve pattern bindings and guards; use =>, comma separators and existing braces correctly.",
  patterns: "Rust if let/while let/let-else: preserve destructuring bindings and ownership; let-else fallback must diverge.",
  results: "Rust Result/Option: respect return types and use ? only when error/absence propagation is type-compatible; do not invent unwraps.",
  async: "Rust async code: preserve Future and .await placement, AsyncFn bounds, closure captures, Send constraints and borrowing across suspension points.",
  preciseCapture: "Rust impl Trait use<...> capture bounds: preserve lifetime-first ordering, all in-scope type/const generics and explicit capture requirements.",
  traits: "Rust traits and impl blocks: respect associated types, self receivers, trait method signatures and existing where bounds.",
  ffi: "Rust unsafe/FFI: preserve ABI signatures, pointer validity and safety invariants; do not invent unnecessary unsafe blocks.",
  borrow: "Rust ownership: preserve lifetimes, mutability and borrowed/owned values; avoid unnecessary clones or moves.",
  iter: "Rust iterators and closures: preserve item/reference types, closure captures, iterator adapters and collection targets.",
  macro: "Rust macros: preserve macro_rules! or invocation delimiter structure and Rust token-tree syntax.",
  generics: "Rust generics: preserve type parameters, lifetimes, trait bounds and where clauses without guessing missing types.",
  constants: "Rust const contexts: respect const-evaluation rules, const generics and associated constants; avoid runtime-only operations."
} as const;

/** Fixed instructions only; never interpolate source, paths, identifiers or comments. */
export function rustContextHints(prefix: string): string[] {
  const scan = scanRustCode(prefix);
  if (scan.state === "line-comment" || scan.state === "block-comment") {
    return ["Cursor is inside a Rust comment: continue only comment text, not executable statements."];
  }
  if (scan.state === "string" || scan.state === "raw-string") {
    return ["Cursor is inside a Rust string literal: continue its content without inventing extra closing delimiters."];
  }
  const code = scan.code.slice(-2200);
  const hints: string[] = [];
  const add = (matched: boolean, hint: string): void => {
    if (matched && hints.length < MAX_HINTS) hints.push(hint);
  };
  // Prioritize local completion patterns. Inspect only code tokens, never
  // quoted string or nested comment payloads.
  add(/\bmatch\b[\s\S]{0,650}\{|=>|\b(?:Some|None|Ok|Err)\s*\(/u.test(code.slice(-700)), HINTS.match);
  add(/\b(?:if|while)\s+let\b|\blet\s+[^\n;]{1,180}\s+else\s*\{/u.test(code.slice(-900)), HINTS.patterns);
  // Rust return-position impl Trait can restrict captured generics with
  // use<...>. This is not a normal use import: only the precise-capture
  // bound has an angle bracket following the keyword.
  add(/\buse\s*<\s*(?:'[A-Za-z_]\w*|[A-Za-z_]\w*)/u.test(code.slice(-900)), HINTS.preciseCapture);
  add(/\b(?:Result|Option)\s*</u.test(code) || /\b(?:Ok|Err|Some|None)\s*\(/u.test(code.slice(-600)) ||
      /\?\s*;?\s*$/u.test(code), HINTS.results);
  // async closures use `async |args|` and `async move |args|`; they are
  // distinct from async fn/blocks. AsyncFn* bounds may also appear without
  // an explicit async keyword at the cursor.
  add(/\basync\s+(?:move\s+)?(?:fn\b|\{|\|)|\basync\s+move\b|\.await\b|\b(?:Future|AsyncFn|AsyncFnMut|AsyncFnOnce)\b/u.test(code), HINTS.async);
  add(/\b(?:trait\s+[A-Za-z_]|impl(?:\s*<|\s+[A-Za-z_]|\s*\{|\s*'|\s*&))|\b(?:Self|self)\s*\./u.test(code), HINTS.traits);
  add(/\bunsafe\s*(?:fn|trait|impl|\{)|\bextern\s+(?:fn|\{)|\brepr\s*\(\s*C\s*\)/u.test(code), HINTS.ffi);
  add(/(?:&\s*(?:'\w+\s*)?mut\b|&'\w+\b|\b(?:ref\s+mut|move\s*\|)\b)/u.test(code), HINTS.borrow);
  add(/\.(?:iter|iter_mut|into_iter|map|filter|collect|fold|enumerate|flat_map)\s*(?:\(|::<)|\bmove\s*\|/u.test(code), HINTS.iter);
  add(/\bmacro_rules\s*!|\b[A-Za-z_]\w*!\s*[([{]/u.test(code), HINTS.macro);
  add(/\bwhere\b|\bfn\s+\w+\s*<|\bimpl\s*<|\b(?:dyn|impl)\s+[A-Z]\w*/u.test(code), HINTS.generics);
  add(/\bconst\s+fn\b|\bconst\s+[A-Za-z_]\w*\s*[:=]|[<,]\s*const\s+[A-Za-z_]\w*\s*:/u.test(code), HINTS.constants);
  return hints;
}
