#!/usr/bin/env python3
"""Manual local-only synthetic FIM baseline/adapter smoke.

Default --plan never imports ML packages or contacts a network. Explicit
--run loads user-provisioned local checkpoint and optional PEFT adapter.
Generated code is used only in memory; print allowlisted aggregate counts.
"""
from __future__ import annotations

import argparse
import json
import os
import platform
from pathlib import Path
import re
import sys
import time

try:
    from .finetune import (
        FIM_SUFFIX, LANGUAGES, ROOT, ExperimentRejected, fim_prompt,
        validate_local_checkpoint, verify_fim_tokenizer
    )
except ImportError:
    from finetune import (
        FIM_SUFFIX, LANGUAGES, ROOT, ExperimentRejected, fim_prompt,
        validate_local_checkpoint, verify_fim_tokenizer
    )

try:
    from .smoke_report import (
        fingerprints, read_public_fixtures, generation_latency_summary,
        classify_generation_termination,
        checked_runtime_profile
    )
    from .integrity import (
        PROTOCOL as ADAPTER_RECEIPT_PROTOCOL, verify_training_receipt,
        base_checkpoint_fingerprint
    )
    from .generated_syntax import classify_generated_syntax, generated_syntax_summary
    from .typescript_syntax import classify_typescript_syntax
except ImportError:
    from smoke_report import (
        fingerprints, read_public_fixtures, generation_latency_summary,
        classify_generation_termination,
        checked_runtime_profile
    )
    from integrity import (
        PROTOCOL as ADAPTER_RECEIPT_PROTOCOL, verify_training_receipt,
        base_checkpoint_fingerprint
    )
    from generated_syntax import classify_generated_syntax, generated_syntax_summary
    from typescript_syntax import classify_typescript_syntax


def select_public_fixtures(language: str) -> list[dict]:
    """Use only strictly validated checked-in synthetic cases."""
    return read_public_fixtures(language)


def normalize_completion(response: str) -> str:
    """Compare only a hypothetical FIM insertion, never surrounding source.

    The public synthetic exact-string score is not compile correctness:
    a valid alternative implementation can still fail strict matching.
    """
    normalized = response.replace("\r\n", "\n").replace("\r", "\n")
    for marker in ("<|fim_suffix|>", "<|endoftext|>", "<|im_end|>"):
        normalized = normalized.split(marker, 1)[0]
    return normalized


def summarize(results: list[dict]) -> dict:
    counts = {language: {"attempts": 0, "strictExactMatches": 0}
              for language in LANGUAGES}
    for result in results:
        if result["language"] not in counts:
            raise ExperimentRejected("invalid-result-language")
        if not isinstance(result["exact"], bool):
            raise ExperimentRejected("invalid-result")
        counts[result["language"]]["attempts"] += 1
        if result["exact"]:
            counts[result["language"]]["strictExactMatches"] += 1
    return {
        "syntheticAttempts": len(results),
        "strictExactMatches": sum(x["strictExactMatches"] for x in counts.values()),
        "perLanguage": counts
    }


def validate_local_adapter(path: Path) -> Path:
    adapter = path.expanduser().resolve()
    if (not adapter.is_dir() or
        not (adapter / "adapter_config.json").is_file() or
        not (adapter / "adapter_model.safetensors").is_file()):
        raise ExperimentRejected("local-lora-adapter-required")
    return adapter



def verify_smoke_inputs_unchanged(base_dir: Path, expected_identity: dict,
                                  adapter_dir: Path | None, revision: str) -> None:
    """Recheck reviewed local bytes after inference, before reporting results.

    A preflight alone cannot detect files changed during a long benchmark.
    This checks disk state at two points, not continuous runtime integrity.
    """
    if base_checkpoint_fingerprint(base_dir) != expected_identity:
        raise ExperimentRejected("base-checkpoint-changed-during-smoke")
    if adapter_dir is not None:
        verify_training_receipt(adapter_dir, base_dir, revision)


