"""Offline integrity gate regression tests: no model files, GPU, or network."""
from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

try:
    from . import integrity as integrity_module
    from .integrity import (
        PROTOCOL, IntegrityRejected, adapter_artifact_hashes,
        base_metadata_hashes, read_training_receipt, verify_training_receipt
    )
except ImportError:
    import integrity as integrity_module
    from integrity import (
        PROTOCOL, IntegrityRejected, adapter_artifact_hashes,
        base_metadata_hashes, read_training_receipt, verify_training_receipt
    )

REVISION = "0123456789abcdef" * 2 + "01234567"


def fabricated_local_experiment(root: Path) -> tuple[Path, Path]:
    """A made-up receipt over dummy test bytes, NEVER actual training."""
    base = root / "local-base"
    adapter = root / "private-experiment" / "adapter"
    base.mkdir()
    adapter.mkdir(parents=True)
    (base / "config.json").write_text('{"architectures":["dummy"]}', encoding="utf-8")
    (base / "tokenizer.json").write_text('{"dummy":true}', encoding="utf-8")
    (adapter / "adapter_config.json").write_text('{"r":8}', encoding="utf-8")
    (adapter / "adapter_model.safetensors").write_bytes(b"synthetic test weights only")
    (adapter / "README.md").write_text("Dummy, not a trained model\n", encoding="utf-8")
    receipt = {
        "adapterReceiptProtocol": PROTOCOL,
        "stage": "LOCAL_UNREVIEWED_ADAPTER_EXPERIMENT",
        "trainingExecuted": True,
        "published": False,
        "testSamplesUsed": 0,
        "baseRevisionDeclared": REVISION,
        "trainingManifestSha256": "c" * 64,
        "trainSamples": 5,
        "validationSamples": 5,
        "adapterFileSha256": adapter_artifact_hashes(adapter),
        **base_metadata_hashes(base),
    }
    (adapter.parent / "experiment.json").write_text(
        json.dumps(receipt, sort_keys=True), encoding="utf-8"
    )
    return base, adapter


