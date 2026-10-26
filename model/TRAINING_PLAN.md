# Dedicated LineLoom Code Model — staged proposal

**Status: planned, not trained, not released.** Tentative research name: **LineLoom Code**. No pretrained checkpoint or training dataset is bundled with the extension.

## Initial product contract

- Task: **low-latency fill-in-the-middle (FIM) inline continuation**, not a chat assistant.
- Languages: **Rust, C, C++, Python and TypeScript**. Differentiate C vs modern C++; no JavaScript-only training claim.
- Inputs: bounded cursor prefix and optional suffix, plus the minimal language signal supported by the chosen base model.
- Outputs: insertion-only text. Never produce fenced explanations, duplicate already-visible suffix or hidden Unicode control characters.
- Runtime target: **optional local Ollama model**, with model assignment through existing `lineloom.languageModels`. Do not automatically pull weights or change users' defaults.
- Model family/size: decide only after checking actual licenses and latency on target machines. A 0.5B–1.5B-class permissively reusable code base is a *candidate*, not a selected dependency. Prefer adapter fine-tuning over training a foundation model from scratch in the first milestone.

## Milestone gates

1. **M0 — Measurement foundation (merged to main):** fixed MIT-original synthetic fixtures, local-only evaluator, pure tests, per-language exact-match counts, aggregate repeated-fixture outcomes and measured first-token / total p50-p95. The [local baseline protocol](EVALUATION_PROTOCOL.md) defines reproducible, sanitized reporting. No real model performance results have been recorded.
2. **M1 — Dataset review:** licensed provenance for each source (repository, revision, SPDX license, consent/opt-out status), duplicate and near-duplicate removal, secret/PII scanning, malware/poisoned training example filtering, holdout split by **repository**, not file, and an exclusion mechanism. Never train automatically on users' workspaces.
3. **M2 — Baseline comparison:** record real Ollama results for the same fixtures using at least one known FIM baseline; include named model, prompt mode, hardware, quantization, run count and temperature. The initial 30 synthetic cases still do not justify model-quality claims; expand to a sufficiently diverse, independently reviewed holdout suite before making such claims.
4. **M3 — Small adapter experiment:** with reviewed checkpoint and corpus, train completion-only/FIM on opted-in or appropriately licensed sources. Record full config, seeds, base model revision, data hashes, train/validation splits, loss curves and GPU compute use. No externally sourced or private data in this repository.
5. **M4 — Test quality and safety:** code parse/typecheck/compile execution where appropriate in **isolated offline sandboxes**, human correctness/usefulness review, duplicate/unsafe completions, multilingual identifier safety, p50/p95 latency and cancellation. Include editor tests on Windows/macOS/Linux and accessibility results; all currently **NOT RUN**.
6. **M5 — Optional packaging:** only if evaluation warrants it, export a license-compliant local quantized artifact, verify SHA-256 and document Ollama import/run commands. Ship model **separately** from the extension and do not change default Ollama tags silently.

## Candidate training sample schema (design only)

```json
{
  "language": "rust",
  "prefix": "fn double(value: i32) -> i32 {\n    value * ",
  "middle": "2",
  "suffix": "\n}\n",
  "source_repo": "example/consented-project",
  "source_revision": "<verified commit SHA>",
  "license_spdx": "<reviewed SPDX identifier>",
  "split": "train",
  "permission_record": "<reviewable provenance record>"
}
```

Do not interpret this example as permission to collect the named repository or to use public source without reviewing its license. **Training samples and evaluation fixtures must never overlap**, including near-duplicate code across forks; this 30-fixture synthetic benchmark is insufficient for ranking production models.

## Model-selection decision criteria

1. Redistributable checkpoint and training rights reviewed for intended use; reliable provenance.
2. Measurable local response under a declared target machine and quantization.
3. Correct continuation behavior for **each** language; no single aggregate masking weak C/C++ behavior.
4. Compatibility with Ollama's actual prompt/FIM protocol, cancellation, output length and suffix behavior.
5. Privacy/security test outcomes and repeatable build artifacts.

**No GPU training, checkpoint download, dataset scrape, synthetic real-model output collection, or model publication is performed by this plan.**


**Post-v1.4.0 toolchain development (not a model release):** a bounded,
offline comparator for synthetic M0 reports enforces identical SHA-256
fixture scope, prompt mode and run count before exposing source-free deltas
per language and category. This is reproducibility infrastructure, not
measured M2 model quality, successful training or redistribution approval.


## M1 mechanical dataset preflight — development, not training

A new `model:data-audit` command verifies **explicitly provided** records
without creating train shards, collecting user workspaces, or downloading
repos. It enforces human-attested rights/opt-out/attribution flags,
repository-group split isolation, source-revision syntax, deduplication,
heuristic evaluation overlap and obvious secret screening. Counts are
source-free. It does not verify permission authenticity, detect all PII,
ensure a corpus's license is compatible with a checkpoint, or make the model
safe. Failing audit blocks the next step; passing audit only means mechanical
preconditions hold and **never authorizes fine-tuning or model publication**.


