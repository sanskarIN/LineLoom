#!/usr/bin/env python3
"""Opt-in, local syntax checks of fixed public reference completions only.

Never compiles generated model responses, arbitrary paths, private manifests
or workspace code. Does not execute any compiled program. All diagnostics
and fixture source remain local; stdout includes only bounded aggregates.
"""
from __future__ import annotations

import argparse
import ast
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

try:
    from .smoke_report import LANGUAGES, fingerprints, read_public_fixtures
except ImportError:
    from smoke_report import LANGUAGES, fingerprints, read_public_fixtures

PROTOCOL = "lineloom-public-reference-syntax-v1"
EXTENSIONS = {"rust": ".rs", "c": ".c", "cpp": ".cpp",
              "python": ".py", "typescript": ".ts"}
TOOLS = {"rust": "rustc", "c": "cc", "cpp": "c++", "typescript": "tsc"}
TIMEOUT_SECONDS = 20


class ReferenceAuditRejected(ValueError):
    """Keep source text, filenames and compiler diagnostics out of errors."""


def compiler_arguments(language: str, binary: str, source: Path, output: Path) -> list[str]:
    if language == "rust":
        return [binary, "--edition=2021", "--crate-type=lib",
                "--emit=metadata", "-o", str(output), str(source)]
    if language == "c":
        return [binary, "-std=c11", "-fsyntax-only", "-x", "c", str(source)]
    if language == "cpp":
        return [binary, "-std=c++17", "-fsyntax-only", "-x", "c++", str(source)]
    if language == "typescript":
        return [binary, "--noEmit", "--strict", "--skipLibCheck", "--pretty", "false",
                "--target", "ES2020", "--module", "ESNext", str(source)]
    raise ReferenceAuditRejected("unsupported-compiler-language")


def compiler_environment() -> dict[str, str]:
    # Toolchains need paths, temporary storage and sometimes user-local
    # toolchain discovery. Never forward unrelated credentials or proxy keys.
    allowed = ("PATH", "HOME", "USERPROFILE", "SYSTEMROOT", "WINDIR",
               "TEMP", "TMP", "TMPDIR", "RUSTUP_HOME", "CARGO_HOME", "LC_ALL", "LANG")
    return {key: os.environ[key] for key in allowed if key in os.environ}


def audit_public_references(language: str = "all", *, run: bool = False,
                            approved: bool = False,
                            resolve_tool=shutil.which,
                            invoke=subprocess.run) -> dict:
    if language not in ("all",) + LANGUAGES or type(run) is not bool or type(approved) is not bool:
        raise ReferenceAuditRejected("invalid-reference-audit-options")
    if run and not approved:
        raise ReferenceAuditRejected("local-compiler-approval-required")
    fixtures = read_public_fixtures(language)
    summary = {key: {"fixtures": 0, "passed": 0, "failed": 0, "unavailable": 0}
               for key in LANGUAGES}
    for fixture in fixtures:
        summary[fixture["language"]]["fixtures"] += 1
    report = {
        "protocol": PROTOCOL,
        "stage": "REFERENCE_SYNTAX_NOT_RUN" if not run else "REFERENCE_SYNTAX_INCOMPLETE",
        "compilerExecution": run,
        "realModelInferenceExecuted": False,
        "referenceFixtures": len(fixtures),
        "fixtureSetSha256": fingerprints(fixtures, 64)["fixtureSetSha256"],
        "passed": 0, "failed": 0, "unavailable": 0,
        "byLanguage": summary,
        "limitation": (
            "Only checked-in synthetic reference syntax; not generated model output, "
            "runtime behavior, compiler correctness, source safety or model quality."
        ),
    }
    if not run:
        return report

    # Resolve tools once per language. Missing required tools cause an
    # incomplete result, never an implicitly successful all-language audit.
    binaries = {key: resolve_tool(tool) for key, tool in TOOLS.items()}
    with tempfile.TemporaryDirectory(prefix="lineloom-reference-") as temporary:
        for index, fixture in enumerate(fixtures):
            lang = fixture["language"]
            source_text = fixture["prefix"] + fixture["expected"] + fixture["suffix"]
            outcome = "failed"
            if lang == "python":
                try:
                    ast.parse(source_text, filename="<public-reference>", mode="exec")
                    outcome = "passed"
                except (SyntaxError, ValueError, TypeError):
                    pass
            elif not binaries[lang]:
                outcome = "unavailable"
            else:
                # No user path is an input. The only compiler source is a
                # hardcoded, reviewed fixture from the checked-in manifest.
                root = Path(temporary)
                filename = root / ("fixture" + str(index) + EXTENSIONS[lang])
                output = root / ("fixture" + str(index) + ".rmeta")
                try:
                    filename.write_text(source_text, encoding="utf-8")
                    result = invoke(
                        compiler_arguments(lang, binaries[lang], filename, output),
                        cwd=temporary, env=compiler_environment(),
                        stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL, timeout=TIMEOUT_SECONDS,
                        check=False, shell=False,
                    )
                    if result.returncode == 0:
                        outcome = "passed"
                except (OSError, ValueError, subprocess.TimeoutExpired):
                    pass
                finally:
                    filename.unlink(missing_ok=True)
                    output.unlink(missing_ok=True)
            summary[lang][outcome] += 1
            report[outcome] += 1

    if report["failed"] == 0 and report["unavailable"] == 0:
        report["stage"] = "PUBLIC_REFERENCE_SYNTAX_CHECKED"
    return report


def main() -> int:
    cli = argparse.ArgumentParser(description="Offline original-reference syntax audit (no model inference)")
    cli.add_argument("--language", choices=("all",) + LANGUAGES, default="all")
    cli.add_argument("--run", action="store_true", help="Check checked-in reference fixtures locally")
    cli.add_argument("--approve-local-compilers", action="store_true",
                     help="Acknowledge local compiler subprocesses for fixed public references")
    args = cli.parse_args()
    try:
        report = audit_public_references(
            args.language, run=args.run, approved=args.approve_local_compilers
        )
        print(json.dumps(report, indent=2, sort_keys=True))
        return int(args.run and report["stage"] != "PUBLIC_REFERENCE_SYNTAX_CHECKED")
    except (ReferenceAuditRejected, OSError, ValueError):
        print("LineLoom public reference syntax audit rejected; review local prerequisites.",
              file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
