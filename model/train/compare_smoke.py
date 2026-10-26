#!/usr/bin/env python3
"""Offline, source-free comparison of real local base and LoRA smoke reports.

Only accepts protocol v2 reports for identical checked-in synthetic fixtures,
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
        fingerprints, read_public_fixtures
    )
except ImportError:
    from smoke_report import (
        GENERATION_POLICY, LANGUAGES, PROTOCOL, SmokeReportRejected,
        fingerprints, read_public_fixtures
    )

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
                for key in ("baseConfigSha256", "tokenizerSha256"))):
        raise SmokeReportRejected("ineligible-real-smoke-report")
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
    return report


def compare_reports(base: dict, adapter: dict) -> dict:
    """Only count sanitized matching synthetic attempts, never raw completions."""
    left = _validated_report(base, "local-base-model")
    right = _validated_report(adapter, "local-lora-adapter")
    same = (
        "selectedLanguage", "maxNewTokens", "fixtureSetSha256",
        "requestSpecSha256", "baseRevisionDeclared",
        "baseConfigSha256", "tokenizerSha256", "syntheticAttempts",
    )
    if any(left[field] != right[field] for field in same):
        raise SmokeReportRejected("incomparable-smoke-reports")
    delta = right["strictExactMatches"] - left["strictExactMatches"]
    by_language = {}
    for language in LANGUAGES:
        before = left["perLanguage"][language]["strictExactMatches"]
        after = right["perLanguage"][language]["strictExactMatches"]
        by_language[language] = {
            "attemptsPerModel": left["perLanguage"][language]["attempts"],
            "baseStrictExactMatches": before,
            "adapterStrictExactMatches": after,
            "adapterMinusBase": after - before,
        }
    return {
        "comparisonProtocol": "lineloom-hf-synthetic-comparison-v1",
        "benchmarkProtocol": PROTOCOL,
        "scope": left["selectedLanguage"],
        "syntheticAttemptsPerModel": left["syntheticAttempts"],
        "baseStrictExactMatches": left["strictExactMatches"],
        "adapterStrictExactMatches": right["strictExactMatches"],
        "adapterMinusBase": delta,
        "perLanguage": by_language,
        "verdict": "DESCRIPTIVE_SYNTHETIC_COUNTS_ONLY",
        "limitation": ("Same declared base metadata and synthetic request hashes "
                       "do not verify real weights, compute environment, code "
                       "correctness, latency, acceptance or release readiness."),
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
