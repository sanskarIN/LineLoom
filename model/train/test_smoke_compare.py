"""Pure, offline smoke-report comparison tests. No real model runs."""
from __future__ import annotations

import copy
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

try:
    from . import compare_smoke
    from .smoke_report import (
        GENERATION_POLICY, LANGUAGES, PROTOCOL, SmokeReportRejected,
        fingerprints, hash_local_metadata_file, read_public_fixtures
    )
except ImportError:
    import compare_smoke
    from smoke_report import (
        GENERATION_POLICY, LANGUAGES, PROTOCOL, SmokeReportRejected,
        fingerprints, hash_local_metadata_file, read_public_fixtures
    )


def simulated_report(kind: str, language: str = "all", tokens: int = 64,
                     score: int = 2) -> dict:
    """Test-only synthetic counts; never claim these represent real inference."""
    selected = read_public_fixtures(language)
    groups = {}
    for name in LANGUAGES:
        attempts = sum(item["language"] == name for item in selected)
        groups[name] = {
            "attempts": attempts,
            "strictExactMatches": min(score, attempts),
        }
    return {
        "stage": "UNREVIEWED_REAL_LOCAL_SYNTHETIC_SMOKE",
        "realModelInferenceExecuted": True,
        "artifactKind": kind,
        "adapterReceiptVerified": kind == "local-lora-adapter",
        "adapterReceiptProtocol": (
            "lineloom-local-adapter-receipt-v2"
            if kind == "local-lora-adapter" else "not-applicable"
        ),
        "selectedLanguage": language,
        "maxNewTokens": tokens,
        "baseRevisionDeclared": "1" * 40,
        "baseConfigSha256": "a" * 64,
        "tokenizerSha256": "b" * 64,
        "baseWeightsSha256": "c" * 64,
        "baseWeightFiles": 2,
        **fingerprints(selected, tokens),
        "syntheticAttempts": len(selected),
        "strictExactMatches": sum(x["strictExactMatches"] for x in groups.values()),
        "perLanguage": groups,
    }


