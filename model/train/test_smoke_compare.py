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
    from .generated_syntax import generated_syntax_summary
    from .smoke_report import (
        GENERATION_POLICY, LANGUAGES, PROTOCOL, SmokeReportRejected,
        fingerprints, hash_local_metadata_file, read_public_fixtures, generation_latency_summary
    )
except ImportError:
    import compare_smoke
    from generated_syntax import generated_syntax_summary
    from smoke_report import (
        GENERATION_POLICY, LANGUAGES, PROTOCOL, SmokeReportRejected,
        fingerprints, hash_local_metadata_file, read_public_fixtures, generation_latency_summary
    )


def simulated_report(kind: str, language: str = "all", tokens: int = 64,
                     score: int = 2, token_cap_exits: int = 0,
                     python_syntax_failures: int = 0,
                     typescript_syntax_failures: int = 0) -> dict:
    """Test-only synthetic counts; never claim these represent real inference."""
    selected = read_public_fixtures(language)
    groups = {}
    for name in LANGUAGES:
        attempts = sum(item["language"] == name for item in selected)
        groups[name] = {
            "attempts": attempts,
            "strictExactMatches": min(score, attempts),
        }
    seen_python = 0
    seen_typescript = 0
    outcomes = []
    for fixture in selected:
        status = "unchecked"
        if fixture["language"] == "python":
            status = ("failed" if seen_python < python_syntax_failures
                      else "passed")
            seen_python += 1
        if fixture["language"] == "typescript":
            status = ("failed" if seen_typescript < typescript_syntax_failures
                      else "passed")
            seen_typescript += 1
        outcomes.append({"language": fixture["language"], "syntaxOutcome": status})
    timings = generation_latency_summary([
        {"language": item["language"],
         "generationMs": (index + 1) * (2 if kind == "local-lora-adapter" else 1),
         "generationTokens": (
             tokens if index < token_cap_exits else
             (index % 3) + (2 if kind == "local-lora-adapter" else 1)),
         "terminationReason": (
             "token-limit" if index < token_cap_exits else "stop-token")}
        for index, item in enumerate(selected)
    ], tokens)
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
        "runtimeProfile": {
            "device": "cpu", "precision": "float32",
            "operatingSystem": "Linux", "pythonVersion": "3.11.8",
            "torchVersion": "2.5.1+cpu", "transformersVersion": "4.47.1",
            "cudaRuntimeVersion": None, "hipRuntimeVersion": None,
        },
        **fingerprints(selected, tokens),
        "syntheticAttempts": len(selected),
        "strictExactMatches": sum(x["strictExactMatches"] for x in groups.values()),
        "perLanguage": groups,
        **generated_syntax_summary(outcomes),
        **timings,
    }


