#!/usr/bin/env python3
"""Explicit, read-only verification of a privately trained local adapter."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

try:
    from .integrity import IntegrityRejected, verify_training_receipt
except ImportError:
    from integrity import IntegrityRejected, verify_training_receipt


def main() -> int:
    cli = argparse.ArgumentParser(
        description="Verify a local LineLoom FIM adapter against its saved receipt"
    )
    cli.add_argument("--base-dir", required=True)
    cli.add_argument("--base-revision", required=True)
    cli.add_argument("--adapter-dir", required=True)
    args = cli.parse_args()
    try:
        report = verify_training_receipt(
            Path(args.adapter_dir), Path(args.base_dir), args.base_revision
        )
        print(json.dumps(report, indent=2, sort_keys=True))
        return 0
    except (IntegrityRejected, OSError, ValueError, RuntimeError):
        print("LineLoom adapter integrity verification failed; review local artifacts.",
              file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
