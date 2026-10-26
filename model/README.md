# LineLoom autocomplete-model research

**State: experimental local model-building code plus evaluation infrastructure; no LineLoom-trained weights, completed GPU fine-tune, approved dataset, or real model benchmark results exist yet.**

LineLoom's VS Code extension already supports more languages; this **dedicated model track is intentionally narrower**:

| Scope | VS Code language ID | Extension |
| --- | --- | --- |
| Rust | `rust` | `.rs` |
| C | `c` | `.c`, `.h` |
| C++ | `cpp` | `.cc`, `.cpp`, `.cxx`, `.hpp` |
| Python | `python` | `.py`, `.pyi` |
| TypeScript | `typescript` / `typescriptreact` | `.ts`, `.tsx` |

C and C++ are **separate** evaluation targets. JavaScript, Java, Kotlin and Go remain supported by the extension with existing Ollama models, but **are not initial dedicated-model targets**.

## Running the first evaluation harness

The checked-in `fixtures/completion-v1.json` contains **30 small, original, synthetic examples**, six per language. It is **not a training corpus**. A strict exact string comparison is a narrow regression metric, not a claim that the generated code compiles or is useful. Equivalent completions can be marked wrong.

```sh
npm run model:eval:dry
npm run test:model-eval
# Optional; requires running Ollama and an installed model:
npm run model:eval -- --model qwen2.5-coder:1.5b --runs 3 --mode auto
# Compare syntax-sensitive or suffix behavior in isolation:
npm run model:eval -- --language cpp --category suffix --runs 2
# For a future FIM-trained, locally installed custom model:
npm run model:eval -- --model lineloom-code:dev --mode fim --language rust
```

- The evaluator is **opt-in** and talks only to `http://127.0.0.1:11434/api/generate`. It has no configurable remote endpoint and no model downloads.
- `--dry-run` is fully offline. No evaluator command reads editor buffers, repositories or personal source.
- `--runs` allows 1–5 sequential repetitions. Language filters: `rust`, `c`, `cpp`, `python`, `typescript`, or `all`. The optional `--category` filter selects `expression`, `statement`, `suffix`, `type`, `indentation`, or `all`.
- Each language has six hand-authored, synthetic checks. Category-specific results distinguish common expressions, statements, suffix awareness, type usage, and indentation. **Synthetic strict matches can reject valid alternative implementations**.
- `auto` uses prefix/suffix generation for the known `qwen2.5-coder` model family and a bounded instruction format for all others; `--mode fim` explicitly benchmarks a custom FIM-capable model.
- Only aggregate counts, per-language/per-category strict matches, nearest-rank p50/p95 duration/first-token latency, and **fixture-level outcome totals without fixture IDs** are printed. `fixtureOutcomes` reports how many synthetic fixtures were evaluated, repeated, matched at least once, matched on every attempt, or had mixed exact-match outcomes. Failed requests count as non-matches. `exactEveryAttempt` also includes one-run fixtures; use `repeated` to distinguish repeated observations. These are descriptive synthetic results, **not statistical pass@k, real-editor acceptance or proven model quality**. Model text, prompts, paths and server errors are not logged. A failed request returns a failure count and a nonzero process exit code.
- The stream decoder validates NDJSON finalization, malformed response fields, UTF-8 boundaries and strict output/byte/record limits; the tests use offline synthetic streams rather than real model access.
- Run one **named model and mode at a time** on the same local machine, with warmed and cold trials recorded separately in human-written notes. Do not compare claims across different hardware without annotation.
- Human review of syntax correctness, unsafe code, indentation, duplicate suffix, irrelevant outputs, keyboard UX and actual VS Code acceptance remains **NOT RUN** until recorded separately.

See the [reproducible local benchmark protocol](EVALUATION_PROTOCOL.md), [training and release gates](TRAINING_PLAN.md) and [dataset and contributor policy](DATA_POLICY.md). Do not confuse the extension's version numbers with any future model version.

## Source and safety boundaries

Existing LineLoom endpoint approval, workspace trust, file exclusions, per-language model selection, cancellation and bounded prompt windows remain in force. The benchmark introduces **no new inference path inside the extension**; it is an explicitly invoked development command.

The eventual first-party model can be distributed only after a separate reviewed model license, weight provenance, privacy assessment, local compatibility test and maintainer release approval.


## Post-v1.4.0 development: compare two local synthetic baselines (unreleased)

The optional offline comparator checks that two reports use the **same SHA-256
fingerprint of all selected public fixture contents**, the same resolved
prompt mode, benchmark protocol, number of fixtures, and repetitions.
New evaluator summaries include `benchmarkProtocol`,
`fixtureSetSha256` and `runsPerFixture` (older summaries are not comparable).
It also rejects malformed numeric totals and inconsistent per-language or
per-category counts. Run separately against an already installed local model:

