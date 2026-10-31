# Native-language reference compiler QA (Rust, C, C++)

**Development validation, not model evaluation.** This tool reconstructs each of
18 checked-in, original synthetic FIM reference programs by joining its public
prefix, **expected insertion** and suffix. It does **not** compile model-generated
code, inspect workspace files, train a model or download toolchains.

From the repository root, with optional local Rust/C/C++ toolchains installed:

```sh
npm run model:reference:native
npm run model:reference:native:strict
```

The first command reports per-language `passed`, `failed` and `unchecked`
counts. A missing compiler yields `unchecked`, **never** a pass. The command
fails on a completed compiler rejection. The strict command additionally fails
if any language is unchecked, and is suitable for a machine with verified
`rustc` and either `clang`/`gcc` and `clang++`/`g++` installed.

- Rust: `rustc` compiles a library crate to temporary metadata (`.rmeta`), then
  deletes the temporary directory. No linked program runs.
- C: `clang` or fallback `gcc` uses C11 `-fsyntax-only` on stdin.
- C++: `clang++` or fallback `g++` uses C++17 `-fsyntax-only` on stdin.
- Each process has a 5-second timeout, no shell, capped stdin source and
  suppressed stdout/stderr. The report contains only static tool names,
  counts and enum/status fields—no source, paths, fixture IDs or diagnostics.
- Nonzero **completed** compiler exits count as failed; tool absence, process
  errors or timeouts count as unchecked. A normal compiler failure may be
  missing environment headers rather than faulty syntax. Investigate locally.

These checks cover the repository's public **reference answers only**. They
cannot establish correctness of Ollama/Hugging Face generated suggestions,
semantic correctness beyond the particular compiler invocation, editor
acceptance, real user latency or hardware performance. Existing generated-code
benchmark summaries continue to mark Rust/C/C++ **unchecked** until a
separately reviewed, safely isolated generated-code evaluation is implemented.

**Safety boundary:** never reuse this compiler helper on untrusted generated or
private workspace source; compilers and preprocessors can read other local
files, and compile-time facilities may execute code. Source and diagnostics are
intentionally not returned. Do not treat it as a sandbox.

Offline unit tests are included in `npm run test:model-eval` and verify command
selection, compiler flags, failure-vs-unavailable classification, source bounds,
privacy of aggregate reporting and no execution step. A real rustc-based run
requires a host with Rust installed; unit test stubs are not that evidence.
