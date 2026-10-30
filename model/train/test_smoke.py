"""No-GPU, no-network tests for optional Qwen FIM smoke runner."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

try:
    from . import smoke
    from .finetune import ExperimentRejected
except ImportError:
    import smoke
    from finetune import ExperimentRejected


class LocalSmokeTests(unittest.TestCase):
    def test_only_original_public_synthetic_cases_are_eligible(self):
        all_items = smoke.select_public_fixtures("all")
        self.assertEqual(len(all_items), 30)
        self.assertEqual(len({x["id"] for x in all_items}), 30)
        for language in smoke.LANGUAGES:
            selected = smoke.select_public_fixtures(language)
            self.assertEqual(len(selected), 6)
            self.assertTrue(all(s["language"] == language for s in selected))

    def test_fim_boundary_normalization_is_conservative(self):
        self.assertEqual(smoke.normalize_completion(" x + 2\r\n"), " x + 2\n")
        self.assertEqual(smoke.normalize_completion("print(x)<|fim_suffix|>rest"), "print(x)")
        self.assertEqual(smoke.normalize_completion("return 42<|endoftext|>"), "return 42")
        self.assertEqual(smoke.normalize_completion("a + b<|im_end|>"), "a + b")
        self.assertEqual(smoke.normalize_completion("value   "), "value   ")

    def test_aggregates_have_only_fixed_language_counts(self):
        result = smoke.summarize([
            {"language": "rust", "exact": True},
            {"language": "rust", "exact": False},
            {"language": "typescript", "exact": True}
        ])
        self.assertEqual(result["syntheticAttempts"], 3)
        self.assertEqual(result["strictExactMatches"], 2)
        self.assertEqual(result["perLanguage"]["rust"]["attempts"], 2)
        self.assertEqual(result["perLanguage"]["c"]["attempts"], 0)
        self.assertEqual(result["perLanguage"]["typescript"]["strictExactMatches"], 1)
        self.assertNotIn("prompt", json.dumps(result))
        with self.assertRaises(ExperimentRejected):
            smoke.summarize([{"language": "other", "exact": True}])
        with self.assertRaises(ExperimentRejected):
            smoke.summarize([{"language": "python", "exact": "yes"}])

    def test_generation_timing_nearest_rank_and_no_source_output(self):
        from_smoke = smoke.generation_latency_summary([
            {"language": "rust", "generationMs": 8},
            {"language": "rust", "generationMs": 20},
            {"language": "rust", "generationMs": 11},
            {"language": "python", "generationMs": 3},
        ])
        self.assertEqual(from_smoke["latencyMeasurement"], "monotonic-generation-only-v1")
        self.assertEqual(from_smoke["generationP50Ms"], 8)
        self.assertEqual(from_smoke["generationP95Ms"], 20)
        self.assertEqual(from_smoke["generationLatencyByLanguage"]["rust"],
                         {"attempts": 3, "p50Ms": 11, "p95Ms": 20})
        self.assertEqual(from_smoke["generationLatencyByLanguage"]["c"],
                         {"attempts": 0, "p50Ms": None, "p95Ms": None})
        self.assertNotIn("prefix", json.dumps(from_smoke))
        for invalid in (True, 1.5, -1, 3_600_001, float("nan"), "10"):
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                smoke.generation_latency_summary([
                    {"language": "rust", "generationMs": invalid}
                ])
        for invalid in ([], "invalid", [{"language": "other", "generationMs": 10}]):
            with self.assertRaises(ValueError):
                smoke.generation_latency_summary(invalid)

    def test_adapter_validation_requires_local_peft_files(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp)
            with self.assertRaises(ExperimentRejected):
                smoke.validate_local_adapter(path)
            (path / "adapter_config.json").write_text("{}", encoding="utf-8")
            with self.assertRaises(ExperimentRejected):
                smoke.validate_local_adapter(path)
            (path / "adapter_model.safetensors").write_bytes(b"test-only-no-weights")
            self.assertEqual(smoke.validate_local_adapter(path), path.resolve())

    def test_post_smoke_checkpoint_verification_rejects_disk_changes(self):
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp)
            initial_bytes = {
                "config.json": b'{"model_type":"synthetic"}',
                "tokenizer.json": b'{"test":true}',
                "model.safetensors": b"dummy local weights",
            }
            for filename, data in initial_bytes.items():
                (base / filename).write_bytes(data)
            identity = smoke.base_checkpoint_fingerprint(base)
            smoke.verify_smoke_inputs_unchanged(base, identity, None, "a" * 40)
            for filename, data in initial_bytes.items():
                with self.subTest(filename=filename):
                    (base / filename).write_bytes(data + b"mutated")
                    with self.assertRaises(ExperimentRejected):
                        smoke.verify_smoke_inputs_unchanged(
                            base, identity, None, "a" * 40
                        )
                    (base / filename).write_bytes(data)
            self.assertEqual(smoke.base_checkpoint_fingerprint(base), identity)

    def test_post_smoke_adapter_receipt_is_checked_again(self):
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp)
            (base / "config.json").write_bytes(b"dummy-config")
            (base / "tokenizer.json").write_bytes(b"dummy-tokenizer")
            (base / "model.safetensors").write_bytes(b"dummy-weights")
            identity = smoke.base_checkpoint_fingerprint(base)
            adapter = base / "experiment" / "adapter"
            with mock.patch.object(smoke, "verify_training_receipt") as verify:
                smoke.verify_smoke_inputs_unchanged(
                    base, identity, adapter, "a" * 40
                )
                verify.assert_called_once_with(adapter, base, "a" * 40)
            with mock.patch.object(
                smoke, "verify_training_receipt",
                side_effect=ExperimentRejected("adapter-changed")
            ):
                with self.assertRaises(ExperimentRejected):
                    smoke.verify_smoke_inputs_unchanged(
                        base, identity, adapter, "a" * 40
                    )

    def test_default_smoke_is_offline_plan_without_checkpoint_or_framework_import(self):
        script = str(Path(smoke.__file__).resolve())
        proc = subprocess.run(
            [sys.executable, script, "--language", "cpp", "--max-new-tokens", "32"],
            capture_output=True, text=True, timeout=20
        )
        self.assertEqual(proc.returncode, 0, proc.stderr)
        result = json.loads(proc.stdout)
        self.assertEqual(result["stage"], "OFFLINE_SYNTHETIC_PLAN_ONLY")
        self.assertEqual(result["syntheticFixtures"], 6)
        self.assertEqual(result["perLanguage"]["cpp"], 6)
        self.assertEqual(result["networkCalls"], 0)
        self.assertFalse(result["realModelInferenceExecuted"])
        self.assertEqual(result["benchmarkProtocol"], "lineloom-hf-synthetic-smoke-v4")
        self.assertEqual(result["generationPolicy"], "greedy-fim-v2")
        self.assertEqual(result["selectedLanguage"], "cpp")
        self.assertEqual(len(result["fixtureSetSha256"]), 64)
        self.assertEqual(len(result["requestSpecSha256"]), 64)
        self.assertNotIn("baseConfigSha256", result)
        self.assertNotIn("tokenizerSha256", result)
        self.assertNotIn("rust-arithmetic", proc.stdout)
        self.assertNotIn("fn ", proc.stdout)
        self.assertEqual(proc.stderr, "")

    def test_real_adapter_smoke_refuses_missing_receipt_before_model_import(self):
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp) / "base"
            adapter = Path(temp) / "experiment" / "adapter"
            base.mkdir()
            adapter.mkdir(parents=True)
            (base / "config.json").write_text("{}", encoding="utf-8")
            (base / "tokenizer.json").write_text("{}", encoding="utf-8")
            (base / "model.safetensors").write_bytes(b"test-only")
            (adapter / "adapter_config.json").write_text("{}", encoding="utf-8")
            (adapter / "adapter_model.safetensors").write_bytes(b"test-only")
            command = [
                sys.executable, str(Path(smoke.__file__).resolve()),
                "--run", "--approve-checkpoint", "--base-dir", str(base),
                "--base-revision", "a" * 40, "--adapter-dir", str(adapter),
            ]
            run = subprocess.run(command, capture_output=True, text=True, timeout=20)
            self.assertEqual(run.returncode, 1)
            self.assertEqual(run.stdout, "")
            self.assertNotIn(str(base), run.stderr)
            self.assertNotIn(str(adapter), run.stderr)
            self.assertNotIn("test-only", run.stderr)

    def test_explicit_run_fails_without_reviewed_local_checkpoint(self):
        script = str(Path(smoke.__file__).resolve())
        cases = [
            ["--run", "--base-dir", "/private/missing-checkpoint"],
            ["--run", "--approve-checkpoint"],
            ["--run", "--approve-checkpoint", "--base-dir", "/private/missing-checkpoint",
             "--base-revision", "not-a-commit"],
            ["--max-new-tokens", "129"],
            ["--max-new-tokens", "0"],
        ]
        for flags in cases:
            proc = subprocess.run(
                [sys.executable, script] + flags, capture_output=True, text=True, timeout=20
            )
            self.assertEqual(proc.returncode, 1)
            self.assertEqual(proc.stdout, "")
            self.assertNotIn("/private/missing-checkpoint", proc.stderr)
            self.assertNotIn("not-a-commit", proc.stderr)


if __name__ == "__main__":
    unittest.main()
