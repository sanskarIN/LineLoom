"""Deterministic five-language sampling and validation for local FIM experiments.

Pure standard library: testable without a model, GPU, private source or network.
No sample contents, paths or IDs are returned in aggregate metrics.
"""
from __future__ import annotations

import math
import random


class SamplingRejected(ValueError):
    """Reject invalid local experiment sampling inputs without user content."""


def balanced_sample_indices(samples: list[dict], languages: tuple[str, ...],
                            draws: int, seed: int) -> list[int]:
    """Seeded round-robin over languages, shuffling examples per language.

    Exactly one training example per draw. Language exposure differs by at
    most one; small language buckets must repeat and are NOT extra data.
    Never sample validation/test records: the caller supplies train-only data.
    """
    if (not languages or len(set(languages)) != len(languages) or
        type(draws) is not int or not 1 <= draws <= 1_000_000 or
        type(seed) is not int or not 0 <= seed <= 2_147_483_647):
        raise SamplingRejected("invalid-sampling-parameters")
    buckets: dict[str, list[int]] = {language: [] for language in languages}
    for index, sample in enumerate(samples):
        if not isinstance(sample, dict) or sample.get("language") not in buckets or sample.get("split") != "train":
            raise SamplingRejected("nontraining-sample")
        buckets[sample["language"]].append(index)
    if any(not bucket for bucket in buckets.values()):
        raise SamplingRejected("missing-training-language")

    rng = random.Random(seed)
    for bucket in buckets.values():
        rng.shuffle(bucket)
    order = list(languages)
    rng.shuffle(order)
    cursor = {language: 0 for language in languages}
    chosen: list[int] = []
    for draw in range(draws):
        if draw and draw % len(order) == 0:
            rng.shuffle(order)
        language = order[draw % len(order)]
        bucket = buckets[language]
        position = cursor[language]
        if position == len(bucket):
            rng.shuffle(bucket)
            position = 0
        chosen.append(bucket[position])
        cursor[language] = position + 1
    return chosen


def validation_metrics(samples: list[dict], losses: list[float],
                       languages: tuple[str, ...]) -> dict:
    """Report independently observable validation-only means by language.

    The macro average weights languages equally; the sample average weights
    each validation example equally. Both are descriptive training signals,
    not held-out test results or code-correctness metrics.
    """
    if not languages or len(set(languages)) != len(languages) or len(samples) != len(losses):
        raise SamplingRejected("invalid-validation-input")
    buckets: dict[str, list[float]] = {language: [] for language in languages}
    for sample, loss in zip(samples, losses):
        if (not isinstance(sample, dict) or sample.get("split") != "validation" or
            sample.get("language") not in buckets or isinstance(loss, bool) or
            not isinstance(loss, (float, int)) or not math.isfinite(loss) or
            not 0 <= loss < 1_000_000):
            raise SamplingRejected("invalid-validation-loss")
        buckets[sample["language"]].append(float(loss))
    if any(not values for values in buckets.values()):
        raise SamplingRejected("missing-validation-language")
    averages = {language: math.fsum(values) / len(values)
                for language, values in buckets.items()}
    total_count = sum(len(values) for values in buckets.values())
    overall = math.fsum(math.fsum(values) for values in buckets.values()) / total_count
    macro = math.fsum(averages.values()) / len(languages)
    if not all(math.isfinite(value) and 0 <= value < 1_000_000
               for value in (overall, macro, *averages.values())):
        raise SamplingRejected("invalid-validation-summary")
    return {
        "validationLoss": round(overall, 6),
        "validationMacroLoss": round(macro, 6),
        "validationLossByLanguage": {
            language: round(averages[language], 6) for language in languages
        },
        "validationSamplesByLanguage": {
            language: len(buckets[language]) for language in languages
        },
    }



def compare_validation_losses(before: dict, after: dict,
                              languages: tuple[str, ...]) -> dict:
    """Describe validation loss changes on the SAME samples, never test data.

    This is a diagnostic, not a model promotion gate or code-quality metric.
    Validate aggregate inputs so malformed reports cannot suggest improvement.
    """
    if not languages or len(set(languages)) != len(languages):
        raise SamplingRejected("invalid-validation-language-scope")

    def checked_metric(report: dict, key: str) -> float:
        if not isinstance(report, dict):
            raise SamplingRejected("invalid-validation-report")
        value = report.get(key)
        if (isinstance(value, bool) or not isinstance(value, (float, int)) or
                not math.isfinite(value) or not 0 <= value < 1_000_000):
            raise SamplingRejected("invalid-validation-report-value")
        return float(value)

    before_loss = checked_metric(before, "validationLoss")
    after_loss = checked_metric(after, "validationLoss")
    before_macro = checked_metric(before, "validationMacroLoss")
    after_macro = checked_metric(after, "validationMacroLoss")
    changes = {}
    raised = []
    lowered = []
    for language in languages:
        a_counts = before.get("validationSamplesByLanguage")
        b_counts = after.get("validationSamplesByLanguage")
        a_losses = before.get("validationLossByLanguage")
        b_losses = after.get("validationLossByLanguage")
        if (not isinstance(a_counts, dict) or not isinstance(b_counts, dict) or
                not isinstance(a_losses, dict) or not isinstance(b_losses, dict) or
                set(a_counts) != set(languages) or set(b_counts) != set(languages) or
                set(a_losses) != set(languages) or set(b_losses) != set(languages) or
                type(a_counts.get(language)) is not int or a_counts[language] < 1 or
                type(b_counts.get(language)) is not int or
                a_counts[language] != b_counts[language]):
            raise SamplingRejected("incompatible-validation-scope")
        change = (checked_metric(b_losses, language) -
                  checked_metric(a_losses, language))
        changes[language] = round(change, 6)
        if change > 0.000001:
            raised.append(language)
        elif change < -0.000001:
            lowered.append(language)
    return {
        "validationLossChange": round(after_loss - before_loss, 6),
        "validationMacroLossChange": round(after_macro - before_macro, 6),
        "validationLossChangeByLanguage": changes,
        "validationLanguagesWithHigherLoss": raised,
        "validationLanguagesWithLowerLoss": lowered,
        "warning": ("Changes are descriptive validation-only loss differences; "
                    "not code correctness, unbiased quality or a promotion decision.")
    }
