# Local model baseline — reproducible evaluation protocol

**Status: procedure only. No measurements have been performed or endorsed by this document.**

This is an opt-in, **synthetic-only** developer protocol for the first-party
LineLoom Code research track: Rust, C, C++, Python and TypeScript.
It does not test user repositories, collect source, train a model, download
weights, or authorize an extension/registry release.

## 1. Record the test environment (without private data)

Keep a private local note of the UTC date, LineLoom Git commit SHA,
Ollama version, editor version (if an editor test is run), OS version,
CPU/GPU type, RAM/VRAM, quantization, exact installed model tag,
prompt mode, and whether the trial is cold or warmed.

- Use a *manually installed, permitted* local Ollama model.
- Benchmark a single named model and mode at a time. Run different models
  on the same machine with the same number of attempts before comparing.
- Record changes to CPU/GPU load, power mode, thermal state or hardware;
  do not mix machine configurations into one performance claim.
- Do not share paths, hostnames, prompt/response bodies, code snippets,
  local user IDs, secrets, endpoint credentials or private model sources.

## 2. Validate before any inference

From a reviewed checkout of the exact Git commit, with Node.js 22+:

```sh
npm ci
npm run test:model-eval
npm run model:eval:dry
```

The dry run is offline: confirm the expected **30 synthetic fixtures** across
five languages, six per language. A dry run is not model inference.

## 3. Run a controlled, voluntary baseline

The evaluator only targets loopback `http://127.0.0.1:11434/api/generate`
and never crawls the workspace or uploads examples.

```sh
npm run model:eval -- --model qwen2.5-coder:1.5b --mode auto --runs 3
npm run model:eval -- --model qwen2.5-coder:1.5b --mode auto --language cpp --runs 3
npm run model:eval -- --model qwen2.5-coder:1.5b --mode auto --category suffix --runs 3
```

Replace the illustrative tag only with a locally installed, reviewed model.
Run `--mode fim` only where a model actually supports suffix-aware FIM.
The source benchmark v7 also recognizes `lineloom-code` and
`lineloom-code:<tag>` for native FIM in `--mode auto`, matching VS Code
extension routing. This name only selects a request format; it is not
evidence that any checkpoint is installed or supports FIM. Use
`--mode instruction` to force a generic comparison if needed.
The Ollama report protocol is `lineloom-synthetic-v7`, which does not
compare with earlier v1–v6 reports; regenerate both reports locally.
Use separate notes for cold and warmed conditions. The benchmark is
sequential and capped at five runs per fixture; do not assume independence
from repeated runs or infer human usefulness from strict string equality.

A failing inference returns a nonzero process exit code; preserve the
aggregate failure count and do **not** quietly discard failed attempts.
The evaluator prints only aggregate statistics, not source or generated code.

## 4. Interpret numbers accurately

| Field | Correct interpretation |
| --- | --- |
| `attempts`, `completed`, `failed` | Every attempted synthetic request, including failures |
| `strictExactMatches` | Finished responses exactly matching one hand-authored continuation |
| `perLanguage` / `perCategory` | Counts, not compile correctness or an editor acceptance rate |
| `completionP50Ms` / `completionP95Ms` | Nearest-rank latency **of completed requests only** |
| `firstTokenP50Ms` / `firstTokenP95Ms` | Latency of completed requests that emitted a token |
| `fixtureOutcomes.evaluated` | Distinct synthetic fixtures with recorded attempts |
| `fixtureOutcomes.repeated` | Distinct fixtures with more than one attempt |
| `fixtureOutcomes.exactAtLeastOnce` | Fixtures with at least one exact completed response |
| `fixtureOutcomes.exactEveryAttempt` | Fixtures with all attempts exact, including one-run fixtures |
| `fixtureOutcomes.mixedExactOutcomes` | Repeated fixtures with both exact and non-exact outcomes, including failed attempts |

If there are few completed requests, latency percentiles are not a reliable
performance baseline. These indicators are **not pass@k**, compilation
results, controlled random-seed repeatability, human acceptance or production
readiness. A correct alternative implementation may be recorded as a
non-match. Inspect actual suggestions **locally** before making any claim
about quality.

