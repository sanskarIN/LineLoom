"""Source-free metadata for optional local Hugging Face FIM smoke runs.

Strictly fixed, original synthetic probes; no private manifests, runtime
framework imports, network or workspace access.
"""
from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

LANGUAGES = ("rust", "c", "cpp", "python", "typescript")
PROTOCOL = "lineloom-hf-synthetic-smoke-v8"
GENERATION_POLICY = "greedy-fim-v2"
PUBLIC_FIXTURES = Path(__file__).resolve().parents[1] / "fixtures" / "completion-v1.json"


class SmokeReportRejected(ValueError):
    """Do not include file contents, prompts or paths in rejection text."""


def _canonical(value: object) -> bytes:
    return json.dumps(
        value, ensure_ascii=False, sort_keys=True, separators=(",", ":"),
        allow_nan=False
    ).encode("utf-8")


def _sha(value: object) -> str:
    return hashlib.sha256(_canonical(value)).hexdigest()


def read_public_fixtures(language: str) -> list[dict]:
    if language not in ("all",) + LANGUAGES:
        raise SmokeReportRejected("invalid-language")
    # This is a fixed checked-in file, never an arbitrary input path.
    try:
        raw = json.loads(PUBLIC_FIXTURES.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, ValueError) as exc:
        raise SmokeReportRejected("invalid-public-probes") from None
    if (not isinstance(raw, dict) or raw.get("schemaVersion") != 1 or
            not isinstance(raw.get("fixtures"), list)):
        raise SmokeReportRejected("invalid-public-probes")
    fixtures = raw["fixtures"]
    if len(fixtures) != 30:
        raise SmokeReportRejected("invalid-public-coverage")
    ids: set[str] = set()
    counts = dict.fromkeys(LANGUAGES, 0)
    for fixture in fixtures:
        if (not isinstance(fixture, dict) or
                set(fixture) != {"id", "language", "prefix", "suffix", "expected", "category"} or
                any(not isinstance(fixture.get(key), str)
                    for key in ("id", "language", "prefix", "suffix", "expected", "category")) or
                not fixture["id"] or fixture["id"] in ids or
                fixture["language"] not in LANGUAGES or
                not fixture["prefix"] or not fixture["expected"]):
            raise SmokeReportRejected("invalid-public-probes")
        ids.add(fixture["id"])
        counts[fixture["language"]] += 1
    if any(count != 6 for count in counts.values()):
        raise SmokeReportRejected("invalid-public-coverage")
    return [fixture for fixture in fixtures
            if language == "all" or fixture["language"] == language]


def fingerprints(fixtures: list[dict], max_new_tokens: int) -> dict:
    """Fingerprint fixture scope and actual ordered FIM generation requests.

    The digest does not attest hardware, weights, backend implementation, or
    tokenizer behavior; those require separate human review.
    """
    if not fixtures or type(max_new_tokens) is not int or not 1 <= max_new_tokens <= 128:
        raise SmokeReportRejected("invalid-generation-scope")
    for item in fixtures:
        if not isinstance(item, dict) or any(
            not isinstance(item.get(key), str)
            for key in ("id", "language", "prefix", "suffix", "expected", "category")
        ):
            raise SmokeReportRejected("invalid-fixture")
    requests = [{
        "prompt": "<|fim_prefix|>" + item["prefix"] +
                  "<|fim_suffix|>" + item["suffix"] + "<|fim_middle|>",
        "maxNewTokens": max_new_tokens,
        "doSample": False,
        "stopTokenKinds": ["tokenizer.eos", "fim_suffix"],
        "decodeSkipSpecialTokens": False,
        "inputTokenLimit": 2048,
    } for item in fixtures]
    return {
        "benchmarkProtocol": PROTOCOL,
        "generationPolicy": GENERATION_POLICY,
        "syntheticFixtures": len(fixtures),
        "fixtureSetSha256": _sha(fixtures),
        "requestSpecSha256": _sha(requests),
    }




def classify_generation_termination(
        generated_ids: list[int], stop_ids: list[int], max_new_tokens: int) -> str:
    """Classify one local generate() result before dropping token IDs.

    Prefer the stop-token label when the model stops precisely at its cap.
    A short response without an explicit stop token cannot be explained
    by this fixed greedy FIM generation policy; refuse to report it.
    """
    if (type(max_new_tokens) is not int or not 1 <= max_new_tokens <= 128 or
            not isinstance(generated_ids, list) or
            not 1 <= len(generated_ids) <= max_new_tokens or
            not isinstance(stop_ids, list) or not stop_ids or
            any(type(item) is not int or item < 0 for item in
                (*generated_ids, *stop_ids))):
        raise SmokeReportRejected("invalid-generation-termination")
    if any(token in stop_ids for token in generated_ids[:-1]):
        raise SmokeReportRejected("unexpected-early-stop-token")
    if generated_ids[-1] in stop_ids:
        return "stop-token"
    if len(generated_ids) == max_new_tokens:
        return "token-limit"
    raise SmokeReportRejected("unexplained-short-generation")


