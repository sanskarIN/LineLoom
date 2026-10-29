#!/usr/bin/env python3
"""Opt-in, local-only LineLoom Code FIM LoRA experiment.

Planning requires only Python 3.10+ and Node 22+; training additionally
requires locally installed PyTorch, Transformers, PEFT and a local checkpoint.
Never downloads a model, traverses an editor workspace or publishes weights.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import random
import re
import subprocess
import sys

try:
    from .sampling import balanced_sample_indices, validation_metrics
    from .integrity import (
        PROTOCOL as ADAPTER_RECEIPT_PROTOCOL, IntegrityRejected,
        adapter_artifact_hashes, base_metadata_hashes
    )
except ImportError:
    from sampling import balanced_sample_indices, validation_metrics
    from integrity import (
        PROTOCOL as ADAPTER_RECEIPT_PROTOCOL, IntegrityRejected,
        adapter_artifact_hashes, base_metadata_hashes
    )

ROOT = Path(__file__).resolve().parents[2]
SPLITS = ("train", "validation", "test")
LANGUAGES = ("rust", "c", "cpp", "python", "typescript")
FIM_PREFIX = "<|fim_prefix|>"
FIM_SUFFIX = "<|fim_suffix|>"
FIM_MIDDLE = "<|fim_middle|>"
MAX_MANIFEST_BYTES = 1_048_576


class ExperimentRejected(ValueError):
    """The local training gate failed; never attach user data to this error."""


def audit_manifest(path: Path) -> tuple[dict, dict, str]:
    """Run the project's real offline Node audit BEFORE returning any records.

    The SHA-256 before/after rejects ordinary concurrent file changes. This
    is not a rights/PII attestation or protection against hostile local races.
    """
    if not path.is_file():
        raise ExperimentRejected("manifest")
    raw = path.read_bytes()
    if not raw or len(raw) > MAX_MANIFEST_BYTES:
        raise ExperimentRejected("manifest-size")
    digest = hashlib.sha256(raw).hexdigest()
    try:
        check = subprocess.run(
            ["node", str(ROOT / "scripts/model-data-audit.mjs"),
             "--manifest", str(path)],
            cwd=ROOT, capture_output=True, text=True, timeout=20, check=False
        )
        if check.returncode != 0:
            raise ExperimentRejected("data-audit")
        audit = json.loads(check.stdout)
        manifest = json.loads(raw.decode("utf-8", errors="strict"))
        if hashlib.sha256(path.read_bytes()).hexdigest() != digest:
            raise ExperimentRejected("manifest-changed")
        if audit.get("status") != "MECHANICAL_CHECKS_PASS_ONLY":
            raise ExperimentRejected("data-audit-status")
        if len(manifest["samples"]) != audit["samples"]:
            raise ExperimentRejected("audit-mismatch")
        return manifest, audit, digest
    except (OSError, ValueError, KeyError, subprocess.TimeoutExpired) as exc:
        raise ExperimentRejected("dataset-rejected") from None


def check_output_destination(target: Path) -> Path:
    """Do not accidentally write unreviewed adapter metadata under tracked source."""
    dest = target.expanduser().resolve()
    if dest.exists():
        raise ExperimentRejected("output-must-not-exist")
    # A repository-local experiment MUST live under the gitignored runs dir.
    if dest.is_relative_to(ROOT) and not dest.is_relative_to(ROOT / "model" / "runs"):
        raise ExperimentRejected("unignored-output")
    if (dest == ROOT) or (ROOT / ".git").is_relative_to(dest):
        raise ExperimentRejected("unsafe-output")
    return dest


def validate_local_checkpoint(base: Path) -> Path:
    path = base.expanduser().resolve()
    if not path.is_dir() or not (path / "config.json").is_file():
        raise ExperimentRejected("local-checkpoint-required")
    if not any(path.glob("*.safetensors")) or not (path / "tokenizer.json").is_file():
        raise ExperimentRejected("local-safetensors-tokenizer-required")
    return path


def fim_prompt(sample: dict) -> str:
    return FIM_PREFIX + sample["prefix"] + FIM_SUFFIX + sample["suffix"] + FIM_MIDDLE


def verify_fim_tokenizer(tokenizer) -> None:
    """A tokenizer lacking Qwen's actual FIM token IDs is not trainable here."""
    for token in (FIM_PREFIX, FIM_SUFFIX, FIM_MIDDLE):
        tokens = tokenizer.encode(token, add_special_tokens=False)
        if len(tokens) != 1 or tokenizer.convert_tokens_to_ids(token) != tokens[0]:
            raise ExperimentRejected("unsupported-fim-tokenizer")
    if not isinstance(tokenizer.eos_token_id, int) or tokenizer.eos_token_id < 0:
        raise ExperimentRejected("missing-eos")
    if not isinstance(tokenizer.pad_token_id, int) or tokenizer.pad_token_id < 0:
        raise ExperimentRejected("missing-pad")


