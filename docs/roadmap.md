# LineLoom roadmap

**Updated 2026-10-25 · Planned milestones are not implementation or release commitments.**

## Current state (verified repository and GitHub release)

- **GitHub stable: [v1.3.0](https://github.com/sanskarIN/LineLoom/releases/tag/v1.3.0)**, published 2026-10-25 with stable-channel VSIX and SHA-256. Default-off **explicitly selected** related-file context, native sidebar and single-file autocomplete are shipped.
- **Latest GitHub preview: [v1.3.1](https://github.com/sanskarIN/LineLoom/releases/tag/v1.3.1)**, published 2026-10-25 with pre-release-channel VSIX + SHA-256; this does **not** replace stable v1.3.0. The former v1.2.5 source was incorporated into v1.3.0 without an independent v1.2.5 release.
- **Previously merged improvement:** [PR #99](https://github.com/sanskarIN/LineLoom/pull/99) added invisible-Unicode completion hardening, subsequently included in the published v1.3.1 preview.
- **Independent distribution:** [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=SanskarCodes.lineloom) and [Open VSX](https://open-vsx.org/extension/SanskarCodes/lineloom) listings use `SanskarCodes.lineloom` and are **not automatically updated by GitHub**. The verified historical Open VSX version is v1.2.0; verify the live registry versions before giving current install advice. GitHub Packages npm installer `@sanskarin/lineloom-cli` is independently published at **v0.1.0**, without CLI v0.2.0 verify or proposed v0.3.0 offline install.
- **Outstanding quality evidence:** real Ollama completion quality, physical Windows/macOS/Linux editor UX, accessibility, selected-context consent and real publisher-authentication workflows are not verified by the automated release. See [#66](https://github.com/sanskarIN/LineLoom/issues/66), [#60](https://github.com/sanskarIN/LineLoom/issues/60), [#79](https://github.com/sanskarIN/LineLoom/issues/79), and [manual acceptance](qa/v1.3.0-manual-acceptance.md).

## Forward-looking milestones

| Target | State | Priority and proposed deliverables | Explicit gates |
| --- | --- | --- | --- |
| **v1.3.1 — sidebar reliability** | GitHub pre-release published | User-invoked active-model and file readiness, native Control Center guidance, invisible-Unicode completion hardening | Published preview is not stable; human real Ollama, device and accessibility QA outstanding |
| **CLI v0.2.0/v0.3.0** | Development candidates; not published | Offline local VSIX verification, then carefully reviewed offline installation from pinned artifacts | Independent [PR #92](https://github.com/sanskarIN/LineLoom/pull/92), package-only tests/security, real installs and version-specific GitHub Packages authorization |
| **v1.4.0 — usability & quality** | Research branch; not released | Synthetic local-only model comparison harness, first-party completion-model planning, further accessible sidebar and recovery improvements | No training weights yet; actual model metrics, editor/manual QA, privacy review and release gates still required |
| **v1.4.x+ — language evaluation** | Research | Investigate C# and Dart opt-in support and model-specific prompting only if real samples justify them | VS Code language mapping, fixtures, bounded prompts, manual local model quality across OSs |
| **v1.5.x+ — limited symbol intelligence** | RFC only | Explore optional developer-selected symbol/import hints with bounded parser effort | New opt-in privacy RFC, no automatic workspace scan or persistent indexing by default, independent I/O and security evaluation |
| **v2.0.0 — additional local providers** | Research, not scheduled | Abstract backend transport without losing Ollama defaults | Explicit endpoint permissions, no cloud inference by default, strict stream decoding, cancel and budget equivalence |

**The roadmap does not approve publication of any tag, VSIX, registry update or npm package.** Releases remain channel-specific and require explicit maintainer authorization.

## Suggested next work order

1. Resolve or explicitly record remaining **manual v1.3.0 acceptance** tasks with sanitized dated evidence. Keep [security #79](https://github.com/sanskarIN/LineLoom/issues/79) open while compatible upstream packaging options and inherited moderate advisories are assessed.
2. Fix the highest-impact small runtime regressions in focused PRs with mocked VS Code host tests; improve feedback without recording user code or filenames.
3. Validate the pinned npm CLI branch separately, especially the independent security workflow; do not publish proposed commands before acceptance.
4. Review the [dedicated-model evaluation foundation](../model/README.md), run synthetic local-only baseline comparisons with real Ollama, and review [training gates](../model/TRAINING_PLAN.md) before model fine-tuning. The harness is developer-invoked and is **not** evidence of actual model quality until results are recorded.
5. Keep the shipped v1.3.1 preview separate from stable v1.3.0. Review v1.4.0 feature PRs, cross-platform CI and manual QA before requesting a **separate**, explicitly authorized release.

## Permanent non-goals for current releases

No account or subscription requirement, passive model downloads, telemetry, arbitrary external code uploads, automatic whole-repository indexing, persistent private-source embeddings or silent remote origin changes.

## Technical plans and historical release notes

- [Upcoming feature candidates and decision criteria](feature-proposals.md)
- [v1.3.1 maintenance scope and exit criteria](releases/v1.3.1-plan.md)
- [Release evidence rules](qa/release-evidence.md) · [v1.3.0 acceptance checklist](qa/v1.3.0-manual-acceptance.md)
- [Selected-file context privacy RFC](privacy/selected-context.md) · [Packages guide](packages.md)
- [CHANGELOG.md](../CHANGELOG.md) for **historical v0.1.0–v1.3.0 milestones** and what was actually released, and [GitHub Releases](https://github.com/sanskarIN/LineLoom/releases) for public artifact truth.