```sh
npm run model:eval -- --model qwen2.5-coder:1.5b --mode fim --runs 3 > baseline.json
npm run model:eval -- --model YOUR-LOCAL-MODEL --mode fim --runs 3 > candidate.json
npm run model:compare -- --baseline baseline.json --candidate candidate.json
```

**Security and interpretation:** this command is offline and reads only the two
explicit report files, each limited to 32 KiB. It displays only allowlisted
aggregate count/latency changes and per-language/per-category exact-match
deltas, without echoing the model tags, filenames, JSON payloads, generated
code, source, or file paths. Keep original report filenames and hardware
details in **private** local notes. The comparator cannot verify CPU/GPU,
thermal or quantization equivalence, and completed-only latency percentiles
are not representative when failures differ. Higher strict equality is not
proof of safer/correct code. No actual Ollama model has been benchmarked here.
This tool is unreleased development and not included in GitHub v1.4.0.


## Dataset preparation safety gate (post-v1.4.0 source, unreleased)

LineLoom Code now has a **read-only offline preflight** for potential training
samples. For a local, independently reviewed, permissioned manifest:

```sh
npm run test:model-data-audit
npm run model:data-audit -- --manifest local-reviewed-dataset.json
```

The audit checks language/split coverage, repository-group segregation,
source revision and review declarations, duplicate and near-duplicate
samples, overlap with the checked-in 30 synthetic evaluation fixtures,
and conservative secret/PII red flags. It emits sanitized totals only;
it does **not** train, copy, download, export, distribute, or persist
any source. See [data governance](DATA_POLICY.md) for the private manifest
schema, limitations, mandatory human reviews, and failure behavior.
No approved training corpus or model weights exist yet.


## Completion format diagnostics (post-v1.4.0 development, not released)

The local-only benchmark now distinguishes **seven conservative format
signals** from strict exact-match equality: empty output, markdown fencing,
chat preambles, model protocol tokens, unsafe/hidden Unicode, copied prefix
text and copied suffix text. Completed suggestions can have multiple flags.
No generated text, snippets or per-fixture flags are written to reports.
Only aggregate counts and a count of completions with no detected format
flags are included.

The benchmark protocol identifier is now **`lineloom-synthetic-v2`**.
Existing v1 JSON reports are **not comparable** with v2: rerun both baseline
and candidate models under the same new protocol rather than quietly
mixing scoring definitions. The offline comparator now reports per-signal
candidate-minus-baseline counts and rejects missing/inconsistent signal
summaries. Signals can be false positives or false negatives and do not
prove compilability, safety, relevance, acceptance or model superiority.
No actual Ollama baseline measurements have been made by this change.


**Current preflight hardening:** every target language must have declared
samples in *all three* repository-separated splits (train, validation, test).
Lightly edited copies of the public synthetic evaluation fixtures are
additionally screened using bounded character shingles. Audit outputs include
only numerical per-language/per-split totals; this is not enough data for a
real model, and these heuristics do not replace independently reviewed rights,
fork relationships, or contamination scans.


## Synthetic request fingerprints (benchmark protocol v3 — unreleased source)

A request-spec SHA-256 now accompanies the original fixture-content hash
in dry-run and real local benchmark summaries. It deterministically covers
the **actual constructed synthetic requests**, including prefix/prompt, FIM
suffix, streaming and explicit Ollama options (`temperature: 0`,
`num_predict: 64`, `num_ctx: 2048`), **excluding the model tag** so different
models can be compared. It never logs raw prompts, generated code or
private workspace content. The offline comparator refuses missing or
different request-spec hashes and still checks fixture hash, mode,
repetitions and valid numeric outcomes.

Protocol is now **`lineloom-synthetic-v3`**. Reports from v1/v2 cannot
be compared to v3. Regenerate both reports on a matching checkout and use an
explicit prompt mode. Matching hashes **cannot** verify model/Modelfile
identity, server-side defaults, quantization, OS/GPU, system load,
correctness or human acceptance. No real model was benchmarked here.

**Request-path test hardening (unreleased source):** a new offline testable
synthetic evaluator verifies the entire request → bounded NDJSON parsing →
completion-format flags/strict equality → source-free result flow using
an injected mock transport. It fails closed for malformed replies, HTTP
errors and aborted requests, and tests deadline races. No real Ollama
inference, network access in tests, approved corpus or trained model
is implied.

## M3 first local adapter-training implementation (unreleased source)