## 4a. Generated Python and TypeScript grammar checks (Ollama v6)

The opt-in loopback-only `model:eval` runner parses original, checked-in
synthetic `prefix + insertion + suffix` after each successful Ollama
response. TypeScript is checked with the locked local TypeScript parser, in
memory and bounded to 16,384 UTF-16 code units. Python is checked with the
stdlib `ast.parse` from a local Python 3 interpreter, bounded to 8,192 UTF-16
code units. It uses a fixed `python -I -S -c` script, stdin input, an
allowlisted environment, a 2.5-second parser deadline and no shell. The parser
does **not** execute generated code. No reconstructed source, diagnostic
text, AST, files or private paths are saved or printed.

Python is **`unchecked`** if its interpreter is missing or the isolated
parser does not return a valid result; that is not counted as a syntax failure
or a successful parser check. TypeScript responses get `passed` or
`failed`. Rust, C and C++ stay `unchecked`. Failed or timed-out Ollama
requests are counted separately from successful inference with parser
results. `generatedSyntax` provides source-free by-language counts.
The offline comparison rejects impossible allocations, more exact matches
than checked grammar passes could support, and comparisons with different
Python checked counts. Its regression review flags increases in Python or
TypeScript parser failures, but neither flags nor passes prove model quality.

**Re-run both baselines under v7.** Earlier Ollama v1–v6 reports are
incompatible. For comparable syntax evidence, use the same installed Python
interpreter and TypeScript dependency, alongside matching model hardware
and request settings. Python AST and TypeScript parser success do not imply
type correctness, runtime safety, compilation or practical editor usefulness.
The separate Linux compiler CI tests only **public reference answers**, not
model-generated source. This is distinct from the optional Hugging Face
training/smoke pipeline and does not imply that a first-party model was
trained or inference was performed in CI.

## 4b. Rust/C/C++ generated delimiter warnings (Ollama v7)

The synthetic benchmark now inspects the **actual normalized generated insertion**
for balanced parentheses, braces and brackets together with each original public
prefix/suffix. A bounded, pure JavaScript lexical scanner recognizes common
strings, comments, Rust lifetimes and raw strings, and C++ raw strings.
Detected mismatches are counted as a source-free `nativeDelimiterMismatch`
**format warning**. Unsupported/ambiguous cases are skipped rather than
declared good. It does not execute code, call compilers, read workspace files or
add external packages.

A clean result means **only** that the scanner did not see a delimiter
problem. It is not parsing, compilation, semantic validation, proof of safety
or evidence of model usefulness. Rust/C/C++ `generatedSyntax` remain
**unchecked**, distinct from Python AST and TypeScript parser results.
Because format diagnostics changed, v7 reports cannot be directly compared
with v6; re-run both candidates with the same v7 revision.

## 5. Sanitize and review the report

Use this metadata-only template in a GitHub issue or reviewed PR:

```text
Evaluation status: NOT RUN / PASS / FAIL / DEFERRED
Date (UTC):
Tested commit SHA:
Model tag and quantization (public names only):
Ollama version / prompt mode:
OS / CPU / GPU / RAM / runtime conditions:
Runs per fixture and filters:
Synthetic attempts / completed / failed / exact matches:
Per-language aggregate counts:
Fixture outcomes (aggregate counts only):
Completed-request total p50/p95 and first-token p50/p95:
Known limitations / follow-up issue:
Manual editor verification: NOT RUN / PASS / FAIL / DEFERRED
```

Never attach full benchmark console traffic from an unreviewed environment,
private generated code, model responses, personal prompts, secret-bearing
URLs, or file paths. Publish sanitized numeric aggregates only.

## 6. Release and training decision gates

A synthetic comparison can guide the next **research** experiment, but does
not justify claiming LineLoom Code is trained, superior, stable or
production-ready. Review model/checkpoint licenses and provenance before
any download/training/redistribution; use independent holdouts for training
experiments and physical Windows/macOS/Linux editor QA with keyboard and
accessibility testing before proposing a stable release.