def encode_fim(sample: dict, tokenizer, max_tokens: int) -> dict:
    """Use causal LM label shift: only inserted middle + EOS incur loss."""
    prefix = tokenizer.encode(fim_prompt(sample), add_special_tokens=False)
    target = tokenizer.encode(sample["middle"], add_special_tokens=False)
    if not prefix or not target:
        raise ExperimentRejected("empty-tokenized-fim")
    if len(target) > 256 or len(prefix) + len(target) + 1 > max_tokens:
        raise ExperimentRejected("sample-exceeds-training-limit")
    token_ids = prefix + target + [tokenizer.eos_token_id]
    return {
        "input_ids": token_ids,
        "attention_mask": [1] * len(token_ids),
        "labels": [-100] * len(prefix) + target + [tokenizer.eos_token_id],
    }


def pad_examples(examples: list[dict], pad_token_id: int) -> dict:
    if not examples:
        raise ExperimentRejected("empty-batch")
    width = max(len(x["input_ids"]) for x in examples)
    return {
        "input_ids": [x["input_ids"] + [pad_token_id] * (width - len(x["input_ids"]))
                      for x in examples],
        "attention_mask": [x["attention_mask"] + [0] * (width - len(x["attention_mask"]))
                           for x in examples],
        "labels": [x["labels"] + [-100] * (width - len(x["labels"]))
                   for x in examples],
    }


def private_report(audit: dict, digest: str, steps: int, max_tokens: int,
                   manifest: dict, gradient_accumulation: int, seed: int) -> dict:
    # Planning observes sample descriptors only; no model or GPU is loaded.
    train_records = [sample for sample in manifest["samples"]
                     if sample["split"] == "train"]
    order = balanced_sample_indices(
        train_records, LANGUAGES, steps * gradient_accumulation, seed
    )
    exposure = {language: 0 for language in LANGUAGES}
    for index in order:
        exposure[train_records[index]["language"]] += 1
    return {
        "stage": "OFFLINE_PLAN_ONLY",
        "trainingExecuted": False,
        "dataAudit": "MECHANICAL_CHECKS_PASS_ONLY",
        "trainingManifestSha256": digest,
        "targetLanguages": list(LANGUAGES),
        "byLanguageAndSplit": audit["byLanguageAndSplit"],
        "samples": audit["samples"],
        "plannedOptimizerSteps": steps,
        "plannedTrainingMicrobatches": steps * gradient_accumulation,
        "plannedTrainingMicrobatchesByLanguage": exposure,
        "trainingSampler": "seeded-language-balanced-v1",
        "seed": seed,
        "maxSequenceTokens": max_tokens,
        "requires": [
            "Separate independent data rights and current opt-out approvals.",
            "Locally provisioned, legally reviewed model checkpoint and license.",
            "Explicit --train --approve-rights --approve-checkpoint.",
            "Real GPU/runtime and subsequent human/editor/quality QA."
        ],
    }


