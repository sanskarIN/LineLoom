"""Offline artifact-integrity receipt for locally trained LineLoom Code adapters.

A digest detects accidental changes, NOT a cryptographic signature or proof
of model ownership, training permissions, lineage, or source confidentiality.
No model/framework imports, network or generated-code logging.
"""
from __future__ import annotations

import hashlib
import json
import os
from contextlib import contextmanager
from pathlib import Path
import re
import stat
from typing import BinaryIO, Iterator

PROTOCOL = "lineloom-local-adapter-receipt-v2"
MAX_RECEIPT_BYTES = 32 * 1024
MAX_ARTIFACT_FILES = 64
MAX_FILE_BYTES = 128 * 1024 * 1024
MAX_TOTAL_BYTES = 256 * 1024 * 1024
SHA256 = re.compile(r"[a-f0-9]{64}\Z")
REVISION = re.compile(r"[a-f0-9]{40}\Z")
SAFE_PART = re.compile(r"[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,127}\Z")


class IntegrityRejected(ValueError):
    """Reject an adapter without exposing user paths or serialized content."""


def _object_without_duplicates(pairs: list[tuple[str, object]]) -> dict:
    record = {}
    for key, value in pairs:
        if key in record:
            raise IntegrityRejected("duplicate-receipt-field")
        record[key] = value
    return record


def _same_regular_file(expected: os.stat_result, actual: os.stat_result) -> bool:
    """Check the opened inode/device, size and modification time against lstat."""
    return (stat.S_ISREG(actual.st_mode) and
            (expected.st_dev, expected.st_ino, expected.st_size, expected.st_mtime_ns) ==
            (actual.st_dev, actual.st_ino, actual.st_size, actual.st_mtime_ns))


@contextmanager
def _checked_regular_stream(path: Path, max_bytes: int) -> Iterator[BinaryIO]:
    """Read from a checked file descriptor, never a separately reopened path.

    O_NOFOLLOW prevents final-component symlink substitution where supported.
    The lstat/fstat/lstat identity checks are retained for Windows and races;
    intermediate directory replacement is not fully prevented by this API.
    """
    try:
        before = path.lstat()
        if not stat.S_ISREG(before.st_mode) or not 0 < before.st_size <= max_bytes:
            raise IntegrityRejected("invalid-artifact-file")
        # O_NONBLOCK also avoids hanging when a concurrently swapped target is
        # a FIFO. On Windows these flags may be unavailable; fstat remains vital.
        flags = (os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) |
                 getattr(os, "O_NONBLOCK", 0) | getattr(os, "O_BINARY", 0))
        fd = os.open(path, flags)
        try:
            stream = os.fdopen(fd, "rb")
        except BaseException:
            os.close(fd)
            raise
        with stream:
            opened = os.fstat(stream.fileno())
            if not _same_regular_file(before, opened):
                raise IntegrityRejected("artifact-changed-before-read")
            yield stream
            closed = os.fstat(stream.fileno())
            after = path.lstat()
            if (not _same_regular_file(before, closed) or
                    not _same_regular_file(before, after)):
                raise IntegrityRejected("artifact-changed-during-read")
    except OSError:
        # Never display OS errors: their messages may contain private paths.
        raise IntegrityRejected("unreadable-artifact") from None


def _file_hash(path: Path, max_bytes: int) -> str:
    """Bounded streaming SHA-256 with descriptor-backed identity checks."""
    digest = hashlib.sha256()
    size = 0
    with _checked_regular_stream(path, max_bytes) as stream:
        while chunk := stream.read(65536):
            size += len(chunk)
            if size > max_bytes:
                raise IntegrityRejected("oversized-artifact")
            digest.update(chunk)
    return digest.hexdigest()


def base_metadata_hashes(base_dir: Path) -> dict:
    """Digest only fixed, reviewed base metadata, never the entire model."""
    if base_dir.is_symlink() or not base_dir.is_dir():
        raise IntegrityRejected("invalid-base-dir")
    return {
        "baseConfigSha256": _file_hash(base_dir / "config.json", MAX_RECEIPT_BYTES),
        "baseTokenizerSha256": _file_hash(base_dir / "tokenizer.json", 32 * 1024 * 1024),
    }


