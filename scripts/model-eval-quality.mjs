/**
 * Source-free quality indicators for original synthetic model completions.
 * No raw model output is written to benchmark summaries or logs.
 * These are heuristics, not a proof of correctness or harmlessness.
 */
import { inspectNativeGeneratedStructure } from "./model-eval-native-structure.mjs";

export const FORMAT_SIGNAL_NAMES = Object.freeze([
  "empty", "markdownFence", "chatPreamble", "specialToken",
  "unsafeUnicode", "prefixEcho", "suffixEcho", "nativeDelimiterMismatch"
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
        cp === 0xfeff || (cp >= 0xd800 && cp <= 0xdfff)) return true;
  }
  return false;
}
export function classifyCompletionFormat(raw, fixture, insertion = raw) {
  const generated = raw.replace(/\r\n?/g, "\n");
  const prefix = fixture.prefix.replace(/\r\n?/g, "\n");
  const suffix = fixture.suffix.replace(/\r\n?/g, "\n");
  const flags = new Set();
  if (!generated.trim()) flags.add("empty");
  if (/(?:^|\n)\s*\x60{3}/.test(generated)) flags.add("markdownFence");
  if (/^\s*(?:Certainly\b|Sure[,! ]|As an AI\b|Here(?:'s| is) (?:the )?code\b|Completion:)/i.test(generated)) flags.add("chatPreamble");
  if (/<\|(?:fim_prefix|fim_middle|fim_suffix|endoftext|im_start|im_end)\|>/.test(generated)) flags.add("specialToken");
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
  if (inspectNativeGeneratedStructure(fixture, insertion) === "mismatch") {
    flags.add("nativeDelimiterMismatch");
  }
  return FORMAT_SIGNAL_NAMES.filter(name => flags.has(name));
}
