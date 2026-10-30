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
                       languages: tuple[str, ...],
                       target_tokens: list[int] | None = None) -> dict:
    """Describe sample-mean loss and optional target-token-weighted loss.

    Each underlying model loss is averaged across its supervised tokens.
    With varied target lengths, an unweighted average over examples does NOT
    equal an average across target tokens. Report both without private text.
    The target-token counts include supervised EOS and exclude masked FIM
    prompt/suffix tokens. No held-out test records are permitted.
    """
    if (not languages or len(set(languages)) != len(languages) or
            len(samples) != len(losses) or
            (target_tokens is not None and len(target_tokens) != len(samples))):
        raise SamplingRejected("invalid-validation-input")
    buckets: dict[str, list[float]] = {language: [] for language in languages}
    token_buckets: dict[str, list[tuple[float, int]]] = {
        language: [] for language in languages
    }
    for index, (sample, loss) in enumerate(zip(samples, losses)):
        if (not isinstance(sample, dict) or sample.get("split") != "validation" or
                sample.get("language") not in buckets or isinstance(loss, bool) or
                not isinstance(loss, (float, int)) or not math.isfinite(loss) or
                not 0 <= loss < 1_000_000):
            raise SamplingRejected("invalid-validation-loss")
        language = sample["language"]
        buckets[language].append(float(loss))
        if target_tokens is not None:
            count = target_tokens[index]
            if type(count) is not int or not 1 <= count <= 257:
                raise SamplingRejected("invalid-target-token-count")
            token_buckets[language].append((float(loss), count))
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
    report = {
        "validationLoss": round(overall, 6),
        "validationMacroLoss": round(macro, 6),
        "validationLossByLanguage": {
            language: round(averages[language], 6) for language in languages
        },
        "validationSamplesByLanguage": {
            language: len(buckets[language]) for language in languages
        },
    }
    if target_tokens is None:
        return report
    token_totals = {language: sum(count for _, count in token_buckets[language])
                    for language in languages}
    token_averages = {
        language: math.fsum(loss * count for loss, count
                            in token_buckets[language]) / token_totals[language]
        for language in languages
    }
    all_tokens = sum(token_totals.values())
    weighted = math.fsum(
        loss * count for language in languages
        for loss, count in token_buckets[language]
    ) / all_tokens
    token_macro = math.fsum(token_averages.values()) / len(languages)
    if not all(math.isfinite(value) and 0 <= value < 1_000_000
               for value in (weighted, token_macro, *token_averages.values())):
        raise SamplingRejected("invalid-token-weighted-summary")
    report.update({
        "validationTargetTokens": all_tokens,
        "validationTargetTokensByLanguage": token_totals,
        "validationTokenWeightedLoss": round(weighted, 6),
        "validationMacroTokenWeightedLoss": round(token_macro, 6),
        "validationTokenWeightedLossByLanguage": {
            language: round(token_averages[language], 6) for language in languages
        },
    })
    return report

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
    token_fields = (
        "validationTargetTokens", "validationTargetTokensByLanguage",
        "validationTokenWeightedLoss", "validationMacroTokenWeightedLoss",
        "validationTokenWeightedLossByLanguage",
    )
    has_before = any(field in before for field in token_fields)
    has_after = any(field in after for field in token_fields)
    if has_before != has_after:
        raise SamplingRejected("incompatible-token-metric-coverage")
    token_changes = {}
    if has_before:
        if any(field not in before or field not in after for field in token_fields):
            raise SamplingRejected("incomplete-token-metrics")
        total = 0
        before_weighted = checked_metric(before, "validationTokenWeightedLoss")
        after_weighted = checked_metric(after, "validationTokenWeightedLoss")
        before_macro_weighted = checked_metric(before, "validationMacroTokenWeightedLoss")
        after_macro_weighted = checked_metric(after, "validationMacroTokenWeightedLoss")
        for language in languages:
            before_counts = before["validationTargetTokensByLanguage"]
            after_counts = after["validationTargetTokensByLanguage"]
            before_losses = before["validationTokenWeightedLossByLanguage"]
            after_losses = after["validationTokenWeightedLossByLanguage"]
            if (not all(isinstance(item, dict) and set(item) == set(languages)
                        for item in (before_counts, after_counts, before_losses, after_losses)) or
                    type(before_counts[language]) is not int or
                    not 1 <= before_counts[language] <= 257_000 or
                    type(after_counts[language]) is not int or
                    after_counts[language] != before_counts[language]):
                raise SamplingRejected("incompatible-token-validation-scope")
            total += before_counts[language]
            token_changes[language] = round(
                checked_metric(after_losses, language) -
                checked_metric(before_losses, language), 6)
        if (type(before["validationTargetTokens"]) is not int or
                type(after["validationTargetTokens"]) is not int or
                before["validationTargetTokens"] != total or
                after["validationTargetTokens"] != total):
            raise SamplingRejected("inconsistent-token-validation-counts")
        token_changes = {
            "validationTokenWeightedLossChange": round(
                after_weighted - before_weighted, 6),
            "validationMacroTokenWeightedLossChange": round(
                after_macro_weighted - before_macro_weighted, 6),
            "validationTokenWeightedLossChangeByLanguage": token_changes,
            "validationLanguagesWithHigherTokenWeightedLoss": [
                language for language in languages
                if token_changes[language] > 0.000001],
            "validationLanguagesWithLowerTokenWeightedLoss": [
                language for language in languages
                if token_changes[language] < -0.000001],
        }

    return {
        "validationLossChange": round(after_loss - before_loss, 6),
        "validationMacroLossChange": round(after_macro - before_macro, 6),
        "validationLossChangeByLanguage": changes,
        **token_changes,
        "validationLanguagesWithHigherLoss": raised,
        "validationLanguagesWithLowerLoss": lowered,
        "warning": ("Changes are descriptive validation-only loss differences; "
                    "not code correctness, unbiased quality or a promotion decision.")
    }
