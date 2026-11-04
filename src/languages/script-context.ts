/**
 * Small deterministic lexical hints for local instruction-mode models.
 * No source snippets, identifiers or paths are interpolated into hints.
 * This does not parse or type-check code.
 */
export type ScriptLanguage = "python" | "javascript" | "typescript";
export type ScriptState = "code" | "comment" | "block-comment" | "single" |
  "double" | "triple-single" | "triple-double" | "template" | "regex";
export interface ScriptScan { code: string; state: ScriptState }

const PY = {
  comment: "Python comment at cursor: continue only comment text, not executable statements.",
  literal: "Python literal at cursor: preserve literal content and quote delimiters.",
  async: "Python async code: preserve await placement, coroutine returns and async context-manager semantics.",
  types: "Python typing: preserve annotations, generic collections and existing Protocol contracts.",
  errors: "Python exceptions: preserve try/except/else/finally and error propagation.",
  context: "Python with statements: preserve context-manager cleanup and as bindings.",
  patterns: "Python match/case: preserve pattern guards, bindings and indentation.",
  decorators: "Python decorators: preserve the original callable signature and decoration order."
} as const;
const JS = {
  comment: "JavaScript/TypeScript comment at cursor: continue only comment text.",
  literal: "JavaScript/TypeScript literal at cursor: preserve the existing delimiter and escaping.",
  modules: "JavaScript/TypeScript modules: preserve import/export style and existing symbols.",
  async: "JavaScript/TypeScript async code: preserve await placement, Promise contracts and error propagation.",
  functions: "JavaScript/TypeScript functions: preserve parameters, arrow syntax, closures and return contracts.",
  errors: "JavaScript/TypeScript exceptions: preserve try/catch/finally scope.",
  types: "TypeScript declarations: preserve interfaces, generics, narrowing and readonly/satisfies constraints.",
  nullish: "JavaScript/TypeScript nullish expressions: preserve optional chaining and nullish-coalescing intent."
} as const;