def run_local(fixture_set: list[dict], args) -> dict:
    """Only local model files; optional PEFT adapter is never uploaded/merged."""
    # Fail closed before importing ML frameworks or loading any weights:
    # merely having adapter.safetensors is insufficient for comparison.
    if args.adapter_dir:
        verify_training_receipt(
            Path(args.adapter_dir), Path(args.base_dir), args.base_revision
        )
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"
    os.environ["HF_DATASETS_OFFLINE"] = "1"
    os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
    try:
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer, __version__ as transformers_version
    except ImportError:
        raise ExperimentRejected("optional-local-ml-dependencies-missing") from None

    if args.device == "cuda" and not torch.cuda.is_available():
        raise ExperimentRejected("cuda-unavailable")
    base_dir = validate_local_checkpoint(Path(args.base_dir))
    base_identity = base_checkpoint_fingerprint(base_dir)
    if args.adapter_dir:
        adapter_dir = validate_local_adapter(Path(args.adapter_dir))
        try:
            from peft import PeftModel
        except ImportError:
            raise ExperimentRejected("optional-peft-dependency-missing") from None

    dtype = (torch.bfloat16 if args.device == "cuda" and
             torch.cuda.is_bf16_supported() else torch.float32)
    # Allowlisted, source-free environment details catch obvious CPU/GPU,
    # precision and framework differences before comparing local reports.
    # They cannot attest same hardware or process load.
    runtime_profile = checked_runtime_profile({
        "device": args.device,
        "precision": "bfloat16" if dtype == torch.bfloat16 else "float32",
        "operatingSystem": platform.system(),
        "pythonVersion": ".".join(str(v) for v in sys.version_info[:3]),
        "torchVersion": str(torch.__version__),
        "transformersVersion": str(transformers_version),
        "cudaRuntimeVersion": torch.version.cuda,
        "hipRuntimeVersion": getattr(torch.version, "hip", None),
    })
    tokenizer = AutoTokenizer.from_pretrained(
        str(base_dir), local_files_only=True, trust_remote_code=False, use_fast=True
    )
    if tokenizer.pad_token_id is None:
        tokenizer.pad_token = tokenizer.eos_token
    verify_fim_tokenizer(tokenizer)
    model = AutoModelForCausalLM.from_pretrained(
        str(base_dir), local_files_only=True, trust_remote_code=False,
        use_safetensors=True, torch_dtype=dtype
    )
    if args.adapter_dir:
        model = PeftModel.from_pretrained(
            model, str(adapter_dir), is_trainable=False, local_files_only=True
        )
    model.to(args.device)
    model.eval()
    stop_ids = [tokenizer.eos_token_id]
    fim_end = tokenizer.convert_tokens_to_ids(FIM_SUFFIX)
    if isinstance(fim_end, int) and fim_end >= 0 and fim_end not in stop_ids:
        stop_ids.append(fim_end)
    result = []
    with torch.inference_mode():
        for fixture in fixture_set:
            prompt_ids = tokenizer.encode(fim_prompt(fixture), add_special_tokens=False)
            if not prompt_ids or len(prompt_ids) > 2048:
                raise ExperimentRejected("synthetic-input-too-long")
            inputs = torch.tensor([prompt_ids], dtype=torch.long, device=args.device)
            attention = torch.ones_like(inputs)
            if args.device == "cuda":
                torch.cuda.synchronize()
            started_ns = time.perf_counter_ns()
            generated = model.generate(
                input_ids=inputs,
                attention_mask=attention,
                do_sample=False,
                max_new_tokens=args.max_new_tokens,
                eos_token_id=stop_ids,
                pad_token_id=tokenizer.pad_token_id
            )
            if args.device == "cuda":
                torch.cuda.synchronize()
            elapsed_ns = time.perf_counter_ns() - started_ns
            if elapsed_ns < 0:
                raise ExperimentRejected("invalid-generation-clock")
            generation_ms = round(elapsed_ns / 1_000_000)
            tokens = generated[0, inputs.shape[1]:].tolist()
            reason = classify_generation_termination(
                tokens, stop_ids, args.max_new_tokens
            )
            # Raw completion remains in memory only; no IDs/code/special
            # model errors written into the console or an artifact.
            completion = tokenizer.decode(tokens, skip_special_tokens=False)
            insertion = normalize_completion(completion)
            exact = insertion == fixture["expected"]
            # Standard-library AST only: does not import or execute the
            # generated program; non-Python languages are explicitly unchecked.
            syntax_outcome = classify_generated_syntax(
                fixture, insertion, parse_typescript=classify_typescript_syntax
            )
            result.append({"language": fixture["language"], "exact": exact,
                           "syntaxOutcome": syntax_outcome,
                           "generationMs": generation_ms,
                           "generationTokens": len(tokens),
                           "terminationReason": reason})
    verify_smoke_inputs_unchanged(
        base_dir, base_identity,
        Path(args.adapter_dir) if args.adapter_dir else None,
        args.base_revision
    )
    return {
        "stage": "UNREVIEWED_REAL_LOCAL_SYNTHETIC_SMOKE",
        "realModelInferenceExecuted": True,
        "artifactKind": "local-lora-adapter" if args.adapter_dir else "local-base-model",
        "adapterReceiptVerified": bool(args.adapter_dir),
        "adapterReceiptProtocol": (
            ADAPTER_RECEIPT_PROTOCOL if args.adapter_dir else "not-applicable"
        ),
        **fingerprints(fixture_set, args.max_new_tokens),
        "selectedLanguage": args.language,
        "baseRevisionDeclared": args.base_revision,
        "baseConfigSha256": base_identity["baseConfigSha256"],
        "tokenizerSha256": base_identity["baseTokenizerSha256"],
        "baseWeightsSha256": base_identity["baseWeightsSha256"],
        "baseWeightFiles": base_identity["baseWeightFiles"],
        "runtimeProfile": runtime_profile,
        "maxNewTokens": args.max_new_tokens,
        **summarize(result),
        **generated_syntax_summary(result),
        **generation_latency_summary(result, args.max_new_tokens),
        "limitation": ("Strict synthetic equality and Python/TypeScript parser-only grammar; "
                       "C, C++ and Rust generated code remains unchecked. "
                       "No generated code execution, type correctness, "
                       "compiler, human, editor or deployment QA.")
    }