See [training plan](TRAINING_PLAN.md), [data policy](DATA_POLICY.md),
[model README](README.md) and [manual release evidence rules](../docs/qa/release-evidence.md).


## 7. Offline, controlled baseline-to-candidate comparison (unreleased)

After both runs use the **same** checked-out fixtures, explicit prompt mode,
hardware, quantization conditions, and `--runs`, save their aggregate JSON
outputs locally and compare only after the reports have been reviewed:

```sh
npm run model:compare -- --baseline baseline.json --candidate candidate.json
```

The source-free comparator reconstructs the permitted language/category filter
scopes from the fixed checked-in public synthetic fixture manifest and verifies
each claimed fixture and request-spec hash against that reviewed content,
not merely against the other report. It also validates benchmark protocol,
prompt mode, run count, and the exact per-language/category attempt allocation.
It rejects mathematically impossible repeated-fixture outcomes (including
mixed exact/non-exact attempts) and impossible formatting counts: every
flagged completion must have at least one signal, and overlapping signals
cannot individually exceed the number of flagged completions. Category-level
strict-match regressions are surfaced for review alongside language-level
regressions; these are warning signals, not proof of model quality.
It refuses incompatible/malformed/legacy reports rather than comparing
percentages across different test sets. Input files are individually capped at
32 KiB, and untrusted report fields are never echoed. Keep names and raw
reports local, and **review the clipboard or output before publishing**.

These reviewed-scope checks reject fabricated or inconsistent benchmark
claims but cannot prove that a model was run: both a report and the checked-in
fixture set could be modified by an adversary with local repository write
access. This does not establish matching runtime/hardware, independent
statistical significance, correctness, user acceptance or actual first-party
model progress. No physical model run or benchmark observation was performed by
the implementation.


## 8. Conservative completion-format signals (v2 development)

The report records aggregate counts for `empty`, `markdownFence`,
`chatPreamble`, `specialToken`, `unsafeUnicode`, `prefixEcho`,
and `suffixEcho`, plus inspected completions and completions without any
detected format flag. Multiple signals can apply to one completion; do
not sum these counts to derive a failure rate. A token/code continuation
may be semantically wrong despite no format flags. Manual editor review
and separately isolated compiler checks are still required.

Reports now specify benchmark protocol `lineloom-synthetic-v2`, and the
comparison command refuses old v1 or mixed-protocol reports. Do not
compare new v2 signal counts with prior v1 runs or call them a quality
benchmark until actual local model evidence has been collected.


## 9. Source-free request-spec SHA-256 (v3 source, not yet released)

Both the offline dry-run and real model evaluator record
`requestSpecSha256` of the complete constructed original synthetic Ollama
requests, excluding the model tag. The hash binds prompt instructions,
prefix, FIM suffix, stream flag and explicit sampling/context settings,
independent of the `fixtureSetSha256` hash of public probes and expected
continuations. Neither value writes raw prompts or model completions to
the benchmark report.

The comparator rejects missing/different request-spec digests. Because
the report contract changes, its protocol is now
**`lineloom-synthetic-v3`**; v1/v2 reports must be rerun to compare.
The digest is a local reproducibility check, **not an attestation** of
server-side settings, model checkpoint/quantization, physical hardware or
semantic quality. Record those external variables separately and review
numeric results honestly.

## 10. Deterministic request-to-report unit verification (source development)

The synthetic one-fixture evaluation path has a dependency-injected **in-memory
transport test suite**. It checks the fixed loopback endpoint and explicit
Ollama options, correct continuations, formatting indicators, malformed
JSON streams, redirected/partial HTTP responses, private error-body
redaction, abortable stalled requests and an abort racing a mocked result.
The **research evaluator**, unlike latency-sensitive editor ghost text, now
requires clean EOF after exactly one terminal `done: true` event; any later
non-whitespace event (including another transport chunk) fails the attempt.
A server that stalls after `done` is cancelled at the existing bounded
per-fixture timeout, and such an attempt is recorded as failed. The interactive
extension only validates the currently buffered terminal chunk and cancels
immediately without waiting for EOF. Neither approach proves server honesty.
All tests are offline; the production `model:eval` command continues to
contact **only** the fixed local Ollama endpoint after explicit invocation.
`npm run test:model-eval` runs the new regression tests automatically.

