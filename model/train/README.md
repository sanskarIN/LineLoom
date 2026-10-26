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

FIM loss is applied **only to the inserted middle and EOS tokens**, with the prefix and suffix masked as labels `-100`. Qwen FIM format: `<|fim_prefix|>prefix<|fim_suffix|>suffix<|fim_middle|>target`. Fixed experimental LoRA parameters are r=8, alpha=16, dropout=0.05 targeting query/value projections; AdamW, sequential bounded steps, deterministic seed. Requires realistic GPU memory and an independently confirmed compatible local environment.

## Evaluation/rollout gates

1. Verify reproducible checkpoint files, exact tokenizer revision and dependency lock; the current local config hash and **user-declared** commit are not full weight-provenance verification.
2. Validate train vs validation loss, ensure test holdout remained sealed, repeat on multiple data splits, conduct independent decontamination, manual safety and authorship audits. The existing 15-sample mechanical minimum **cannot train a useful model**.
3. Evaluate **real**, correctly formatted FIM completions per Rust/C/C++/Python/TypeScript using the offline synthetic v3 baseline protocol, expand to genuinely independent holdouts, run isolated compile/parse/unit tests and human editor/latency/accessibility QA.
4. Review an accurate model/dataset card, copyright and distribution approval **before** separately authorizing any GGUF/quantization/Ollama export. This script **does not** export weights as an Ollama model, publish to GitHub or register an extension.

The stable extension and `SanskarCodes.lineloom` publisher are unaffected.
