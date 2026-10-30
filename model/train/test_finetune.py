"""No network, GPU or third-party framework needed for this unittest suite."""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

try:
    from . import finetune
except ImportError:
    import finetune


class FakeQwenTokenizer:
    pad_token_id = 3
    eos_token_id = 2
    _tokens = {
        finetune.FIM_PREFIX: 100,
        finetune.FIM_SUFFIX: 101,
        finetune.FIM_MIDDLE: 102,
    }

    def encode(self, text, add_special_tokens=False):
        if text in self._tokens:
            return [self._tokens[text]]
        result = []
        while text:
            found = next((key for key in self._tokens if text.startswith(key)), None)
            if found:
                result.append(self._tokens[found])
                text = text[len(found):]
            else:
                result.append(ord(text[0]) + 200)
                text = text[1:]
        return result

    def convert_tokens_to_ids(self, token):
        return self._tokens.get(token, -1)


class FimEncodingTests(unittest.TestCase):
    def setUp(self):
        self.tokenizer = FakeQwenTokenizer()
        self.sample = {
            "prefix": "fn calc(x: i32) -> i32 { ",
            "middle": "x + 3",
            "suffix": " }",
            "split": "train", "language": "rust"
        }

    def test_fim_order_includes_suffix_before_middle(self):
        expected = (finetune.FIM_PREFIX + self.sample["prefix"] +
                    finetune.FIM_SUFFIX + self.sample["suffix"] +
                    finetune.FIM_MIDDLE)
        self.assertEqual(finetune.fim_prompt(self.sample), expected)
        finetune.verify_fim_tokenizer(self.tokenizer)
        encoded = finetune.encode_fim(self.sample, self.tokenizer, 1024)
        prefix = self.tokenizer.encode(expected, add_special_tokens=False)
        target = self.tokenizer.encode(self.sample["middle"], add_special_tokens=False)
        self.assertEqual(encoded["input_ids"], prefix + target + [self.tokenizer.eos_token_id])
        self.assertEqual(encoded["labels"], [-100] * len(prefix) + target + [2])
        self.assertEqual(encoded["attention_mask"], [1] * len(encoded["input_ids"]))

    def test_target_token_weights_exclude_masked_prompt_but_include_eos(self):
        item = finetune.encode_fim(self.sample, self.tokenizer, 1024)
        supervised = sum(label != -100 for label in item["labels"])
        middle = self.tokenizer.encode(self.sample["middle"], add_special_tokens=False)
        self.assertEqual(supervised, len(middle) + 1)
        self.assertEqual(item["labels"][-1], self.tokenizer.eos_token_id)
        self.assertEqual(item["labels"].count(-100),
                         len(self.tokenizer.encode(
                             finetune.fim_prompt(self.sample), add_special_tokens=False)))

    def test_suffix_cannot_leak_loss_into_prompt(self):
        encoded = finetune.encode_fim(self.sample, self.tokenizer, 1024)
        suffix_marker = encoded["input_ids"].index(101)
        self.assertEqual(encoded["labels"][suffix_marker], -100)
        self.assertEqual(encoded["labels"][suffix_marker + 1], -100)
        self.assertEqual(encoded["labels"].count(-100), len(self.tokenizer.encode(
            finetune.fim_prompt(self.sample), add_special_tokens=False)))

    def test_tokenizer_with_missing_fim_or_eos_fails_closed(self):
        class BadTokenizer(FakeQwenTokenizer):
            def encode(self, text, add_special_tokens=False):
                if text == finetune.FIM_SUFFIX:
                    return [301, 302]
                return super().encode(text, add_special_tokens)
        with self.assertRaises(finetune.ExperimentRejected):
            finetune.verify_fim_tokenizer(BadTokenizer())
        no_eos = FakeQwenTokenizer()
        no_eos.eos_token_id = None
        with self.assertRaises(finetune.ExperimentRejected):
            finetune.verify_fim_tokenizer(no_eos)

    def test_rejects_embedded_fim_or_chat_control_tokens_in_each_field(self):
        for token in finetune.RESERVED_MODEL_TOKENS:
            for part in ("prefix", "middle", "suffix"):
                sample = dict(self.sample)
                sample[part] += " /* " + token + " */"
                with self.subTest(token=token, part=part):
                    with self.assertRaises(finetune.ExperimentRejected):
                        finetune.encode_fim(sample, self.tokenizer, 1024)

    def test_rejects_tokenizer_that_merges_across_prompt_target_boundary(self):
        class MergingTokenizer(FakeQwenTokenizer):
            def encode(self, text, add_special_tokens=False):
                ids = super().encode(text, add_special_tokens)
                full = finetune.fim_prompt(self_sample) + self_sample["middle"]
                if text == full:
                    return ids[:-2] + [987654]  # different canonical boundary
                return ids
        self_sample = self.sample
        with self.assertRaises(finetune.ExperimentRejected):
            finetune.encode_fim(self.sample, MergingTokenizer(), 1024)

    def test_fim_markers_must_be_distinct_and_not_collide_with_eos(self):
        overlapping = FakeQwenTokenizer()
        overlapping._tokens = dict(FakeQwenTokenizer._tokens)
        overlapping._tokens[finetune.FIM_SUFFIX] = overlapping._tokens[finetune.FIM_PREFIX]
        with self.assertRaises(finetune.ExperimentRejected):
            finetune.verify_fim_tokenizer(overlapping)
        ambiguous_eos = FakeQwenTokenizer()
        ambiguous_eos.eos_token_id = 102
        with self.assertRaises(finetune.ExperimentRejected):
            finetune.verify_fim_tokenizer(ambiguous_eos)

    def test_overlong_samples_rejected_not_silently_truncated(self):
        with self.assertRaises(finetune.ExperimentRejected):
            finetune.encode_fim(self.sample, self.tokenizer, 24)
        huge = dict(self.sample, middle="x" * 300)
        with self.assertRaises(finetune.ExperimentRejected):
            finetune.encode_fim(huge, self.tokenizer, 1024)

    def test_padding_masks_non_targets(self):
        first = finetune.encode_fim(self.sample, self.tokenizer, 1024)
        second = finetune.encode_fim(dict(self.sample, middle="z"), self.tokenizer, 1024)
        batch = finetune.pad_examples([first, second], self.tokenizer.pad_token_id)
        self.assertEqual(len(batch["input_ids"][0]), len(batch["input_ids"][1]))
        self.assertEqual(batch["attention_mask"][1][-1], 0)
        self.assertEqual(batch["labels"][1][-1], -100)
        self.assertEqual(batch["input_ids"][1][-1], self.tokenizer.pad_token_id)
        with self.assertRaises(finetune.ExperimentRejected):
            finetune.pad_examples([], 3)


