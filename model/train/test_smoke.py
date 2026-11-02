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
        self.assertEqual(len(all_items), 40)
        self.assertEqual(len({x["id"] for x in all_items}), 40)
        for language in smoke.LANGUAGES:
            selected = smoke.select_public_fixtures(language)
            self.assertEqual(len(selected), 8)
            self.assertTrue(all(s["language"] == language for s in selected))

    def test_fim_boundary_normalization_preserves_literal_marker_text(self):
        normalize = smoke.normalize_completion
        self.assertEqual(normalize(" x + 2\r\n"), " x + 2\n")
        self.assertEqual(normalize("line\rnext"), "line\nnext")
        self.assertEqual(normalize('print("<|fim_suffix|>")'), 'print("<|fim_suffix|>")')
        self.assertEqual(normalize('return "<|endoftext|>"'), 'return "<|endoftext|>"')
        self.assertEqual(normalize("a + b<|im_end|>"), "a + b<|im_end|>")
        self.assertEqual(normalize("value   "), "value   ")
        with self.assertRaises(ExperimentRejected):
            normalize(None)

    def test_token_id_stop_handling_keeps_literal_marker_source(self):
        class TestTokenizer:
            def __init__(self):
                self.calls = []

            def decode(self, token_ids, *, skip_special_tokens):
                self.calls.append((list(token_ids), skip_special_tokens))
                vocab = {5: 'return "<|fim_suffix|>"', 6: ' + "<|endoftext|>"',
                         7: "\r\n", 99: "<|fim_suffix|>"}
                return "".join(vocab[token] for token in token_ids)

        tokenizer = TestTokenizer()
        self.assertEqual(
            smoke.decode_generated_insertion(
                tokenizer, [5, 6, 99], [99], "stop-token"
            ), 'return "<|fim_suffix|>" + "<|endoftext|>"'
        )
        self.assertEqual(tokenizer.calls[-1], ([5, 6], False))
        self.assertEqual(
            smoke.decode_generated_insertion(
                tokenizer, [5, 7], [99], "token-limit"
            ), 'return "<|fim_suffix|>"\n'
        )
        self.assertEqual(tokenizer.calls[-1], ([5, 7], False))
        self.assertEqual(
            smoke.decode_generated_insertion(
                tokenizer, [99], [99], "stop-token"
            ), ""
        )
        self.assertEqual(tokenizer.calls[-1], ([], False))

    def test_token_id_decoder_rejects_bad_termination_and_sanitizes_errors(self):
        class FakeTokenizer:
            def decode(self, *_args, **_kwargs):
                raise RuntimeError("PRIVATE_MODEL_TEXT")

        cases = [
            ([1, 99], [99], "token-limit"),
            ([1, 2], [99], "stop-token"),
            ([99, 1], [99], "token-limit"),
            ([99, 99], [99], "stop-token"),
            ([True], [99], "token-limit"),
            ([1], [], "token-limit"),
            ([], [99], "token-limit"),
            ([1], [99], "unchecked"),
            ([1], [99], True),
        ]
        for tokens, stops, reason in cases:
            with self.subTest(tokens=tokens, reason=reason):
                with self.assertRaises(ExperimentRejected):
                    smoke.decode_generated_insertion(
                        FakeTokenizer(), tokens, stops, reason
                    )
        with self.assertRaises(ExperimentRejected) as caught:
            smoke.decode_generated_insertion(
                FakeTokenizer(), [1, 2], [99], "token-limit"
            )
        self.assertNotIn("PRIVATE_MODEL_TEXT", str(caught.exception))

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

    def test_input_prompt_token_counts_are_bounded_source_free_and_complete(self):
        results = [
            {"language": "rust", "promptTokens": 10,
             "promptIdsSha256": smoke.fingerprint_prompt_token_ids([4] * 10),
             "secret": "PRIVATE_CODE"},
            {"language": "rust", "promptTokens": 25,
             "promptIdsSha256": smoke.fingerprint_prompt_token_ids([6] * 25)},
            {"language": "typescript", "promptTokens": 2048,
             "promptIdsSha256": smoke.fingerprint_prompt_token_ids([8] * 2048)},
        ]
        summary = smoke.prompt_token_summary(results)
        self.assertEqual(summary["inputTokenAccounting"],
                         "tokenizer-encoded-fim-prompt-ids-v1")
        self.assertEqual(summary["inputTokenCount"], 2083)
        self.assertEqual(len(summary["inputLengthSequenceSha256"]), 64)
        self.assertEqual(len(summary["inputTokenSequenceSha256"]), 64)
        self.assertEqual(smoke.prompt_token_summary(results), summary)
        reordered = smoke.prompt_token_summary([results[1], results[0], results[2]])
        self.assertEqual(reordered["inputTokenCount"], summary["inputTokenCount"])
        self.assertEqual(reordered["inputTokensByLanguage"], summary["inputTokensByLanguage"])
        self.assertNotEqual(reordered["inputLengthSequenceSha256"],
                            summary["inputLengthSequenceSha256"])
        self.assertNotEqual(reordered["inputTokenSequenceSha256"],
                            summary["inputTokenSequenceSha256"])
        self.assertEqual(summary["inputTokensByLanguage"]["rust"],
                         {"attempts": 2, "totalTokens": 35})
        self.assertEqual(summary["inputTokensByLanguage"]["typescript"],
                         {"attempts": 1, "totalTokens": 2048})
        self.assertEqual(summary["inputTokensByLanguage"]["python"],
                         {"attempts": 0, "totalTokens": 0})
        self.assertNotIn("PRIVATE_CODE", json.dumps(summary))
        self.assertNotIn("secret", json.dumps(summary))
        same_lengths_different_ids = [dict(result) for result in results]
        same_lengths_different_ids[0]["promptIdsSha256"] = (
            smoke.fingerprint_prompt_token_ids([5] * 10)
        )
        changed = smoke.prompt_token_summary(same_lengths_different_ids)
        self.assertEqual(changed["inputTokenCount"], summary["inputTokenCount"])
        self.assertEqual(changed["inputLengthSequenceSha256"],
                         summary["inputLengthSequenceSha256"])
        self.assertNotEqual(changed["inputTokenSequenceSha256"],
                            summary["inputTokenSequenceSha256"])
        for invalid in ("ABC" * 21 + "A", "z" * 64, True, None, ""):
            broken = [dict(results[0], promptIdsSha256=invalid)]
            with self.subTest(digest=repr(invalid)[:12]), self.assertRaises(ValueError):
                smoke.prompt_token_summary(broken)
        for value in (True, None, 0, -1, 2049, 1.5, "5"):
            with self.subTest(value=repr(value)), self.assertRaises(ValueError):
                smoke.prompt_token_summary([{"language": "rust", "promptTokens": value}])
        for invalid in (
            [], None, "invalid",
            [{"language": "other", "promptTokens": 10}],
            [{"language": "rust"}],
            [{"language": "rust", "promptTokens": 1}] * 41,
        ):
            with self.subTest(invalid=repr(invalid)[:28]), self.assertRaises(ValueError):
                smoke.prompt_token_summary(invalid)

    def test_real_prompt_token_id_digest_requires_bounded_integer_sequence(self):
        digest = smoke.fingerprint_prompt_token_ids([101, 42, 9])
        self.assertEqual(len(digest), 64)
        self.assertEqual(digest, smoke.fingerprint_prompt_token_ids([101, 42, 9]))
        self.assertNotEqual(digest, smoke.fingerprint_prompt_token_ids([101, 9, 42]))
        self.assertNotEqual(digest, smoke.fingerprint_prompt_token_ids([101, 42]))
        self.assertNotIn("101", digest)
        for invalid in (
            None, [], (), [True], [-1], ["1"], [1.5],
            [2 ** 31], [0] * 2049, "private", [[1]],
        ):
            with self.subTest(kind=repr(invalid)[:30]), self.assertRaises(ValueError):
                smoke.fingerprint_prompt_token_ids(invalid)

    def test_generation_timing_nearest_rank_and_no_source_output(self):
        from_smoke = smoke.generation_latency_summary([
            {"language": "rust", "generationMs": 8, "generationTokens": 2,
             "terminationReason": "stop-token"},
            {"language": "rust", "generationMs": 20, "generationTokens": 3,
             "terminationReason": "stop-token"},
            {"language": "rust", "generationMs": 11, "generationTokens": 4,
             "terminationReason": "stop-token"},
            {"language": "python", "generationMs": 3, "generationTokens": 5,
             "terminationReason": "stop-token"},
        ])
        self.assertEqual(from_smoke["latencyMeasurement"], "monotonic-generation-only-v1")
        self.assertEqual(from_smoke["generationP50Ms"], 8)
        self.assertEqual(from_smoke["generationP95Ms"], 20)
        self.assertEqual(from_smoke["generationLatencyByLanguage"]["rust"],
                         {"attempts": 3, "p50Ms": 11, "p95Ms": 20})
        self.assertEqual(from_smoke["generationLatencyByLanguage"]["c"],
                         {"attempts": 0, "p50Ms": None, "p95Ms": None})
        self.assertEqual(from_smoke["generatedTokenAccounting"], "new-token-ids-including-stop-v1")
        self.assertEqual(from_smoke["generatedTokenCount"], 14)
        self.assertEqual(from_smoke["terminationAccounting"], "stop-token-or-token-limit-v1")
        self.assertEqual(from_smoke["terminationCounts"], {"stopToken": 4, "tokenLimit": 0})
        self.assertEqual(from_smoke["terminationByLanguage"]["rust"],
                         {"attempts": 3, "stopToken": 3, "tokenLimit": 0})
        self.assertEqual(from_smoke["generatedTokensByLanguage"]["rust"],
                         {"attempts": 3, "totalTokens": 9})
        self.assertEqual(from_smoke["generatedTokensByLanguage"]["c"],
                         {"attempts": 0, "totalTokens": 0})
        self.assertNotIn("prefix", json.dumps(from_smoke))
        for invalid in (True, 1.5, -1, 3_600_001, float("nan"), "10"):
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                smoke.generation_latency_summary([
                    {"language": "rust", "generationMs": invalid,
                     "generationTokens": 1, "terminationReason": "stop-token"}
                ])
        for invalid in ([], "invalid", [{"language": "other", "generationMs": 10,
                                            "generationTokens": 1, "terminationReason": "stop-token"}]):
            with self.assertRaises(ValueError):
                smoke.generation_latency_summary(invalid)
        for invalid in (None, True, 0, -1, 129, 1.5, float("nan"), "10"):
            with self.subTest(token_count=invalid), self.assertRaises(ValueError):
                smoke.generation_latency_summary([
                    {"language": "rust", "generationMs": 10,
                     "generationTokens": invalid, "terminationReason": "stop-token"}
                ])
        with self.assertRaises(ValueError):
            smoke.generation_latency_summary([
                {"language": "rust", "generationMs": 10, "generationTokens": 3,
                 "terminationReason": "stop-token"}
            ], max_new_tokens=2)

    def test_fim_termination_classification_is_exact_and_private(self):
        classify = smoke.classify_generation_termination
        stop = [2, 13]
        self.assertEqual(classify([5, 13], stop, 5), "stop-token")
        self.assertEqual(classify([5, 6, 7], stop, 3), "token-limit")
        # Stop at the exact cap is still a stop-token exit, never a truncation.
        self.assertEqual(classify([3, 13], stop, 2), "stop-token")
        for ids, endings, cap in (
            ([], stop, 5), ([3], stop, 5),
            ([13, 5], stop, 5), ([3, 13, 5], stop, 5),
            ([4, 5, 6], stop, 2), ([True], stop, 1),
            ([1], [True], 1), ([1], [], 1),
            ([1], stop, 0), ([1], stop, True),
        ):
            with self.subTest(ids=ids, stop=endings, cap=cap), self.assertRaises(ValueError):
                classify(ids, endings, cap)
        values = smoke.generation_latency_summary([
            {"language": "rust", "generationMs": 10, "generationTokens": 4,
             "terminationReason": "token-limit"},
            {"language": "c", "generationMs": 8, "generationTokens": 2,
             "terminationReason": "stop-token"},
        ], max_new_tokens=4)
        self.assertEqual(values["terminationCounts"], {"stopToken": 1, "tokenLimit": 1})
        self.assertEqual(values["terminationByLanguage"]["rust"]["tokenLimit"], 1)
        self.assertEqual(values["terminationByLanguage"]["cpp"]["attempts"], 0)
        self.assertNotIn("generated_ids", json.dumps(values))
        for reason, count in (
            ("token-limit", 3), ("invalid", 4), (True, 4),
        ):
            with self.subTest(reason=reason), self.assertRaises(ValueError):
                smoke.generation_latency_summary([
                    {"language": "rust", "generationMs": 10,
                     "generationTokens": count, "terminationReason": reason}
                ], max_new_tokens=4)

    def test_source_free_runtime_profile_is_bounded_and_exact(self):
        from copy import deepcopy
        from_synthetic = {
            "device": "cpu", "precision": "float32",
            "operatingSystem": "Linux", "pythonVersion": "3.11.8",
            "torchVersion": "2.5.1+cpu", "transformersVersion": "4.47.1",
            "cudaRuntimeVersion": None, "hipRuntimeVersion": None,
        }
        profile = smoke.checked_runtime_profile(from_synthetic)
        self.assertEqual(profile, from_synthetic)
        self.assertIsNot(profile, from_synthetic)
        self.assertNotIn("source", json.dumps(profile))
        self.assertNotIn("hostname", json.dumps(profile))
        for field, value in (
            ("device", "unreviewed-backend"), ("precision", "bfloat16"),
            ("pythonVersion", ""), ("torchVersion", "x version"),
            ("transformersVersion", "4.47.1\\nprivate"),
            ("cudaRuntimeVersion", "private/device"),
        ):
            candidate = deepcopy(from_synthetic)
            candidate[field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                smoke.checked_runtime_profile(candidate)
        candidate = deepcopy(from_synthetic)
        candidate["host"] = "private-host"
        with self.assertRaises(ValueError):
            smoke.checked_runtime_profile(candidate)
        cuda = dict(from_synthetic, device="cuda", precision="bfloat16",
                    cudaRuntimeVersion="12.4")
        self.assertEqual(smoke.checked_runtime_profile(cuda), cuda)

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
        self.assertEqual(result["syntheticFixtures"], 8)
        self.assertEqual(result["perLanguage"]["cpp"], 8)
        self.assertEqual(result["networkCalls"], 0)
        self.assertFalse(result["realModelInferenceExecuted"])
        self.assertEqual(result["benchmarkProtocol"], "lineloom-hf-synthetic-smoke-v12")
        self.assertEqual(result["generationPolicy"], "greedy-fim-v3")
        self.assertEqual(result["selectedLanguage"], "cpp")
        self.assertEqual(len(result["fixtureSetSha256"]), 64)
        self.assertEqual(len(result["requestSpecSha256"]), 64)
        self.assertNotIn("baseConfigSha256", result)
        self.assertNotIn("tokenizerSha256", result)
        self.assertNotIn("rust-arithmetic", proc.stdout)
        self.assertNotIn("fn ", proc.stdout)
        self.assertEqual(proc.stderr, "")

    def test_native_compiler_mode_requires_run_and_separate_approval(self):
        script = str(Path(smoke.__file__).resolve())
        cases = (
            ["--native-syntax"],
            ["--native-syntax", "--approve-local-compilers"],
            ["--native-syntax", "--run"],
        )
        for flags in cases:
            with self.subTest(flags=flags):
                result = subprocess.run(
                    [sys.executable, script] + flags,
                    capture_output=True, text=True, timeout=20
                )
                self.assertEqual(result.returncode, 1)
                self.assertEqual(result.stdout, "")
                self.assertIn("smoke was rejected", result.stderr)
        normal = subprocess.run(
            [sys.executable, script, "--language", "rust"],
            capture_output=True, text=True, timeout=20
        )
        self.assertEqual(normal.returncode, 0, normal.stderr)
        self.assertNotIn("syntaxAccounting", normal.stdout)

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
