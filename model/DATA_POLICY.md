# Data governance and provenance for LineLoom Code

**Applies to proposed future model training; no training corpus has been collected in this project.**

LineLoom autocomplete only processes user code in the existing consent- and privacy-gated inference path. **User editor buffers, opted-in related-file context, local source, prompts and completions must not become training or evaluation uploads.** The new synthetic evaluator uses only checked-in original fixtures.

Before accepting any training record:

1. Document source repository and immutable revision, original author/provider, applicable SPDX license, attribution requirements, and legal basis for model training/redistribution. A GitHub repository being public is **not sufficient permission**.
2. Enforce dataset opt-outs and removals, plus removal propagation to cached datasets and derived fine-tunes where feasible. Do not include private, unlicensed or disputed content.
3. Scan for credentials, personal information, generated/vendor/minified binaries, copied benchmarks, malicious snippets and instruction-poisoning attempts. Quarantine uncertain cases rather than silently accept them.
4. Deduplicate at repository and content levels; split by repository/fork family, so validation/test examples do not leak into training. Keep explicit exclusions for all public evaluation fixtures.
5. Record retention, access controls, licenses and provenance manifests. Release no raw corpus, excerpts, weights or statistics until rights, safety and privacy reviews pass.
6. Prefer original examples written specifically for LineLoom and small independently permissioned corpora. Never silently crawl a workspace or scrape public repositories from the extension.

Potential data source for later *review*, **not automatically approved for use**: BigCode The Stack v2 and its documented license/provenance/opt-out workflows. Dataset availability and model-training rights must be rechecked for the chosen snapshot and downstream artifact.

Model card and dataset card must disclose sources, exclusions, approximate language mix, evaluation contamination checks, unsafe-completion limitations, known license obligations and opt-out contact procedure before any model release.


## Pre-training mechanical audit (unreleased development)

Use the read-only, offline `npm run model:data-audit -- --manifest local-reviewed-dataset.json`
**only for explicitly obtained, separately reviewed source**. This file is never
checked in, auto-downloaded or discovered from VS Code. Maximum 1 MiB; up to
256 records and 8,192 UTF-16 units of snippet content per record.
Sample schema v1:

```json
{
  "schemaVersion": 1,
  "samples": [
    {
      "id": "locally-reviewed-example-1",
      "language": "rust",
      "split": "train",
      "repositoryGroup": "fork-family-1",
      "sourceRevision": "0123456789abcdef0123456789abcdef01234567",
      "spdxLicense": "MIT",
      "rightsReviewed": true,
      "optOutReviewed": true,
      "attributionReviewed": true,
      "prefix": "fn example() -> i32 { ",
      "middle": "42",
      "suffix": " }"
    }
  ]
}
```

The illustrated single record **does not pass** by itself: each real
manifest needs reviewed train, validation and test samples from distinct
repository/fork groups. All three Boolean review fields are human
declarations, **not proof of permission or a substitute for legal review**.
The allowlist of SPDX identifiers is intentionally narrow and is not a legal
determination that training/redistribution is allowed.

The tool refuses same-repository-group cross-split assignments, duplicate
sample IDs and normalized exact duplicate code, and conservatively screens
near-duplicate fragments (including checked-in original evaluation probes),
obvious credentials, email addresses and hidden Unicode. Heuristics have
both false negatives and false positives. Human red-team, attribution,
copyright, current opt-out and independent secret scans **remain mandatory**.
Output contains **counts and fixed warnings only**, never snippets, sample
IDs, repository identities, revisions, full hashes or file paths. On failure,
the exit code is nonzero and the error text is generic. No dataset export,
download, training loop or server request occurs. Training authorization
is a separate review gate.


### Strict manifest identity and read consistency

The offline v1 preflight now requires **exactly the documented manifest and
sample fields**, with real string types for sample IDs, fork-family identifiers,
language IDs, SPDX license names and immutable source revisions. Numeric
values and objects are rejected instead of being silently converted to text.
Unrecognized or inherited metadata fields are rejected rather than ignored.
Opaque ASCII `repositoryGroup` identifiers are compared without case, so a
case-only change cannot put one family in both training and a holdout split.

The auditor accepts only an explicitly named regular, non-symlink local
manifest. It performs bounded descriptor-backed reads and compares filesystem
identity/size/change timestamps before and after. This detects ordinary
concurrent edits, not a hostile process that restores original metadata
between checks. Neither the schema nor file checks validate actual copyright,
dataset lineage, author consent, hidden duplicates or live opt-outs; the
independent human approval gates still apply.

### Model-control delimiter contamination

The mechanical preflight also blocks exact FIM/chat control markers from
`prefix`, `middle` and `suffix`, even when they appear in comments or
string literals. These markers can change the supervised generation task and
should not be treated as ordinary training text without a separately
reviewed escaping/tokenization policy. The local Python trainer independently
checks canonical combined-tokenization boundaries before assigning labels.
Neither check validates copyright, safety, dataset quality, checkpoint
licensing, actual opt-out requests or the resulting model.

### Five-language split coverage and improved contamination screening

The development audit now requires **at least one independently declared
train, validation and test sample for *each* of Rust, C, C++, Python and
TypeScript** (15 total at minimum), with repository-group holdouts respected.
Its source-free output adds an allowlisted `byLanguageAndSplit` count matrix.
It also applies bounded character-shingle near-duplicate screening against
the original checked-in evaluation probes, not just between submitted
records, to reject lightly edited benchmark copies.

**The minimum one sample per language/split is only a mechanical coverage
gate.** It is far too small for training, statistical validation or reliable
quality comparisons. The group IDs, source rights, licenses, attribution
and opt-out declarations are still user-entered claims requiring independent
verification. This audit is a fail-closed local heuristic, not a legal
approval, a complete plagiarism detector, a proof of no contamination or
authorization to export training data.