def train(manifest: dict, data_digest: str, args: argparse.Namespace) -> dict:
    """Potentially expensive: called ONLY after explicit flags and audit."""
    # Offline flags must be set *before* imports that could invoke HF Hub.
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"
    os.environ["HF_DATASETS_OFFLINE"] = "1"
    os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
    os.environ["WANDB_DISABLED"] = "true"
    try:
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer
        from peft import LoraConfig, TaskType, get_peft_model
    except ImportError:
        raise ExperimentRejected("optional-training-dependencies-missing") from None

    if args.device == "cuda" and not torch.cuda.is_available():
        raise ExperimentRejected("cuda-unavailable")
    torch.manual_seed(args.seed)
    random.seed(args.seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(args.seed)
    model_dir = validate_local_checkpoint(Path(args.base_dir))
    dtype = (torch.bfloat16 if args.device == "cuda" and
             torch.cuda.is_bf16_supported() else torch.float32)
    tokenizer = AutoTokenizer.from_pretrained(
        str(model_dir), local_files_only=True, trust_remote_code=False, use_fast=True
    )
    if tokenizer.pad_token_id is None:
        tokenizer.pad_token = tokenizer.eos_token
    verify_fim_tokenizer(tokenizer)

    # Never build a tensor dataset from the held-out TEST split.
    records = manifest["samples"]
    train_samples = [s for s in records if s["split"] == "train"]
    validation_samples = [s for s in records if s["split"] == "validation"]
    train_set = [encode_fim(s, tokenizer, args.max_tokens) for s in train_samples]
    validation_set = [encode_fim(s, tokenizer, args.max_tokens) for s in validation_samples]
    if not train_set or not validation_set:
        raise ExperimentRejected("insufficient-train-validation")
    # Train-only, seeded five-language round-robin. Input order is not
    # evidence of corpus balance, so never follow manifest order directly.
    draw_count = args.steps * args.gradient_accumulation
    sample_order = balanced_sample_indices(train_samples, LANGUAGES, draw_count, args.seed)
    exposure = {language: 0 for language in LANGUAGES}
    for index in sample_order:
        exposure[train_samples[index]["language"]] += 1
    model = AutoModelForCausalLM.from_pretrained(
        str(model_dir), local_files_only=True, trust_remote_code=False,
        use_safetensors=True, torch_dtype=dtype
    )
    model.config.use_cache = False
    model = get_peft_model(model, LoraConfig(
        r=8, lora_alpha=16, lora_dropout=0.05, bias="none",
        target_modules=["q_proj", "v_proj"], task_type=TaskType.CAUSAL_LM
    ))
    model.to(args.device)
    model.train()
    parameters = [p for p in model.parameters() if p.requires_grad]
    if not parameters:
        raise ExperimentRejected("no-trainable-lora-parameters")
    optimizer = torch.optim.AdamW(parameters, lr=2e-4, weight_decay=0.01)

    def tensors(example):
        batch = pad_examples([example], tokenizer.pad_token_id)
        return {key: torch.tensor(value, device=args.device, dtype=torch.long)
                for key, value in batch.items()}

    for step in range(args.steps):
        optimizer.zero_grad(set_to_none=True)
        for micro in range(args.gradient_accumulation):
            index = sample_order[step * args.gradient_accumulation + micro]
            output = model(**tensors(train_set[index]))
            if not torch.isfinite(output.loss).all():
                raise ExperimentRejected("nonfinite-training-loss")
            (output.loss / args.gradient_accumulation).backward()
        torch.nn.utils.clip_grad_norm_(parameters, max_norm=1.0)
        optimizer.step()

    model.eval()
    with torch.no_grad():
        losses = [float(model(**tensors(item)).loss.detach().cpu())
                  for item in validation_set]
    # Macro loss prevents a large language subset from hiding regression
    # in an under-represented language. Held-out TEST data stays untouched.
    validation = validation_metrics(validation_samples, losses, LANGUAGES)

    output_dir = check_output_destination(Path(args.output_dir))
    output_dir.mkdir(parents=True, exist_ok=False, mode=0o700)
    # PEFT adapter only; base model is NEVER copied, merged or exported.
    adapter_dir = output_dir / "adapter"
    model.save_pretrained(str(adapter_dir), safe_serialization=True)
    # Hash actual bytes after saving. Relative file keys avoid collisions
    # between equal basenames in different PEFT subfolders.
    artifact_hashes = adapter_artifact_hashes(adapter_dir)
    base_hashes = base_metadata_hashes(model_dir)
    result = {
        "stage": "LOCAL_UNREVIEWED_ADAPTER_EXPERIMENT",
        "trainingExecuted": True,
        "published": False,
        "dataAudit": "MECHANICAL_CHECKS_PASS_ONLY",
        "trainingManifestSha256": data_digest,
        "adapterReceiptProtocol": ADAPTER_RECEIPT_PROTOCOL,
        **base_hashes,
        "baseRevisionDeclared": args.base_revision,
        "optimizerSteps": args.steps,
        "gradientAccumulation": args.gradient_accumulation,
        "seed": args.seed,
        "trainingSampler": "seeded-language-balanced-v1",
        "trainingMicrobatchesByLanguage": exposure,
        **validation,
        "trainSamples": len(train_set),
        "validationSamples": len(validation_set),
        "testSamplesUsed": 0,
        "adapterFileSha256": artifact_hashes,
        "warning": "Unreviewed local adapter; no benchmark, safety or distribution approval."
    }
    (output_dir / "experiment.json").write_text(
        json.dumps(result, sort_keys=True, indent=2) + "\n", encoding="utf-8"
    )
    return result


def parser() -> argparse.ArgumentParser:
    cli = argparse.ArgumentParser(
        description="Offline LineLoom Code FIM LoRA plan or explicit local experiment"
    )
    cli.add_argument("--manifest", required=True)
    cli.add_argument("--train", action="store_true", help="Explicitly enable training (default: plan only)")
    cli.add_argument("--approve-rights", action="store_true")
    cli.add_argument("--approve-checkpoint", action="store_true")
    cli.add_argument("--base-dir")
    cli.add_argument("--base-revision")
    cli.add_argument("--output-dir")
    cli.add_argument("--steps", type=int, default=10)
    cli.add_argument("--gradient-accumulation", type=int, default=4)
    cli.add_argument("--max-tokens", type=int, default=1024)
    cli.add_argument("--seed", type=int, default=42)
    cli.add_argument("--device", choices=("cuda", "cpu"), default="cuda")
    return cli


def main() -> int:
    args = parser().parse_args()
    try:
        if not (1 <= args.steps <= 200 and
                1 <= args.gradient_accumulation <= 16 and
                256 <= args.max_tokens <= 4096 and
                0 <= args.seed <= 2_147_483_647):
            raise ExperimentRejected("invalid-bounds")
        if args.train:
            if not (args.approve_rights and args.approve_checkpoint and
                    args.base_dir and args.base_revision and args.output_dir):
                raise ExperimentRejected("explicit-training-approval-required")
            if not re.fullmatch(r"[0-9a-f]{40}", args.base_revision):
                raise ExperimentRejected("immutable-base-revision-required")
            check_output_destination(Path(args.output_dir))
            validate_local_checkpoint(Path(args.base_dir))
        manifest, audit, digest = audit_manifest(Path(args.manifest))
        if not args.train:
            print(json.dumps(private_report(
                audit, digest, args.steps, args.max_tokens,
                manifest, args.gradient_accumulation, args.seed
            ), indent=2))
            return 0
        result = train(manifest, digest, args)
        # No raw source, model output, file paths, repository names or tokens.
        print(json.dumps(result, indent=2))
        return 0
    except (ExperimentRejected, IntegrityRejected, OSError, ValueError, RuntimeError):
        print("LineLoom Code local experiment was rejected or failed; review local gates and dependencies.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