def parser() -> argparse.ArgumentParser:
    cli = argparse.ArgumentParser(
        description="Source-free, local-only FIM baseline or LoRA adapter smoke"
    )
    cli.add_argument("--language", choices=("all",) + LANGUAGES, default="all")
    cli.add_argument("--run", action="store_true", help="Load locally provisioned weights (default: plan)")
    cli.add_argument("--approve-checkpoint", action="store_true")
    cli.add_argument("--base-dir")
    cli.add_argument("--base-revision")
    cli.add_argument("--adapter-dir", help="Optional directory holding an independently trained local LoRA adapter")
    cli.add_argument("--device", choices=("cuda", "cpu"), default="cuda")
    cli.add_argument("--max-new-tokens", type=int, default=64)
    return cli


def main() -> int:
    args = parser().parse_args()
    try:
        if not 1 <= args.max_new_tokens <= 128:
            raise ExperimentRejected("invalid-token-cap")
        fixtures = select_public_fixtures(args.language)
        if not args.run:
            print(json.dumps({
                "stage": "OFFLINE_SYNTHETIC_PLAN_ONLY",
                "realModelInferenceExecuted": False,
                **fingerprints(fixtures, args.max_new_tokens),
                "selectedLanguage": args.language,
                "perLanguage": {language: sum(f["language"] == language for f in fixtures)
                                for language in LANGUAGES},
                "networkCalls": 0,
                "maxNewTokens": args.max_new_tokens,
                "warning": "Real model quality, latency, compilation and model license review NOT RUN."
            }, indent=2))
            return 0
        if not (args.approve_checkpoint and args.base_dir and args.base_revision and
                re.fullmatch(r"[a-f0-9]{40}", args.base_revision)):
            raise ExperimentRejected("independent-checkpoint-review-required")
        validate_local_checkpoint(Path(args.base_dir))
        if args.adapter_dir:
            validate_local_adapter(Path(args.adapter_dir))
        print(json.dumps(run_local(fixtures, args), indent=2))
        return 0
    except (ExperimentRejected, OSError, ValueError, KeyError, RuntimeError):
        print("LineLoom Code local synthetic smoke was rejected or failed; inspect local prerequisites.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