class FingerprintTests(unittest.TestCase):
    def test_language_coverage_is_fixed_and_source_free(self):
        all_cases = read_public_fixtures("all")
        self.assertEqual(len(all_cases), 40)
        self.assertEqual(len({x["id"] for x in all_cases}), 40)
        self.assertEqual(
            {language: len(read_public_fixtures(language)) for language in LANGUAGES},
            dict.fromkeys(LANGUAGES, 8))
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
        self.assertEqual(result["syntheticAttemptsPerModel"], 40)
        self.assertEqual(result["perLanguage"]["rust"]["adapterMinusBase"], 1)
        self.assertEqual(result["perLanguage"]["cpp"]["attemptsPerModel"], 8)
        self.assertEqual(result["verdict"], "DESCRIPTIVE_SYNTHETIC_COUNTS_ONLY")
        self.assertEqual(result["comparisonProtocol"], "lineloom-hf-synthetic-comparison-v8")
        self.assertEqual(result["latencyMeasurement"], "monotonic-generation-only-v1")
        self.assertEqual(result["generationP50DeltaMs"], 20)
        self.assertEqual(result["generationP95DeltaMs"], 38)
        self.assertEqual(result["perLanguage"]["rust"]["generationP95DeltaMs"], 32)
        self.assertTrue(result["runtimeProfileComparable"])
        self.assertEqual(result["runtimeProfileFieldsChecked"], 8)
        self.assertNotIn("runtimeProfile", result)
        self.assertEqual(result["generatedTokenAccounting"], "new-token-ids-including-stop-v1")
        self.assertEqual(result["baseGeneratedTokens"], 79)
        self.assertEqual(result["adapterGeneratedTokens"], 119)
        self.assertEqual(result["generatedTokenDelta"], 40)
        self.assertEqual(result["generatedTokenCountStatus"], "DIFFERENT_GENERATED_TOKEN_TOTALS")
        self.assertEqual(result["perLanguage"]["rust"]["generatedTokenDelta"], 8)
        self.assertEqual(result["terminationAccounting"], "stop-token-or-token-limit-v1")
        self.assertEqual(result["baseTokenLimitExits"], 0)
        self.assertEqual(result["adapterTokenLimitExits"], 0)
        self.assertEqual(result["terminationReview"], "NO_TOKEN_LIMIT_EXITS_RECORDED")
        self.assertEqual(result["syntaxAccounting"], "python-ast-typescript-parser-v1")
        self.assertEqual(result["syntaxCheckedPerModel"], 16)
        self.assertEqual(result["syntaxUncheckedPerModel"], 24)
        self.assertEqual(result["basePythonAstPassed"], 8)
        self.assertEqual(result["adapterPythonAstPassed"], 8)
        self.assertEqual(result["pythonAstPassedDelta"], 0)
        self.assertEqual(result["syntaxReview"],
                         "PYTHON_TYPESCRIPT_PARSERS_ONLY_OTHER_LANGUAGES_UNCHECKED")
        self.assertEqual(result["perLanguage"]["rust"]["syntaxCheckedPerModel"], 0)
        self.assertEqual(result["perLanguage"]["python"]["baseSyntaxPassed"], 8)
        self.assertEqual(result["perLanguage"]["typescript"]["baseSyntaxPassed"], 8)
        self.assertEqual(result["baseTypeScriptParserPassed"], 8)
        self.assertEqual(result["perLanguage"]["rust"]["tokenLimitExitDelta"], 0)

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
        self.assertEqual(result["perLanguage"]["rust"]["generationP50DeltaMs"], None)
        self.assertEqual(result["perLanguage"]["cpp"]["generationP95DeltaMs"], 8)
        self.assertEqual(result["generatedTokenDelta"], 8)
        self.assertEqual(result["perLanguage"]["rust"]["generatedTokenDelta"], 0)

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

    def test_latency_fields_are_bounded_and_language_scoped(self):
        cases = (
            {"latencyMeasurement": "unverified-timer"},
            {"generationP50Ms": True},
            {"generationP50Ms": -1},
            {"generationP95Ms": 3_600_001},
            {"generationP50Ms": self.adapter["generationP95Ms"] + 1},
            {"generationLatencyByLanguage": {}},
        )
        for changes in cases:
            candidate = copy.deepcopy(self.adapter)
            candidate.update(changes)
            with self.subTest(changes=changes), self.assertRaises(SmokeReportRejected):
                compare_smoke.compare_reports(self.base, candidate)
        for language in ("rust", "python"):
            candidate = copy.deepcopy(self.adapter)
            candidate["generationLatencyByLanguage"][language]["attempts"] = 5
            with self.assertRaises(SmokeReportRejected):
                compare_smoke.compare_reports(self.base, candidate)
            candidate = copy.deepcopy(self.adapter)
            candidate["generationLatencyByLanguage"][language]["p95Ms"] = True
            with self.assertRaises(SmokeReportRejected):
                compare_smoke.compare_reports(self.base, candidate)
        cpp_only = simulated_report("local-lora-adapter", language="cpp")
        cpp_only["generationLatencyByLanguage"]["rust"]["p50Ms"] = 0
        with self.assertRaises(SmokeReportRejected):
            compare_smoke.compare_reports(
                simulated_report("local-base-model", language="cpp"), cpp_only
            )

    def test_generated_token_accounting_catches_inconsistent_or_malformed_reports(self):
        cases = [
            ("generatedTokenAccounting", "unverified"),
            ("generatedTokenCount", True),
            ("generatedTokenCount", -1),
            ("generatedTokenCount", 40 * 129),
            ("generatedTokensByLanguage", {}),
        ]
        for field, value in cases:
            candidate = copy.deepcopy(self.adapter)
            candidate[field] = value
            with self.subTest(field=field), self.assertRaises(SmokeReportRejected):
                compare_smoke.compare_reports(self.base, candidate)
        for lang in ("rust", "python"):
            for change in (
                {"totalTokens": True},
                {"totalTokens": -1},
                {"totalTokens": 8 * 65},
                {"attempts": 9},
                {"extra": "private source"},
            ):
                candidate = copy.deepcopy(self.adapter)
                candidate["generatedTokensByLanguage"][lang].update(change)
                with self.subTest(language=lang, change=change), self.assertRaises(SmokeReportRejected):
                    compare_smoke.compare_reports(self.base, candidate)
        candidate = copy.deepcopy(self.adapter)
        candidate["generatedTokensByLanguage"]["cpp"]["totalTokens"] += 1
        with self.assertRaises(SmokeReportRejected):
            compare_smoke.compare_reports(self.base, candidate)

    def test_equal_aggregate_token_totals_do_not_claim_per_probe_parity(self):
        candidate = copy.deepcopy(self.adapter)
        candidate["generatedTokenCount"] = self.base["generatedTokenCount"]
        candidate["generatedTokensByLanguage"] = copy.deepcopy(
            self.base["generatedTokensByLanguage"]
        )
        result = compare_smoke.compare_reports(self.base, candidate)
        self.assertEqual(result["generatedTokenCountStatus"], "AGGREGATE_TOKEN_TOTALS_MATCH_ONLY")
        self.assertEqual(result["generatedTokenDelta"], 0)
        self.assertIn("even equal totals", result["limitation"])

    def test_token_limit_exits_trigger_review_without_code_or_ids(self):
        base = simulated_report("local-base-model", token_cap_exits=1)
        adapter = simulated_report("local-lora-adapter", token_cap_exits=2)
        result = compare_smoke.compare_reports(base, adapter)
        self.assertEqual(result["baseTokenLimitExits"], 1)
        self.assertEqual(result["adapterTokenLimitExits"], 2)
        self.assertEqual(result["tokenLimitExitDelta"], 1)
        self.assertEqual(result["perLanguage"]["rust"]["tokenLimitExitDelta"], 1)
        self.assertEqual(result["terminationReview"], "TOKEN_LIMIT_EXITS_REQUIRE_REVIEW")
        self.assertNotIn("runtimeProfile", result)
        self.assertNotIn("generationTokens", result)
        self.assertNotIn("fixtureSetSha256", result)
        self.assertNotIn("fn ", json.dumps(result))
        single = compare_smoke.compare_reports(
            simulated_report("local-base-model", language="cpp", token_cap_exits=1),
            simulated_report("local-lora-adapter", language="cpp", token_cap_exits=0))
        self.assertEqual(single["perLanguage"]["cpp"]["tokenLimitExitDelta"], -1)
        self.assertEqual(single["perLanguage"]["python"]["tokenLimitExitDelta"], 0)

    def test_invalid_termination_counts_and_inconsistent_totals_rejected(self):
        for field, value in (
            ("terminationAccounting", "unknown"),
            ("terminationCounts", {}),
            ("terminationByLanguage", {}),
        ):
            candidate = copy.deepcopy(self.adapter)
            candidate[field] = value
            with self.subTest(field=field), self.assertRaises(SmokeReportRejected):
                compare_smoke.compare_reports(self.base, candidate)
        for field, value in (
            ("stopToken", True),
            ("stopToken", -1),
            ("tokenLimit", 31),
        ):
            candidate = copy.deepcopy(self.adapter)
            candidate["terminationCounts"][field] = value
            with self.subTest(field=field, value=value), self.assertRaises(SmokeReportRejected):
                compare_smoke.compare_reports(self.base, candidate)
        for field, value in (
            ("attempts", 5), ("stopToken", 5),
            ("tokenLimit", 1), ("tokenLimit", True),
        ):
            candidate = copy.deepcopy(self.adapter)
            candidate["terminationByLanguage"]["rust"][field] = value
            with self.subTest(field=field, value=value), self.assertRaises(SmokeReportRejected):
                compare_smoke.compare_reports(self.base, candidate)
        candidate = copy.deepcopy(self.adapter)
        candidate["terminationByLanguage"]["rust"]["rawSource"] = "private"
        with self.assertRaises(SmokeReportRejected):
            compare_smoke.compare_reports(self.base, candidate)
        candidate = copy.deepcopy(self.adapter)
        candidate["terminationCounts"] = {"stopToken": 29, "tokenLimit": 1}
        candidate["terminationByLanguage"]["rust"].update({
            "stopToken": 5, "tokenLimit": 1
        })
        # Merely inventing an exit cannot explain output shorter than cap.
        with self.assertRaises(SmokeReportRejected):
            compare_smoke.compare_reports(self.base, candidate)

    def test_python_ast_failures_reported_without_generated_source(self):
        base = simulated_report("local-base-model", python_syntax_failures=2)
        adapter = simulated_report("local-lora-adapter", python_syntax_failures=1)
        result = compare_smoke.compare_reports(base, adapter)
        self.assertEqual(result["basePythonAstPassed"], 6)
        self.assertEqual(result["adapterPythonAstPassed"], 7)
        self.assertEqual(result["pythonAstPassedDelta"], 1)
        self.assertEqual(result["basePythonAstFailed"], 2)
        self.assertEqual(result["syntaxReview"], "GENERATED_SYNTAX_FAILURES_REQUIRE_REVIEW")
        self.assertEqual(result["perLanguage"]["python"]["adapterSyntaxFailed"], 1)
        self.assertNotIn("syntaxByLanguage", result)
        self.assertNotIn("generatedSource", result)
        only_rust = compare_smoke.compare_reports(
            simulated_report("local-base-model", language="rust"),
            simulated_report("local-lora-adapter", language="rust")
        )
        self.assertEqual(only_rust["syntaxCheckedPerModel"], 0)
        self.assertEqual(only_rust["syntaxUncheckedPerModel"], 8)
        self.assertEqual(only_rust["syntaxReview"], "NO_SYNTAX_CHECKS_FOR_SCOPE")

    def test_typescript_syntax_deltas_are_separate_from_python_ast_deltas(self):
        base = simulated_report("local-base-model", typescript_syntax_failures=2)
        adapter = simulated_report("local-lora-adapter", typescript_syntax_failures=1)
        compared = compare_smoke.compare_reports(base, adapter)
        self.assertEqual(compared["baseTypeScriptParserPassed"], 6)
        self.assertEqual(compared["adapterTypeScriptParserPassed"], 7)
        self.assertEqual(compared["typeScriptParserPassedDelta"], 1)
        self.assertEqual(compared["baseTypeScriptParserFailed"], 2)
        self.assertEqual(compared["adapterTypeScriptParserFailed"], 1)
        self.assertEqual(compared["pythonAstPassedDelta"], 0)
        self.assertEqual(compared["perLanguage"]["typescript"]["syntaxPassedDelta"], 1)
        self.assertEqual(compared["syntaxReview"], "GENERATED_SYNTAX_FAILURES_REQUIRE_REVIEW")

        selected = compare_smoke.compare_reports(
            simulated_report("local-base-model", language="typescript"),
            simulated_report("local-lora-adapter", language="typescript")
        )
        self.assertEqual(selected["syntaxCheckedPerModel"], 8)
        self.assertEqual(selected["syntaxUncheckedPerModel"], 0)
        self.assertEqual(selected["basePythonAstPassed"], 0)
        self.assertEqual(selected["baseTypeScriptParserPassed"], 8)

    def test_fabricated_ast_totals_and_illegal_non_python_passes_rejected(self):
        for field, value in (
            ("syntaxAccounting", "unapproved"),
            ("syntaxChecked", True),
            ("syntaxChecked", 5),
            ("syntaxPassed", -1),
            ("syntaxFailed", 7),
            ("syntaxUnchecked", 23),
            ("syntaxByLanguage", {}),
        ):
            candidate = copy.deepcopy(self.adapter)
            candidate[field] = value
            with self.subTest(field=field), self.assertRaises(SmokeReportRejected):
                compare_smoke.compare_reports(self.base, candidate)
        for language, changed in (
            ("python", {"passed": 5}),
            ("python", {"checked": 5}),
            ("python", {"failed": 1}),
            ("typescript", {"checked": 5}),
            ("typescript", {"unchecked": 1}),
            ("typescript", {"passed": 5}),
            ("typescript", {"failed": 1}),
            ("rust", {"passed": 1}),
            ("rust", {"unchecked": 5}),
            ("c", {"unchecked": True}),
            ("cpp", {"unknown": "private-code"}),
        ):
            candidate = copy.deepcopy(self.adapter)
            candidate["syntaxByLanguage"][language].update(changed)
            with self.subTest(language=language, changed=changed), self.assertRaises(
                SmokeReportRejected
            ):
                compare_smoke.compare_reports(self.base, candidate)
        candidate = simulated_report("local-lora-adapter", python_syntax_failures=5)
        # A fabricated exact-match count cannot exceed Python AST successes.
        with self.assertRaises(SmokeReportRejected):
            compare_smoke.compare_reports(self.base, candidate)
        candidate = simulated_report("local-lora-adapter",
                                     typescript_syntax_failures=5)
        with self.assertRaises(SmokeReportRejected):
            compare_smoke.compare_reports(self.base, candidate)

    def test_runtime_profiles_block_cross_environment_comparisons(self):
        profile = self.adapter["runtimeProfile"]
        cases = (
            ("device", "cuda"),
            ("precision", "bfloat16"),
            ("operatingSystem", "Windows"),
            ("pythonVersion", "3.12.4"),
            ("torchVersion", "2.6.0+cu124"),
            ("transformersVersion", "4.48.2"),
            ("cudaRuntimeVersion", "12.4"),
            ("hipRuntimeVersion", "6.3"),
        )
        for field, change in cases:
            candidate = copy.deepcopy(self.adapter)
            candidate["runtimeProfile"][field] = change
            with self.subTest(field=field), self.assertRaises(SmokeReportRejected):
                compare_smoke.compare_reports(self.base, candidate)
        # A valid CUDA profile is comparable ONLY to the same CUDA profile.
        base = copy.deepcopy(self.base)
        adapter = copy.deepcopy(self.adapter)
        for report in (base, adapter):
            report["runtimeProfile"].update({
                "device": "cuda", "precision": "bfloat16",
                "cudaRuntimeVersion": "12.4",
            })
        result = compare_smoke.compare_reports(base, adapter)
        self.assertTrue(result["runtimeProfileComparable"])

    def test_runtime_profiles_reject_bad_types_extra_keys_and_leaked_values(self):
        cases = (
            ("runtimeProfile", {}),
            ("runtimeProfile", None),
            ("runtimeProfile", "cpu"),
        )
        for field, value in cases:
            candidate = copy.deepcopy(self.adapter)
            candidate[field] = value
            with self.subTest(value=value), self.assertRaises(SmokeReportRejected):
                compare_smoke.compare_reports(self.base, candidate)
        for field, value in (
            ("device", True),
            ("device", "gpu"),
            ("precision", "float16"),
            ("operatingSystem", "private-hostname"),
            ("torchVersion", "2.5.1\\nprivate-code"),
            ("transformersVersion", ""),
            ("cudaRuntimeVersion", "secret private path"),
            ("pythonVersion", 3.11),
            ("hipRuntimeVersion", 12),
        ):
            candidate = copy.deepcopy(self.adapter)
            candidate["runtimeProfile"][field] = value
            with self.subTest(field=field), self.assertRaises(SmokeReportRejected):
                compare_smoke.compare_reports(self.base, candidate)
        candidate = copy.deepcopy(self.adapter)
        candidate["runtimeProfile"]["hostname"] = "sensitive-value"
        with self.assertRaises(SmokeReportRejected):
            compare_smoke.compare_reports(self.base, candidate)
        candidate = copy.deepcopy(self.adapter)
        del candidate["runtimeProfile"]["torchVersion"]
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
