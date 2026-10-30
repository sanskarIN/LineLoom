"""Strictly in-memory syntax check of generated Python FIM insertions.

Source is reconstructed only from a checked-in synthetic fixture and local
inference result. Python ast.parse does not execute code. No generated source,
AST, errors, temporary files or fixture IDs are ever returned.
Other languages are deliberately NOT assessed until isolated parsers exist.
"""
from __future__ import annotations

import ast

try:
    from .smoke_report import LANGUAGES, SmokeReportRejected
except ImportError:
    from smoke_report import LANGUAGES, SmokeReportRejected

SYNTAX_ACCOUNTING = "python-ast-only-v1"
MAX_SYNTHETIC_SOURCE_CHARS = 8192


def classify_generated_syntax(fixture: dict, insertion: str) -> str:
    """Return passed/failed for Python, unchecked for other languages.

    Only the original public synthetic source may be supplied by the
    optional local runner. This pure helper never executes a completion.
    """
    if (not isinstance(fixture, dict) or
            fixture.get("language") not in LANGUAGES or
            type(insertion) is not str):
        raise SmokeReportRejected("invalid-generated-syntax-input")
    if fixture["language"] != "python":
        return "unchecked"
    if any(type(fixture.get(key)) is not str for key in ("prefix", "suffix")):
        raise SmokeReportRejected("invalid-python-synthetic-fixture")
    source = fixture["prefix"] + insertion + fixture["suffix"]
    if len(source) > MAX_SYNTHETIC_SOURCE_CHARS:
        raise SmokeReportRejected("synthetic-python-source-too-long")
    try:
        ast.parse(source, filename="<public-fim-syntax>", mode="exec")
    except (SyntaxError, ValueError, TypeError, RecursionError):
        return "failed"
    return "passed"


def generated_syntax_summary(results: list[dict]) -> dict:
    """Emit only bounded five-language counts; never content or IDs."""
    if not isinstance(results, list) or not 1 <= len(results) <= 30:
        raise SmokeReportRejected("invalid-generated-syntax-results")
    by_language = {
        language: {"attempts": 0, "checked": 0, "passed": 0,
                   "failed": 0, "unchecked": 0}
        for language in LANGUAGES
    }
    for item in results:
        if not isinstance(item, dict) or item.get("language") not in by_language:
            raise SmokeReportRejected("invalid-generated-syntax-language")
        language = item["language"]
        status = item.get("syntaxOutcome")
        if (language == "python" and status not in ("passed", "failed") or
                language != "python" and status != "unchecked"):
            raise SmokeReportRejected("invalid-generated-syntax-status")
        bucket = by_language[language]
        bucket["attempts"] += 1
        if status == "unchecked":
            bucket["unchecked"] += 1
        else:
            bucket["checked"] += 1
            bucket[status] += 1
    result = {
        "syntaxAccounting": SYNTAX_ACCOUNTING,
        "syntaxChecked": sum(x["checked"] for x in by_language.values()),
        "syntaxPassed": sum(x["passed"] for x in by_language.values()),
        "syntaxFailed": sum(x["failed"] for x in by_language.values()),
        "syntaxUnchecked": sum(x["unchecked"] for x in by_language.values()),
        "syntaxByLanguage": by_language,
    }
    return result
