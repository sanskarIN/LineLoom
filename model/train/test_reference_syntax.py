"""No-network, no-model tests for public reference syntax auditing."""
from __future__ import annotations

import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from types import SimpleNamespace
from unittest import mock

try:
    from . import audit_reference_syntax as audit
except ImportError:
    import audit_reference_syntax as audit


class ReferenceSyntaxAuditTests(unittest.TestCase):
    def test_default_is_plan_only_without_tool_discovery_or_subprocesses(self):
        with mock.patch.object(audit, "read_public_fixtures", wraps=audit.read_public_fixtures):
            result = audit.audit_public_references(
                resolve_tool=lambda _: self.fail("no executable discovery in planning"),
                invoke=lambda *a, **k: self.fail("no compiler in planning")
            )
        self.assertEqual(result["protocol"], "lineloom-public-reference-syntax-v1")
        self.assertEqual(result["stage"], "REFERENCE_SYNTAX_NOT_RUN")
        self.assertEqual(result["referenceFixtures"], 30)
        self.assertEqual(result["passed"], 0)
        self.assertEqual(result["failed"], 0)
        self.assertEqual(result["unavailable"], 0)
        self.assertFalse(result["compilerExecution"])
        self.assertFalse(result["realModelInferenceExecuted"])
        self.assertEqual(
            {name: item["fixtures"] for name, item in result["byLanguage"].items()},
            dict.fromkeys(audit.LANGUAGES, 6)
        )
        self.assertNotIn("fn double", json.dumps(result))
        self.assertEqual(len(result["fixtureSetSha256"]), 64)

    def test_explicit_approval_required_before_running_compilers(self):
        with self.assertRaises(audit.ReferenceAuditRejected):
            audit.audit_public_references(run=True, approved=False,
                                          invoke=lambda *a, **k: self.fail("compiler called"))
        for lang in ("bad-language", "", "javascript"):
            with self.assertRaises(audit.ReferenceAuditRejected):
                audit.audit_public_references(lang)
        for options in ({"run": 1}, {"approved": "yes"}):
            with self.assertRaises(audit.ReferenceAuditRejected):
                audit.audit_public_references(**options)

    def test_pure_python_references_parse_without_compilers_or_exec(self):
        result = audit.audit_public_references(
            "python", run=True, approved=True,
            resolve_tool=lambda _: None,
            invoke=lambda *a, **k: self.fail("no compiler should run for Python")
        )
        self.assertEqual(result["stage"], "PUBLIC_REFERENCE_SYNTAX_CHECKED")
        self.assertEqual(result["passed"], 6)
        self.assertEqual(result["failed"], 0)
        self.assertEqual(result["unavailable"], 0)
        self.assertEqual(result["byLanguage"]["python"]["passed"], 6)

    def test_all_five_languages_use_fixed_compiler_arguments_and_no_output(self):
        captured = []
        def invoked(args, **options):
            captured.append((args, options))
            self.assertEqual(options["timeout"], audit.TIMEOUT_SECONDS)
            self.assertIs(options["stdin"], subprocess.DEVNULL)
            self.assertIs(options["stdout"], subprocess.DEVNULL)
            self.assertIs(options["stderr"], subprocess.DEVNULL)
            self.assertIs(options["shell"], False)
            self.assertIs(options["check"], False)
            self.assertTrue(Path(args[-1]).is_file())
            self.assertTrue(str(args[-1]).startswith(options["cwd"]))
            self.assertNotIn("SECRET_FOR_REFERENCE_AUDIT", options["env"])
            return SimpleNamespace(returncode=0)
        with mock.patch.dict(audit.os.environ, {
            "SECRET_FOR_REFERENCE_AUDIT": "private", "PATH": "/synthetic"
        }):
            result = audit.audit_public_references(
                run=True, approved=True,
                resolve_tool=lambda name: "/synthetic/" + name,
                invoke=invoked
            )
        self.assertEqual(result["stage"], "PUBLIC_REFERENCE_SYNTAX_CHECKED")
        self.assertEqual(result["passed"], 30)
        self.assertEqual(result["unavailable"], 0)
        self.assertEqual(result["failed"], 0)
        self.assertEqual(len(captured), 24)
        for name in audit.LANGUAGES:
            self.assertEqual(result["byLanguage"][name]["passed"], 6)
        flags = {Path(args[0]).name: args[1:-1] for args, _ in captured}
        self.assertIn("--emit=metadata", flags["rustc"])
        self.assertIn("-fsyntax-only", flags["cc"])
        self.assertIn("-fsyntax-only", flags["c++"])
        self.assertIn("--noEmit", flags["tsc"])
        self.assertNotIn("source_text", json.dumps(result))
        self.assertNotIn("fixture0.rs", json.dumps(result))

    def test_missing_compiler_never_counts_as_success(self):
        result = audit.audit_public_references(
            run=True, approved=True,
            resolve_tool=lambda name: None if name == "rustc" else "/mock/" + name,
            invoke=lambda *args, **kwargs: SimpleNamespace(returncode=0)
        )
        self.assertEqual(result["stage"], "REFERENCE_SYNTAX_INCOMPLETE")
        self.assertEqual(result["passed"], 24)
        self.assertEqual(result["unavailable"], 6)
        self.assertEqual(result["byLanguage"]["rust"]["unavailable"], 6)

    def test_compiler_failures_and_timeouts_are_private_and_counted(self):
        def invoked(args, **opts):
            if args[0].endswith("/cc"):
                return SimpleNamespace(returncode=1)
            if args[0].endswith("/c++"):
                raise subprocess.TimeoutExpired(args, opts["timeout"], output=b"private-code")
            return SimpleNamespace(returncode=0)
        result = audit.audit_public_references(
            run=True, approved=True,
            resolve_tool=lambda name: "/mock/" + name, invoke=invoked
        )
        self.assertEqual(result["stage"], "REFERENCE_SYNTAX_INCOMPLETE")
        self.assertEqual(result["passed"], 18)
        self.assertEqual(result["failed"], 12)
        self.assertNotIn("private-code", json.dumps(result))
        self.assertEqual(result["byLanguage"]["c"]["failed"], 6)
        self.assertEqual(result["byLanguage"]["cpp"]["failed"], 6)

    def test_invalid_synthetic_reference_is_not_echoed(self):
        with mock.patch.object(audit, "read_public_fixtures", return_value=[{
            "id": "synthetic-broken", "category": "expression",
            "language": "python", "prefix": "def secret(", "expected": "abc",
            "suffix": " ) syntax_error"}]):
            report = audit.audit_public_references("python", run=True, approved=True)
            self.assertEqual(report["passed"], 0)
            self.assertEqual(report["failed"], 1)
            self.assertNotIn("secret(", json.dumps(report))

    def test_cli_plan_and_approved_python_are_safe_and_failures_generic(self):
        script = str(Path(audit.__file__).resolve())
        for flags, expected_code, stage in (
            ([], 0, "REFERENCE_SYNTAX_NOT_RUN"),
            (["--run", "--approve-local-compilers", "--language", "python"],
             0, "PUBLIC_REFERENCE_SYNTAX_CHECKED"),
        ):
            result = subprocess.run(
                [sys.executable, script] + flags,
                text=True, capture_output=True, timeout=20
            )
            self.assertEqual(result.returncode, expected_code, result.stderr)
            self.assertEqual(json.loads(result.stdout)["stage"], stage)
            self.assertEqual(result.stderr, "")
        rejected = subprocess.run(
            [sys.executable, script, "--run", "--language", "python"],
            text=True, capture_output=True, timeout=20
        )
        self.assertEqual(rejected.returncode, 1)
        self.assertEqual(rejected.stdout, "")
        self.assertNotIn("def square", rejected.stderr)


if __name__ == "__main__":
    unittest.main()
