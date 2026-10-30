#!/usr/bin/env python3
"""Offline, source-free comparison of real local base and LoRA smoke reports.

Only accepts current protocol reports for identical checked-in synthetic fixtures,
generation settings, base metadata and declared base revision. It cannot
establish actual weight provenance, hardware parity or model correctness.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import sys

try:
    from .smoke_report import (
        GENERATION_POLICY, LANGUAGES, PROTOCOL, SmokeReportRejected,
        fingerprints, read_public_fixtures, checked_runtime_profile
    )
    from .integrity import PROTOCOL as ADAPTER_RECEIPT_PROTOCOL
except ImportError:
    from smoke_report import (
        GENERATION_POLICY, LANGUAGES, PROTOCOL, SmokeReportRejected,
        fingerprints, read_public_fixtures, checked_runtime_profile
    )
    from integrity import PROTOCOL as ADAPTER_RECEIPT_PROTOCOL

MAX_REPORT_BYTES = 32 * 1024
SHA256 = re.compile(r"[0-9a-f]{64}\Z")
REVISION = re.compile(r"[0-9a-f]{40}\Z")


def _unique_pairs(pairs: list[tuple[str, object]]) -> dict:
    result = {}
    for key, value in pairs:
        if key in result:
            raise SmokeReportRejected("duplicate-report-field")
        result[key] = value
    return result


def load_report(path: Path) -> dict:
    """Only read a named local report, rejecting symlinks and large files."""
    try:
        if path.is_symlink() or not path.is_file():
            raise SmokeReportRejected("invalid-report-file")
        with path.open("rb") as stream:
            payload = stream.read(MAX_REPORT_BYTES + 1)
        if not payload or len(payload) > MAX_REPORT_BYTES:
            raise SmokeReportRejected("invalid-report-size")
        report = json.loads(payload.decode("utf-8", errors="strict"),
                            object_pairs_hook=_unique_pairs,
                            parse_constant=lambda _: (_ for _ in ()).throw(
                                SmokeReportRejected("invalid-number")))
    except (OSError, UnicodeError, ValueError, TypeError) as exc:
        raise SmokeReportRejected("invalid-report-file") from None
    if not isinstance(report, dict):
        raise SmokeReportRejected("invalid-report-structure")
    return report


def _validated_report(report: dict, kind: str) -> dict:
    """Refuse incomplete, synthetic plan, changed-scope or inconsistent totals."""
    if not isinstance(report, dict):
        raise SmokeReportRejected("invalid-report-structure")
    language = report.get("selectedLanguage")
    tokens = report.get("maxNewTokens")
    if language not in ("all",) + LANGUAGES or type(tokens) is not int or not 1 <= tokens <= 128:
        raise SmokeReportRejected("invalid-report-scope")
    expected = fingerprints(read_public_fixtures(language), tokens)
    for field, value in expected.items():
        if report.get(field) != value:
            raise SmokeReportRejected("incompatible-report-fingerprint")
    if (report.get("stage") != "UNREVIEWED_REAL_LOCAL_SYNTHETIC_SMOKE" or
            report.get("realModelInferenceExecuted") is not True or
            report.get("artifactKind") != kind or
            report.get("benchmarkProtocol") != PROTOCOL or
            report.get("generationPolicy") != GENERATION_POLICY or
            not isinstance(report.get("baseRevisionDeclared"), str) or
            not REVISION.fullmatch(report["baseRevisionDeclared"]) or
            any(not isinstance(report.get(key), str) or
                not SHA256.fullmatch(report[key])
                for key in ("baseConfigSha256", "tokenizerSha256", "baseWeightsSha256"))):
        raise SmokeReportRejected("ineligible-real-smoke-report")
    if kind == "local-lora-adapter":
        if (report.get("adapterReceiptVerified") is not True or
                report.get("adapterReceiptProtocol") != ADAPTER_RECEIPT_PROTOCOL):
            raise SmokeReportRejected("unverified-adapter")
    elif (report.get("adapterReceiptVerified") is not False or
          report.get("adapterReceiptProtocol") != "not-applicable"):
        raise SmokeReportRejected("invalid-base-receipt")
    if type(report.get("baseWeightFiles")) is not int or not 1 <= report["baseWeightFiles"] <= 64:
        raise SmokeReportRejected("invalid-base-weight-count")
    attempts = report.get("syntheticAttempts")
    exact = report.get("strictExactMatches")
    if (type(attempts) is not int or attempts != expected["syntheticFixtures"] or
            type(exact) is not int or not 0 <= exact <= attempts):
        raise SmokeReportRejected("invalid-report-totals")
    groups = report.get("perLanguage")
    if not isinstance(groups, dict) or set(groups) != set(LANGUAGES):
        raise SmokeReportRejected("invalid-language-totals")
    counted = 0
    for name in LANGUAGES:
        group = groups[name]
        expected_attempts = 6 if language in ("all", name) else 0
        if (not isinstance(group, dict) or
                set(group) != {"attempts", "strictExactMatches"} or
                type(group["attempts"]) is not int or
                group["attempts"] != expected_attempts or
                type(group["strictExactMatches"]) is not int or
                not 0 <= group["strictExactMatches"] <= expected_attempts):
            raise SmokeReportRejected("invalid-language-totals")
        counted += group["strictExactMatches"]
    if counted != exact:
        raise SmokeReportRejected("mismatched-language-totals")
    checked_runtime_profile(report.get("runtimeProfile"))
    if report.get("latencyMeasurement") != "monotonic-generation-only-v1":
        raise SmokeReportRejected("invalid-latency-method")
    def checked_latency(value) -> bool:
        return type(value) is int and 0 <= value <= 3_600_000
    for key in ("generationP50Ms", "generationP95Ms"):
        if not checked_latency(report.get(key)):
            raise SmokeReportRejected("invalid-generation-latency")
    if report["generationP50Ms"] > report["generationP95Ms"]:
        raise SmokeReportRejected("inconsistent-generation-latency")
    timing = report.get("generationLatencyByLanguage")
    if not isinstance(timing, dict) or set(timing) != set(LANGUAGES):
        raise SmokeReportRejected("invalid-generation-language-latency")
    for name in LANGUAGES:
        group = timing[name]
        expected_count = groups[name]["attempts"]
        if (not isinstance(group, dict) or
                set(group) != {"attempts", "p50Ms", "p95Ms"} or
                type(group["attempts"]) is not int or
                group["attempts"] != expected_count):
            raise SmokeReportRejected("invalid-generation-language-latency")
        if expected_count:
            if (not checked_latency(group["p50Ms"]) or
                    not checked_latency(group["p95Ms"]) or
                    group["p50Ms"] > group["p95Ms"]):
                raise SmokeReportRejected("invalid-generation-language-latency")
        elif group["p50Ms"] is not None or group["p95Ms"] is not None:
            raise SmokeReportRejected("unexpected-generation-language-latency")
    if report.get("generatedTokenAccounting") != "new-token-ids-including-stop-v1":
        raise SmokeReportRejected("invalid-generated-token-method")
    total = report.get("generatedTokenCount")
    if (type(total) is not int or
            not attempts <= total <= attempts * tokens):
        raise SmokeReportRejected("invalid-generated-token-total")
    token_groups = report.get("generatedTokensByLanguage")
    if not isinstance(token_groups, dict) or set(token_groups) != set(LANGUAGES):
        raise SmokeReportRejected("invalid-generated-token-groups")
    counted_tokens = 0
    for name in LANGUAGES:
        group = token_groups[name]
        expected_count = groups[name]["attempts"]
        if (not isinstance(group, dict) or
                set(group) != {"attempts", "totalTokens"} or
                type(group["attempts"]) is not int or
                group["attempts"] != expected_count or
                type(group["totalTokens"]) is not int or
                not expected_count <= group["totalTokens"] <= expected_count * tokens):
            raise SmokeReportRejected("invalid-generated-token-language")
        counted_tokens += group["totalTokens"]
    if counted_tokens != total:
        raise SmokeReportRejected("mismatched-generated-token-total")
    if report.get("terminationAccounting") != "stop-token-or-token-limit-v1":
        raise SmokeReportRejected("invalid-termination-accounting")
    counts = report.get("terminationCounts")
    per_language = report.get("terminationByLanguage")
    if (not isinstance(counts, dict) or
            set(counts) != {"stopToken", "tokenLimit"} or
            not isinstance(per_language, dict) or set(per_language) != set(LANGUAGES)):
        raise SmokeReportRejected("invalid-termination-counts")
    for key in ("stopToken", "tokenLimit"):
        if type(counts[key]) is not int or not 0 <= counts[key] <= attempts:
            raise SmokeReportRejected("invalid-termination-count")
    if sum(counts.values()) != attempts:
        raise SmokeReportRejected("invalid-termination-total")
    totals = {"stopToken": 0, "tokenLimit": 0}
    for name in LANGUAGES:
        item = per_language[name]
        expected_count = groups[name]["attempts"]
        if (not isinstance(item, dict) or
                set(item) != {"attempts", "stopToken", "tokenLimit"} or
                type(item["attempts"]) is not int or item["attempts"] != expected_count or
                any(type(item[key]) is not int or not 0 <= item[key] <= expected_count
                    for key in ("stopToken", "tokenLimit")) or
                item["stopToken"] + item["tokenLimit"] != expected_count or
                token_groups[name]["totalTokens"] <
                item["tokenLimit"] * tokens + item["stopToken"]):
            raise SmokeReportRejected("invalid-termination-language")
        for key in totals:
            totals[key] += item[key]
    if totals != counts:
        raise SmokeReportRejected("mismatched-termination-groups")
    return report


def compare_reports(base: dict, adapter: dict) -> dict:
    """Only count sanitized matching synthetic attempts, never raw completions."""
    left = _validated_report(base, "local-base-model")
    right = _validated_report(adapter, "local-lora-adapter")
    same = (
        "selectedLanguage", "maxNewTokens", "fixtureSetSha256",
        "requestSpecSha256", "baseRevisionDeclared",
        "baseConfigSha256", "tokenizerSha256", "baseWeightsSha256",
        "baseWeightFiles", "syntheticAttempts", "runtimeProfile",
    )
    if any(left[field] != right[field] for field in same):
        raise SmokeReportRejected("incomparable-smoke-reports")
    delta = right["strictExactMatches"] - left["strictExactMatches"]
    by_language = {}
    for language in LANGUAGES:
        before = left["perLanguage"][language]["strictExactMatches"]
        after = right["perLanguage"][language]["strictExactMatches"]
        left_timing = left["generationLatencyByLanguage"][language]
        right_timing = right["generationLatencyByLanguage"][language]
        left_tokens = left["generatedTokensByLanguage"][language]["totalTokens"]
        right_tokens = right["generatedTokensByLanguage"][language]["totalTokens"]
        by_language[language] = {
            "attemptsPerModel": left["perLanguage"][language]["attempts"],
            "baseStrictExactMatches": before,
            "adapterStrictExactMatches": after,
            "adapterMinusBase": after - before,
            "baseGeneratedTokens": left_tokens,
            "adapterGeneratedTokens": right_tokens,
            "generatedTokenDelta": right_tokens - left_tokens,
            "baseTokenLimitExits": left["terminationByLanguage"][language]["tokenLimit"],
            "adapterTokenLimitExits": right["terminationByLanguage"][language]["tokenLimit"],
            "tokenLimitExitDelta": (
                right["terminationByLanguage"][language]["tokenLimit"] -
                left["terminationByLanguage"][language]["tokenLimit"]
            ),
            "baseGenerationP50Ms": left_timing["p50Ms"],
            "adapterGenerationP50Ms": right_timing["p50Ms"],
            "generationP50DeltaMs": (
                right_timing["p50Ms"] - left_timing["p50Ms"]
                if left_timing["p50Ms"] is not None else None
            ),
            "baseGenerationP95Ms": left_timing["p95Ms"],
            "adapterGenerationP95Ms": right_timing["p95Ms"],
            "generationP95DeltaMs": (
                right_timing["p95Ms"] - left_timing["p95Ms"]
                if left_timing["p95Ms"] is not None else None
            ),
        }
    return {
        "comparisonProtocol": "lineloom-hf-synthetic-comparison-v6",
        "benchmarkProtocol": PROTOCOL,
        "scope": left["selectedLanguage"],
        "runtimeProfileComparable": True,
        "runtimeProfileFieldsChecked": 8,
        "syntheticAttemptsPerModel": left["syntheticAttempts"],
        "baseStrictExactMatches": left["strictExactMatches"],
        "adapterStrictExactMatches": right["strictExactMatches"],
        "adapterMinusBase": delta,
        "terminationAccounting": "stop-token-or-token-limit-v1",
        "baseTokenLimitExits": left["terminationCounts"]["tokenLimit"],
        "adapterTokenLimitExits": right["terminationCounts"]["tokenLimit"],
        "tokenLimitExitDelta": (
            right["terminationCounts"]["tokenLimit"] -
            left["terminationCounts"]["tokenLimit"]
        ),
        "terminationReview": (
            "TOKEN_LIMIT_EXITS_REQUIRE_REVIEW"
            if left["terminationCounts"]["tokenLimit"] or
               right["terminationCounts"]["tokenLimit"] else
            "NO_TOKEN_LIMIT_EXITS_RECORDED"
        ),
        "generatedTokenAccounting": "new-token-ids-including-stop-v1",
        "baseGeneratedTokens": left["generatedTokenCount"],
        "adapterGeneratedTokens": right["generatedTokenCount"],
        "generatedTokenDelta": right["generatedTokenCount"] - left["generatedTokenCount"],
        "generatedTokenCountStatus": (
            "AGGREGATE_TOKEN_TOTALS_MATCH_ONLY"
            if left["generatedTokenCount"] == right["generatedTokenCount"]
            else "DIFFERENT_GENERATED_TOKEN_TOTALS"
        ),
        "latencyMeasurement": "monotonic-generation-only-v1",
        "baseGenerationP50Ms": left["generationP50Ms"],
        "adapterGenerationP50Ms": right["generationP50Ms"],
        "generationP50DeltaMs": right["generationP50Ms"] - left["generationP50Ms"],
        "baseGenerationP95Ms": left["generationP95Ms"],
        "adapterGenerationP95Ms": right["generationP95Ms"],
        "generationP95DeltaMs": right["generationP95Ms"] - left["generationP95Ms"],
        "perLanguage": by_language,
        "verdict": "DESCRIPTIVE_SYNTHETIC_COUNTS_ONLY",
        "limitation": ("Matching locally hashed base weight bytes and synthetic requests "
                       "do not verify real weights, compute environment, code "
                       "correctness, hardware parity, editor latency, acceptance "
                       "or release readiness. Generation-only timings are "
                       "descriptive, and small samples are unstable. "
                       "Runtime fields match but cannot prove physical GPU, "
                       "driver, thermal, load or execution-order parity. "
                       "Different generated token counts confound absolute latency; "
                       "even equal totals do not prove per-probe length parity. "
                       "A token-limit exit may truncate an otherwise valid completion; "
                       "a stop-token exit does not establish code correctness."),
    }


def parser() -> argparse.ArgumentParser:
    cli = argparse.ArgumentParser(
        description="Compare two local source-free Hugging Face synthetic smoke reports"
    )
    cli.add_argument("--base", required=True, help="Local JSON report from the base smoke run")
    cli.add_argument("--adapter", required=True, help="Local JSON report from the LoRA smoke run")
    return cli


def main() -> int:
    args = parser().parse_args()
    try:
        result = compare_reports(load_report(Path(args.base)),
                                 load_report(Path(args.adapter)))
        print(json.dumps(result, indent=2, sort_keys=True))
        return 0
    except (SmokeReportRejected, OSError, ValueError, TypeError):
        print("LineLoom local smoke reports were rejected or incompatible; review offline inputs.",
              file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
