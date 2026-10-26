# Local model baseline — reproducible evaluation protocol

**Status: procedure only. No measurements have been performed or endorsed by this document.**

This is an opt-in, **synthetic-only** developer protocol for the first-party
LineLoom Code research track: Rust, C, C++, Python and TypeScript.
It does not test user repositories, collect source, train a model, download
weights, or authorize an extension/registry release.

## 1. Record the test environment (without private data)

Keep a private local note of the UTC date, LineLoom Git commit SHA,
Ollama version, editor version (if an editor test is run), OS version,
CPU/GPU type, RAM/VRAM, quantization, exact installed model tag,
prompt mode, and whether the trial is cold or warmed.

- Use a *manually installed, permitted* local Ollama model.
- Benchmark a single named model and mode at a time. Run different models
  on the same machine with the same number of attempts before comparing.
- Record changes to CPU/GPU load, power mode, thermal state or hardware;
  do not mix machine configurations into one performance claim.
- Do not share paths, hostnames, prompt/response bodies, code snippets,
  local user IDs, secrets, endpoint credentials or private model sources.

## 2. Validate before any inference

From a reviewed checkout of the exact Git commit, with Node.js 22+:

```sh
npm ci
npm run test:model-eval
npm run model:eval:dry
```

The dry run is offline: confirm the expected **30 synthetic fixtures** across
five languages, six per language. A dry run is not model inference.

## 3. Run a controlled, voluntary baseline

The evaluator only targets loopback `http://127.0.0.1:11434/api/generate`
and never crawls the workspace or uploads examples.

```sh
npm run model:eval -- --model qwen2.5-coder:1.5b --mode auto --runs 3
npm run model:eval -- --model qwen2.5-coder:1.5b --mode auto --language cpp --runs 3
npm run model:eval -- --model qwen2.5-coder:1.5b --mode auto --category suffix --runs 3
```

Replace the illustrative tag only with a locally installed, reviewed model.
Run `--mode fim` only where a model actually supports suffix-aware FIM.
Use separate notes for cold and warmed conditions. The benchmark is
sequential and capped at five runs per fixture; do not assume independence
from repeated runs or infer human usefulness from strict string equality.

A failing inference returns a nonzero process exit code; preserve the
aggregate failure count and do **not** quietly discard failed attempts.
The evaluator prints only aggregate statistics, not source or generated code.

## 4. Interpret numbers accurately

| Field | Correct interpretation |
| --- | --- |
| `attempts`, `completed`, `failed` | Every attempted synthetic request, including failures |
| `strictExactMatches` | Finished responses exactly matching one hand-authored continuation |
| `perLanguage` / `perCategory` | Counts, not compile correctness or an editor acceptance rate |
| `completionP50Ms` / `completionP95Ms` | Nearest-rank latency **of completed requests only** |
| `firstTokenP50Ms` / `firstTokenP95Ms` | Latency of completed requests that emitted a token |
| `fixtureOutcomes.evaluated` | Distinct synthetic fixtures with recorded attempts |
| `fixtureOutcomes.repeated` | Distinct fixtures with more than one attempt |
| `fixtureOutcomes.exactAtLeastOnce` | Fixtures with at least one exact completed response |
| `fixtureOutcomes.exactEveryAttempt` | Fixtures with all attempts exact, including one-run fixtures |
| `fixtureOutcomes.mixedExactOutcomes` | Repeated fixtures with both exact and non-exact outcomes, including failed attempts |

If there are few completed requests, latency percentiles are not a reliable
performance baseline. These indicators are **not pass@k**, compilation
results, controlled random-seed repeatability, human acceptance or production
readiness. A correct alternative implementation may be recorded as a
non-match. Inspect actual suggestions **locally** before making any claim
about quality.

## 5. Sanitize and review the report

Use this metadata-only template in a GitHub issue or reviewed PR:

```text
Evaluation status: NOT RUN / PASS / FAIL / DEFERRED
Date (UTC):
Tested commit SHA:
Model tag and quantization (public names only):
Ollama version / prompt mode:
OS / CPU / GPU / RAM / runtime conditions:
Runs per fixture and filters:
Synthetic attempts / completed / failed / exact matches:
Per-language aggregate counts:
Fixture outcomes (aggregate counts only):
Completed-request total p50/p95 and first-token p50/p95:
Known limitations / follow-up issue:
Manual editor verification: NOT RUN / PASS / FAIL / DEFERRED
```

Never attach full benchmark console traffic from an unreviewed environment,
private generated code, model responses, personal prompts, secret-bearing
URLs, or file paths. Publish sanitized numeric aggregates only.

## 6. Release and training decision gates

A synthetic comparison can guide the next **research** experiment, but does
not justify claiming LineLoom Code is trained, superior, stable or
production-ready. Review model/checkpoint licenses and provenance before
any download/training/redistribution; use independent holdouts for training
experiments and physical Windows/macOS/Linux editor QA with keyboard and
accessibility testing before proposing a stable release.

See [training plan](TRAINING_PLAN.md), [data policy](DATA_POLICY.md),
[model README](README.md) and [manual release evidence rules](../docs/qa/release-evidence.md).


## 7. Offline, controlled baseline-to-candidate comparison (unreleased)

After both runs use the **same** checked-out fixtures, explicit prompt mode,
hardware, quantization conditions, and `--runs`, save their aggregate JSON
outputs locally and compare only after the reports have been reviewed:

```sh
npm run model:compare -- --baseline baseline.json --candidate candidate.json
```

The source-free comparator verifies a cryptographic fixture-set fingerprint
(which includes checked-in fixture contents), benchmark protocol, prompt mode,
run count, and per-language/category attempt scope before reporting deltas.
It refuses incompatible/malformed/legacy reports rather than comparing
percentages across different test sets. Input files are individually capped at
32 KiB, and untrusted report fields are never echoed. Keep names and raw
reports local, and **review the clipboard or output before publishing**.

This does not establish matching runtime/hardware, independent statistical
significance, correctness, user acceptance or actual first-party model
progress. No physical model run or benchmark observation was performed by
the implementation.


## 8. Conservative completion-format signals (v2 development)

The report records aggregate counts for `empty`, `markdownFence`,
`chatPreamble`, `specialToken`, `unsafeUnicode`, `prefixEcho`,
and `suffixEcho`, plus inspected completions and completions without any
detected format flag. Multiple signals can apply to one completion; do
not sum these counts to derive a failure rate. A token/code continuation
may be semantically wrong despite no format flags. Manual editor review
and separately isolated compiler checks are still required.

Reports now specify benchmark protocol `lineloom-synthetic-v2`, and the
comparison command refuses old v1 or mixed-protocol reports. Do not
compare new v2 signal counts with prior v1 runs or call them a quality
benchmark until actual local model evidence has been collected.


## 9. Source-free request-spec SHA-256 (v3 source, not yet released)

Both the offline dry-run and real model evaluator record
`requestSpecSha256` of the complete constructed original synthetic Ollama
requests, excluding the model tag. The hash binds prompt instructions,
prefix, FIM suffix, stream flag and explicit sampling/context settings,
independent of the `fixtureSetSha256` hash of public probes and expected
continuations. Neither value writes raw prompts or model completions to
the benchmark report.

The comparator rejects missing/different request-spec digests. Because
the report contract changes, its protocol is now
**`lineloom-synthetic-v3`**; v1/v2 reports must be rerun to compare.
The digest is a local reproducibility check, **not an attestation** of
server-side settings, model checkpoint/quantization, physical hardware or
semantic quality. Record those external variables separately and review
numeric results honestly.
