"""No-GPU, no-network tests for optional Qwen FIM smoke runner."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

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
        self.assertEqual(result["benchmarkProtocol"], "lineloom-hf-synthetic-smoke-v2")
        self.assertEqual(result["generationPolicy"], "greedy-fim-v2")
        self.assertEqual(result["selectedLanguage"], "cpp")
        self.assertEqual(len(result["fixtureSetSha256"]), 64)
        self.assertEqual(len(result["requestSpecSha256"]), 64)
        self.assertNotIn("baseConfigSha256", result)
        self.assertNotIn("tokenizerSha256", result)
        self.assertNotIn("rust-arithmetic", proc.stdout)
        self.assertNotIn("fn ", proc.stdout)
        self.assertEqual(proc.stderr, "")

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