class FingerprintTests(unittest.TestCase):
    def test_language_coverage_is_fixed_and_source_free(self):
        all_cases = read_public_fixtures("all")
        self.assertEqual(len(all_cases), 30)
        self.assertEqual(len({x["id"] for x in all_cases}), 30)
        self.assertEqual(
            {language: len(read_public_fixtures(language)) for language in LANGUAGES},
            dict.fromkeys(LANGUAGES, 6))
        with self.assertRaises(SmokeReportRejected):
            read_public_fixtures("javascript")

    def test_fingerprint_is_deterministic_and_sensitive_to_scope_request_and_expected(self):
        cases = read_public_fixtures("rust")
        one = fingerprints(cases, 64)
        self.assertEqual(one, fingerprints(cases, 64))
        self.assertEqual(one["benchmarkProtocol"], PROTOCOL)
        self.assertEqual(one["generationPolicy"], GENERATION_POLICY)
        self.assertEqual(len(one["fixtureSetSha256"]), 64)
        self.assertNotEqual(one["requestSpecSha256"],
                            fingerprints(cases, 32)["requestSpecSha256"])
        self.assertEqual(one["fixtureSetSha256"],
                         fingerprints(cases, 32)["fixtureSetSha256"])
        changed = copy.deepcopy(cases)
        changed[0]["expected"] += "changed"
        self.assertNotEqual(one["fixtureSetSha256"],
                            fingerprints(changed, 64)["fixtureSetSha256"])
        self.assertEqual(one["requestSpecSha256"],
                         fingerprints(changed, 64)["requestSpecSha256"])
        changed[0]["prefix"] += "changed"
        self.assertNotEqual(one["requestSpecSha256"],
                            fingerprints(changed, 64)["requestSpecSha256"])
        with self.assertRaises(SmokeReportRejected):
            fingerprints(cases, 129)

    def test_local_metadata_fingerprint_is_bounded_and_not_file_content(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "tokenizer.json"
            with self.assertRaises(SmokeReportRejected):
                hash_local_metadata_file(path)
            path.write_bytes(b"")
            with self.assertRaises(SmokeReportRejected):
                hash_local_metadata_file(path)
            path.write_bytes(b"original synthetic file")
            self.assertEqual(
                hash_local_metadata_file(path),
                hashlib.sha256(b"original synthetic file").hexdigest())
            with self.assertRaises(SmokeReportRejected):
                hash_local_metadata_file(path, limit_bytes=4)


class CompareSmokeTests(unittest.TestCase):
    def setUp(self):
        self.base = simulated_report("local-base-model", score=1)
        self.adapter = simulated_report("local-lora-adapter", score=2)

    def test_compatible_counts_are_only_source_free_descriptive_deltas(self):
        result = compare_smoke.compare_reports(self.base, self.adapter)
        self.assertEqual(result["adapterMinusBase"], 5)
        self.assertEqual(result["syntheticAttemptsPerModel"], 30)
        self.assertEqual(result["perLanguage"]["rust"]["adapterMinusBase"], 1)
        self.assertEqual(result["perLanguage"]["cpp"]["attemptsPerModel"], 6)
        self.assertEqual(result["verdict"], "DESCRIPTIVE_SYNTHETIC_COUNTS_ONLY")
        self.assertNotIn("fixtureSetSha256", result)
        self.assertNotIn("baseRevisionDeclared", result)
        self.assertNotIn("Qwen", json.dumps(result))

    def test_single_language_scope_and_no_false_improvement(self):
        a = simulated_report("local-base-model", language="cpp", score=3)
        b = simulated_report("local-lora-adapter", language="cpp", score=1)
        result = compare_smoke.compare_reports(a, b)
        self.assertEqual(result["adapterMinusBase"], -2)
        self.assertEqual(result["perLanguage"]["rust"]["attemptsPerModel"], 0)
        self.assertEqual(result["perLanguage"]["cpp"]["attemptsPerModel"], 6)

    def test_mismatched_identity_scope_and_generation_rejected(self):
        for field, other in (
            ("baseRevisionDeclared", "2" * 40),
            ("baseConfigSha256", "c" * 64),
            ("tokenizerSha256", "d" * 64),
            ("baseWeightsSha256", "e" * 64),
            ("baseWeightFiles", 3),
        ):
            candidate = copy.deepcopy(self.adapter)
            candidate[field] = other
            with self.subTest(field=field), self.assertRaises(SmokeReportRejected):
                compare_smoke.compare_reports(self.base, candidate)
        for changes in (
            {"selectedLanguage": "cpp"},
            {"maxNewTokens": 33},
            {"fixtureSetSha256": "c" * 64},
            {"requestSpecSha256": "c" * 64},
            {"benchmarkProtocol": "lineloom-hf-synthetic-smoke-v1"},
            {"generationPolicy": "changed"},
            {"realModelInferenceExecuted": False},
            {"stage": "OFFLINE_SYNTHETIC_PLAN_ONLY"},
            {"artifactKind": "local-base-model"},
            {"adapterReceiptVerified": False},
            {"adapterReceiptProtocol": "unknown"},
            {"baseRevisionDeclared": "a" * 39},
            {"baseWeightsSha256": "not-a-digest"},
            {"baseWeightFiles": True},
        ):
            candidate = copy.deepcopy(self.adapter)
            candidate.update(changes)
            with self.subTest(changes=changes), self.assertRaises(SmokeReportRejected):
                compare_smoke.compare_reports(self.base, candidate)

    def test_tampered_counts_boolean_and_report_content_rejected(self):
        cases = (
            ("syntheticAttempts", True),
            ("syntheticAttempts", 29),
            ("strictExactMatches", 31),
            ("strictExactMatches", 10.0),
            ("perLanguage", {}),
        )
        for field, value in cases:
            candidate = copy.deepcopy(self.adapter)
            candidate[field] = value
            with self.subTest(field=field, value=value), self.assertRaises(SmokeReportRejected):
                compare_smoke.compare_reports(self.base, candidate)
        candidate = copy.deepcopy(self.adapter)
        candidate["perLanguage"]["rust"]["strictExactMatches"] = 5
        with self.assertRaises(SmokeReportRejected):
            compare_smoke.compare_reports(self.base, candidate)
        candidate = copy.deepcopy(self.adapter)
        candidate["perLanguage"]["c"]["attempts"] = True
        with self.assertRaises(SmokeReportRejected):
            compare_smoke.compare_reports(self.base, candidate)
        candidate = copy.deepcopy(self.adapter)
        candidate["perLanguage"]["cpp"]["extra"] = "private code"
        with self.assertRaises(SmokeReportRejected):
            compare_smoke.compare_reports(self.base, candidate)

    def test_wrong_base_and_adapter_positions_rejected(self):
        with self.assertRaises(SmokeReportRejected):
            compare_smoke.compare_reports(self.adapter, self.base)

    def test_json_loading_rejects_duplicates_nonfinite_and_oversize(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "private-report.json"
            for raw in ('{"x":1,"x":2}', '{"x":NaN}', '[]',
                        '{"secret":"' + "x" * 40_000 + '"}'):
                path.write_text(raw, encoding="utf-8")
                with self.assertRaises(SmokeReportRejected):
                    compare_smoke.load_report(path)
            path.write_text(json.dumps(self.base), encoding="utf-8")
            self.assertEqual(compare_smoke.load_report(path)["artifactKind"],
                             "local-base-model")
            link = Path(temp) / "alias.json"
            try:
                link.symlink_to(path)
            except OSError:
                # Some Windows runners deny symlink creation to unprivileged users.
                pass
            else:
                with self.assertRaises(SmokeReportRejected):
                    compare_smoke.load_report(link)

    def test_cli_compares_only_report_files_without_echoing_paths(self):
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp) / "private-base.json"
            adapter = Path(temp) / "private-adapter.json"
            base.write_text(json.dumps(self.base), encoding="utf-8")
            adapter.write_text(json.dumps(self.adapter), encoding="utf-8")
            cli = str(Path(compare_smoke.__file__).resolve())
            command = [sys.executable, cli, "--base", str(base), "--adapter", str(adapter)]
            run = subprocess.run(command, capture_output=True, text=True, timeout=15)
            self.assertEqual(run.returncode, 0, run.stderr)
            result = json.loads(run.stdout)
            self.assertEqual(result["adapterMinusBase"], 5)
            self.assertNotIn(str(base), run.stdout)
            self.assertNotIn("fn ", run.stdout)
            adapter.write_text('{"invalid":"private source secret"}', encoding="utf-8")
            run = subprocess.run(command, capture_output=True, text=True, timeout=15)
            self.assertEqual(run.returncode, 1)
            self.assertEqual(run.stdout, "")
            self.assertNotIn(str(adapter), run.stderr)
            self.assertNotIn("private source secret", run.stderr)


if __name__ == "__main__":
    unittest.main()