# Restrict the separately provisioned local checkpoint to the expected
# Hugging Face safetensors layout. Only an aggregate digest is published.
MAX_BASE_WEIGHT_FILES = 64
MAX_BASE_WEIGHT_FILE_BYTES = 8 * 1024 * 1024 * 1024
MAX_BASE_WEIGHT_TOTAL_BYTES = 32 * 1024 * 1024 * 1024
WEIGHT_SHARD = re.compile(r"model-[0-9]{5}-of-[0-9]{5}\.safetensors\Z")


def base_weight_fingerprint(base_dir: Path) -> dict:
    """Digest *actual bytes* of local base safetensors and optional shard index.

    All files must be in the checkpoint root. Streaming avoids loading tensor
    content into memory; it does NOT attest that those bytes were the ones
    later loaded into a framework, their rights, or the claimed revision.
    """
    if base_dir.is_symlink() or not base_dir.is_dir():
        raise IntegrityRejected("invalid-base-dir")
    weights = sorted(base_dir.glob("*.safetensors"), key=lambda p: p.name)
    if not 1 <= len(weights) <= MAX_BASE_WEIGHT_FILES:
        raise IntegrityRejected("invalid-base-weight-count")
    names = [p.name for p in weights]
    if len(set(names)) != len(names):
        raise IntegrityRejected("duplicate-base-weight-names")
    if not (names == ["model.safetensors"] or
            all(WEIGHT_SHARD.fullmatch(name) for name in names)):
        raise IntegrityRejected("invalid-base-weight-layout")
    total = 0
    digest = hashlib.sha256(b"lineloom-base-weights-v1\n")
    for path in weights:
        metadata = path.lstat()
        if (not stat.S_ISREG(metadata.st_mode) or
                not 0 < metadata.st_size <= MAX_BASE_WEIGHT_FILE_BYTES):
            raise IntegrityRejected("invalid-base-weight-file")
        total += metadata.st_size
        if total > MAX_BASE_WEIGHT_TOTAL_BYTES:
            raise IntegrityRejected("oversized-base-weights")
        digest.update(path.name.encode("ascii") + b"\0" +
                      str(metadata.st_size).encode("ascii") + b"\0" +
                      _file_hash(path, MAX_BASE_WEIGHT_FILE_BYTES).encode("ascii") +
                      b"\n")

    index_path = base_dir / "model.safetensors.index.json"
    if names == ["model.safetensors"]:
        if index_path.exists() or index_path.is_symlink():
            raise IntegrityRejected("unexpected-base-weight-index")
        digest.update(b"single-file\n")
    else:
        if not index_path.is_file() or index_path.is_symlink():
            raise IntegrityRejected("missing-base-weight-index")
        with _checked_regular_stream(index_path, 1024 * 1024) as stream:
            raw = stream.read(1024 * 1024 + 1)
        try:
            document = json.loads(raw.decode("utf-8", errors="strict"),
                                  object_pairs_hook=_object_without_duplicates)
        except (UnicodeError, ValueError, TypeError):
            raise IntegrityRejected("invalid-base-weight-index") from None
        if (not isinstance(document, dict) or
                not isinstance(document.get("weight_map"), dict) or
                not document["weight_map"] or
                any(not isinstance(key, str) or not key or
                    not isinstance(value, str) for key, value
                    in document["weight_map"].items()) or
                set(document["weight_map"].values()) != set(names)):
            raise IntegrityRejected("inconsistent-base-weight-index")
        # Index bytes are part of the checkpoint identity, not just shards.
        digest.update(b"sharded\n" + hashlib.sha256(raw).hexdigest().encode("ascii"))
    return {"baseWeightsSha256": digest.hexdigest(),
            "baseWeightFiles": len(weights)}


def adapter_artifact_hashes(adapter_dir: Path) -> dict[str, str]:
    """Hash a bounded, regular-file-only adapter tree using relative names."""
    if adapter_dir.is_symlink() or not adapter_dir.is_dir():
        raise IntegrityRejected("invalid-adapter-dir")
    files: dict[str, str] = {}
    total_bytes = 0
    for entry in sorted(adapter_dir.rglob("*")):
        relative = entry.relative_to(adapter_dir)
        if any(not SAFE_PART.fullmatch(part) or part in (".", "..") for part in relative.parts):
            raise IntegrityRejected("unsafe-artifact-name")
        if entry.is_symlink():
            raise IntegrityRejected("symlink-artifact")
        metadata = entry.lstat()
        if stat.S_ISDIR(metadata.st_mode):
            continue
        if not stat.S_ISREG(metadata.st_mode) or not 0 < metadata.st_size <= MAX_FILE_BYTES:
            raise IntegrityRejected("invalid-adapter-artifact")
        if len(files) >= MAX_ARTIFACT_FILES:
            raise IntegrityRejected("too-many-artifacts")
        total_bytes += metadata.st_size
        if total_bytes > MAX_TOTAL_BYTES:
            raise IntegrityRejected("too-large-adapter")
        files[relative.as_posix()] = _file_hash(entry, MAX_FILE_BYTES)
    if (not files or "adapter_config.json" not in files or
            "adapter_model.safetensors" not in files):
        raise IntegrityRejected("incomplete-adapter")
    return files


