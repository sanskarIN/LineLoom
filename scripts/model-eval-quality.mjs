/**
 * Source-free quality indicators for original synthetic model completions.
 * No raw model output is written to benchmark summaries or logs.
 * These are heuristics, not a proof of correctness or harmlessness.
 */
import { inspectNativeGeneratedStructure } from "./model-eval-native-structure.mjs";

export const FORMAT_SIGNAL_NAMES = Object.freeze([
  "empty", "markdownFence", "chatPreamble", "specialToken",
  "reasoningEnvelope", "unsafeUnicode", "prefixEcho", "suffixEcho", "nativeDelimiterMismatch"
]);
function unsafeUnicode(value) {
  for (const character of value) {
    const cp = character.codePointAt(0);
    if ((cp <= 31 && cp !== 9 && cp !== 10 && cp !== 13) ||
        (cp >= 127 && cp <= 159) || cp === 0x00ad ||
        cp === 0x061c || cp === 0x180e || cp === 0x200b ||
        cp === 0x200e || cp === 0x200f ||
        (cp >= 0x2028 && cp <= 0x202e) ||
        (cp >= 0x2060 && cp <= 0x206f) ||
        cp === 0xfeff || (cp >= 0xd800 && cp <= 0xdfff) ||
        // Match the editor completion filter: supplementary tag characters
        // U+E0000–U+E007F are invisible and cannot be inserted as ghost text.
        (cp >= 0xe0000 && cp <= 0xe007f)) return true;
  }
  return false;
}
/**
 * Detect a model-origin reasoning preamble without reading or exposing its
 * content. Recognized chat/FIM framing may appear in either order. Only a
 * leading, line-bounded <think> marker qualifies; marker text inside source
 * string literals or later code remains unclassified.
 *
 * Both complete and truncated opening reasoning sections are a quality
 * signal. This is a metric only: editor insertion sanitization remains in
 * src/completion/filter.ts, and strict exact-match scoring stays unchanged.
 */
function startsWithReasoningEnvelope(value) {
  let remaining = value;
  // The model may nest recognized chat and FIM openers; bound unwrapping.
  for (let depth = 0; depth < 8; depth++) {
    if (/^<think>(?:\n|$)/u.test(remaining)) return true;
    const fim = /^<\|(?:fim_prefix|fim_middle)\|>/u.exec(remaining);
    if (fim) { remaining = remaining.slice(fim[0].length); continue; }
    const chat = /^<\|im_start\|>assistant[^\n]*\n/u.exec(remaining);
    if (chat) { remaining = remaining.slice(chat[0].length); continue; }
    break;
  }
  return /^<think>(?:\n|$)/u.test(remaining);
}

export function classifyCompletionFormat(
  raw, fixture, insertion = raw,
  nativeStructureOutcome = inspectNativeGeneratedStructure(fixture, insertion)
) {
  const generated = raw.replace(/\r\n?/g, "\n");
  const prefix = fixture.prefix.replace(/\r\n?/g, "\n");
  const suffix = fixture.suffix.replace(/\r\n?/g, "\n");
  const flags = new Set();
  if (!generated.trim()) flags.add("empty");
  if (/(?:^|\n)\s*\x60{3}/.test(generated)) flags.add("markdownFence");
  if (/^\s*(?:Certainly\b|Sure[,! ]|As an AI\b|Here(?:'s| is) (?:the )?code\b|Completion:)/i.test(generated)) flags.add("chatPreamble");
  if (/<\|(?:fim_prefix|fim_middle|fim_suffix|endoftext|im_start|im_end)\|>/.test(generated)) flags.add("specialToken");
  if (startsWithReasoningEnvelope(generated)) flags.add("reasoningEnvelope");
  if (unsafeUnicode(generated)) flags.add("unsafeUnicode");
  const limit = Math.min(160, prefix.length, generated.length);
  for (let n = limit; n >= 12; n--) {
    if (generated.startsWith(prefix.slice(-n)) && prefix.slice(-n).trim()) {
      flags.add("prefixEcho");
      break;
    }
  }
  const followingCode = suffix.trim();
  if (followingCode.length >= 12 && generated.includes(followingCode.slice(0, 80))) {
    flags.add("suffixEcho");
  }
  // Structural warnings are separate from grammar/compile correctness. An
  // unchecked lexer path does not count as a failure or a syntax pass.
  if (nativeStructureOutcome === "mismatch") {
    flags.add("nativeDelimiterMismatch");
  }
  return FORMAT_SIGNAL_NAMES.filter(name => flags.has(name));
}