A green mock suite **does not** constitute a completed real model test,
a successful cancellation test on every Ollama version, or proof of
correctness, hardware latency, licensed training or human usefulness.


## 11. Separate local adapter smoke (source only, no verified model results)

The optional [Python smoke runner](train/README.md) tests an
*already* locally provisioned reviewed Qwen FIM base and an *optional*
privately trained LoRA adapter using only 30 original checked-in public
synthetic probes. It has a safe **offline plan** default and a separately
gated `--run --approve-checkpoint` path. Real mode performs strictly
bounded local greedy generations with no returned/printed code,
source-paths or raw prompts; report is source-free per-language exact
counts and generation-only timing. This is not compile accuracy, editor
response latency, or proof of model improvement.

These results are a DIFFERENT protocol from the `model:eval`
loopback Ollama v5 benchmark; do not directly compare scores across
tokenization backends/modes. No real local model run is claimed in the
repository. Independent human, compiler, rights and editor QA is required.

## 12. Local Hugging Face base-versus-adapter consistency check (v2)

The optional local HF smoke now reports fixture-scope/request-spec SHA-256
and local **base config/tokenizer** metadata digests, along with its
user-declared immutable revision. It does not hash the full base weights
or prove checkpoint provenance. Only opt-in **real-run** reports with
matching `lineloom-hf-synthetic-smoke-v2` hashes/settings and internally
consistent per-language counts can be compared:

```sh
npm run model:smoke:compare -- --base base-smoke.json --adapter adapter-smoke.json
```

The comparison command is offline: it reads only two explicitly named,
bounded JSON files and the checked-in original synthetic fixture set,
with no model or inference framework loaded. It prints only numeric
base-versus-adapter exact-match deltas and fixed interpretive warnings.
Old protocol v1 smoke summaries are intentionally refused, and HF
smoke scores must **never** be mixed with the Ollama v3 evaluation format.

The consistency gate cannot show that either report came from a real
model execution, that the purported checkpoint revision was truly used,
that an adapter was correctly applied, that hardware was equivalent, or
that any completion compiles, is secure, or improves VS Code acceptance.
Real approved local trials and independent manual code/editor QA remain
NOT RUN.

## 13. Adapter receipt check before reporting local improvement

A real local LoRA-adapter HF synthetic smoke run now requires the
`lineloom-local-adapter-receipt-v1` saved with a **LineLoom-trained
local experiment**. Its file digests and local base metadata must still
match. The HF v2 comparator refuses adapter reports without that
verified receipt marker. Before opt-in smoke, an offline verification
can be run explicitly with `npm run model:adapter:verify -- ...`;
it prints no source or file paths.

This is only a basic integrity consistency check: user-controlled
receipts can be altered, the full base weights are not authenticated
and a checksum says nothing about code usefulness, correctness,
legality or safety. The real-model and human-review gates remain.


## 14. Local HF synthetic timing, length, parity and termination (v9 current protocol)

For actual reviewed local `smoke.py --run` trials, protocol
`lineloom-hf-synthetic-smoke-v9` reports nearest-rank **p50/p95 generation
latency in milliseconds**, overall and per target language. Measurement
uses a monotonic clock surrounding only the `model.generate()` call,
with explicit CUDA synchronization on both sides. Loading, prompt
tokenization, decoding, VS Code integration and all editor-side delays
are **outside this timing**. Unselected languages report zero attempts
and null latency percentiles.

