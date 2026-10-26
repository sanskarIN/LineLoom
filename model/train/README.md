# LineLoom Code — optional local FIM LoRA experiment (not a model release)

**Status: training implementation only. NO LineLoom-trained weights, GPU run, approved dataset, compiler verification or real model benchmark has been produced by this repository change.**

## Reviewed candidate (not auto-downloaded)

The first experimental candidate is the **base**, *not Instruct*, [Qwen/Qwen2.5-Coder-0.5B](https://huggingface.co/Qwen/Qwen2.5-Coder-0.5B) model. Its publisher lists Apache-2.0, ~0.49B parameters and FIM token support. Independent license, checkpoint revision, attribution and rights review is still required *before* running or distributing derivatives. The workflow accepts a **locally downloaded, individually reviewed and approved** checkpoint folder containing safetensors and tokenizer files. It never downloads one or contacts Hugging Face.

## First: data audit and offline plan

Provide an **independently reviewed private** manifest of schema v1 documented in [data policy](../DATA_POLICY.md). It must pass the project's read-only audit, including train/validation/test examples for all five target languages and repository-family holdout isolation. Neither a public GitHub repository nor flags declaring review guarantee permission.

```sh
node scripts/model-data-audit.mjs --manifest /path/to/reviewed-private-manifest.json
python model/train/finetune.py --manifest /path/to/reviewed-private-manifest.json
python -m unittest discover -s model/train -p "test_*.py"
```

The **default is plan only**: Python + Node required, no GPU/framework imports, no files written, no source printed, no network access or workspace collection. Output is a source-free count/metadata summary and private manifest SHA-256. It is not training authorization.

## Actual local experiment — explicit approvals and pre-existing checkpoint

Only after **independent** dataset privacy/licensing/opt-out/attribution review and actual base model license/immutable SHA review, separately provision the checkpoint offline. Create a Python virtual environment, review and install the optional dependencies in `requirements.txt`. Start in the repository root:

```sh
python model/train/finetune.py \
  --manifest /path/to/reviewed-private-manifest.json \
  --train --approve-rights --approve-checkpoint \
  --base-dir /path/to/approved-local-qwen-base-checkpoint \
  --base-revision REPLACE_WITH_ACTUAL_REVIEWED_40_HEX_CHECKPOINT_COMMIT \
  --output-dir model/runs/private-experiment-001 \
  --device cuda --steps 10 --gradient-accumulation 4 --max-tokens 1024
```

This example has a placeholder revision and deliberately cannot run as-is. The script refuses missing approvals/checkpoint, invalid hex revision, dataset-audit failures, truncated inputs, missing FIM IDs, unavailable CUDA and existing output directories. **Flags are human assertions, not cryptographic legal approvals.** Model loading is forced to local files, without remote code. Output is a locally stored **LoRA adapter only** with hashed files and sanitized numeric validation-loss metadata; held-out `test` examples are never tensorized or optimized. No full base model is copied or silently exported. The output directory is required to be outside the repository or inside the gitignored `model/runs/` path. Do not commit local manifests, training output, model cache, private paths or training logs.

FIM loss is applied **only to the inserted middle and EOS tokens**, with the prefix and suffix masked as labels `-100`. Qwen FIM format: `<|fim_prefix|>prefix<|fim_suffix|>suffix<|fim_middle|>target`. Fixed experimental LoRA parameters are r=8, alpha=16, dropout=0.05 targeting query/value projections; AdamW with deterministic seeded, language-balanced train-only sampling and bounded optimizer steps. Requires realistic GPU memory and an independently confirmed compatible local environment.

## Evaluation/rollout gates

1. Verify reproducible checkpoint files, exact tokenizer revision and dependency lock; the current local config hash and **user-declared** commit are not full weight-provenance verification.
2. Validate train vs validation loss, ensure test holdout remained sealed, repeat on multiple data splits, conduct independent decontamination, manual safety and authorship audits. The existing 15-sample mechanical minimum **cannot train a useful model**.
3. Evaluate **real**, correctly formatted FIM completions per Rust/C/C++/Python/TypeScript using the offline synthetic v3 baseline protocol, expand to genuinely independent holdouts, run isolated compile/parse/unit tests and human editor/latency/accessibility QA.
4. Review an accurate model/dataset card, copyright and distribution approval **before** separately authorizing any GGUF/quantization/Ollama export. This script **does not** export weights as an Ollama model, publish to GitHub or register an extension.

The stable extension and `SanskarCodes.lineloom` publisher are unaffected.


## Local base-versus-adapter synthetic smoke (no model publishing)

A separate `model/train/smoke.py` lets a developer manually compare
an independently installed base model to a **locally trained** LoRA adapter
using **only** the 30 original checked-in synthetic completion probes
(six each: Rust, C, C++, Python, TypeScript). No raw prompts or model
responses are printed, stored or uploaded.

```sh
# Offline planning mode — imports no PyTorch, no weights, no network:
python model/train/smoke.py --language all

# Only after independently reviewing the local model and checkpoint:
python model/train/smoke.py --run --approve-checkpoint \
  --base-dir /path/to/reviewed-local-qwen-base \
  --base-revision REPLACE_WITH_REVIEWED_40_HEX_COMMIT \
  --device cuda --language all

# Optional comparison after a *real* separate approved adapter training run:
python model/train/smoke.py --run --approve-checkpoint \
  --base-dir /path/to/reviewed-local-qwen-base \
  --base-revision REPLACE_WITH_REVIEWED_40_HEX_COMMIT \
  --adapter-dir model/runs/private-experiment-001/adapter \
  --device cuda --language all
```

Both real commands are illustrative and cannot work without an actual
reviewed checkpoint and (in the last command) locally trained adapter.
All model loading is `local_files_only` with `trust_remote_code=False`,
Hugging Face offline mode, greedy bounded generation and fixed local
original synthetic probes only. The stdout report contains numeric
strict-match totals by language and fixed disclaimers; no generated code,
private model directory or adapter path is displayed. This is a **separate
`lineloom-hf-synthetic-smoke-v2`** protocol; do not mix its scores
with the Ollama network/latency `lineloom-synthetic-v3` protocol.

Passing six synthetic examples per language is **not sufficient** for a
real-world-quality claim. Inference quality, safety, semantic correctness,
compiler tests, editor latency and tokenizer/FIM compatibility must all
be tested on real approved hardware before any adapter/weights export.
The script never exports GGUF, registers an Ollama model, automatically
changes LineLoom settings or publishes to any service.

## Seeded balanced training and per-language validation (development)

The original prototype selected training records in manifest order, which
could overrepresent a language when the records were grouped and the
optimizer-step budget was small. The updated sampler uses a seed-local
pseudo-random generator and **cycles through all five languages once per
five microbatches** (with reproducible per-language reshuffling).
At most one extra draw occurs in a partial cycle. Only manifest entries
explicitly marked `train` may be sampled. The `validation` and `test`
splits are rejected by the sampler; the test split is never tensorized
or used to choose model parameters.

The **default offline plan** also previews the scheduled language
exposure as `plannedTrainingMicrobatches` and
`plannedTrainingMicrobatchesByLanguage`. This can be reviewed without
loading PyTorch, any model checkpoint or a GPU; plan-only metadata
contains no code or source identifiers.

Every real local experiment records:
- `trainingSampler: "seeded-language-balanced-v1"`, fixed seed and
  `trainingMicrobatchesByLanguage` exposure totals.
- `validationLoss`: sample-weighted mean across **validation only**.
- `validationMacroLoss`: unweighted mean of five language means.
- `validationLossByLanguage` and `validationSamplesByLanguage`.

All these metrics are **descriptive losses**, not code correctness,
quality, fairness or acceptance scores. Oversampling a small language
bucket only repeats the same examples; it does **not** create additional
training data. Dataset proportions, larger independent held-out sets,
learning curves, checkpoint selection, and real GPU reproducibility
remain unresolved. No samples, paths, completions, or training snippets
appear in printed metrics.

```sh
npm run test:model-training
```

The sampling tests use only synthetic in-memory record descriptors and
Python standard library. They check seeded repeatability, distribution,
bucket coverage, rejection of validation/test contamination, nonfinite
losses and independence from the process-global PRNG.

## Comparing local HF base-versus-adapter smoke reports (protocol v2)

After **independently approved** local base and adapter runs on the same
machine with the *same* base revision, tokenizer, fixtures and generation
parameters, save their **source-free JSON stdout** into two local files:

```sh
# Illustrative only: both real smoke invocations still require reviewed
# checkpoint, explicit approval, pre-installed ML dependencies and, for
# the second run, an actual private adapter.
python model/train/compare_smoke.py --base base-smoke.json --adapter adapter-smoke.json
# Or use:
npm run model:smoke:compare -- --base base-smoke.json --adapter adapter-smoke.json
```

This new command is **offline and read-only**. It does not perform model
inference or load PyTorch, Transformers, PEFT, a model, or an adapter.
Each user-supplied report must be a non-symlink UTF-8 JSON file no larger
than 32 KiB. Only one of the fixed checked-in synthetic scopes
(`all`, `rust`, `c`, `cpp`, `python`, `typescript`) is valid.

Real local `smoke.py --run` reports now include the
`lineloom-hf-synthetic-smoke-v2` protocol, deterministic
`fixtureSetSha256`, `requestSpecSha256`, checked-in fixture scope,
greedy generation contract, fixed local base config/tokenizer SHA-256,
and the **user-declared** 40-character base revision. The comparator
recomputes fixture and FIM request hashes against the current checkout
and refuses plans, legacy reports, corrupted counts, mixed base revisions,
different settings, or comparisons without a local base report followed by
a local adapter report.

The only comparison output is **allowlisted numeric strict-match counts
and adapter-minus-base differences** by language and total, plus fixed
caveats. It never prints prompts, completions, model checkpoint paths,
private metadata, filenames or user-supplied report fields.

Important limitations: file/content hashes **are not attestation of
actual model weights or correct adapter loading**. The declared revision is
a human assertion. This comparator cannot verify matching hardware,
GPU settings, tokenizer runtime behavior, hidden sampling defaults,
compiler correctness, editor acceptance, speed or whether reports were
truthfully generated. **The six probes per language are not a production
model evaluation**, and a strict exact-match improvement does not establish
quality. Protocol v1 reports must be rerun; HF protocol v2 remains
incomparable with the Ollama `lineloom-synthetic-v3` protocol.

Tests are run automatically by `npm run test:model-training` using Python
standard library only; they use invented in-memory count summaries and
perform **no inference**.

## Local adapter integrity gate (source development, no trained weights)

New adapter experiments record a **source-free** `adapterReceiptProtocol:
lineloom-local-adapter-receipt-v1` in their locally retained
`model/runs/<experiment>/experiment.json`. The receipt records the
actual SHA-256 digests of all adapter files **by relative filename**,
plus the local base `config.json` and `tokenizer.json` digests,
the explicitly declared 40-hex model revision and training split counts.

Verify a locally generated adapter **without any ML dependency, network
request, checkpoint loading or inference**:

```sh
npm run model:adapter:verify -- \
  --base-dir /path/to/approved-local-qwen-base-checkpoint \
  --base-revision REPLACE_WITH_ACTUAL_REVIEWED_40_HEX_CHECKPOINT_COMMIT \
  --adapter-dir model/runs/private-experiment-001/adapter
```

This command checks a bounded adapter tree (regular files, no symlinks,
up to 64 files, 128 MiB per file, 256 MiB total), relative file names,
missing/extra/modified artifacts, the receipt's real-run markers,
the held-out test-use count and current local base metadata. It prints
only fixed statuses and the number of verified files; errors never
print paths or source. A read-only check makes **no copies, downloads,
model merges or public artifacts**.

The **real LoRA smoke runner and HF v2 comparator now require a matching
new-style receipt** before reporting adapter improvements. Legacy and
third-party adapters without this LineLoom training receipt are intentionally
not accepted by this specific comparison workflow; they require separate
independent review and migration, not fabricating a receipt. Base-only smoke
still works as before. Default planning modes still import no ML packages.

These SHA-256 values **are not signatures**, do not authenticate the
claimed model revision, full base-weight files, training corpus rights,
training run honesty, or the absence of hidden/poisoned code, and cannot
guarantee protection from malicious local races. The receipt may be
modified along with an adapter by someone who controls both files.
They only detect accidental mismatch and basic tampering, and are NOT
distribution approvals. Real GPU training, model correctness, independent
quality evaluation and production readiness remain unverified.
