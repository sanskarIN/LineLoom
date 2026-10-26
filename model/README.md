# LineLoom autocomplete-model research

**State: research and evaluation infrastructure only. No LineLoom-trained model, weights, fine-tune, or benchmark results exist yet.**

LineLoom's VS Code extension already supports more languages; this **dedicated model track is intentionally narrower**:

| Scope | VS Code language ID | Extension |
| --- | --- | --- |
| Rust | `rust` | `.rs` |
| C | `c` | `.c`, `.h` |
| C++ | `cpp` | `.cc`, `.cpp`, `.cxx`, `.hpp` |
| Python | `python` | `.py`, `.pyi` |
| TypeScript | `typescript` / `typescriptreact` | `.ts`, `.tsx` |

C and C++ are **separate** evaluation targets. JavaScript, Java, Kotlin and Go remain supported by the extension with existing Ollama models, but **are not initial dedicated-model targets**.

## Running the first evaluation harness

The checked-in `fixtures/completion-v1.json` contains **30 small, original, synthetic examples**, six per language. It is **not a training corpus**. A strict exact string comparison is a narrow regression metric, not a claim that the generated code compiles or is useful. Equivalent completions can be marked wrong.

```sh
npm run model:eval:dry
npm run test:model-eval
# Optional; requires running Ollama and an installed model:
npm run model:eval -- --model qwen2.5-coder:1.5b --runs 3 --mode auto
# Compare syntax-sensitive or suffix behavior in isolation:
npm run model:eval -- --language cpp --category suffix --runs 2
# For a future FIM-trained, locally installed custom model:
npm run model:eval -- --model lineloom-code:dev --mode fim --language rust
```

- The evaluator is **opt-in** and talks only to `http://127.0.0.1:11434/api/generate`. It has no configurable remote endpoint and no model downloads.
- `--dry-run` is fully offline. No evaluator command reads editor buffers, repositories or personal source.
- `--runs` allows 1–5 sequential repetitions. Language filters: `rust`, `c`, `cpp`, `python`, `typescript`, or `all`. The optional `--category` filter selects `expression`, `statement`, `suffix`, `type`, `indentation`, or `all`.
- Each language has six hand-authored, synthetic checks. Category-specific results distinguish common expressions, statements, suffix awareness, type usage, and indentation. **Synthetic strict matches can reject valid alternative implementations**.
- `auto` uses prefix/suffix generation for the known `qwen2.5-coder` model family and a bounded instruction format for all others; `--mode fim` explicitly benchmarks a custom FIM-capable model.
- Only aggregate counts, per-language/per-category strict matches, nearest-rank p50/p95 duration/first-token latency, and **fixture-level outcome totals without fixture IDs** are printed. `fixtureOutcomes` reports how many synthetic fixtures were evaluated, repeated, matched at least once, matched on every attempt, or had mixed exact-match outcomes. Failed requests count as non-matches. `exactEveryAttempt` also includes one-run fixtures; use `repeated` to distinguish repeated observations. These are descriptive synthetic results, **not statistical pass@k, real-editor acceptance or proven model quality**. Model text, prompts, paths and server errors are not logged. A failed request returns a failure count and a nonzero process exit code.
- The stream decoder validates NDJSON finalization, malformed response fields, UTF-8 boundaries and strict output/byte/record limits; the tests use offline synthetic streams rather than real model access.
- Run one **named model and mode at a time** on the same local machine, with warmed and cold trials recorded separately in human-written notes. Do not compare claims across different hardware without annotation.
- Human review of syntax correctness, unsafe code, indentation, duplicate suffix, irrelevant outputs, keyboard UX and actual VS Code acceptance remains **NOT RUN** until recorded separately.

See the [reproducible local benchmark protocol](EVALUATION_PROTOCOL.md), [training and release gates](TRAINING_PLAN.md) and [dataset and contributor policy](DATA_POLICY.md). Do not confuse the extension's version numbers with any future model version.

## Source and safety boundaries

Existing LineLoom endpoint approval, workspace trust, file exclusions, per-language model selection, cancellation and bounded prompt windows remain in force. The benchmark introduces **no new inference path inside the extension**; it is an explicitly invoked development command.

The eventual first-party model can be distributed only after a separate reviewed model license, weight provenance, privacy assessment, local compatibility test and maintainer release approval.
