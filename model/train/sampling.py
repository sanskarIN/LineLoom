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
