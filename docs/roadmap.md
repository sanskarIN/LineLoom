# LineLoom roadmap

**Updated 2026-10-25 · Planned milestones are not implementation or release commitments.**

## Current state (verified repository and GitHub release)

- **GitHub stable: [v1.3.0](https://github.com/sanskarIN/LineLoom/releases/tag/v1.3.0)**, published 2026-10-25 with stable-channel VSIX and SHA-256. Default-off **explicitly selected** related-file context, native sidebar and single-file autocomplete are shipped.
- **Latest GitHub preview: [v1.3.1](https://github.com/sanskarIN/LineLoom/releases/tag/v1.3.1)**, published 2026-10-25 with genuine preview-channel VSIX and SHA-256 after independently passing audit, editor-host tests, clean installation and a pinned upgrade from v1.3.0. This preview contains the manual sidebar state features and does **not** replace v1.3.0 stable. The earlier v1.2.5 source was integrated into v1.3.0; no standalone v1.2.5 release exists.
- **Shipped in preview:** [PR #99](https://github.com/sanskarIN/LineLoom/pull/99) added invisible-Unicode completion hardening, now included in the v1.3.1 pre-release VSIX.
- **Independent distribution:** [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=SanskarCodes.lineloom) and [Open VSX](https://open-vsx.org/extension/SanskarCodes/lineloom) listings use `SanskarCodes.lineloom` and are **not automatically updated by GitHub**. Open VSX v1.3.0 Stable was independently published and verified on 2026-10-25; the maintainer separately updated Marketplace to v1.3.0. Verify live registry versions before giving future install advice. GitHub Packages npm installer `@sanskarin/lineloom-cli` is independently published at **v0.1.0**, without CLI v0.2.0 verify or proposed v0.3.0 offline install.
- **Outstanding quality evidence:** real Ollama completion quality, physical Windows/macOS/Linux editor UX, accessibility, selected-context consent and real publisher-authentication workflows are not verified by the automated release. See [#66](https://github.com/sanskarIN/LineLoom/issues/66), [#60](https://github.com/sanskarIN/LineLoom/issues/60), [#79](https://github.com/sanskarIN/LineLoom/issues/79), and [manual acceptance](qa/v1.3.0-manual-acceptance.md).

## Forward-looking milestones

| Target | State | Priority and proposed deliverables | Explicit gates |
| --- | --- | --- | --- |
| **v1.3.1 — reliability preview** | **GitHub pre-release published** | Unicode completion safety, native sidebar next-action guidance, manually checked default and effective editor models, local file privacy | [Public preview and notes](releases/v1.3.1.md), [manual QA still outstanding](qa/v1.3.1-preview-acceptance.md); not a stable or registry release |
| **CLI v0.2.0/v0.3.0** | Development candidates; not published | Offline local VSIX verification, then carefully reviewed offline installation from pinned artifacts | Independent [PR #92](https://github.com/sanskarIN/LineLoom/pull/92), package-only tests/security, real installs and version-specific GitHub Packages authorization |
| **v1.4.0 — usability & quality** | **Model evaluation tooling under review**, no public release | 30-fixture, five-language categorized synthetic comparison harness, hardened NDJSON parsing, dedicated local model research, keyboard/accessible sidebar polish | No trained model or real results; privacy, on-device benchmarks, cross-platform QA and release approval still required |
| **v1.4.x+ — language evaluation** | Research | Investigate C# and Dart opt-in support and model-specific prompting only if real samples justify them | VS Code language mapping, fixtures, bounded prompts, manual local model quality across OSs |
| **v1.5.x+ — limited symbol intelligence** | RFC only | Explore optional developer-selected symbol/import hints with bounded parser effort | New opt-in privacy RFC, no automatic workspace scan or persistent indexing by default, independent I/O and security evaluation |
| **v2.0.0 — additional local providers** | Research, not scheduled | Abstract backend transport without losing Ollama defaults | Explicit endpoint permissions, no cloud inference by default, strict stream decoding, cancel and budget equivalence |

**The roadmap does not approve publication of any tag, VSIX, registry update or npm package.** Releases remain channel-specific and require explicit maintainer authorization.

## Suggested next work order

1. Resolve or explicitly record remaining **manual v1.3.0 acceptance** tasks with sanitized dated evidence. Keep [security #79](https://github.com/sanskarIN/LineLoom/issues/79) open while compatible upstream packaging options and inherited moderate advisories are assessed.
2. Fix the highest-impact small runtime regressions in focused PRs with mocked VS Code host tests; improve feedback without recording user code or filenames.
3. Validate the pinned npm CLI branch separately, especially the independent security workflow; do not publish proposed commands before acceptance.
4. Make readiness status precise: the native status bar distinguishes enabled from manually verified models; pending user-initiated checks show non-clickable Next notices. No new network or source access on refresh. Physical accessibility QA remains **NOT RUN**.
5. Measure suggestions offered separately from the session-only VS Code accepted-item callbacks in development; do not infer usefulness or human model quality. Manual acceptance and accessibility on physical OS devices remain **NOT RUN**. See [sidebar notes](sidebar.md).
6. Use the [dedicated-model synthetic evaluation harness](../model/README.md) to collect genuine optional local Ollama baseline evidence, and review [training and licensing gates](../model/TRAINING_PLAN.md) before any fine-tuning. No benchmark results or model weights are claimed yet.
7. Use [v1.3.1 preview feedback](releases/v1.3.1.md) and unresolved manual acceptance to plan the next **stable** candidate separately; then investigate v1.4.0 usability and model-quality work.

## Permanent non-goals for current releases

No account or subscription requirement, passive model downloads, telemetry, arbitrary external code uploads, automatic whole-repository indexing, persistent private-source embeddings or silent remote origin changes.

## Technical plans and historical release notes

- [Upcoming feature candidates and decision criteria](feature-proposals.md)
- [v1.3.1 maintenance scope and exit criteria](releases/v1.3.1-plan.md)
- [Release evidence rules](qa/release-evidence.md) · [v1.3.0 acceptance checklist](qa/v1.3.0-manual-acceptance.md)
- [Selected-file context privacy RFC](privacy/selected-context.md) · [Packages guide](packages.md)
- [CHANGELOG.md](../CHANGELOG.md) for **historical releases through the GitHub v1.3.1 preview** and what was actually released, and [GitHub Releases](https://github.com/sanskarIN/LineLoom/releases) for public artifact truth.