def read_training_receipt(path: Path) -> dict:
    """Strict, bounded JSON. An arbitrary report is never treated as proof."""
    try:
        with _checked_regular_stream(path, MAX_RECEIPT_BYTES) as stream:
            raw = stream.read(MAX_RECEIPT_BYTES + 1)
        if not 0 < len(raw) <= MAX_RECEIPT_BYTES:
            raise IntegrityRejected("invalid-experiment-receipt-size")
        document = json.loads(
            raw.decode("utf-8", errors="strict"),
            object_pairs_hook=_object_without_duplicates,
            parse_constant=lambda _: (_ for _ in ()).throw(
                IntegrityRejected("invalid-experiment-number"))
        )
    except (OSError, UnicodeError, ValueError, TypeError):
        raise IntegrityRejected("invalid-experiment-receipt") from None
    if not isinstance(document, dict):
        raise IntegrityRejected("invalid-experiment-receipt")
    return document


def verify_training_receipt(adapter_dir: Path, base_dir: Path, revision: str) -> dict:
    """Check experiment metadata and ALL adapter artifact digests, offline.

    Requires a receipt made by the current LineLoom training protocol.
    Any external/older adapter needs independent evaluation, not this gate.
    """
    if (not isinstance(revision, str) or REVISION.fullmatch(revision) is None or
            adapter_dir.name != "adapter"):
        raise IntegrityRejected("unreviewed-adapter-identity")
    receipt = read_training_receipt(adapter_dir.parent / "experiment.json")
    if (receipt.get("adapterReceiptProtocol") != PROTOCOL or
            receipt.get("stage") != "LOCAL_UNREVIEWED_ADAPTER_EXPERIMENT" or
            receipt.get("trainingExecuted") is not True or
            receipt.get("published") is not False or
            type(receipt.get("testSamplesUsed")) is not int or
            receipt.get("testSamplesUsed") != 0 or
            type(receipt.get("trainSamples")) is not int or
            receipt["trainSamples"] <= 0 or
            type(receipt.get("validationSamples")) is not int or
            receipt["validationSamples"] <= 0 or
            not isinstance(receipt.get("trainingManifestSha256"), str) or
            not SHA256.fullmatch(receipt["trainingManifestSha256"]) or
            receipt.get("baseRevisionDeclared") != revision or
            type(receipt.get("baseWeightFiles")) is not int or
            not 1 <= receipt["baseWeightFiles"] <= MAX_BASE_WEIGHT_FILES or
            not isinstance(receipt.get("baseWeightsSha256"), str) or
            not SHA256.fullmatch(receipt["baseWeightsSha256"])):
        raise IntegrityRejected("adapter-receipt-mismatch")
    metadata = {**base_metadata_hashes(base_dir), **base_weight_fingerprint(base_dir)}
    if any(receipt.get(key) != digest for key, digest in metadata.items()):
        raise IntegrityRejected("base-metadata-mismatch")
    claimed_files = receipt.get("adapterFileSha256")
    if not isinstance(claimed_files, dict) or not claimed_files or any(
            not isinstance(name, str) or not isinstance(digest, str) or
            not SHA256.fullmatch(digest) for name, digest in claimed_files.items()):
        raise IntegrityRejected("invalid-receipt-artifacts")
    if claimed_files != adapter_artifact_hashes(adapter_dir):
        raise IntegrityRejected("adapter-content-mismatch")
    return {
        "status": "LOCAL_ADAPTER_INTEGRITY_CHECK_PASS",
        "adapterReceiptProtocol": PROTOCOL,
        "adapterFilesVerified": len(claimed_files),
        "baseMetadataVerified": True,
        "baseWeightsVerified": True,
        "warning": ("Digest checks only: no signature, approved rights, "
                    "declared revision authenticity, training rights, or model release approval."),
    }
