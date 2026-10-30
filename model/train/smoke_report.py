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
PROTOCOL = "lineloom-hf-synthetic-smoke-v4"
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



def generation_latency_summary(results: list[dict]) -> dict:
    """Aggregate completed local generations; never expose per-probe timings.

    Duration covers model.generate only. It excludes model loading, prompt
    tokenization and decoding, so it is NOT end-to-end editor latency.
    CUDA callers must synchronize around generation before recording times.
    """
    if not isinstance(results, list) or not 1 <= len(results) <= 30:
        raise SmokeReportRejected("invalid-generation-measurements")
    buckets: dict[str, list[int]] = {language: [] for language in LANGUAGES}
    all_times: list[int] = []
    for item in results:
        if not isinstance(item, dict) or item.get("language") not in buckets:
            raise SmokeReportRejected("invalid-generation-language")
        duration = item.get("generationMs")
        if type(duration) is not int or not 0 <= duration <= 3_600_000:
            raise SmokeReportRejected("invalid-generation-duration")
        buckets[item["language"]].append(duration)
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
    }


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
