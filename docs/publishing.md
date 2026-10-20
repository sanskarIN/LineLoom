# Extension distribution: GitHub v1.2.0 stable and external registry releases

LineLoom is an **independent MIT-licensed VS Code extension**. Its GitHub repository is at https://github.com/sanskarIN/LineLoom. The project owner has selected the public publisher ID **SanskarCodes** (display name: **Sanskar**). The GitHub username **sanskarIN** is *not* the extension publisher ID.

**Current publication status (2026-10-19):** LineLoom **v1.0.0** is public on [Microsoft Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=SanskarCodes.lineloom) as **SanskarCodes.lineloom** and the independent [GitHub stable release](https://github.com/sanskarIN/LineLoom/releases/tag/v1.0.0). **Open VSX v1.0.0 is now publicly published** at [Open VSX Registry](https://open-vsx.org/extension/SanskarCodes/lineloom). The registry reports `version: 1.0.0`, `preRelease: false`, `preview: false`, and `verified: false` (publisher badge/verification is separate from publication). No token, account credential, or registry secret belongs in this repository.

## v1.1.0 GitHub-only pre-release (separate from stable registries)

The native LineLoom sidebar is distributed as an opt-in [GitHub v1.1.0
**pre-release**](https://github.com/sanskarIN/LineLoom/releases/tag/v1.1.0) VSIX, with its SHA-256 checksum published alongside it. A separate automated workflow
(`.github/workflows/release-preview.yml`) checks the package version, unit
and integration tests, dependency audit, VSIX contents, and a clean VS Code CLI
installation before creating the GitHub release with `--prerelease` and
`--latest=false`. It uses `vsce package --pre-release` to distinguish the
editor preview channel. No Marketplace/Open VSX credentials are used.

Stable v1.0.0 in both registries remains unchanged. A future **stable** registry
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

### Publish the same 1.2.0 stable version to external registries separately

**Do not assume that either listing was updated by GitHub publishing.** The
previous public registries carried **1.0.0** at last verification:

- [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=SanskarCodes.lineloom)
- [Open VSX](https://open-vsx.org/extension/SanskarCodes/lineloom)

To update them, use the already verified `LineLoom-1.2.0.vsix` with official
registry publisher authentication under the existing `SanskarCodes.lineloom`
identity. Keep tokens exclusively in secure environments. Confirm each listing
shows 1.2.0 and correct stable/preview status **independently**. Neither
registry is updated by the GitHub workflow.

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

The public [Open VSX listing](https://open-vsx.org/extension/SanskarCodes/lineloom) is now live for **LineLoom 1.0.0** in the `SanskarCodes` namespace.

- **Extension ID:** `SanskarCodes.lineloom`; **namespace:** `SanskarCodes`.
- **Stable distribution:** version `1.0.0`, `preRelease: false`, `preview: false`. The Open VSX API indicates the VSIX is downloadable.
- **Publisher verification:** the registry currently reports `verified: false`. This is **not** the same as extension unavailability, and should not be described as a verified publisher badge.
- **Install:** in an editor configured to use Open VSX, search for LineLoom and select publisher `SanskarCodes`, or visit https://open-vsx.org/extension/SanskarCodes/lineloom.
- **Future updates:** sign in to [Open VSX](https://open-vsx.org/), confirm you retain namespace publishing rights, then publish a newer versioned VSIX via its web upload or the [official `ovsx` CLI](https://github.com/eclipse-openvsx/ovsx). Do **not** upload the already published v1.0.0 again; do not expose personal access tokens.
- **Trusted publishing:** consider Open VSX's documented OIDC/trusted publishing for future CI updates, with access controls and namespace authorization reviewed first.
- **Namespace verification:** if a verified badge is needed, follow the current registry claim/review process using the public [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=SanskarCodes.lineloom) and [GitHub repository](https://github.com/sanskarIN/LineLoom) as ownership evidence. Do not claim that a verification request is approved until the registry confirms it.

**Open VSX public URL:** https://open-vsx.org/extension/SanskarCodes/lineloom

For every subsequent version, publish to GitHub, Microsoft Marketplace, and Open VSX as **separate destinations** and check that all three show the expected version before announcing broad availability. Updating GitHub README/docs will not retroactively alter README content embedded in the already published v1.0.0 registry VSIX.

## Post-release verification and limitations

GitHub v1.0.0, Visual Studio Marketplace and [Open VSX](https://open-vsx.org/extension/SanskarCodes/lineloom) are public, but manual editor acceptance, real CPU/GPU Ollama measurements, offline use, privacy controls, and Windows/macOS/Linux hands-on model tests remain unverified and must not be described as passed. See `docs/qa/v0.9.5-readiness.md`. The Open VSX **publisher badge** is not currently verified; do not confuse that with the publicly published v1.0.0 extension.
