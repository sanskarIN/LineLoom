"""No-weight, no-network tests for explicit compiler checks of synthetic outputs."""
from __future__ import annotations

from pathlib import Path
import subprocess
import unittest

try:
    from .native_syntax import classify_native_syntax, NATIVE_LANGUAGES
    from .smoke_report import read_public_fixtures, SmokeReportRejected
except ImportError:
    from native_syntax import classify_native_syntax, NATIVE_LANGUAGES
    from smoke_report import read_public_fixtures, SmokeReportRejected


class NativeGeneratedSyntaxTests(unittest.TestCase):
    @staticmethod
    def simulated_compiler(returncode, observed):
        def invoke(argv, **kwargs):
            observed.append((argv, kwargs))
            source = Path(argv[-1])
            text = source.read_text(encoding="utf-8")
            assert "synthetic" not in str(source.parent)
            assert text
            return subprocess.CompletedProcess(argv, returncode)
        return invoke

    def test_three_public_native_languages_use_nonexecuting_toolchain_modes(self):
        for language in NATIVE_LANGUAGES:
            fixture = read_public_fixtures(language)[0]
            seen = []
            result = classify_native_syntax(
                fixture, fixture["expected"], approved=True,
                resolve_tool=lambda _: "/opt/fake-compiler",
                invoke=self.simulated_compiler(0, seen)
            )
            with self.subTest(language=language):
                self.assertEqual(result, "passed")
                self.assertEqual(len(seen), 1)
                args, settings = seen[0]
                self.assertEqual(settings["stdin"], subprocess.DEVNULL)
                self.assertEqual(settings["stdout"], subprocess.DEVNULL)
                self.assertEqual(settings["stderr"], subprocess.DEVNULL)
                self.assertIs(settings["shell"], False)
                self.assertLessEqual(settings["timeout"], 20)
                self.assertNotIn("PRIVATE_TOKEN", str(settings))
                self.assertTrue(
                    "-fsyntax-only" in args if language in ("c", "cpp")
                    else "--emit=metadata" in args
                )

    def test_bad_insertion_returns_failed_without_exposing_compiler_diagnostics(self):
        fixture = read_public_fixtures("cpp")[0]
        seen = []
        status = classify_native_syntax(
            fixture, "PRIVATE_TOKEN", approved=True,
            resolve_tool=lambda _: "c++",
            invoke=self.simulated_compiler(1, seen)
        )
        self.assertEqual(status, "failed")
        self.assertNotIn("PRIVATE_TOKEN", str(status))

    def test_rejects_unapproved_execution_without_discovering_compiler(self):
        fixture = read_public_fixtures("rust")[0]
        def should_not_discover(_):
            raise AssertionError("compiler discovery must require approval")
        with self.assertRaises(SmokeReportRejected):
            classify_native_syntax(
                fixture, fixture["expected"],
                resolve_tool=should_not_discover
            )

    def test_rejects_modified_public_fixture_and_unbounded_output(self):
        fixture = read_public_fixtures("c")[0]
        for altered in (
            dict(fixture, prefix="PRIVATE_PATH"),
            dict(fixture, suffix="PRIVATE_PATH"),
            dict(fixture, id="PRIVATE_PATH"),
            dict(fixture, language="python"),
            dict(fixture, language=None),
            dict(fixture, prefix=None),
        ):
            with self.subTest(altered_type=type(altered).__name__):
                with self.assertRaises(SmokeReportRejected) as caught:
                    classify_native_syntax(
                        altered, "ok", approved=True,
                        resolve_tool=lambda _: "/opt/fake"
                    )
                self.assertNotIn("PRIVATE_PATH", str(caught.exception))
        with self.assertRaises(SmokeReportRejected):
            classify_native_syntax(
                fixture, "x" * 8193, approved=True,
                resolve_tool=lambda _: "/opt/fake"
            )

    def test_missing_compiler_timeout_and_errors_fail_closed_without_leakage(self):
        fixture = read_public_fixtures("rust")[0]
        with self.assertRaises(SmokeReportRejected):
            classify_native_syntax(
                fixture, "PRIVATE_SOURCE", approved=True,
                resolve_tool=lambda _: None
            )
        for error in (
            OSError("PRIVATE_SOURCE"),
            ValueError("PRIVATE_SOURCE"),
            subprocess.TimeoutExpired("PRIVATE_SOURCE", 1),
        ):
            def fail(*args, **kwargs):
                raise error
            with self.subTest(kind=type(error).__name__):
                with self.assertRaises(SmokeReportRejected) as caught:
                    classify_native_syntax(
                        fixture, "PRIVATE_SOURCE", approved=True,
                        resolve_tool=lambda _: "rustc", invoke=fail
                    )
                self.assertNotIn("PRIVATE_SOURCE", str(caught.exception))


if __name__ == "__main__":
    unittest.main()