V7 retains **actual generated token ID** accounting (including a terminal
stop token when generated), aggregated globally and per language, with at
most `maxNewTokens` IDs per attempt. It does **not** print tokens, decoded
text, fixture identities or individual token counts. The source-free
comparator validates count bounds and five-language sums, then reports
base, adapter and adapter-minus-base generation-token totals. If token
totals differ, raw generation-duration deltas are especially unsuitable
for a speed comparison: one model may simply produce more code. Even
equal totals do **not** establish matching per-probe output lengths.
The runner intentionally does not claim throughput, first-token latency,
identical hardware, compiler correctness or editor acceptance.

Before comparing, the v7 report requires an exact, bounded, **source-free
runtime profile** containing device (`cpu` or `cuda`), selected precision,
OS family, Python/PyTorch/Transformers versions, and nullable CUDA/HIP
runtime versions. The offline comparator fails closed if any of the eight
fields differs across the base and adapter runs. This rejects accidental
CPU-versus-GPU, FP32-versus-BF16, operating-system and framework-version
comparisons that could otherwise be misread as adapter speed differences.

V7 also reports **how generation terminated**. Only two conditions are
accepted under the current deterministic greedy FIM policy: the last
generated token is the tokenizer EOS or FIM suffix marker
(`stop-token`), or the model used the full `maxNewTokens` allowance
without producing a stop token (`token-limit`). A stop token generated
exactly at the cap is classified as a natural stop. An unexplained
short generation or a stop token followed by more tokens is rejected.

The reported data consists solely of total and per-language
`stopToken`/`tokenLimit` counts, and comparator base/adapter token-limit
deltas. No individual result, raw token ID or generated text leaves memory.
**Any token-limit exit triggers `TOKEN_LIMIT_EXITS_REQUIRE_REVIEW`**:
the completion may be incomplete. A stop-token exit does not prove
syntactic validity, correctness or acceptable code quality. Source-free
aggregate metrics alone cannot determine which individual completion
was truncated.

Only fixed allowlisted platform/version strings are written. Hostnames,
local file paths, GPU serials and private environment variables are never
recorded. This profile is *not signed* and does not establish actual GPU,
driver, memory layout, CUDA kernels, machine load, thermal state, batch
shape or time-of-run parity. Even passing reports are descriptive and not
a deployment or model-promotion gate.

Offline `compare_smoke.py` requires identical fixture/request/checkpoint
scope and reports only descriptive base-versus-adapter differences. A
**positive duration difference** is slower in that particular run, not
an independently verified regression. Compare only on controlled
hardware, load, thermal state, quantization and execution order.
With six examples per language, p95 is highly unstable.

V8 rejects previous v1–v7 HF smoke protocols in the comparator; rerun
both base and adapter from the same reviewed checkout. The separate
Ollama benchmark uses `lineloom-synthetic-v5` and is not directly
comparable. Offline tests use invented timing and token counts without
GPU, model inference, training, generated private source or network
access. No real HF inference is claimed by this development change.

## 15. Optional syntax check of original reference fixtures (source development)

The new `npm run model:reference:syntax` command has an offline **plan-only**
default. It does not run compilers, read private files, load any model,
start network requests, or claim compilation success. Only a user-requested
`--run --approve-local-compilers` executes locally installed toolchains
against the **original fixed public synthetic reference code**:

| Language | Tool and mode |
| --- | --- |
| Rust | `rustc`, edition 2021, library metadata only |
| C | `cc`, C11 `-fsyntax-only` |
| C++ | `c++`, C++17 `-fsyntax-only` |
| Python | Standard-library `ast.parse` (no execution) |
| TypeScript | `tsc`, strict, `--noEmit` |

The exact source is `prefix + expected + suffix` for each of the 30
checked-in original fixtures. It never checks or writes generated
completions from a model, reads private training examples, invokes a
compiler through a shell, executes compiled programs, or publishes a
benchmark result externally. A bounded temporary directory is erased
afterward. Compiler stdout and stderr are suppressed; reports include
only allowlisted totals and the fixture fingerprint, never source,
diagnostics, temporary paths or usernames.

The regular Linux GitHub CI now runs this public-reference audit with
actual `rustc`, `cc`, `c++`, and the locked `tsc` from `npm ci`, alongside
Python's AST parser. VSIX candidate packaging requires that real syntax
check to pass. This is a per-commit Linux reference-fixture validation,
not evidence of candidate-model correctness or cross-platform parity.

