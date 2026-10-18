import { createHash } from "node:crypto";

/** Only hashes of surrounding code are retained, plus the already-generated suggestion. */
export interface ContinuationPoint {
  documentId: string;
  languageId: string;
  version: number;
  offset: number;
  prefix: string;
  suffix: string;
  profileDigest: string;
}
interface Stored {
  documentId: string;
  languageId: string;
  version: number;
  offset: number;
  prefixDigest: string;
  suffixDigest: string;
  profileDigest: string;
  suggestion: string;
  expires: number;
}
function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Reuse the untyped remainder only after one simple forward edit.
 * All original surrounding text must match; short or shifted context windows
 * merely miss the optimization rather than guessing or sending more code.
 */
export class ContinuationCache {
  private entry: Stored | undefined;
  constructor(private readonly ttlMs = 12_000, private readonly maxTyped = 32) {}

  remember(point: ContinuationPoint, suggestion: string, now = Date.now()): void {
    if (!suggestion || suggestion.length > 6_000) {
      this.entry = undefined;
      return;
    }
    this.entry = {
      documentId: point.documentId, languageId: point.languageId,
      version: point.version, offset: point.offset,
      prefixDigest: digest(point.prefix), suffixDigest: digest(point.suffix),
      profileDigest: point.profileDigest, suggestion, expires: now + this.ttlMs
    };
  }

  remainder(point: ContinuationPoint, now = Date.now()): string | undefined {
    const saved = this.entry;
    if (!saved) return;
    if (saved.expires <= now) {
      this.clear();
      return;
    }
    if (saved.documentId !== point.documentId || saved.languageId !== point.languageId ||
        saved.profileDigest !== point.profileDigest || point.version !== saved.version + 1 ||
        digest(point.suffix) !== saved.suffixDigest) return;
    const typed = point.offset - saved.offset;
    if (typed < 1 || typed > this.maxTyped || typed >= saved.suggestion.length) return;
    if (!point.prefix.endsWith(saved.suggestion.slice(0, typed))) return;
    if (digest(point.prefix.slice(0, -typed)) !== saved.prefixDigest) return;
    return saved.suggestion.slice(typed);
  }

  /**
   * VS Code reports the actual edit shape, not merely the resulting text.
   * A continuation is reusable only after one forward insertion at the
   * original cursor, with exactly the expected generated characters.
   * Do not retain the source edit text after this synchronous check.
   */
  invalidateOnEdit(
    documentId: string,
    version: number,
    changes: readonly { rangeOffset: number; rangeLength: number; text: string }[]
  ): void {
    const saved = this.entry;
    if (!saved || saved.documentId !== documentId) return;
    // VS Code also emits metadata-only events (such as a dirty-state update)
    // after a real edit. They do not represent additional source mutations.
    if (changes.length === 0) return;
    const edit = changes[0];
    if (version !== saved.version + 1 || changes.length !== 1 || !edit ||
        edit.rangeOffset !== saved.offset || edit.rangeLength !== 0 ||
        edit.text.length < 1 || edit.text.length > this.maxTyped ||
        edit.text.length >= saved.suggestion.length ||
        !saved.suggestion.startsWith(edit.text)) {
      this.clear();
    }
  }

  clear(): void { this.entry = undefined; }
}
