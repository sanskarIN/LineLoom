"""Bounded, offline TypeScript parser bridge for local HF-generated insertions.

Only an explicitly approved local HF inference run calls this helper.
It sends a fixed checked-in public fixture ID and one in-memory generated
continuation to the repository's pinned TypeScript parser over stdin.
There is no generated source in stdout, stderr, exceptions or saved files.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess

try:
    from .smoke_report import SmokeReportRejected
except ImportError:
    from smoke_report import SmokeReportRejected

ROOT = Path(__file__).resolve().parents[2]
PARSER = ROOT / "scripts" / "hf-typescript-syntax.mjs"
TIMEOUT_SECONDS = 8
MAX_SOURCE_CHARS = 8192


def parser_environment() -> dict[str, str]:
    # Prevent NODE_OPTIONS, proxy credentials, telemetry and other unrelated
    # environment variables from flowing into the parser subprocess.
    keys = ("PATH", "SYSTEMROOT", "WINDIR", "HOME", "USERPROFILE",
            "TEMP", "TMP", "TMPDIR", "LC_ALL", "LANG")
    return {key: os.environ[key] for key in keys if key in os.environ}


def classify_typescript_syntax(fixture: dict, insertion: str,
                               *, invoke=subprocess.run) -> str:
    """Check only TypeScript synthetic code; never execute it or print it."""
    if (not isinstance(fixture, dict) or fixture.get("language") != "typescript" or
            not isinstance(fixture.get("id"), str) or
            not isinstance(fixture.get("prefix"), str) or
            not isinstance(fixture.get("suffix"), str) or
            type(insertion) is not str):
        raise SmokeReportRejected("invalid-typescript-syntax-input")
    if len(fixture["prefix"] + insertion + fixture["suffix"]) > MAX_SOURCE_CHARS:
        raise SmokeReportRejected("typescript-syntax-input-too-long")
    request = json.dumps({"id": fixture["id"], "insertion": insertion},
                         ensure_ascii=False, allow_nan=False)
    try:
        completed = invoke(
            ["node", str(PARSER)], input=request, text=True,
            encoding="utf-8", errors="strict", cwd=ROOT,
            env=parser_environment(),
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            timeout=TIMEOUT_SECONDS, check=False, shell=False,
        )
        if completed.returncode != 0 or len(completed.stdout) > 128:
            raise SmokeReportRejected("typescript-parser-unavailable-or-rejected")
        response = json.loads(completed.stdout)
        if (not isinstance(response, dict) or
                set(response) != {"syntaxOutcome"} or
                response["syntaxOutcome"] not in ("passed", "failed")):
            raise SmokeReportRejected("invalid-typescript-parser-result")
        return response["syntaxOutcome"]
    except (OSError, UnicodeError, ValueError, subprocess.TimeoutExpired):
        raise SmokeReportRejected("typescript-parser-unavailable-or-rejected") from None