**Format-focused local evaluation (post-v1.4.0 development):** synthetic
v2 benchmark adds seven aggregate non-content formatting indicators and
per-signal offline comparison deltas, while retaining strict exact-match
metrics. These identify possible output-format defects without logging
inference responses; they do not replace compilation, human QA or actual
model performance data. No training run is implied.


**M1 quality gate hardening (post-v1.4.1 source):** do not accept a
manifest merely because *some* train/validation/test samples exist.
The offline audit now requires Rust, C, C++, Python and TypeScript each
to occur in every split, verifies repo-group holdout consistency and
screens even lightly modified public benchmark probes via character
shingles. This mechanical 15-sample minimum is not a meaningful corpus,
a statistically powered holdout or training authorization.


**M2 reproducibility infrastructure (unreleased post-v1.4.1 source):**
synthetic benchmark protocol v3 adds a deterministic hash of the actual
constructed Ollama prompt/suffix and explicit generation settings, apart
from the fixture-set fingerprint. Old or mismatched report formats fail
closed. This does not provide real Ollama benchmark data, approved weights,
training authorization, or evidence of model usefulness.

## M3 implementation begins — opt-in FIM LoRA experiment (post-v1.4.1 source)

`model/train/finetune.py` implements real PyTorch + PEFT local-only
adapter fine-tuning for an independently reviewed, locally installed
Qwen2.5-Coder-0.5B base candidate. It constructs Qwen FIM
prefix/suffix/middle inputs with completion-only masked loss, validates
the original *private* manifest through the existing offline Node audit,
trains only `train` samples, calculates validation loss on `validation`
samples, and **never uses test samples** in optimization or evaluation.
Explicit rights and checkpoint flags are mandatory, as are an approved
40-digit revision declaration and an existing local safetensors model.
Output is an unreviewed, locally saved PEFT adapter and source-free
metadata with hashes. Full instructions and caveats:
[train/README.md](train/README.md).

Only offline plan/encoding/approval tests have been added and can run
without a GPU. **No actual fine-tune, measured loss, approved corpus,
quantization, model card or distributable model exists yet.** Data and
checkpoint legal provenance still need independent review.

## M3: optional local LoRA FIM training implementation (source milestone)

`model/train/finetune.py` contains an executable opt-in local adapter
experiment for a legally reviewed and separately provisioned
Qwen2.5-Coder-0.5B **base** candidate. It uses FIM prefix/suffix/middle
tokens, completion-only label masking, local validation-only loss, and
small sequential LoRA optimizer steps. Only after passing the original
offline data preflight and explicit checkpoint/rights approval flags
can it load user-provided local safetensors; it writes an unreviewed PEFT
adapter and sanitized SHA-256 metadata to a Git-ignored/outside-repo
folder. The `test` split is never tokenized or optimized.

[Usage, limitations and safety/rights gates](train/README.md).
**No actual GPU/CPU training, dataset licensing approval, trained
adapter, quantization, model card or model-release artifact yet exists.**

## Next M3 iteration — five-language exposure and validation visibility

The optional Python LoRA trainer now includes
`model/train/sampling.py`: a reproducible seed-local, five-language
round-robin over **train** records, with shuffled record order within
each language. Because each language gets one draw per five microbatches,
manifest ordering no longer determines the first optimizer steps.

The unreviewed local experiment report includes training draw totals
by language, a sample-weighted validation loss, a macro-average of the
five language losses and individual validation loss/sample counts for
Rust, C, C++, Python and TypeScript. This is meant to reveal bad
language-specific validation performance rather than bury it inside
a pooled loss. Small language buckets are oversampled by repetition:
a mechanical audit pass remains inadequate for model training.

The new sampler/validation tests run offline with Python standard library
and no model checkpoint. **No approved corpus, trained adapter, GPU
evaluation, independently measured model improvement or production
release is claimed.**

## M4 preparation — reproducible local adapter comparisons

The standalone optional HF FIM smoke can now produce protocol-v2
synthetic fixture/request fingerprints and config/tokenizer digest
metadata, and the offline comparator refuses ineligible or
incompatible base-versus-adapter reports. Strict-match deltas remain
five-language **synthetic diagnostics only**, not meaningful evidence
of model improvement. Real checkpoint provenance, training corpus
approval, compiler tests, editor acceptance, hardware latency and
actual trained LoRA weights are still unverified.

`npm run test:model-training` covers the comparator offline with
mocked source-free counts; no model checkpoint is loaded.

## M3 artifact correctness: local adapter receipts

The experimental local LoRA fine-tuner records a bounded,
source-free **adapter file integrity receipt** including relative
filenames, SHA-256 digests, local base config/tokenizer hashes, train
and validation counts, sealed-test usage and an explicitly declared
revision. A separate stdlib-only verification command checks the
receipt before opt-in LoRA smoke or comparing to a local base model.

This gate detects accidental artifact tampering and mismatched base
metadata, but deliberately **does not** claim signed provenance,
hashes of all base weights, checkpoint license verification, GPU
execution, reproducibility, training-corpus rights, compiler results,
real autocomplete quality or distribution approval. Existing adapters
without a LineLoom receipt are ineligible for this specific comparator.