class AdapterIntegrityTests(unittest.TestCase):
    def test_valid_source_free_receipt_verifies_all_adapter_files(self):
        with tempfile.TemporaryDirectory() as temp:
            base, adapter = fabricated_local_experiment(Path(temp))
            result = verify_training_receipt(adapter, base, REVISION)
            self.assertEqual(result["status"], "LOCAL_ADAPTER_INTEGRITY_CHECK_PASS")
            self.assertTrue(result["baseMetadataVerified"])
            self.assertEqual(result["adapterFilesVerified"], 3)
            self.assertNotIn(str(base), json.dumps(result))
            self.assertNotIn(str(adapter), json.dumps(result))
            self.assertNotIn("synthetic test weights", json.dumps(result))

    def test_modified_weights_and_extra_file_are_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            base, adapter = fabricated_local_experiment(Path(temp))
            weights = adapter / "adapter_model.safetensors"
            weights.write_bytes(weights.read_bytes() + b"tampered")
            with self.assertRaises(IntegrityRejected):
                verify_training_receipt(adapter, base, REVISION)
            # Restore exactly the bytes recorded in the receipt.
            weights.write_bytes(b"synthetic test weights only")
            (adapter / "injected.bin").write_bytes(b"other content")
            with self.assertRaises(IntegrityRejected):
                verify_training_receipt(adapter, base, REVISION)

    def test_mismatched_checkpoint_revision_or_tokenizer_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            base, adapter = fabricated_local_experiment(Path(temp))
            with self.assertRaises(IntegrityRejected):
                verify_training_receipt(adapter, base, "f" * 40)
            (base / "tokenizer.json").write_text('{"dummy":false}', encoding="utf-8")
            with self.assertRaises(IntegrityRejected):
                verify_training_receipt(adapter, base, REVISION)

    def test_wrong_base_config_and_missing_receipt_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            base, adapter = fabricated_local_experiment(Path(temp))
            (base / "config.json").write_text("changed base config", encoding="utf-8")
            with self.assertRaises(IntegrityRejected):
                verify_training_receipt(adapter, base, REVISION)
            (adapter.parent / "experiment.json").unlink()
            with self.assertRaises(IntegrityRejected):
                verify_training_receipt(adapter, base, REVISION)

    def test_untrusted_receipt_claims_are_fail_closed(self):
        for patch in (
            {"stage": "OFFLINE_PLAN_ONLY"},
            {"trainingExecuted": False},
            {"published": True},
            {"testSamplesUsed": 1},
            {"testSamplesUsed": False},
            {"baseRevisionDeclared": "f" * 40},
            {"baseConfigSha256": "f" * 64},
            {"baseTokenizerSha256": "f" * 64},
            {"adapterReceiptProtocol": "legacy"},
            {"adapterFileSha256": {"adapter_model.safetensors": "f" * 64}},
        ):
            with self.subTest(patch=patch):
                with tempfile.TemporaryDirectory() as temp:
                    base, adapter = fabricated_local_experiment(Path(temp))
                    receipt_path = adapter.parent / "experiment.json"
                    receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
                    receipt.update(patch)
                    receipt_path.write_text(json.dumps(receipt), encoding="utf-8")
                    with self.assertRaises(IntegrityRejected):
                        verify_training_receipt(adapter, base, REVISION)

    def test_refuses_malformed_duplicates_and_oversized_receipts(self):
        with tempfile.TemporaryDirectory() as temp:
            base, adapter = fabricated_local_experiment(Path(temp))
            receipt = adapter.parent / "experiment.json"
            for payload in ('{"foo":1,"foo":2}', '{"x":NaN}', "[]",
                            '{"secret":"' + "x" * 40_000 + '"}'):
                receipt.write_text(payload, encoding="utf-8")
                with self.assertRaises(IntegrityRejected):
                    verify_training_receipt(adapter, base, REVISION)
            receipt.unlink()
            with self.assertRaises(IntegrityRejected):
                read_training_receipt(receipt)

    def test_nested_paths_use_relative_keys_without_basename_collision(self):
        with tempfile.TemporaryDirectory() as temp:
            base, adapter = fabricated_local_experiment(Path(temp))
            (adapter / "sub").mkdir()
            (adapter / "sub" / "README.md").write_text("separate", encoding="utf-8")
            hashes = adapter_artifact_hashes(adapter)
            self.assertIn("README.md", hashes)
            self.assertIn("sub/README.md", hashes)
            self.assertNotEqual(hashes["README.md"], hashes["sub/README.md"])
            # Extra file not present in the signed-looking but unsigned
            # receipt is refused rather than silently ignored.
            with self.assertRaises(IntegrityRejected):
                verify_training_receipt(adapter, base, REVISION)

    def test_symlink_or_empty_artifacts_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            base, adapter = fabricated_local_experiment(Path(temp))
            injected = adapter / "linked.bin"
            try:
                injected.symlink_to(base / "config.json")
            except (OSError, NotImplementedError):
                # Symlinks may require Windows developer privileges.
                pass
            else:
                with self.assertRaises(IntegrityRejected):
                    adapter_artifact_hashes(adapter)
                injected.unlink()
            (adapter / "empty.bin").write_bytes(b"")
            with self.assertRaises(IntegrityRejected):
                adapter_artifact_hashes(adapter)

    def test_regular_file_path_swap_is_rejected_before_hashing_other_content(self):
        # Simulate the exact lstat/open gap, not just a static symlink.
        with tempfile.TemporaryDirectory() as temp:
            base, adapter = fabricated_local_experiment(Path(temp))
            target = adapter / "adapter_model.safetensors"
            displaced = adapter / "original.tmp"
            external = Path(temp) / "unrelated-private-source"
            external.write_bytes(b"not an adapter artifact")
            original_open = os.open
            changed = False

            def swap_then_open(path, flags, *args, **kwargs):
                nonlocal changed
                if Path(path) == target and not changed:
                    changed = True
                    target.rename(displaced)
                    try:
                        target.symlink_to(external)
                    except (OSError, NotImplementedError):
                        displaced.rename(target)
                        raise unittest.SkipTest("Symlink creation not supported in this environment")
                return original_open(path, flags, *args, **kwargs)

            with mock.patch.object(integrity_module.os, "open", side_effect=swap_then_open):
                with self.assertRaises(IntegrityRejected):
                    adapter_artifact_hashes(adapter)
            self.assertTrue(changed)

    def test_receipt_path_swap_is_rejected_before_json_read(self):
        with tempfile.TemporaryDirectory() as temp:
            base, adapter = fabricated_local_experiment(Path(temp))
            receipt = adapter.parent / "experiment.json"
            displaced = adapter.parent / "original-receipt.tmp"
            foreign = Path(temp) / "unrelated-private-json"
            foreign.write_text('{"secret":"never-consume"}', encoding="utf-8")
            original_open = os.open
            swapped = False

            def swap_then_open(path, flags, *args, **kwargs):
                nonlocal swapped
                if Path(path) == receipt and not swapped:
                    swapped = True
                    receipt.rename(displaced)
                    try:
                        receipt.symlink_to(foreign)
                    except (OSError, NotImplementedError):
                        displaced.rename(receipt)
                        raise unittest.SkipTest("Symlink creation not supported in this environment")
                return original_open(path, flags, *args, **kwargs)

            with mock.patch.object(integrity_module.os, "open", side_effect=swap_then_open):
                with self.assertRaises(IntegrityRejected):
                    read_training_receipt(receipt)
            self.assertTrue(swapped)

    def test_cli_outputs_only_fixed_metadata_and_sanitized_failures(self):
        script = str(Path(__file__).resolve().with_name("verify_adapter.py"))
        with tempfile.TemporaryDirectory() as temp:
            base, adapter = fabricated_local_experiment(Path(temp))
            command = [sys.executable, script, "--base-dir", str(base),
                       "--adapter-dir", str(adapter), "--base-revision", REVISION]
            good = subprocess.run(command, text=True, capture_output=True, timeout=15)
            self.assertEqual(good.returncode, 0, good.stderr)
            self.assertEqual(json.loads(good.stdout)["adapterFilesVerified"], 3)
            self.assertNotIn(str(base), good.stdout)
            (adapter / "adapter_config.json").write_text("corrupted", encoding="utf-8")
            bad = subprocess.run(command, text=True, capture_output=True, timeout=15)
            self.assertEqual(bad.returncode, 1)
            self.assertEqual(bad.stdout, "")
            self.assertNotIn(str(base), bad.stderr)
            self.assertNotIn(str(adapter), bad.stderr)


if __name__ == "__main__":
    unittest.main()
