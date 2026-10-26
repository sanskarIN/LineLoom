# Extension distribution: GitHub stable, preview and independent registries

LineLoom is an **independent MIT-licensed VS Code extension**. Its GitHub repository is at https://github.com/sanskarIN/LineLoom. The project owner has selected the public publisher ID **SanskarCodes** (display name: **Sanskar**). The GitHub username **sanskarIN** is *not* the extension publisher ID.

**Publication status (2026-10-25):** [GitHub v1.3.0 stable](https://github.com/sanskarIN/LineLoom/releases/tag/v1.3.0) and the newer [v1.3.1 GitHub pre-release](https://github.com/sanskarIN/LineLoom/releases/tag/v1.3.1) are publicly available with independent SHA-256-verified VSIX assets. The v1.3.1 release is **pre-release only**, not latest stable. [Open VSX v1.3.0 Stable](https://open-vsx.org/extension/SanskarCodes/lineloom) was independently published and verified as public/latest on 2026-10-25 ([publisher run](https://github.com/sanskarIN/LineLoom/actions/runs/40201081119)); the maintainer manually updated the separate [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=SanskarCodes.lineloom) to v1.3.0. Check each live registry for its subsequent version. GitHub releases never publish to either external registry or the npm CLI. Keep publisher credentials in protected environments and never commit them.

## v1.4.1 GitHub-only pre-release (published 2026-10-26)

[GitHub v1.4.1](https://github.com/sanskarIN/LineLoom/releases/tag/v1.4.1) is the latest verified **preview**, published by the owner-gated [version-specific workflow](https://github.com/sanskarIN/LineLoom/actions/runs/40265555223) after full source tests, Linux mocked editor-host checks, security audits, genuine VS Code preview-channel packaging, checksum verification, clean install and digest-pinned published v1.3.0 stable upgrade. Public artifacts: [LineLoom-1.4.1.vsix](https://github.com/sanskarIN/LineLoom/releases/download/v1.4.1/LineLoom-1.4.1.vsix) and [LineLoom-1.4.1.sha256](https://github.com/sanskarIN/LineLoom/releases/download/v1.4.1/LineLoom-1.4.1.sha256). Public VSIX SHA-256: `d69705cd7f2cc273e455730d8a63b41a8a617e39d02f343bfdb1bf3f9d503c3b`.

**Still stable v1.3.0.** Publishing to GitHub did not alter VS Code Marketplace, Open VSX, GitHub Packages/npmjs, or `SanskarCodes.lineloom`; publisher migration remains deferred. No trained LineLoom Code weights, real Ollama quality metrics or physical editor/accessibility/manual QA have been verified. [Release notes](releases/v1.4.1.md).

## v1.4.0 GitHub preview (published 2026-10-26)

[GitHub v1.4.0](https://github.com/sanskarIN/LineLoom/releases/tag/v1.4.0) is a verified **pre-release**, not a stable release. The version-scoped [publisher workflow](https://github.com/sanskarIN/LineLoom/actions/runs/40257458416) passed source tests, Linux mocked editor-host, dependency audits, genuine preview-channel VSIX verification, checksum, clean profile installation and the independently digest-pinned v1.3.0 stable upgrade. Public assets are [LineLoom-1.4.0.vsix](https://github.com/sanskarIN/LineLoom/releases/download/v1.4.0/LineLoom-1.4.0.vsix) and [SHA-256](https://github.com/sanskarIN/LineLoom/releases/download/v1.4.0/LineLoom-1.4.0.sha256). The VSIX digest is `f09f6e9a13837658abcd9eefd599a64cbf6d7211c5a001d5e675aa0f87f71cda`.

**Not included in these passing gates:** physical Windows/macOS/Linux and accessibility validation, real-model quality/latency benchmarks, production remote inference or trained LineLoom model weights. All remain **NOT RUN**. Visual Studio Marketplace, Open VSX (last independently verified v1.3.0 stable), and GitHub Packages CLI remain independent and unchanged by this publisher.

## Open VSX v1.3.0 stable — publication verified 2026-10-25

The version-scoped [publisher workflow](../.github/workflows/publish-openvsx-v1.3.0.yml) completed successfully in [GitHub Actions](https://github.com/sanskarIN/LineLoom/actions/runs/40201081119). It independently checked the exact GitHub v1.3.0 stable VSIX digest, release checksum, publisher/manifest and stable-channel metadata, then published using protected `OVSX_PAT`.

The [version API](https://open-vsx.org/api/SanskarCodes/lineloom/1.3.0) and [latest API](https://open-vsx.org/api/SanskarCodes/lineloom) were independently checked after publication and returned `version: 1.3.0`, `preRelease: false`, `downloadable: true`, and `verified: true`; the root `latest` alias resolves to v1.3.0. The maintainer separately updated Microsoft's Marketplace to v1.3.0. Neither update published GitHub v1.3.1 preview or changed the npm CLI, and no real-model/hardware/accessibility manual QA was performed by registry publication.

## v1.3.1 GitHub pre-release (published 2026-10-25)

The [v1.3.1 public pre-release](https://github.com/sanskarIN/LineLoom/releases/tag/v1.3.1) provides the genuine preview-channel [VSIX](https://github.com/sanskarIN/LineLoom/releases/download/v1.3.1/LineLoom-1.3.1.vsix) and its [SHA-256 checksum](https://github.com/sanskarIN/LineLoom/releases/download/v1.3.1/LineLoom-1.3.1.sha256). The [owner-authorized publishing workflow](https://github.com/sanskarIN/LineLoom/actions/runs/40192010209) passed independent cross-platform checks, mocked VS Code integration, audited dependencies, preview identity verification, clean installation and a digest-pinned v1.3.0 stable-to-preview upgrade. The workflow also prevents overwriting existing tags or updating stable latest. Human actual Ollama and physical desktop/accessibility checks remain NOT RUN. No Marketplace/Open VSX/npm package was published, and v1.3.0 remains GitHub stable.

## v1.2.1 GitHub-only pre-release (published 2026-10-22)

The [v1.2.1 GitHub pre-release](https://github.com/sanskarIN/LineLoom/releases/tag/v1.2.1)
includes the [VS Code preview VSIX](https://github.com/sanskarIN/LineLoom/releases/download/v1.2.1/LineLoom-1.2.1.vsix)
and a [SHA-256 file](https://github.com/sanskarIN/LineLoom/releases/download/v1.2.1/LineLoom-1.2.1.sha256).
The [owner-gated release workflow](../.github/workflows/release-v1.2.1.yml)
ran the required source/module audit, unit and mocked editor-host checks, dependency
audit, genuine VS Code preview manifest verification and clean installation. It
created a **GitHub pre-release**, not a stable-channel release and not a VS Code
Marketplace or Open VSX update. GitHub **v1.2.0 remains stable**. Hands-on
Ollama and cross-platform usability acceptance is still outstanding.

The v1.2.2 [GitHub pre-release](https://github.com/sanskarIN/LineLoom/releases/tag/v1.2.2) is now published with the verified VS Code preview VSIX and SHA-256 checksum. It is not a registry update. The following v1.2.3 source version remains unreleased.

## v1.1.0 GitHub-only pre-release (separate from stable registries)

The native LineLoom sidebar is distributed as an opt-in [GitHub v1.1.0
**pre-release**](https://github.com/sanskarIN/LineLoom/releases/tag/v1.1.0) VSIX, with its SHA-256 checksum published alongside it. A separate automated workflow
(`.github/workflows/release-preview.yml`) checks the package version, unit
and integration tests, dependency audit, VSIX contents, and a clean VS Code CLI
installation before creating the GitHub release with `--prerelease` and
`--latest=false`. It uses `vsce package --pre-release` to distinguish the
editor preview channel. No Marketplace/Open VSX credentials are used.

At the time of this preview, stable v1.0.0 in both registries remained unchanged. A future **stable** registry
release must use a new package version (planned v1.2.0), not reuse the v1.1.0
pre-release version. Future registry publishing,
manual platform and real-model testing are tracked in
[release gate #21](https://github.com/sanskarIN/LineLoom/issues/21).
For preview download/installation instructions, see
[release notes](releases/v1.1.0.md). Do not present v1.1.0 as available in
the registries until their *public* versions confirm it.

## v1.1.1 GitHub-only preview and v1.2.0 stable plan

The published [GitHub v1.1.1 pre-release](https://github.com/sanskarIN/LineLoom/releases/tag/v1.1.1)
contains editor-aware sidebar improvements and
a file-scheme eligibility fix. A guarded GitHub Actions workflow at
`.github/workflows/release-v1.1.1.yml` performs full typecheck, lint, unit,
static site and mocked-Ollama integration suites, dependency audit, preview
metadata verification, archive/checksum validation and an isolated VS Code CLI
installation. The explicit release flag was committed to main and the workflow successfully
created **GitHub v1.1.1 with `--prerelease --latest=false`**, attaching the VSIX
and SHA-256 checksum.
It has no third-party publishing tokens or registry-publish step.

**Next GitHub stable v1.2.0 is now published.** The
[historical release plan](releases/v1.2.0-plan.md) and
[QA tracker](https://github.com/sanskarIN/LineLoom/issues/21) document
outstanding physical/manual checks. GitHub release status does not automatically
change the Visual Studio Marketplace or Open VSX distribution.

## v1.2.0 GitHub stable release (published 2026-10-20)

The [GitHub v1.2.0 stable release](https://github.com/sanskarIN/LineLoom/releases/tag/v1.2.0)
is live, containing
[`LineLoom-1.2.0.vsix`](https://github.com/sanskarIN/LineLoom/releases/download/v1.2.0/LineLoom-1.2.0.vsix)
and [SHA-256 checksum](https://github.com/sanskarIN/LineLoom/releases/download/v1.2.0/LineLoom-1.2.0.sha256).
The [release workflow](../.github/workflows/release-v1.2.0.yml)
completed successfully, including mocked Ollama extension-host checks,
high-severity dependency audit, stable metadata verification, package install
smoke test, and checksum.

**QA disclosure:** Real Ollama, accessibility, manual Windows/macOS/Linux
integration, privacy consent and upgrade tests are **NOT YET VERIFIED**.
The owner explicitly authorized an initial **GitHub-only** stable distribution
while those remain open in [issue #21](https://github.com/sanskarIN/LineLoom/issues/21).
See [release notes](releases/v1.2.0.md) and the
[manual QA matrix](qa/v1.2.0-acceptance.md).

### External registries: Open VSX v1.2.0 published; Marketplace separate

**Open VSX v1.2.0 Stable was published on 2026-10-20.** The
[version-specific publishing workflow](../.github/workflows/publish-openvsx-v1.2.0.yml)
ran successfully with its `OVSX_PAT` repository secret, downloaded the exact
GitHub release VSIX, checked its SHA-256 and stable metadata, and independently
verified the publicly downloadable `SanskarCodes.lineloom@1.2.0` through the
[Open VSX API](https://open-vsx.org/api/SanskarCodes/lineloom/1.2.0).
[Publishing run](https://github.com/sanskarIN/LineLoom/actions/runs/39382651584).
Do not commit or display the PAT; longer term, consider Open VSX trusted
publishing (OIDC) where available.

[Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=SanskarCodes.lineloom)
remains a **separate** publishing and verification task. GitHub publishing did
not update either external registry automatically, and this Open VSX workflow
did not publish to Microsoft's Marketplace. Real-model, physical-device and
accessibility QA remain outstanding in [issue #21](https://github.com/sanskarIN/LineLoom/issues/21).

## Stable release package safety and required checks

- The default v1.0.0 VSIX is a **stable channel** package and must **not** include `--pre-release`. Use `npm run package:preview` only for future explicitly marked experimental updates.
- `package.json` must contain `"publisher": "SanskarCodes"`; changing this later changes the installed extension ID.
- `npm ci && npm run check`; on Linux CI run `xvfb-run -a npm run test:integration`.
- `npm audit --audit-level=high`; confirm test results before release.
- `npm run package` generates a stable VSIX by default. To choose an explicit destination, run:

```sh
npx vsce package --no-dependencies -o LineLoom-1.0.0.vsix
```

- For Windows, do not double-click the downloaded VSIX; Microsoft Visual Studio VSIX Installer is for a different product. Open Visual Studio Code → Extensions → … → **Install from VSIX…**. The user-friendly guide is at https://sanskarin.github.io/LineLoom/install.html.
- Inspect included files (`npx vsce ls --no-dependencies`) and the VSIX archive (`npm run verify:vsix -- LineLoom-1.0.0.vsix` on a Linux shell with `unzip`). Do not include secrets, personal files, or `node_modules`.
- The GitHub release workflow installs the VSIX in a **temporary VS Code CLI profile** and lists `SanskarCodes.lineloom`; this is not proof of real-model completion. See [manual QA evidence matrix](qa/v0.9.5-readiness.md).
- Install the exact VSIX in a fresh compatible VS Code user profile and test both automatic ghost text and accepting a suggestion with a **real** independently installed Ollama model. Repeat for all supported operating systems before claiming stable readiness.
- The GitHub v1.0.0 release is tagged **stable**, not pre-release. GitHub Releases never publish to external registries by themselves.

## Microsoft Visual Studio Marketplace — published

The v1.0.0 stable VSIX was uploaded through the **Sanskar (SanskarCodes)** publisher and its [public listing](https://marketplace.visualstudio.com/items?itemName=SanskarCodes.lineloom) is live.

1. In VS Code, open **Extensions** and search **LineLoom**; confirm publisher **SanskarCodes**, then click **Install**.
2. Or use `code --install-extension SanskarCodes.lineloom` in a terminal with the VS Code CLI installed.
3. For future **versioned updates**, use [Manage Publishers & Extensions](https://marketplace.visualstudio.com/manage/publishers/) under **SanskarCodes**; upload a new VSIX for the same extension ID instead of creating a second listing.
4. Verify the public listing's updated version, README, extension icon, MIT license, website and privacy links after each submission. A published GitHub release does not automatically update Marketplace.

**Public Marketplace listing:** https://marketplace.visualstudio.com/items?itemName=SanskarCodes.lineloom
**Publisher ID:** `SanskarCodes` · **Extension ID:** `SanskarCodes.lineloom`
**GitHub owner:** `sanskarIN` · **Release:** `v1.0.0`

Official guide: https://code.visualstudio.com/api/working-with-extensions/publishing-extension

Future automation should prefer Microsoft's documented OIDC/Entra workload-federation approach where available. Do not commit publishing credentials or PATs. Initial upload remains manual.

## Eclipse Open VSX — published

The public [Open VSX listing](https://open-vsx.org/extension/SanskarCodes/lineloom) now serves **LineLoom 1.3.0 Stable** in the `SanskarCodes` namespace.

- **Extension ID:** `SanskarCodes.lineloom`; **namespace:** `SanskarCodes`.
- **Stable distribution:** version `1.3.0`, `preRelease: false`, `downloadable: true`; independently confirmed in the Open VSX API.
- **Publisher verification:** the Open VSX API currently reports `verified: true` (checked 2026-10-25). Verification status may change separately from version availability.
- **Install:** in an editor configured to use Open VSX, search for LineLoom and select publisher `SanskarCodes`, or visit https://open-vsx.org/extension/SanskarCodes/lineloom.
- **Future updates:** publish a newer versioned VSIX through the [official `ovsx` CLI](https://github.com/eclipse-openvsx/openvsx/tree/main/cli) or a versioned GitHub Actions workflow. Do **not** re-upload either v1.0.0 or v1.2.0, and never display personal access tokens.
- **Trusted publishing:** consider Open VSX's documented OIDC/trusted publishing for future CI updates, with access controls and namespace authorization reviewed first.
- **Namespace verification:** Open VSX currently returns `verified: true` for this extension; continue verifying that result through the public API rather than relying on an old screenshot.

**Open VSX public URL:** https://open-vsx.org/extension/SanskarCodes/lineloom

For every subsequent version, publish to GitHub, Microsoft Marketplace, and Open VSX as **separate destinations** and check that all three show the expected version before announcing broad availability. Updating GitHub README/docs will not retroactively alter README content embedded in the already published v1.2.0 registry VSIX.

## Post-release verification and limitations

GitHub v1.3.0 and [Open VSX v1.3.0 Stable](https://open-vsx.org/extension/SanskarCodes/lineloom) are public; the Marketplace was separately updated to v1.3.0 by the maintainer. Manual editor acceptance, real CPU/GPU Ollama measurements, offline use, privacy controls, physical Windows/macOS/Linux sessions and accessibility testing remain unverified and must not be described as passed. See `docs/qa/v1.2.0-acceptance.md` and [issue #21](https://github.com/sanskarIN/LineLoom/issues/21).
