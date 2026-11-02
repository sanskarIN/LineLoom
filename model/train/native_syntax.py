"""Explicit opt-in, local-only compiler checks of generated native FIM insertions.

This is not a sandbox. Compilers inspect a reconstructed *public synthetic*
source in a disposable directory, never execute compiled programs or emit
compiler diagnostics. Only approved local inference uses this module.
"""
from __future__ import annotations

import os
from pathlib import Path
import shutil
import subprocess
import tempfile

try:
    from .audit_reference_syntax import compiler_arguments, compiler_environment
    from .smoke_report import read_public_fixtures, SmokeReportRejected
except ImportError:
    from audit_reference_syntax import compiler_arguments, compiler_environment
    from smoke_report import read_public_fixtures, SmokeReportRejected

NATIVE_LANGUAGES = ("rust", "c", "cpp")
TOOL_NAMES = {"rust": "rustc", "c": "cc", "cpp": "c++"}
EXTENSIONS = {"rust": ".rs", "c": ".c", "cpp": ".cpp"}
MAX_SOURCE_CHARS = 8192
TIMEOUT_SECONDS = 12


def classify_native_syntax(fixture: dict, insertion: str, *, approved: bool = False,
                           resolve_tool=shutil.which, invoke=subprocess.run) -> str:
    """Return passed/failed; reject unapproved/missing compilers, no source output.

    The exact fixture must match an immutable checked-in public case; no
    private workspace, arbitrary path or unreviewed prefix/suffix is allowed.
    Compilers use source-only/syntax-only modes and isolated temporary files.
    This is NOT a security sandbox for hostile code or hostile toolchains.
    """
    if approved is not True:
        raise SmokeReportRejected("native-compiler-approval-required")
    if (type(fixture) is not dict or
            fixture.get("language") not in NATIVE_LANGUAGES or
            type(insertion) is not str):
        raise SmokeReportRejected("invalid-native-syntax-input")
    language = fixture["language"]
    if not any(
        all(fixture.get(field) == original[field]
            for field in ("id", "language", "prefix", "suffix"))
        for original in read_public_fixtures(language)
    ):
        raise SmokeReportRejected("native-syntax-fixture-not-public")
    source = fixture["prefix"] + insertion + fixture["suffix"]
    if len(source) > MAX_SOURCE_CHARS:
        raise SmokeReportRejected("native-syntax-input-too-long")
    try:
        binary = resolve_tool(TOOL_NAMES[language])
        if not binary or not isinstance(binary, str):
            raise SmokeReportRejected("native-compiler-unavailable")
        with tempfile.TemporaryDirectory(prefix="lineloom-native-syntax-") as temp:
            root = Path(temp)
            path = root / ("generated" + EXTENSIONS[language])
            result_file = root / "generated.rmeta"
            path.write_text(source, encoding="utf-8")
            completed = invoke(
                compiler_arguments(language, binary, path, result_file),
                cwd=temp, env=compiler_environment(),
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                timeout=TIMEOUT_SECONDS, check=False, shell=False
            )
            if type(completed.returncode) is not int:
                raise SmokeReportRejected("native-compiler-invalid-result")
            return "passed" if completed.returncode == 0 else "failed"
    except SmokeReportRejected:
        raise
    except (OSError, ValueError, UnicodeError, subprocess.TimeoutExpired):
        raise SmokeReportRejected("native-compiler-unavailable-or-rejected") from None
