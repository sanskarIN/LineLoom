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
