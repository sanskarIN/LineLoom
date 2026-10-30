"""No-network checks of Python/TypeScript synthetic grammar accounting."""
from __future__ import annotations

import json
import unittest

try:
    from .generated_syntax import (
        SYNTAX_ACCOUNTING, MAX_SYNTHETIC_SOURCE_CHARS,
        classify_generated_syntax, generated_syntax_summary
    )
    from .smoke_report import read_public_fixtures, SmokeReportRejected, LANGUAGES
except ImportError:
    from generated_syntax import (
        SYNTAX_ACCOUNTING, MAX_SYNTHETIC_SOURCE_CHARS,
        classify_generated_syntax, generated_syntax_summary
    )
    from smoke_report import read_public_fixtures, SmokeReportRejected, LANGUAGES


class GeneratedSyntaxTests(unittest.TestCase):
    def test_all_original_python_reference_insertions_parse_without_execution(self):
        cases = read_public_fixtures("python")
        self.assertEqual(len(cases), 6)
        for fixture in cases:
            with self.subTest(id=fixture["id"]):
                self.assertEqual(
                    classify_generated_syntax(fixture, fixture["expected"]), "passed"
                )

    def test_python_valid_alternatives_and_broken_generated_insertion(self):
        fixture = next(x for x in read_public_fixtures("python")
                       if x["id"] == "python-multiply")
        self.assertEqual(classify_generated_syntax(fixture, "value ** 2"),
                         "passed")
        self.assertEqual(classify_generated_syntax(fixture, "("), "failed")
        self.assertEqual(classify_generated_syntax(fixture, "return ???"), "failed")
        self.assertEqual(classify_generated_syntax(fixture, "value + )"), "failed")
        # The parser must not execute the inserted expression.
        self.assertEqual(classify_generated_syntax(
            fixture, "__import__('os').system('never_execute')"
        ), "passed")

    def test_unchecked_languages_remain_unchecked_even_for_perfect_reference(self):
        for lang in ("rust", "c", "cpp"):
            fixture = read_public_fixtures(lang)[0]
            with self.subTest(language=lang):
                self.assertEqual(
                    classify_generated_syntax(fixture, fixture["expected"]),
                    "unchecked"
                )
                self.assertEqual(classify_generated_syntax(fixture, "???"),
                                 "unchecked")

    def test_typescript_requires_explicit_parser_and_does_not_assume_success(self):
        case = read_public_fixtures("typescript")[0]
        with self.assertRaises(SmokeReportRejected):
            classify_generated_syntax(case, case["expected"])
        with self.assertRaises(SmokeReportRejected):
            classify_generated_syntax(case, "private", parse_typescript=lambda _f, _s: "unchecked")
        requests = []
        def fake_parser(fixture, insertion):
            requests.append((fixture["id"], insertion))
            return "failed" if insertion == "???" else "passed"
        self.assertEqual(classify_generated_syntax(
            case, case["expected"], parse_typescript=fake_parser
        ), "passed")
        self.assertEqual(classify_generated_syntax(
            case, "???", parse_typescript=fake_parser
        ), "failed")
        self.assertEqual(requests[0][0], case["id"])
        self.assertEqual(requests[1][1], "???")

    def test_rejects_bad_source_and_invalid_scope_without_echoing_code(self):
        fixture = read_public_fixtures("python")[0]
        for bad_fixture, bad_insert in (
            (None, "private"),
            ({"language": "other"}, "private"),
            (fixture, None), (fixture, True),
            ({"language": "python", "prefix": "private"}, "private"),
            (fixture, "private" * MAX_SYNTHETIC_SOURCE_CHARS),
        ):
            with self.subTest(scope=repr(bad_fixture)[:16]), self.assertRaises(
                SmokeReportRejected
            ) as context:
                classify_generated_syntax(bad_fixture, bad_insert)
            self.assertNotIn("private", str(context.exception))

    def test_counts_both_parsed_languages_and_never_outputs_source_or_probe_ids(self):
        measurements = [
            {"language": "python", "syntaxOutcome": "passed",
             "secret": "IN_MEMORY_GENERATED_CODE"},
            {"language": "python", "syntaxOutcome": "failed"},
            {"language": "rust", "syntaxOutcome": "unchecked"},
            {"language": "typescript", "syntaxOutcome": "passed"},
        ]
        report = generated_syntax_summary(measurements)
        self.assertEqual(report["syntaxAccounting"], SYNTAX_ACCOUNTING)
        self.assertEqual((report["syntaxChecked"], report["syntaxPassed"],
                          report["syntaxFailed"], report["syntaxUnchecked"]),
                         (3, 2, 1, 1))
        self.assertEqual(report["syntaxByLanguage"]["python"], {
            "attempts": 2, "checked": 2, "passed": 1, "failed": 1,
            "unchecked": 0
        })
        self.assertEqual(report["syntaxByLanguage"]["typescript"], {
            "attempts": 1, "checked": 1, "passed": 1, "failed": 0,
            "unchecked": 0
        })
        self.assertEqual(report["syntaxByLanguage"]["c"], {
            "attempts": 0, "checked": 0, "passed": 0, "failed": 0,
            "unchecked": 0
        })
        self.assertNotIn("IN_MEMORY_GENERATED_CODE", json.dumps(report))
        self.assertNotIn("fixtureId", json.dumps(report))

    def test_malformed_syntax_outcomes_fail_closed(self):
        for results in (
            [], None, "wrong", [{}],
            [{"language": "python", "syntaxOutcome": "unchecked"}],
            [{"language": "typescript", "syntaxOutcome": "unchecked"}],
            [{"language": "rust", "syntaxOutcome": "passed"}],
            [{"language": "python", "syntaxOutcome": 1}],
            [{"language": "c", "syntaxOutcome": True}],
            [{"language": "other", "syntaxOutcome": "unchecked"}],
            [{"language": "rust", "syntaxOutcome": "unchecked"}] * 31,
        ):
            with self.subTest(case=repr(results)[:35]), self.assertRaises(
                SmokeReportRejected
            ):
                generated_syntax_summary(results)


if __name__ == "__main__":
    unittest.main()