function regexCanStart(output: readonly string[]): boolean {
  let end = output.length;
  while (end && /\s/u.test(output[end - 1])) end--;
  if (end === 0) return true;
  const last = output[end - 1];
  // A slash following a binary/unary expression operator can begin a regex,
  // including single |, &, ^, *, /, + and -. Without masking that operand,
  // its contents may be mistaken for executable async/type declarations.
  if (/[=([{,:;!?|&^~*%\/]/u.test(last)) return true;
  if (last === "+" || last === "-") {
    // Postfix increment/decrement are completed operands, so a following
    // slash is division rather than the start of a regex literal.
    if (end > 1 && output[end - 2] === last) return false;
    return true;
  }
  // These operators expect a fresh expression. Inspect only a tiny portion
  // of already-scanned source, never expose or interpolate user identifiers.
  const operator = output.slice(Math.max(0, end - 2), end).join("");
  if (operator === "=>" || operator === "||" || operator === "&&") return true;
  const tail = output.slice(Math.max(0, end - 32), end).join("");
  const keyword = /\b(?:return|throw|case|yield|await)\s*$/u.exec(tail);
  if (!keyword) return false;
  // obj.return / denominator and obj.await / denominator are division:
  // property names that resemble keywords must not start regex mode.
  return !tail.slice(0, keyword.index).trimEnd().endsWith(".");
}

/** Bounded scanner: mask template text but inspect executable JS/TS interpolations. */
export function scanScriptCode(source: string, language: ScriptLanguage): ScriptScan {
  const text = source.slice(-30_000);
  const python = language === "python";
  const output: string[] = [];
  let state: ScriptState = "code";
  let charClass = false;
  // Each template has its own interpolation brace depth. A nested template
  // inside ${...} must not close the outer interpolation, and braces in
  // strings/comments/regexes must not affect its depth.
  const templates: Array<{ interpolationDepth: number }> = [];
  let i = 0;
  const mask = (part: string): void => {
    for (const c of part) output.push(c === "\n" ? "\n" : " ");
  };
  while (i < text.length) {
    const c = text[i];
    if (state === "comment") {
      if (c === "\n") { output.push("\n"); state = "code"; }
      else output.push(" ");
      i++;
      continue;
    }
    if (state === "block-comment") {
      if (text.startsWith("*/", i)) { mask("*/"); i += 2; state = "code"; }
      else { mask(c); i++; }
      continue;
    }
    if (state === "triple-single" || state === "triple-double") {
      const delimiter = state === "triple-single" ? "'''" : '"""';
      if (text.startsWith(delimiter, i)) { mask(delimiter); i += 3; state = "code"; }
      else if (c === "\\" && i + 1 < text.length) { mask(text.slice(i, i + 2)); i += 2; }
      else { mask(c); i++; }
      continue;
    }
    if (state === "template") {
      if (c === "\\" && i + 1 < text.length) {
        mask(text.slice(i, i + 2));
        i += 2;
      } else if (text.startsWith("${", i)) {
        // Template data stays masked; executable interpolation is scanned
        // normally until its matching unquoted closing brace.
        mask("${");
        templates[templates.length - 1].interpolationDepth = 1;
        state = "code";
        i += 2;
      } else if (c === String.fromCharCode(96)) {
        mask(c);
        templates.pop();
        state = "code";
        i++;
      } else {
        mask(c);
        i++;
      }
      continue;
    }
    if (state !== "code") {
      if (c === "\\" && i + 1 < text.length) {
        mask(text.slice(i, i + 2));
        i += 2;
        continue;
      }
      if (state === "regex") {
        if (c === "[") charClass = true;
        if (c === "]") charClass = false;
        if (c === "/" && !charClass) state = "code";
      } else if (c === (state === "single" ? "'" : '"')) {
        state = "code";
      } else if (python && c === "\n" && (state === "single" || state === "double")) {
        state = "code";
      }
      mask(c);
      i++;
      continue;
    }
    if (python && c === "#") { mask(c); state = "comment"; i++; continue; }
    if (!python && text.startsWith("//", i)) { mask("//"); state = "comment"; i += 2; continue; }
    if (!python && text.startsWith("/*", i)) { mask("/*"); state = "block-comment"; i += 2; continue; }
    if (python && (text.startsWith("'''", i) || text.startsWith('"""', i))) {
      state = c === "'" ? "triple-single" : "triple-double";
      mask(text.slice(i, i + 3));
      i += 3;
      continue;
    }
    if (c === "'" || c === '"') {
      state = c === "'" ? "single" : "double";
      mask(c);
      i++;
      continue;
    }
    if (!python && c === String.fromCharCode(96)) {
      templates.push({ interpolationDepth: 0 });
      state = "template";
      mask(c);
      i++;
      continue;
    }
    if (!python && c === "/" && regexCanStart(output)) {
      state = "regex";
      charClass = false;
      mask(c);
      i++;
      continue;
    }
    // Only the current innermost template frame receives braces from
    // executable interpolation. Other braces and all literals are untouched.
    const frame = templates[templates.length - 1];
    if (frame && frame.interpolationDepth > 0) {
      if (c === "{") frame.interpolationDepth++;
      if (c === "}") {
        frame.interpolationDepth--;
        if (frame.interpolationDepth === 0) {
          mask(c);
          state = "template";
          i++;
          continue;
        }
      }
    }
    output.push(c);
    i++;
  }
  return { code: output.join(""), state };
}

/** Only fixed allowlisted hints, with a strict four-hint maximum. */
export function scriptContextHints(prefix: string, language: ScriptLanguage): string[] {
  const scan = scanScriptCode(prefix, language);
  if (scan.state === "comment" || scan.state === "block-comment")
    return [language === "python" ? PY.comment : JS.comment];
  if (scan.state !== "code") return [language === "python" ? PY.literal : JS.literal];
  const code = scan.code.slice(-1_800);
  const hints: string[] = [];
  const add = (yes: boolean, hint: string): void => {
    if (yes && hints.length < 4) hints.push(hint);
  };
  if (language === "python") {
    add(/\b(?:async\s+(?:def|with|for)\b|await\s+[A-Za-z_(])/u.test(code), PY.async);
    add(/\b(?:Protocol|TypeVar|TypedDict|Optional|Annotated|Self)\b/u.test(code) ||
      /\bdef\s+[A-Za-z_]\w*\s*\([^)\n]{0,180}\)\s*->/u.test(code) ||
      /\b(?:list|dict|tuple|set)\s*\[/u.test(code), PY.types);
    add(/\b(?:try|except|finally|raise)\b/u.test(code), PY.errors);
    add(/\b(?:with|async\s+with)\s+[A-Za-z_(]/u.test(code), PY.context);
    add(/(?:^|\n)\s*(?:match|case)\s+[^\n]{1,160}/u.test(code), PY.patterns);
    add(/(?:^|\n)\s*@[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*/u.test(code), PY.decorators);
    return hints;
  }
  add(/(?:^|\n)\s*(?:import|export)\s/u.test(code) || /\brequire\s*\(\s*$/u.test(code), JS.modules);
  add(/\b(?:async\s+(?:function\b|[A-Za-z_]\w*\s*\(|\([^)\n]{0,120}\)\s*=>)|await\s+[A-Za-z_(]|Promise\.(?:all|race|resolve|reject)\s*\()/u.test(code), JS.async);
  add(/=>|\bfunction\s*[A-Za-z_]*\s*\(/u.test(code), JS.functions);
  add(/\b(?:try|catch|finally|throw)\b/u.test(code), JS.errors);
  if (language === "typescript")
    add(/\b(?:interface|type|enum)\s+[A-Za-z_]\w*|\b(?:satisfies|readonly|keyof|infer)\b/u.test(code), JS.types);
  add(/\?\.|\?\?/u.test(code), JS.nullish);
  return hints;
}
