# Unicode-safe inline insertion — manual QA

**Status: planned physical-editor QA, NOT RUN.** These scenarios complement
the automated TypeScript tests. Do not mark them passed until independently
observed in a real VS Code window with an explicitly configured local model.

## Purpose

VS Code uses UTF-16 columns for its editor positions. A caret can be
programmatically positioned between the high and low surrogate of a valid
non-BMP Unicode character. Inserting an AI suggestion there can corrupt the
character, even when the prompt context sanitizes split surrogates.

LineLoom now suppresses **both manual and automatic** completion requests
at these positions. Ordinary positions before/after a full emoji or non-BMP
identifier remain eligible subject to the existing privacy, model, cursor
and trigger rules.

## Local verification matrix

1. Open an untracked, non-sensitive test file with a line such as
   `const rocket = "🚀";` and an identifier such as `𐐀name`.
2. Verify ordinary cursor positions immediately before and after each
   complete non-BMP character remain usable with the chosen local model.
3. Place a cursor *between the two UTF-16 units* by an editor automation
   or test harness, not by assuming a physical arrow key can create that
   position. Trigger LineLoom manually, then automatically. No LineLoom
   completion should be inserted or generated there.
4. Try model output starting with `𐐀a𐐁()` when the preceding prefix
   contains `𐐀a`. Confirm that the completion cleaner does not
   mistake the next Deseret letter for punctuation and cut a partial
   identifier. Repeat around a trailing suffix overlap.
5. Type only the **complete** astral character at the start of a previously
   shown synthetic suggestion (e.g. `🚀launch()`). Verify the inline
   continuation offers only `launch()` and does not request fresh
   model output when the cached context is otherwise unchanged.
6. Through an editor test harness, insert only the **high surrogate**
   of an astral character from a cached suggestion. The continuation
   must not display its isolated low surrogate or a malformed ghost
   fragment. Repeat with an edit of several ordinary letters followed
   by a high surrogate; the cache must reject it.
7. For a synthetic `42` suggestion, type `4` with an actual one-character
   insertion at the original cursor and confirm the cached `2` is reused.
   Then simulate the same text and document-version snapshot **without**
   delivering a VS Code text-change insertion event. The cache must refuse
   reuse. A replacement event, multi-edit change, or matching edit in
   another document must not authorize continuation either.
8. Repeat in Rust, C, C++, Python, and TypeScript; check that the original
   Unicode characters remain byte-for-byte intact after any accepted edit.

## Evidence to record

Record OS, VS Code version, chosen local Ollama model, prompt mode, example
language, privacy/consent settings and whether each scenario passed.
Use invented example code; **do not attach real editor buffers, prompts,
remote endpoint credentials, or generated completions from private projects**.

The tests in `test/unit/trigger.test.ts`, `test/unit/filter.test.ts`
and `test/unit/continuation.test.ts` cover deterministic boundary math,
including typed-continuation UTF-16 integrity and malformed cached suggestions. Cross-platform CI and mocked extension
host checks do not constitute physical editor/model QA. A first-party
trained LineLoom Code model is not supplied by this change.