def synthetic_manifest():
    records = []
    for s, split in enumerate(("train", "validation", "test")):
        for i, language in enumerate(finetune.LANGUAGES):
            index = s * 5 + i
            unique = hashlib.sha256(("lineloom-fim-local-test-" + str(index)).encode()).hexdigest()
            records.append({
                "id": "fabricated-" + str(index),
                "language": language,
                "split": split,
                "repositoryGroup": "fabricated-group-" + str(index),
                "sourceRevision": format(index + 1, "040x"),
                "spdxLicense": "MIT",
                "rightsReviewed": True,
                "optOutReviewed": True,
                "attributionReviewed": True,
                "prefix": "/*" + unique + "*/ const synthetic_" + str(index) + " = (value) => ",
                "middle": "value + " + str(1000 + index),
                "suffix": "; // " + unique[::-1],
            })
    return {"schemaVersion": 1, "samples": records}


class LocalGateTests(unittest.TestCase):
    def test_approved_manifest_plan_invokes_real_node_auditor_without_training(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "secret-synthetic-data.json"
            path.write_text(json.dumps(synthetic_manifest()), encoding="utf-8")
            script = Path(finetune.__file__).resolve()
            result = subprocess.run(
                [sys.executable, str(script), "--manifest", str(path)],
                capture_output=True, text=True, timeout=25
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            summary = json.loads(result.stdout)
            self.assertEqual(summary["stage"], "OFFLINE_PLAN_ONLY")
            self.assertFalse(summary["trainingExecuted"])
            self.assertEqual(summary["samples"], 15)
            self.assertEqual(summary["byLanguageAndSplit"]["cpp"]["test"], 1)
            self.assertEqual(summary["trainingSampler"], "seeded-language-balanced-v1")
            self.assertEqual(summary["plannedTrainingLossObjective"],
                             "per-step-supervised-token-mean-v1")
            self.assertEqual(summary["plannedTrainingMicrobatches"], 40)
            self.assertEqual(summary["plannedTrainingMicrobatchesByLanguage"],
                             {language: 8 for language in finetune.LANGUAGES})
            self.assertEqual(summary["seed"], 42)
            self.assertNotIn("fabricated-group", result.stdout)
            self.assertNotIn("const synthetic_", result.stdout)
            self.assertNotIn(str(path), result.stdout)
            self.assertFalse((Path(tmp) / "adapter").exists())

    def test_rejects_missing_language_holdout_and_obvious_secret_without_echo(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "sensitive-file.json"
            source = synthetic_manifest()
            source["samples"] = [s for s in source["samples"]
                                 if not (s["language"] == "cpp" and s["split"] == "test")]
            path.write_text(json.dumps(source), encoding="utf-8")
            run = subprocess.run(
                [sys.executable, str(Path(finetune.__file__).resolve()),
                 "--manifest", str(path)], capture_output=True, text=True, timeout=25
            )
            self.assertEqual(run.returncode, 1)
            self.assertNotIn("sensitive-file", run.stderr)
            self.assertEqual(run.stdout, "")
            source = synthetic_manifest()
            source["samples"][0]["middle"] = 'api_key = "supersecretlocalprivate"'
            path.write_text(json.dumps(source), encoding="utf-8")
            again = subprocess.run(
                [sys.executable, str(Path(finetune.__file__).resolve()),
                 "--manifest", str(path)], capture_output=True, text=True, timeout=25
            )
            self.assertEqual(again.returncode, 1)
            self.assertNotIn("supersecret", again.stderr)
            self.assertEqual(again.stdout, "")

    def test_manifest_reader_rejects_oversize_symlink_and_invalid_metadata(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "reviewed-test-manifest.json"
            source.write_text(json.dumps(synthetic_manifest()), encoding="utf-8")
            self.assertGreater(len(finetune.read_bounded_manifest_bytes(source)), 0)
            alias = Path(tmp) / "alias.json"
            try:
                alias.symlink_to(source)
            except OSError:
                # Symlink creation may require privileges on Windows.
                pass
            else:
                with self.assertRaises(finetune.ExperimentRejected):
                    finetune.read_bounded_manifest_bytes(alias)
            source.write_bytes(b"x" * (finetune.MAX_MANIFEST_BYTES + 1))
            with self.assertRaises(finetune.ExperimentRejected):
                finetune.read_bounded_manifest_bytes(source)
            source.write_bytes(b"")
            with self.assertRaises(finetune.ExperimentRejected):
                finetune.read_bounded_manifest_bytes(source)

    def test_python_gate_rejects_numeric_identity_and_extra_fields(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "reviewed-synthetic.json"
            for change in (
                lambda document: document["samples"][0].update({"id": 123}),
                lambda document: document["samples"][0].update({"repositoryGroup": 123}),
                lambda document: document["samples"][0].update({"undocumented": "secret"}),
            ):
                document = synthetic_manifest()
                change(document)
                path.write_text(json.dumps(document), encoding="utf-8")
                result = subprocess.run(
                    [sys.executable, str(Path(finetune.__file__).resolve()),
                     "--manifest", str(path)],
                    capture_output=True, text=True, timeout=25
                )
                self.assertEqual(result.returncode, 1)
                self.assertEqual(result.stdout, "")
                self.assertNotIn(str(path), result.stderr)
                self.assertNotIn("secret", result.stderr)

    def test_train_cannot_start_without_approval_or_base_revision(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "private.json"
            path.write_text(json.dumps(synthetic_manifest()), encoding="utf-8")
            out = Path(tmp) / "not-created-output"
            cmd = [sys.executable, str(Path(finetune.__file__).resolve()),
                   "--manifest", str(path), "--train",
                   "--output-dir", str(out)]
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=25)
            self.assertEqual(r.returncode, 1)
            self.assertFalse(out.exists())
            self.assertEqual(r.stdout, "")
            self.assertNotIn(str(path), r.stderr)

    def test_output_is_restricted_to_ignored_dir_or_elsewhere(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual(
                finetune.check_output_destination(Path(tmp) / "private-adapter"),
                (Path(tmp) / "private-adapter").resolve()
            )
            with self.assertRaises(finetune.ExperimentRejected):
                finetune.check_output_destination(finetune.ROOT / "model" / "bad-artifacts")
            self.assertEqual(
                finetune.check_output_destination(finetune.ROOT / "model" / "runs" / "new"),
                (finetune.ROOT / "model" / "runs" / "new").resolve()
            )
            with self.assertRaises(finetune.ExperimentRejected):
                finetune.check_output_destination(finetune.ROOT)

    def test_checkpoint_requires_explicit_preprovisioned_safetensors_and_tokenizer(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp)
            with self.assertRaises(finetune.ExperimentRejected):
                finetune.validate_local_checkpoint(path)
            (path / "config.json").write_text("{}", encoding="utf-8")
            (path / "model.safetensors").write_bytes(b"test-only")
            with self.assertRaises(finetune.ExperimentRejected):
                finetune.validate_local_checkpoint(path)
            (path / "tokenizer.json").write_text("{}", encoding="utf-8")
            self.assertEqual(finetune.validate_local_checkpoint(path), path.resolve())

if __name__ == "__main__":
    unittest.main()
