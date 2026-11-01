/**
 * Bounded, deterministic C/C++ hint extraction for instruction-mode models.
 * No files are opened, no code is executed and no source tokens enter hints.
 * Comments, quoted literals, and C++ raw strings are masked before matching.
 */
const MAX_SCAN_CHARS = 30_000;
const MAX_HINTS = 4;
export type NativeLanguage = "c" | "cpp";
export type NativeScanState = "code" | "line-comment" | "block-comment" |
  "string" | "char" | "raw-string";
export interface NativeScan { code: string; state: NativeScanState }

const HINTS = {
  comment: "Cursor is inside a C/C++ comment: continue only comment text, not executable statements.",
  string: "Cursor is inside a C/C++ literal: continue literal content without inventing extra closing delimiters.",
  preprocessor: "C/C++ preprocessing: preserve directive syntax, macro parameter boundaries and conditional compilation balance.",
  cPointers: "C pointers and allocation: preserve pointer types, null/error handling, ownership contracts and allocation sizes; do not invent unsafe dereferences.",
  cTypes: "C declarations: preserve struct/union/enum layout, typedef names, storage duration and existing API signatures.",
  cCallbacks: "C callbacks: preserve function-pointer parameter and return types and caller-owned context.",
  cppTypes: "C++ templates and constraints: preserve deduced types, visible template arguments, concepts and requires clauses.",
  cppLifetime: "C++ resource lifetime: preserve RAII, move/copy ownership and smart-pointer semantics; avoid unnecessary raw owning pointers.",
  cppLambda: "C++ lambdas: preserve capture mode, mutable state, parameter and return types and reference lifetimes.",
  cppConst: "C++ constexpr and exception specifications: preserve compile-time constraints, noexcept contracts and existing signatures.",
  cppCoroutine: "C++ coroutines: preserve co_await/co_return/co_yield placement and compatible coroutine return types."
} as const;

const RAW_OPEN = /^(?:u8|u|U|L)?R"([^\s()\\]{0,16})\(/u;

/**
 * C/C++ line splicing precedes comment and string recognition; do not
 * classify code on the next physical line as active after a continued //.
 * A slice can start inside a preexisting literal/comment in a larger file:
 * this remains a bounded best-effort heuristic, never a parser.
 */
export function scanNativeCode(source: string, language: NativeLanguage): NativeScan {
  const original = source.slice(-MAX_SCAN_CHARS);
  const text = original.replace(/\\\r?\n/gu, "");
  const output: string[] = [];
  let state: NativeScanState = "code";
  let index = 0;
  const mask = (value: string): void => {
    for (const char of value) output.push(char === "\n" ? "\n" : " ");
  };
  while (index < text.length) {
    const char = text[index];
    if (state === "line-comment") {
      if (char === "\n") {
        output.push("\n");
        state = "code";
      } else output.push(" ");
      index++;
      continue;
    }
    if (state === "block-comment") {
      if (text.startsWith("*/", index)) {
        mask("*/");
        index += 2;
        state = "code";
      } else {
        mask(char);
        index++;
      }
      continue;
    }
    if (state === "string" || state === "char") {
      if (char === "\\") {
        mask(text.slice(index, index + 2));
        index += Math.min(2, text.length - index);
        continue;
      }
      mask(char);
      if (char === (state === "string" ? '"' : "'")) state = "code";
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
      continue;
    }
    // C++ raw strings may contain both quote/comment tokens and newlines.
    // Restrict opening delimiters to the standard 16-character bound.
    if (language === "cpp" && /[uURL]/u.test(char) &&
        (index === 0 || !/[A-Za-z0-9_]/u.test(text[index - 1]))) {
      const opening = RAW_OPEN.exec(text.slice(index, index + 40));
      if (opening) {
        const endDelimiter = ")" + opening[1] + '"';
        const end = text.indexOf(endDelimiter, index + opening[0].length);
        if (end === -1) {
          mask(text.slice(index));
          state = "raw-string";
          index = text.length;
        } else {
          mask(text.slice(index, end + endDelimiter.length));
          index = end + endDelimiter.length;
        }
        continue;
      }
    }
    if (char === '"' || char === "'") {
      mask(char);
      state = char === '"' ? "string" : "char";
      index++;
      continue;
    }
    output.push(char);
    index++;
  }
  return { code: output.join(""), state };
}

/** Fixed guidance only. Never embed user source, names, paths, or literals. */
export function nativeContextHints(prefix: string, language: NativeLanguage): string[] {
  const scan = scanNativeCode(prefix, language);
  if (scan.state === "line-comment" || scan.state === "block-comment") return [HINTS.comment];
  if (scan.state !== "code") return [HINTS.string];
  const code = scan.code.slice(-2_200);
  const local = code.slice(-1_000);
  const hints: string[] = [];
  const add = (condition: boolean, hint: string): void => {
    if (condition && hints.length < MAX_HINTS) hints.push(hint);
  };
  add(/^\s*#\s*(?:define|if|ifdef|ifndef|elif|else|endif|include|pragma)\b/mu.test(local),
    HINTS.preprocessor);
  if (language === "c") {
    add(/\b(?:malloc|calloc|realloc|free)\s*\(|->|\b(?:NULL|nullptr)\b/u.test(local),
      HINTS.cPointers);
    add(/\b(?:struct|union|enum|typedef|_Atomic)\b/u.test(local), HINTS.cTypes);
    add(/\(\s*\*\s*[A-Za-z_]\w*\s*\)\s*\(/u.test(local), HINTS.cCallbacks);
    return hints;
  }
  add(/\btemplate\s*<|\brequires\b|\bconcept\s+[A-Za-z_]\w*|\btypename\b/u.test(local),
    HINTS.cppTypes);
  add(/\bstd::(?:unique_ptr|shared_ptr|weak_ptr|make_unique|make_shared|move|forward)\b/u.test(local) ||
      /\b(?:class|struct)\s+[A-Za-z_]\w*\s*(?:final\s*)?(?::[^{]{0,120})?\{/u.test(local),
    HINTS.cppLifetime);
  add(/\[[^\]\n]{0,80}\]\s*(?:\([^)\n]{0,120}\)\s*)?(?:mutable\b|noexcept\b|->|\{)/u.test(local),
    HINTS.cppLambda);
  add(/\b(?:constexpr|consteval|constinit|noexcept)\b/u.test(local), HINTS.cppConst);
  add(/\b(?:co_await|co_return|co_yield)\b/u.test(local), HINTS.cppCoroutine);
  return hints;
}
