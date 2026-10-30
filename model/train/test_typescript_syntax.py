"""Offline end-to-end tests of the bounded Node TypeScript AST parser bridge.

No trained model, network, workspace source or GPU is used; only the fixed
public synthetic fixtures and intentionally invented completions are parsed.
"""
from __future__ import annotations

import json
from pathlib import Path
import subprocess
import unittest
from types import SimpleNamespace
from unittest import mock

try:
    from .typescript_syntax import classify_typescript_syntax, parser_environment
    from .smoke_report import read_public_fixtures, SmokeReportRejected
except ImportError:
    from typescript_syntax import classify_typescript_syntax, parser_environment
    from smoke_report import read_public_fixtures, SmokeReportRejected


class TypeScriptSyntaxBridgeTests(unittest.TestCase):
    def test_all_six_checked_in_reference_continuations_parse(self):
        fixtures = read_public_fixtures("typescript")
        self.assertEqual(len(fixtures), 6)
        for fixture in fixtures:
            with self.subTest(id=fixture["id"]):
                self.assertEqual(
                    classify_typescript_syntax(fixture, fixture["expected"]), "passed"
                )

    def test_alternative_valid_insertion_and_broken_syntax(self):
        fixture = next(x for x in read_public_fixtures("typescript")
                       if x["id"] == "typescript-multiply")
        self.assertEqual(classify_typescript_syntax(fixture, "value + value"), "passed")
        self.assertEqual(classify_typescript_syntax(fixture, "value + )"), "failed")
        self.assertEqual(classify_typescript_syntax(fixture, "???"), "failed")
        # Static parsing is not evaluation: this expression must never run.
        self.assertEqual(classify_typescript_syntax(
            fixture, "(() => { throw new Error('do-not-execute'); })()"
        ), "passed")

    def test_subprocess_receives_only_in_memory_fixed_fixture_request(self):
        fixture = read_public_fixtures("typescript")[0]
        requests = []
        def fake_invoke(command, **kwargs):
            requests.append((command, kwargs))
            return SimpleNamespace(returncode=0, stdout='{"syntaxOutcome":"passed"}\n')
        self.assertEqual(classify_typescript_syntax(
            fixture, "const LOCAL_SECRET_MARKER = 3;", invoke=fake_invoke
        ), "passed")
        command, kwargs = requests[0]
        self.assertEqual(Path(command[1]).name, "hf-typescript-syntax.mjs")
        self.assertEqual(command[0], "node")
        self.assertFalse(kwargs["shell"])
        self.assertFalse(kwargs["check"])
        self.assertEqual(kwargs["stderr"], subprocess.DEVNULL)
        self.assertEqual(kwargs["timeout"], 8)
        self.assertEqual(json.loads(kwargs["input"]), {
            "id": fixture["id"], "insertion": "const LOCAL_SECRET_MARKER = 3;"
        })
        self.assertNotIn("LOCAL_SECRET_MARKER", str(command))
        self.assertNotIn("LOCAL_SECRET_MARKER", repr(parser_environment()))
        self.assertNotIn("NODE_OPTIONS", kwargs["env"])

    def test_parser_malformed_results_fail_closed_without_source_or_errors(self):
        fixture = read_public_fixtures("typescript")[0]
        for rc, response in (
            (1, ""), (0, "{}"), (0, "private"), (0, "null"),
            (0, '{"syntaxOutcome":"unchecked"}'),
            (0, '{"syntaxOutcome":"passed","source":"private"}'),
            (0, '{"syntaxOutcome":"failed"}' + "x" * 200),
        ):
            with self.subTest(rc=rc, responseLength=len(response)):
                with self.assertRaises(SmokeReportRejected) as exc:
                    classify_typescript_syntax(fixture, "LOCAL_PRIVATE_SOURCE",
                                               invoke=lambda *_a, **_kw: SimpleNamespace(
                                                   returncode=rc, stdout=response))
                self.assertNotIn("LOCAL_PRIVATE_SOURCE", str(exc.exception))
                self.assertNotIn("private", str(exc.exception))
        with self.assertRaises(SmokeReportRejected):
            classify_typescript_syntax(fixture, "private",
                                       invoke=lambda *_a, **_kw: (
                                           _ for _ in ()).throw(subprocess.TimeoutExpired("node", 8)))

    def test_invalid_source_size_language_and_request_shapes_rejected_preflight(self):
        ts = read_public_fixtures("typescript")[0]
        rust = read_public_fixtures("rust")[0]
        for fixture, generated in (
            (rust, "foo"), (None, "foo"), (ts, None),
            ({"language": "typescript", "id": "x"}, "private"),
            (ts, "private" * 8192),
        ):
            with self.subTest(case=str(fixture and fixture.get("language"))):
                with self.assertRaises(SmokeReportRejected):
                    classify_typescript_syntax(fixture, generated,
                                               invoke=lambda *_a, **_kw: self.fail(
                                                   "unsafe source reached subprocess"))

    def test_hardened_child_accepts_only_public_typescript_ids_and_small_input(self):
        root = Path(__file__).resolve().parents[2]
        command = ["node", str(root / "scripts" / "hf-typescript-syntax.mjs")]
        for request in (
            {"id": "not-a-public-fixture", "insertion": "private"},
            {"id": "rust-loop", "insertion": "private"},
            {"id": "typescript-multiply", "prefix": "private", "insertion": "x"},
            {"id": "typescript-multiply", "insertion": "x" * 17_000},
        ):
            run = subprocess.run(
                command, input=json.dumps(request), text=True, cwd=root,
                env=parser_environment(), capture_output=True, timeout=8
            )
            self.assertNotEqual(run.returncode, 0)
            self.assertEqual(run.stdout, "")
            self.assertNotIn("private", run.stderr)
            self.assertNotIn("insertion", run.stderr)


if __name__ == "__main__":
    unittest.main()