def generation_latency_summary(results: list[dict], max_new_tokens: int = 128) -> dict:
    """Source-free generation timing and actual output-length accounting.

    Count actual generated token IDs, including a terminal stop token when
    present, not UTF-8 characters or decoded text. This avoids interpreting
    a slower but longer completion as a like-for-like latency regression.
    Duration covers model.generate only; it is NOT editor latency.
    """
    if (not isinstance(results, list) or not 1 <= len(results) <= 30 or
            type(max_new_tokens) is not int or not 1 <= max_new_tokens <= 128):
        raise SmokeReportRejected("invalid-generation-measurements")
    buckets: dict[str, list[int]] = {language: [] for language in LANGUAGES}
    token_buckets: dict[str, list[int]] = {language: [] for language in LANGUAGES}
    terminations: dict[str, dict[str, int]] = {
        language: {"stopToken": 0, "tokenLimit": 0} for language in LANGUAGES
    }
    all_times: list[int] = []
    for item in results:
        if not isinstance(item, dict) or item.get("language") not in buckets:
            raise SmokeReportRejected("invalid-generation-language")
        duration = item.get("generationMs")
        generated_tokens = item.get("generationTokens")
        if type(duration) is not int or not 0 <= duration <= 3_600_000:
            raise SmokeReportRejected("invalid-generation-duration")
        if (type(generated_tokens) is not int or
                not 1 <= generated_tokens <= max_new_tokens):
            raise SmokeReportRejected("invalid-generation-token-count")
        reason = item.get("terminationReason")
        if reason not in ("stop-token", "token-limit") or (
            reason == "token-limit" and generated_tokens != max_new_tokens
        ):
            raise SmokeReportRejected("invalid-generation-stop-reason")
        buckets[item["language"]].append(duration)
        token_buckets[item["language"]].append(generated_tokens)
        terminations[item["language"]][
            "stopToken" if reason == "stop-token" else "tokenLimit"
        ] += 1
        all_times.append(duration)

    def nearest_rank(values: list[int], fraction: float) -> int | None:
        if not values:
            return None
        ordered = sorted(values)
        return ordered[max(0, math.ceil(len(ordered) * fraction) - 1)]

    return {
        "latencyMeasurement": "monotonic-generation-only-v1",
        "generationP50Ms": nearest_rank(all_times, 0.5),
        "generationP95Ms": nearest_rank(all_times, 0.95),
        "generationLatencyByLanguage": {
            language: {
                "attempts": len(buckets[language]),
                "p50Ms": nearest_rank(buckets[language], 0.5),
                "p95Ms": nearest_rank(buckets[language], 0.95),
            } for language in LANGUAGES
        },
        "generatedTokenAccounting": "new-token-ids-including-stop-v1",
        "generatedTokenCount": sum(sum(values) for values in token_buckets.values()),
        "generatedTokensByLanguage": {
            language: {
                "attempts": len(token_buckets[language]),
                "totalTokens": sum(token_buckets[language]),
            } for language in LANGUAGES
        },
        "terminationAccounting": "stop-token-or-token-limit-v1",
        "terminationCounts": {
            reason: sum(terminations[language][reason] for language in LANGUAGES)
            for reason in ("stopToken", "tokenLimit")
        },
        "terminationByLanguage": {
            language: {
                "attempts": len(buckets[language]),
                **terminations[language],
            } for language in LANGUAGES
        },
    }


# Deliberately omit hostnames, usernames, environment variables, GPU serials,
# driver strings, install paths and hardware fingerprints from public reports.
# This metadata only catches obvious cross-run incompatibility.
RUNTIME_PROFILE_FIELDS = frozenset({
    "device", "precision", "operatingSystem", "pythonVersion",
    "torchVersion", "transformersVersion", "cudaRuntimeVersion",
    "hipRuntimeVersion"
})


def checked_runtime_profile(profile: dict) -> dict:
    """Require a fixed, source-free profile before comparing smoke reports.

    Matching strings are NOT evidence of the same physical hardware, GPU
    driver, process load, thermal limits or actual code-generation quality.
    """
    import re

    if not isinstance(profile, dict) or set(profile) != RUNTIME_PROFILE_FIELDS:
        raise SmokeReportRejected("invalid-runtime-profile")
    device = profile["device"]
    precision = profile["precision"]
    if (device not in ("cpu", "cuda") or
            precision not in ("float32", "bfloat16") or
            (device == "cpu" and precision != "float32") or
            profile["operatingSystem"] not in ("Linux", "Windows", "Darwin")):
        raise SmokeReportRejected("invalid-runtime-compute")
    version = re.compile(r"[0-9][A-Za-z0-9.+_-]{0,63}\Z")
    for key in ("pythonVersion", "torchVersion", "transformersVersion"):
        value = profile[key]
        if not isinstance(value, str) or not version.fullmatch(value):
            raise SmokeReportRejected("invalid-runtime-version")
    for key in ("cudaRuntimeVersion", "hipRuntimeVersion"):
        value = profile[key]
        if value is not None and (
            not isinstance(value, str) or not version.fullmatch(value)
        ):
            raise SmokeReportRejected("invalid-runtime-accelerator")
    return dict(profile)


def hash_local_metadata_file(path: Path, limit_bytes: int = 32 * 1024 * 1024) -> str:
    """Hash only local, reviewed metadata; refuse unusually large files."""
    digest = hashlib.sha256()
    total = 0
    try:
        with path.open("rb") as handle:
            while block := handle.read(64 * 1024):
                total += len(block)
                if total > limit_bytes:
                    raise SmokeReportRejected("metadata-too-large")
                digest.update(block)
    except OSError:
        raise SmokeReportRejected("unreadable-local-metadata") from None
    if total == 0:
        raise SmokeReportRejected("empty-local-metadata")
    return digest.hexdigest()