An absent compiler makes the scope **incomplete** and the run exits
nonzero. A zero-exit reference syntax check establishes only that these
specific references were accepted by the local tools under their selected
options. It cannot establish runtime semantics, model inference quality,
human acceptance, reproducible cross-platform compilation, privacy of
arbitrary candidate code or a first-party trained checkpoint. It is not
a gate for shipping a model or publishing a stable extension. Standard
offline Python tests use mock compilers plus actual Python AST parsing;
no optional toolchain is required to run CI.

## 16. Generated Python FIM syntax checks (v8 historical design)

The optional Hugging Face `smoke.py --run` command now inspects the
**actual generated Python insertion** for each fixed original public Python
fixture. It joins `prefix + normalized_insertion + suffix` in memory and
runs standard-library `ast.parse` under an 8192-character input bound.
No generated source, AST, parser exception, fixture ID or per-example
outcome appears in logs, outputs, or report files. The parser **does
not execute code**; passing the parse only proves Python grammatical
acceptance in the local interpreter, not runtime safety, semantics,
correctness or deployability. Empty or invalid Python completions fail
syntax; a valid alternative can pass AST while failing strict exact match.

The new `syntaxAccounting: python-ast-only-v1` report aggregates
`syntaxChecked`, `syntaxPassed`, `syntaxFailed`, `syntaxUnchecked`,
plus all five per-language buckets. **Only Python** is checked here:
Rust, C, C++ and TypeScript generated code is explicitly **unchecked**,
even though a separate real Linux CI job validates the **known reference
answers** for those languages. This distinction is mandatory. The
offline comparator refuses inconsistent counts, unsupported-language
syntax success and strict Python matches exceeding Python syntax passes.
It returns a source-free base/adapter Python pass/fail delta and a
bounded review flag; a clean result is not a first-party model claim.

Benchmark protocol `lineloom-hf-synthetic-smoke-v8` and
comparison protocol `lineloom-hf-synthetic-comparison-v7` are
incompatible with prior reports; both local runs must be regenerated
after independently approving the checkpoint and rights. All CI tests
here use invented completions and metadata, not a real ML checkpoint,
GPU inference, training experiment or manual editor test.

## 17. Generated TypeScript syntax in HF local FIM smoke (v9)

HF smoke v9 extends the previous Python AST grammar checks with the
**actual generated TypeScript continuations**. After local, explicitly
approved model inference, the runner sends one bounded in-memory
insertion plus an allowlisted checked-in TypeScript fixture ID to a
local Node subprocess using stdin. The child retrieves the original
public fixture and runs the pinned `typescript` parser without emitting
code, diagnostics, ASTs or file paths. Neither Python `ast.parse` nor
TypeScript `createSourceFile` executes or type-checks generated code.
The runner does not invoke C/C++/Rust compilers on generated source.

Only six Python and six TypeScript original synthetic fixtures qualify
when `--language all` is used. **Rust, C, C++ are unchecked**, not
passed. Failed or unavailable parser subprocesses reject the whole
local smoke experiment; a grammar failure from a functioning parser is
reported separately as a `failed` check.

The v9 `python-ast-typescript-parser-v1` accounting contract reports
per-language and overall checked/passed/failed/unchecked totals. The
offline comparator enforces grammar coverage, exact-match upper bounds,
and returns **separate** Python AST and TypeScript parser base-versus-
adapter counts and changes. Previous v1–v8 HF reports are incompatible;
the new comparison protocol is `lineloom-hf-synthetic-comparison-v8`.
The independent Ollama v5 report uses a different evaluation protocol
and is not mixed with HF reports.

All automated validation uses fixed synthetic insertions only. No real
model, private source, external APIs, GPU training or checkpoint was
executed or published by adding this gate. Syntax correctness is not
evidence of type correctness, runtime safety, semantic quality,
acceptable completion latency, editor acceptance, or release readiness.
