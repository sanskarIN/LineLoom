# Rust context-aware autocomplete — manual QA

**Physical-editor and real Ollama QA: NOT RUN.** This checklist documents
new development-source behavior; green unit and mocked VS Code-host checks
are not proof of real-model usefulness, compilation or Rust type correctness.

## Scope

Rust is already a default-enabled VS Code language. For a **generic installed
local model** (one not recognized as native suffix-aware FIM), LineLoom now
appends up to four fixed Rust-context instructions after the ordinary language
guidance. The instructions are selected locally from the **existing approved,
bounded** prefix; no extra files, Cargo metadata, crates or external services
are read. The scanner masks ordinary, byte and C strings, raw strings (including
C raw strings and up to 255 `#` delimiters), line comments, nested block
comments and complete character literals. It
preserves apostrophes that begin lifetime names.

The supported *guidance cases*, not model-quality guarantees, include:
Result/Option and error propagation, async/.await, trait/impl methods and
associated types, pattern-match arms/guards, ownership/borrowing/lifetimes,
iterator adapters/closures (including `async |x|` and `async move |x|` and `AsyncFn*` bounds), macro invocations, generics/where bounds (including return-position `impl Trait + use<'a, T>` precise capture), `if let`/`while let`/`let-else`, const functions/const generics/associated constants, and unsafe/FFI contexts.


The additional guidance is fixed text derived from masked, already-approved
editor context. It reminds a model that `let-else` branches must diverge,
const-evaluation contexts have restrictions, and FFI/unsafe code must preserve
safety invariants without introducing unnecessary `unsafe`. It neither
compiles suggestions nor makes generated Rust code safe. Native FIM requests
remain unchanged.

**Native FIM behavior is unchanged** for selected qwen2.5-coder and local
lineloom-code tags: the prefix and suffix are still supplied separately
without inserting additional model instructions. Related-file context
remains session-only, explicitly selected and subject to the original
privacy gate. Rust support does not automatically install Rust tools or
download any AI model.

## Bounded lexical scanner maintenance (development source)

The Rust scanner now avoids constructing the remaining input substring at
every character. Comment and raw-string closing delimiters are checked at
the current offset, and raw-string openings inspect at most 255 `#`
characters. The scan remains limited to the existing 30,000-character
window and derives only the same allowlisted contextual hints. No file
reads, Rust compilation, token uploads or model inference were added.

Offline unit cases include async closures, `AsyncFn*` bounds, precise capture, masked mentions in comments/literals, unchanged native FIM requests, and long nested comments, complete and incomplete
ordinary/byte/C raw strings with 0–255 hashes, Rust lifetimes, character
literals and known post-literal code. These tests establish lexical
regression behavior, **not** a measured editor latency improvement or
the quality of generated Rust code. The actual local Ollama and physical
desktop QA below are still required.

## Suggested real-world acceptance

1. Set the Rust language model to an installed, explicitly approved
   **generic** local Ollama model. In a synthetic `.rs` file, complete
   a match arm with `Ok(value)` and `Err(error)`; verify delimiters,
   commas, guards and pattern bindings. Record useful/incorrect outcomes.
2. Repeat in a function returning `Result<T, E>`, including a correct
   `?` expression; validate the suggested code with your own Rust
   toolchain, and do not claim this scanner performed type checking.
3. Test `async fn`, `.await`, `async |x|` / `async move |x|` closures, `AsyncFn` / `AsyncFnMut` / `AsyncFnOnce` bounds, and return-position `impl Trait + use<'a, T>` precise capture. Check that generics and lifetime capture constraints follow the active Rust edition. Also test a trait impl with an associated type,
   `&'a mut` references, iterator/closure adapters, and a
   `macro_rules!` invocation. Record failures as well as successes.
4. Move the cursor inside a line comment, nested block comment, normal
   string, C string, and raw string with many `#` delimiters. Verify the
   suggestion does not switch to executable Rust code or repeat a closing delimiter.
5. Switch to an installed, recognized **native FIM** model. Inspect
   an isolated local mock request and confirm it sends only the existing
   bounded cursor prefix and a separate suffix, not the new Rust hints.
6. Disable Rust in enabled languages; verify no automatic or manual Rust
   request reaches Ollama. Re-enable it and verify existing workspace
   exclusions, editor-change cancellation and remote approval still apply.

For reproducibility record commit SHA, OS, VS Code version, selected local
model tag, model quantization, prompt mode, case identifier, aggregate
latencies and sanitized pass/fail counts. **Never share private code,
personal paths, model request bodies, credentials or proprietary datasets.**

The offline unit suite `test/unit/rust-context.test.ts` and the
mock-server extension-host integration run verify lexical hints and FIM
request shapes only. No first-party LineLoom Code trained weights, Rust
compiler validation of generated answers or actual local-model acceptance
is established by these tests.
