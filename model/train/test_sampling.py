"""Offline reproducibility and leakage tests; no private source or ML imports."""
from __future__ import annotations

import unittest

try:
    from .sampling import SamplingRejected, balanced_sample_indices, validation_metrics
except ImportError:
    from sampling import SamplingRejected, balanced_sample_indices, validation_metrics

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


if __name__ == "__main__":
    unittest.main()
