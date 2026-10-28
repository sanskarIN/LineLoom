# LineLoom roadmap

**Updated 2026-10-28 · Planned milestones are not implementation or release commitments.**

## Current state (verified repository and GitHub release)

- **GitHub stable: [v1.3.0](https://github.com/sanskarIN/LineLoom/releases/tag/v1.3.0)**, published 2026-10-25 with stable-channel VSIX and SHA-256. Default-off **explicitly selected** related-file context, native sidebar and single-file autocomplete are shipped.
- **Latest GitHub preview: [v1.4.2](https://github.com/sanskarIN/LineLoom/releases/tag/v1.4.2)**, published 2026-10-27 with a genuine preview-channel VSIX and SHA-256 after locked checks, a mocked editor-host test, clean install and pinned upgrades from stable v1.3.0 and preview v1.4.1. It adds optional HTML/CSS/Lua language modes, local FIM tag routing and synthetic model-research safeguards; **no first-party trained weights or real model benchmarks** are included. v1.3.0 remains GitHub stable; neither extension marketplace is updated by the GitHub release. No standalone v1.2.5 release exists.
- **Shipped in preview:** [PR #99](https://github.com/sanskarIN/LineLoom/pull/99) added invisible-Unicode completion hardening, now included in the v1.3.1 pre-release VSIX.
- **Independent distribution:** [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=SanskarCodes.lineloom) and [Open VSX](https://open-vsx.org/extension/SanskarCodes/lineloom) listings use `SanskarCodes.lineloom` and are **not automatically updated by GitHub**. Open VSX v1.3.0 Stable was independently published and verified on 2026-10-25; the maintainer separately updated Marketplace to v1.3.0. Verify live registry versions before giving future install advice. GitHub Packages npm installer `@sanskarin/lineloom-cli` is independently published at **v0.1.0**, without CLI v0.2.0 verify or proposed v0.3.0 offline install.
- **Outstanding quality evidence:** real Ollama completion quality, physical Windows/macOS/Linux editor UX, accessibility, selected-context consent and real publisher-authentication workflows are not verified by the automated release. See [#66](https://github.com/sanskarIN/LineLoom/issues/66), [#60](https://github.com/sanskarIN/LineLoom/issues/60), [#79](https://github.com/sanskarIN/LineLoom/issues/79), and [manual acceptance](qa/v1.3.0-manual-acceptance.md).

## v1.4.2 GitHub-only pre-release — published

The [verified GitHub v1.4.2 preview](https://github.com/sanskarIN/LineLoom/releases/tag/v1.4.2) includes [opt-in HTML/CSS/Lua](https://github.com/sanskarIN/LineLoom/pull/144), [local-only native FIM tag routing](https://github.com/sanskarIN/LineLoom/pull/145), adapter-integrity receipts and stronger source-free synthetic benchmark checks. Publication ran through the [owner-authorized v1.4.2 workflow](https://github.com/sanskarIN/LineLoom/actions/runs/40446223653); physical editor acceptance, real-model quality and independent registry updates are **not** implied. See [release notes](releases/v1.4.2.md) and [manual QA — NOT RUN](qa/v1.4.2-preview-acceptance.md).

## v1.4.1 GitHub-only pre-release — published

The [verified GitHub pre-release](https://github.com/sanskarIN/LineLoom/releases/tag/v1.4.1) packages post-v1.4.0 improvements (#126, #127, #129, #130, #131) after an owner-authorized [publisher run](https://github.com/sanskarIN/LineLoom/actions/runs/40265555223), with both public checksum-matching assets. Stable stays v1.3.0 and all registries/publisher `SanskarCodes.lineloom` remain untouched. No trained weights or verified real Ollama model benchmark. See [versioned release notes](releases/v1.4.1.md) and [manual QA NOT RUN](qa/v1.4.1-preview-acceptance.md).

## Post-v1.4.0 source work (now included in v1.4.1 preview)

- [PR #126](https://github.com/sanskarIN/LineLoom/pull/126): sanitized
  clipboard support summary and editor-scoped manual-status invalidation.
- [PR #127](https://github.com/sanskarIN/LineLoom/pull/127): explicit Ollama
  model checks now abort obsolete pending discovery requests on settings,
  trust and editor changes.
- Both PRs passed mocked Linux extension-host, Windows/macOS/Linux CI,
  dependency audit and VSIX candidate checks. These tests are not real-model
  or physical keyboard/screen-reader acceptance. The source changes shipped in the GitHub v1.4.1 preview.
- **Publisher migration remains on hold.** Preserve
  `SanskarCodes.lineloom` and all existing marketplace links until the
  maintainer specifically requests and approves a migration plan.

## Opt-in HTML, CSS and Lua — included in v1.4.2 preview

[PR #144](https://github.com/sanskarIN/LineLoom/pull/144) introduced three optional language modes, now packaged in the GitHub v1.4.2 preview: three additional editor modes require explicit opt-in, the nine existing defaults remain unchanged, per-language local model overrides work, and existing endpoint/privacy gates remain in force. No auto-download, workspace scanning or trained LineLoom Code weights are included. Review [language controls](languages/README.md) and [manual acceptance](qa/opt-in-web-lua-acceptance.md) before recommending broader distribution.

## Model research included in v1.4.2 preview (no model weights)

- [PR #145](https://github.com/sanskarIN/LineLoom/pull/145): an explicitly configured `lineloom-code` model tag uses native bounded FIM requests when no extra references are selected. This does not establish that a first-party model was actually trained or installed.
- [PR #143](https://github.com/sanskarIN/LineLoom/pull/143): integrity receipts for local LoRA adapter experiment artifacts, strict offline verification and matching-receipt gates before smoke comparison. Digest matching alone is **not** signature or provenance verification.
- Cross-platform and editor-host automated checks passed for the merged source. Actual model inference, generated-code quality, physical accessibility and distribution approval remain outstanding.

## Forward-looking milestones

| Target | State | Priority and proposed deliverables | Explicit gates |
| --- | --- | --- | --- |
| **v1.3.1 — reliability preview** | **GitHub pre-release published** | Unicode completion safety, native sidebar next-action guidance, manually checked default and effective editor models, local file privacy | [Public preview and notes](releases/v1.3.1.md), [manual QA still outstanding](qa/v1.3.1-preview-acceptance.md); not a stable or registry release |
| **CLI v0.2.0/v0.3.0** | Development candidates; not published | Offline local VSIX verification, then carefully reviewed offline installation from pinned artifacts | Independent [PR #92](https://github.com/sanskarIN/LineLoom/pull/92), package-only tests/security, real installs and version-specific GitHub Packages authorization |
| **v1.4.0 — usability & quality** | **GitHub pre-release published 2026-10-26; not stable** | 30-fixture, five-language synthetic evaluator and repeatability aggregates; native status clarity, accepted-item metrics, bounded p50/p95, automatic transient retry pause and explicit session reset | [Candidate notes](releases/v1.4.0.md), [manual QA NOT RUN](qa/v1.4.0-preview-acceptance.md), locked audit/VSIX/upgrade and separate GitHub-only publication |
| **v1.4.x+ — language evaluation** | Research | Investigate C# and Dart opt-in support and model-specific prompting only if real samples justify them | VS Code language mapping, fixtures, bounded prompts, manual local model quality across OSs |
| **v1.5.x+ — limited symbol intelligence** | RFC only | Explore optional developer-selected symbol/import hints with bounded parser effort | New opt-in privacy RFC, no automatic workspace scan or persistent indexing by default, independent I/O and security evaluation |
| **v2.0.0 — additional local providers** | Research, not scheduled | Abstract backend transport without losing Ollama defaults | Explicit endpoint permissions, no cloud inference by default, strict stream decoding, cancel and budget equivalence |

**The roadmap is not release evidence.** The latest [v1.4.2 publisher](https://github.com/sanskarIN/LineLoom/actions/runs/40446223653) and GitHub pre-release assets were verified independently; external registries, the npm CLI and stable v1.3.0 were not changed. Future releases remain channel-specific.

## Suggested next work order

1. Resolve or explicitly record remaining **manual v1.3.0 acceptance** tasks with sanitized dated evidence. Keep [security #79](https://github.com/sanskarIN/LineLoom/issues/79) open while compatible upstream packaging options and inherited moderate advisories are assessed.
2. Fix the highest-impact small runtime regressions in focused PRs with mocked VS Code host tests; improve feedback without recording user code or filenames.
3. Validate the pinned npm CLI branch separately, especially the independent security workflow; do not publish proposed commands before acceptance.
4. Make readiness status precise: the native status bar distinguishes enabled from manually verified models; pending user-initiated checks show non-clickable Next notices. No new network or source access on refresh. Physical accessibility QA remains **NOT RUN**.
5. Measure suggestions offered separately from the session-only VS Code accepted-item callbacks in development; do not infer usefulness or human model quality. Manual acceptance and accessibility on physical OS devices remain **NOT RUN**. See [sidebar notes](sidebar.md).
6. Maintain the **opt-in, bounded 64-request inference latency window** with source-free p50/p95 readings and user-initiated timing reset. This is a developer feature only: no real Ollama machine benchmark has yet been recorded.
7. Use the [dedicated-model synthetic evaluation harness](../model/README.md) and [reproducible local baseline protocol](../model/EVALUATION_PROTOCOL.md) to collect genuine optional local Ollama evidence. [PR #119](https://github.com/sanskarIN/LineLoom/pull/119) added aggregate repeated-fixture outcomes to unreleased v1.4 development source on `main`, with six passing automated checks, but no real-model results. Review [training and licensing gates](../model/TRAINING_PLAN.md) before any fine-tuning. No benchmark results or model weights are claimed yet.
8. Use [v1.3.1 preview feedback](releases/v1.3.1.md) and unresolved manual acceptance to plan the next **stable** candidate separately; then investigate v1.4.0 usability and model-quality work.

## Permanent non-goals for current releases

No account or subscription requirement, passive model downloads, telemetry, arbitrary external code uploads, automatic whole-repository indexing, persistent private-source embeddings or silent remote origin changes.

## Technical plans and historical release notes

- [Upcoming feature candidates and decision criteria](feature-proposals.md)
- [v1.3.1 maintenance scope and exit criteria](releases/v1.3.1-plan.md)
- [Release evidence rules](qa/release-evidence.md) · [v1.3.0 acceptance checklist](qa/v1.3.0-manual-acceptance.md)
- [Selected-file context privacy RFC](privacy/selected-context.md) · [Packages guide](packages.md)
- [CHANGELOG.md](../CHANGELOG.md) for **historical releases through the GitHub v1.4.0 preview** and what was actually released, and [GitHub Releases](https://github.com/sanskarIN/LineLoom/releases) for public artifact truth.


## After v1.4.0 — working notes (unreleased)

- **Active-editor readiness correctness:** switching/closing an editor must
  clear *both* manual last-check model and file statuses, and pending results
  cannot reappear after the editor changes. This does not cause passive checks.
- **Copy sanitized support summary:** opt-in clipboard action with aggregate
  session counts and finite-latency summaries only, no source, filenames,
  model IDs, endpoint URLs or stored analytics. Clipboard privacy is disclosed.
- **Publisher ID migration:** intentionally **NOT STARTED**. The current
  `SanskarCodes.lineloom` identity, installation paths and registry listings
  remain unchanged until the maintainer explicitly authorizes a future
  publisher/extension-ID migration, rollback plan and separate channel checks.


- **Manual model check efficiency (post-v1.4.0 development):** abort obsolete,
  user-invoked model-list requests when the editor or configuration changes,
  without adding passive probes or persistent network state.


- **First-party FIM model evaluation (post-v1.4.0 development):** new
  source-free offline baseline/candidate comparator enforces synthetic fixture
  content fingerprint, mode, repetitions and numeric summary invariants.
  Per-language deltas help avoid hiding weaker C or C++ samples behind
  one total. No Ollama real-model measurements or trained model weights exist.


- **Model data governance (post-v1.4.0 source):** opt-in,
  read-only `model:data-audit` preflight for explicitly approved local
  manifest files; fail-closed rights declarations, repo-group holdout splits,
  duplicate/heuristic benchmark contamination, and obvious secrets.
  No corpus was gathered, rights have not been approved and no training run
  has been performed. Human review is required after a mechanical PASS.


- **LineLoom Code synthetic evaluation (post-v1.4.0):** v2 protocol includes
  seven conservative, source-free response-format indicators; offline
  baseline comparator refuses v1/v2 mixture and highlights aggregate
  response-format changes alongside exact matches and latency. This
  infrastructure has **no real-Ollama quality measurements** yet.


- **LineLoom Code M1 data preflight hardening (development after v1.4.1):**
  refuse missing train/validation/test coverage for any of Rust, C, C++,
  Python or TypeScript and screen lightly altered public benchmark text
  with additional character-shingle overlap checks. Report only bounded
  language-by-split counts. No corpus was gathered and no actual model
  training or editor-quality benchmark took place.


- **M2 synthetic request reproducibility (post-v1.4.1 development):**
  protocol v3 adds source-free fingerprints for generated synthetic prompts,
  FIM suffixes and explicit Ollama settings; offline comparison requires
  identical request spec and refuses legacy v1/v2 reports. Hardware,
  server defaults and model revisions still require independent review.

- **M2 local synthetic evaluator hardening (post-v1.4.1 development):**
  isolated in-memory transport tests now cover real request construction,
  full evaluation reporting, aborts, HTTP status/redirect failures and
  untrusted stream handling. A green test is not a real model benchmark.


- **LineLoom Code M3 runnable LoRA experiment (development after v1.4.1):**
  independently approved *local* Qwen2.5-Coder-0.5B base checkpoint
  and private human-reviewed FIM dataset may be used with an opt-in
  Python/PyTorch+PEFT adapter-training command. Prefix/suffix labels
  are masked, training and validation splits remain distinct, the test
  split is never used, and outputs remain excluded from Git/VSIX.
  The default command does **only offline planning**, with pure Python
  regression tests in CI. **No local fine-tune was executed,
  no approved rights-checked corpus or weights exist, and no model
  release was published.** See [training instructions](../model/train/README.md).


- **M3 early-adapter smoke (development after v1.4.1):** separate
  local-only Python base/PEFT-adapter smoke against 30 original synthetic
  probes, with offline planning, explicit reviewed-checkpoint gating and
  fixed aggregate per-language reporting. No prompt/source/output logs,
  downloads, registry publishing or automatic Ollama model migration.
  Requires an actual approved model/adapter for real measurements;
  no weights or measured quality are currently available.
