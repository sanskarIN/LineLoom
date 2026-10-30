"""Offline reproducibility and leakage tests; no private source or ML imports."""
from __future__ import annotations

import unittest

try:
    from .sampling import SamplingRejected, balanced_sample_indices, validation_metrics, compare_validation_losses
except ImportError:
    from sampling import SamplingRejected, balanced_sample_indices, validation_metrics, compare_validation_losses

LANGUAGES = ("rust", "c", "cpp", "python", "typescript")


class BalancedSamplingTests(unittest.TestCase):
    def setUp(self):
        self.samples = [
            {"language": language, "split": "train", "id": f"synthetic-{language}-{i}"}
            for language, count in zip(LANGUAGES, (1, 2, 5, 9, 18))
            for i in range(count)
        ]

    def test_reproducible_seed_and_balanced_exposure(self):
        first = balanced_sample_indices(self.samples, LANGUAGES, 137, 42)
        self.assertEqual(first, balanced_sample_indices(self.samples, LANGUAGES, 137, 42))
        self.assertNotEqual(first, balanced_sample_indices(self.samples, LANGUAGES, 137, 99))
        seen = {language: 0 for language in LANGUAGES}
        for index in first:
            self.assertIn(index, range(len(self.samples)))
            seen[self.samples[index]["language"]] += 1
        self.assertLessEqual(max(seen.values()) - min(seen.values()), 1)
        self.assertEqual(sum(seen.values()), 137)
        self.assertGreater(seen["rust"], 1)

    def test_every_language_in_every_full_cycle_and_bucket_coverage(self):
        result = balanced_sample_indices(self.samples, LANGUAGES, 100, 3)
        for offset in range(0, len(result), len(LANGUAGES)):
            self.assertEqual({self.samples[i]["language"] for i in result[offset:offset+5]},
                             set(LANGUAGES))
        cpp_indexes = {i for i, s in enumerate(self.samples) if s["language"] == "cpp"}
        self.assertEqual({i for i in result if i in cpp_indexes}, cpp_indexes)

    def test_fail_closed_on_holdouts_and_missing_language(self):
        bad = self.samples + [{"language": "rust", "split": "validation"}]
        with self.assertRaises(SamplingRejected):
            balanced_sample_indices(bad, LANGUAGES, 25, 1)
        with self.assertRaises(SamplingRejected):
            balanced_sample_indices(self.samples[:-18], LANGUAGES, 25, 1)
        for draws in (0, -1, True, 1_000_001):
            with self.assertRaises(SamplingRejected):
                balanced_sample_indices(self.samples, LANGUAGES, draws, 1)
        with self.assertRaises(SamplingRejected):
            balanced_sample_indices(self.samples, LANGUAGES, 25, -1)

    def test_no_global_random_seed_side_effect(self):
        import random
        random.seed(101)
        expected = random.random()
        random.seed(101)
        balanced_sample_indices(self.samples, LANGUAGES, 11, 42)
        self.assertEqual(random.random(), expected)


class ValidationMetricsTests(unittest.TestCase):
    def setUp(self):
        self.samples = [{"split": "validation", "language": language}
                        for language in LANGUAGES]

    def test_macro_and_sample_weighted_means_are_distinct(self):
        records = self.samples + [{"split": "validation", "language": "rust"}]
        metrics = validation_metrics(records, [1, 2, 3, 4, 5, 7], LANGUAGES)
        self.assertAlmostEqual(metrics["validationLoss"], 22 / 6, places=6)
        self.assertEqual(metrics["validationMacroLoss"], 3.6)
        self.assertEqual(metrics["validationLossByLanguage"]["rust"], 4)
        self.assertEqual(metrics["validationSamplesByLanguage"]["rust"], 2)
        self.assertEqual(set(metrics["validationLossByLanguage"]), set(LANGUAGES))
        self.assertNotIn("prefix", str(metrics))

    def test_target_weighting_exposes_longer_completion_loss(self):
        records = self.samples + [{"split": "validation", "language": "rust"}]
        losses = [1, 2, 3, 4, 5, 7]
        target_tokens = [1, 2, 2, 2, 2, 9]
        metrics = validation_metrics(records, losses, LANGUAGES, target_tokens)
        self.assertEqual(metrics["validationLoss"], round(22 / 6, 6))
        self.assertEqual(metrics["validationTokenWeightedLoss"], round(92 / 18, 6))
        self.assertEqual(metrics["validationMacroTokenWeightedLoss"], 4.08)
        self.assertEqual(metrics["validationTargetTokens"], 18)
        self.assertEqual(metrics["validationTargetTokensByLanguage"]["rust"], 10)
        self.assertEqual(metrics["validationTokenWeightedLossByLanguage"]["rust"], 6.4)
        self.assertEqual(metrics["validationLossByLanguage"]["rust"], 4)
        self.assertNotIn("validationTokenWeightedLoss",
                         validation_metrics(records, losses, LANGUAGES))

    def test_refuses_invalid_target_token_counts(self):
        for count in (0, -1, 258, True, 2.0, float("nan"), "2"):
            with self.subTest(count=count), self.assertRaises(SamplingRejected):
                validation_metrics(self.samples, [1] * 5, LANGUAGES,
                                   [count, 2, 2, 2, 2])
        with self.assertRaises(SamplingRejected):
            validation_metrics(self.samples, [1] * 5, LANGUAGES, [1] * 4)

    def test_rejects_nonfinite_negative_missing_and_holdout(self):
        for value in (float("nan"), float("inf"), -0.1, 1_000_000, True, "oops"):
            with self.assertRaises(SamplingRejected):
                validation_metrics(self.samples, [1, 1, 1, 1, value], LANGUAGES)
        with self.assertRaises(SamplingRejected):
            validation_metrics(self.samples[:-1], [1] * 4, LANGUAGES)
        with self.assertRaises(SamplingRejected):
            validation_metrics(self.samples + [{"language": "c", "split": "test"}],
                               [1] * 6, LANGUAGES)
        with self.assertRaises(SamplingRejected):
            validation_metrics(self.samples, [1] * 4, LANGUAGES)