An actual **opt-in, locally runnable LoRA fine-tuning experiment** now lives
under [train/](train/README.md). It uses the project's audited, manually
supplied five-language FIM manifest and reviewed locally installed
[Qwen2.5-Coder-0.5B](https://huggingface.co/Qwen/Qwen2.5-Coder-0.5B)
base **candidate**, not new pretrained weights. No checkpoint or training
set is auto-downloaded or bundled. Python stdlib + Node can produce
only a **dry planning report**; full training requires separate explicit
data rights/checkpoint approvals, optional locally installed ML packages,
an immutable revision declaration, and a pre-existing local safetensors
model. The resulting *unreviewed* LoRA adapter is saved only in a locally
ignored or outside-repository directory; no Ollama export/quantization
or marketplace/model release is performed.

Data are FIM-encoded with Qwen's documented special tokens, loss applies
only to the missing code and EOS, and test split remains sealed. The default
plan never calls PyTorch or a network. Run `npm run test:model-training`
for deterministic offline standard-library unit tests. **Real training
has not been executed here**, and minimal mechanically passing input is
far from a useful training dataset. See [train/README](train/README.md)
and [data policy](DATA_POLICY.md).

## First runnable local FIM LoRA experiment — not trained or released

The [train/](train/README.md) directory now contains a voluntary
**local-only** training program using a separately reviewed
[Qwen2.5-Coder-0.5B](https://huggingface.co/Qwen/Qwen2.5-Coder-0.5B)
base candidate and *only* explicitly supplied source records which pass
the current offline dataset audit. It builds Qwen-style FIM examples,
masks prefix and suffix loss, trains only on declared training records,
validates separately and never consumes the held-out test split. The
program requires explicit rights/checkpoint approval flags, an
independently reviewed local safetensors checkpoint and optional
user-installed ML dependencies before starting optimization. All
candidate inputs/outputs stay local; adapter directories are Git-ignored
and excluded from the VSIX. The default command makes a sanitized
**offline plan only**, and `npm run test:model-training` exercises its
FIM encoding and approval gates without downloading data or weights.

**No approved corpus, GPU training session, adapter/weights, actual
quality measurements or deployable model were created by this source
change.** The 15-record mechanical audit minimum cannot produce a
useful trained model, and reviewed licensing/provenance remain required.


**Local FIM adapter verification (development after v1.4.1):** a separate
[optional Python smoke runner](train/README.md) supports a plan-only
mode and an explicit opt-in local base-versus-LoRA-adapter check over
the original 30 synthetic fixtures. It runs no network requests,
prints no generated code, and reports only source-free per-language
strict matches. This is distinct from Ollama benchmark protocol v3;
the two cannot be directly compared, and neither is a full
correctness/accessibility/security evaluation.

## Balanced local training-loop research (unreleased source)

The opt-in LoRA prototype now provides a seeded, language-balanced
microbatch sampler and **per-language validation loss** alongside
sample-weighted and macro validation means. The separate train/validation/test
boundaries remain enforced, and the test holdout is not passed to the
training loop or validation metrics. Offline synthetic sampler tests require
only Python standard library.

This only improves experiment design and diagnostics. It does **not**
mean any real weights were trained, that FIM output quality improved, or
that a useful five-language dataset, real baseline, GPU or local adapter
exists. [Experiment instructions](train/README.md).

## Source-free HF adapter-versus-base comparison (protocol v2, unreleased)

The separate optional local Hugging Face synthetic smoke now tags each
**real** base/LoRA run with a deterministic hash of the fixed public fixture
subset, the ordered FIM request contract, declared base revision and SHA-256
of the local base config and tokenizer metadata. The default dry plan has
no base metadata because it opens no model files.

`npm run model:smoke:compare -- --base base-smoke.json --adapter adapter-smoke.json`
compares two manually captured **real** smoke JSON reports offline.
It validates the two report kinds, recomputes the fixed fixture and
request hashes locally, checks exact per-language totals and refuses
changed checkpoint declarations, corrupt/mixed/legacy JSON or differing
generation settings. Output contains only aggregate differences and
fixed caveats; neither user report paths nor generated source are echoed.

This adds **no trained weights, checkpoint downloads, adapter export or
measured inference**. Report hashes do not prove the identity of
model weights, adapter application or equivalent execution hardware.
Read the [full local model instructions](train/README.md) and do not
compare this HF v2 protocol with Ollama synthetic v3.

## Locally verifiable LoRA adapter receipts (not a model release)

The local LoRA trainer now writes an **unreviewed, source-free**
`lineloom-local-adapter-receipt-v1` metadata record with relative
adapter file SHA-256 digests, local base config/tokenizer digests,
training counts and the declared checkpoint revision. An offline
`npm run model:adapter:verify -- --base-dir ... --base-revision ... --adapter-dir ...`
command detects missing, changed, unexpected or symlinked adapter files.
Actual adapter-vs-base HF smoke and comparisons require this matching
receipt before treating an adapter as eligible.

The receipt detects accidental mismatches, **not** whether weights
were honestly trained, legally permissioned, correct or authentic.
The full base weights are not hashed or proven and the receipt is not
signed. No checkpoint, dataset, trained weights, GPU run or released
model was produced by this code. See [local details](train/README.md).