class ValidationChangeTests(unittest.TestCase):
    def setUp(self):
        self.records = [{"language": language, "split": "validation"}
                        for language in LANGUAGES]
        self.before = validation_metrics(self.records, [2, 2, 2, 2, 2], LANGUAGES)

    def test_detects_each_language_direction_without_any_source(self):
        after = validation_metrics(self.records, [1, 2.5, 2, 1.5, 2], LANGUAGES)
        summary = compare_validation_losses(self.before, after, LANGUAGES)
        self.assertEqual(summary["validationLossChange"], -0.2)
        self.assertEqual(summary["validationMacroLossChange"], -0.2)
        self.assertEqual(summary["validationLossChangeByLanguage"], {
            "rust": -1, "c": 0.5, "cpp": 0, "python": -0.5, "typescript": 0
        })
        self.assertEqual(summary["validationLanguagesWithHigherLoss"], ["c"])
        self.assertEqual(summary["validationLanguagesWithLowerLoss"], ["rust", "python"])
        self.assertNotIn("prefix", str(summary))
        self.assertNotIn("example", str(summary))

    def test_token_weighted_comparison_reports_independent_language_changes(self):
        tokens = [1, 2, 2, 2, 2]
        before = validation_metrics(self.records, [2, 2, 2, 2, 2],
                                    LANGUAGES, tokens)
        after = validation_metrics(self.records, [1, 3, 2, 2, 2],
                                   LANGUAGES, tokens)
        result = compare_validation_losses(before, after, LANGUAGES)
        self.assertEqual(result["validationTokenWeightedLossChange"], round(1 / 9, 6))
        self.assertEqual(result["validationMacroTokenWeightedLossChange"], 0)
        self.assertEqual(result["validationTokenWeightedLossChangeByLanguage"]["rust"], -1)
        self.assertEqual(result["validationTokenWeightedLossChangeByLanguage"]["c"], 1)
        self.assertEqual(result["validationLanguagesWithHigherTokenWeightedLoss"], ["c"])
        self.assertEqual(result["validationLanguagesWithLowerTokenWeightedLoss"], ["rust"])

    def test_incompatible_or_partial_token_metrics_are_rejected(self):
        first = validation_metrics(self.records, [2] * 5, LANGUAGES, [1] * 5)
        second = validation_metrics(self.records, [1] * 5, LANGUAGES, [1] * 5)
        with self.assertRaises(SamplingRejected):
            compare_validation_losses(first,
                validation_metrics(self.records, [1] * 5, LANGUAGES),
                LANGUAGES)
        for field in ("validationTokenWeightedLoss", "validationTargetTokens"):
            partial = dict(second)
            partial.pop(field)
            with self.subTest(field=field), self.assertRaises(SamplingRejected):
                compare_validation_losses(first, partial, LANGUAGES)
        bad = dict(second)
        bad["validationTargetTokensByLanguage"] = dict(second["validationTargetTokensByLanguage"])
        bad["validationTargetTokensByLanguage"]["cpp"] = 2
        with self.assertRaises(SamplingRejected):
            compare_validation_losses(first, bad, LANGUAGES)
        for field, value in (("validationTokenWeightedLoss", float("inf")),
                             ("validationTargetTokens", True)):
            bad = dict(second, **{field: value})
            with self.subTest(field=field), self.assertRaises(SamplingRejected):
                compare_validation_losses(first, bad, LANGUAGES)

    def test_rejects_changed_validation_scope_and_invalid_numbers(self):
        after = validation_metrics(self.records, [1, 2, 2, 2, 2], LANGUAGES)
        inconsistent = dict(after)
        inconsistent["validationSamplesByLanguage"] = dict(after["validationSamplesByLanguage"])
        inconsistent["validationSamplesByLanguage"]["cpp"] = 2
        with self.assertRaises(SamplingRejected):
            compare_validation_losses(self.before, inconsistent, LANGUAGES)
        for key, value in (("validationLoss", float("nan")),
                           ("validationMacroLoss", float("inf")),
                           ("validationLoss", True)):
            broken = dict(after, **{key: value})
            with self.assertRaises(SamplingRejected):
                compare_validation_losses(self.before, broken, LANGUAGES)
        wrong_languages = dict(after)
        wrong_languages["validationLossByLanguage"] = {"rust": 1}
        with self.assertRaises(SamplingRejected):
            compare_validation_losses(self.before, wrong_languages, LANGUAGES)
        with self.assertRaises(SamplingRejected):
            compare_validation_losses(self.before, after, ("rust", "rust"))

if __name__ == "__main__":
    unittest.main()
