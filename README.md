# LineLoom

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/SanskarCodes.lineloom?label=VS%20Code%20Marketplace&logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=SanskarCodes.lineloom)
[![Open VSX Registry](https://img.shields.io/open-vsx/v/SanskarCodes/lineloom?label=Open%20VSX)](https://open-vsx.org/extension/SanskarCodes/lineloom)
[![GitHub release](https://img.shields.io/github/v/release/sanskarIN/LineLoom?label=GitHub%20release)](https://github.com/sanskarIN/LineLoom/releases/tag/v1.2.0)
[![MIT license](https://img.shields.io/badge/license-MIT-70d6ce)](LICENSE)

**Write less. Build more. Stay in control.**

LineLoom is a free MIT-licensed VS Code extension for context-aware inline autocomplete with your own Ollama model. It uses native editor ghost text, and does not require a LineLoom account, cloud inference provider, or telemetry.

> **Latest publicly verified GitHub stable: v1.2.0 (until a new release is verified).** v1.3.0 source is a candidate; changing the manifest version does not publish it. Automated checks are distinct from outstanding real-model, OS/accessibility and publisher-authentication QA. Marketplace/Open VSX versions remain independently managed.

## v1.3.0 stable-channel candidate (not yet published)

The proposed v1.3.0 stable build adds opt-in, session-only **explicitly selected related-file context**: at most two tiny supported, same-workspace source files (2,048 bytes each), subject to existing canonical-path/ignore checks and post-response validation. The feature is **disabled by default**, never automatically scans other files, and requires explicit consent before reference snippets reach Ollama. A reviewed dev-time VSIX packager mitigation clears the high-severity audit gate, but four moderate transitive dev-tool findings remain. See [candidate release notes](docs/releases/v1.3.0.md) and [manual acceptance](docs/qa/v1.3.0-manual-acceptance.md). Physical-device, actual local-model, accessible UI and publisher-authentication QA remain **NOT RUN**, and registries are not updated by the GitHub release.

## v1.2.0 stable on GitHub (released 2026-10-20)

**[GitHub v1.2.0 stable release](https://github.com/sanskarIN/LineLoom/releases/tag/v1.2.0)** is published with [`LineLoom-1.2.0.vsix`](https://github.com/sanskarIN/LineLoom/releases/download/v1.2.0/LineLoom-1.2.0.vsix) and the [SHA-256 checksum](https://github.com/sanskarIN/LineLoom/releases/download/v1.2.0/LineLoom-1.2.0.sha256).

The native Activity Bar Control Center now includes active-editor eligibility,
default/per-language model routing, model-connection guidance, and additional
privacy-safe, in-memory session counters. The stable VSIX has **no pre-release
marker**. Install it using **VS Code → Extensions → … → Install from VSIX…**
or `code --install-extension LineLoom-1.2.0.vsix`.

**Manual QA disclosure:** Real local Ollama model usefulness/latency,
interactive Windows/macOS/Linux editor and accessibility checks, real privacy
acceptance and upgrades from older installations are **not yet verified**.
The owner authorized GitHub stable publication after passing automated CI;
unperformed manual checks are not represented as passed.
[Release notes](docs/releases/v1.2.0.md) · [Acceptance matrix](docs/qa/v1.2.0-acceptance.md) ·
[Follow-up issue #21](https://github.com/sanskarIN/LineLoom/issues/21).

**External registry distribution is separate:** [Open VSX](https://open-vsx.org/extension/SanskarCodes/lineloom)
now publicly serves **v1.2.0 Stable** (verified on 2026-10-20). The
[Open VSX publishing workflow](.github/workflows/publish-openvsx-v1.2.0.yml)
reused and verified the stable GitHub VSIX. Visual Studio Marketplace is a
separate rollout; a GitHub release never updates registries automatically.
The older [v1.1.1 pre-release](https://github.com/sanskarIN/LineLoom/releases/tag/v1.1.1)
and [v1.0.0 stable release](https://github.com/sanskarIN/LineLoom/releases/tag/v1.0.0)
remain accessible.

## v1.2.1 GitHub pre-release (published 2026-10-22)

The [v1.2.1 maintenance pre-release](https://github.com/sanskarIN/LineLoom/releases/tag/v1.2.1)
includes **Stop Current Generation**, hardened sensitive-directory exclusions,
ignore-policy invalidation, more regression tests and a complete TypeScript
source-inventory gate. The attached [VSIX](https://github.com/sanskarIN/LineLoom/releases/download/v1.2.1/LineLoom-1.2.1.vsix)
is marked for the actual **VS Code pre-release channel** and includes a
[SHA-256 checksum](https://github.com/sanskarIN/LineLoom/releases/download/v1.2.1/LineLoom-1.2.1.sha256).
Real-model/editor hardware acceptance remains outstanding, so this is not a
manually verified stable update. GitHub stable v1.2.0 and independently
published registry versions are unchanged.

## v1.2.2 GitHub pre-release (published 2026-10-22)

The [GitHub v1.2.2 pre-release](https://github.com/sanskarIN/LineLoom/releases/tag/v1.2.2)
adds stricter Ollama settings validation, fail-closed malformed path exclusions,
and a preview-channel VSIX. [Download the preview VSIX](https://github.com/sanskarIN/LineLoom/releases/download/v1.2.2/LineLoom-1.2.2.vsix)
and [SHA-256 checksum](https://github.com/sanskarIN/LineLoom/releases/download/v1.2.2/LineLoom-1.2.2.sha256).
This is a GitHub-only preview. **v1.2.0 remains the stable GitHub release**,
with Open VSX and VS Code Marketplace on independently managed channels.
Real model performance, full manual desktop acceptance and accessibility remain unverified.

## v1.2.3 GitHub pre-release (published 2026-10-23)

**[GitHub v1.2.3 — Live Ignore Policy Safety Preview](https://github.com/sanskarIN/LineLoom/releases/tag/v1.2.3)**
is publicly available with a genuine preview-channel
[VSIX](https://github.com/sanskarIN/LineLoom/releases/download/v1.2.3/LineLoom-1.2.3.vsix)
and [SHA-256 checksum](https://github.com/sanskarIN/LineLoom/releases/download/v1.2.3/LineLoom-1.2.3.sha256).
It improves privacy against delayed/dropped ignore-file watcher notifications:
existing and previously missing ignore sources are revalidated, cached source
rules use in-memory SHA-256 fingerprints of rule bytes, and up to eight
concurrent policy read tasks preserve root-to-leaf rule ordering.

[Publishing CI](https://github.com/sanskarIN/LineLoom/actions/runs/39891839514)
passed automated tests, mocked VS Code host integration, preview VSIX
verification and isolated stable-to-preview upgrade. This **does not prove**
real-model quality, physical workstation performance, actual watcher timing
or accessibility; those remain tracked in [issue #46](https://github.com/sanskarIN/LineLoom/issues/46).
The GitHub stable release remains **v1.2.0**; registry distributions are
separate and were not changed by this publication.

## v1.2.4 GitHub pre-release (published 2026-10-23)

**[GitHub v1.2.4 — Privacy Eligibility Diagnostics Preview](https://github.com/sanskarIN/LineLoom/releases/tag/v1.2.4)** is published with
the genuine preview-channel [VSIX](https://github.com/sanskarIN/LineLoom/releases/download/v1.2.4/LineLoom-1.2.4.vsix) and
[SHA-256 checksum](https://github.com/sanskarIN/LineLoom/releases/download/v1.2.4/LineLoom-1.2.4.sha256).
It adds opt-in, in-memory **privacy eligibility check** timing counters
(allowed/denied, last, session average and max, rolling 64-sample p95).
Collection is disabled by default and contains no file paths, prompts,
source code, rule text or response bodies. These measurements are **not**
end-to-end Ollama/model latencies.

[Publisher CI](https://github.com/sanskarIN/LineLoom/actions/runs/39903006652)
passed the real preview VSIX/channel/checksum and isolated installs/upgrades
from SHA-256-pinned v1.2.0 stable and v1.2.3 preview VSIX packages.
Manual real-model, physical Windows/macOS/Linux performance and accessibility
QA remain unverified in [issue #54](https://github.com/sanskarIN/LineLoom/issues/54).
Use the [v1.2.4 manual acceptance checklist](docs/qa/v1.2.4-manual-acceptance.md)
to record reproducible, sanitized evidence before considering a stable rollout.
This **GitHub-only pre-release** did not update either extension registry.
The latest GitHub stable release remains **v1.2.0**.

## v1.2.5 source ready for manual acceptance (not released)

The [v1.2.5 implementation PR #56](https://github.com/sanskarIN/LineLoom/pull/56)
has been **merged into `main`**, alongside
[privacy-hardening PR #59](https://github.com/sanskarIN/LineLoom/pull/59)
and [CI-safety PR #58](https://github.com/sanskarIN/LineLoom/pull/58).
The unreleased v1.2.5 candidate also includes **LineLoom: Check Active File Privacy**
(`lineloom.checkActiveFilePrivacy`): a user-triggered local inspection of
workspace, sensitive-path and root/nested ignore policies. It is available
from the Command Palette, Quick Actions and the Privacy & Connection sidebar,
and does not read source content or contact Ollama. Results only describe
path/ignore eligibility at the time checked, **not** full completion or model
readiness. No filenames or policy contents are shown.

The source includes **LineLoom: Reset Privacy Timing Statistics**
(`lineloom.resetPrivacyTimings`), an opt-in-only sidebar / Quick Actions entry,
and protection against asynchronous statistics being restored after a reset.
Malformed UTF-8 or NUL-containing `.gitignore` / `.lineloomignore` files
fail closed before inference.

[Combined candidate CI](https://github.com/sanskarIN/LineLoom/actions/runs/39921379282)
passed Windows/macOS/Ubuntu builds and tests, mocked VS Code editor-host
integration, preview-channel VSIX validation, isolated install and
checksum-pinned upgrades from v1.2.0, v1.2.3 and v1.2.4. This is **not**
real-model or physical-device acceptance. The
[v1.2.5 development plan](docs/releases/v1.2.5-plan.md),
[manual acceptance checklist](docs/qa/v1.2.5-manual-acceptance.md)
and [release readiness tracker #60](https://github.com/sanskarIN/LineLoom/issues/60)
track the remaining gates.

**v1.2.5 is not publicly released:** no GitHub v1.2.5 tag, public VSIX,
Visual Studio Marketplace or Open VSX update has been published. The
latest stable GitHub release remains **v1.2.0** and latest public GitHub
pre-release remains **v1.2.4**.

## Install LineLoom

Install the currently published version from your editor's supported registry:

- **[Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=SanskarCodes.lineloom)** — for VS Code users.
- **[Open VSX Registry](https://open-vsx.org/extension/SanskarCodes/lineloom)** — for compatible editors using the Open VSX extension registry.
- Both listings use publisher `SanskarCodes` and extension ID `SanskarCodes.lineloom`. Open VSX serves **1.2.0 Stable**; check Visual Studio Marketplace independently for its currently available version.

In VS Code, open Extensions (`Ctrl+Shift+X`), search for **LineLoom**, verify the publisher **SanskarCodes**, and choose **Install**. You can also use the Command Palette's **Extensions: Install Extensions** action, or the VS Code CLI:

```sh
code --install-extension SanskarCodes.lineloom
```

If your editor obtains extensions from Open VSX, open its Extensions view, search for **LineLoom**, and verify the publisher **SanskarCodes**. Open VSX publicly serves [stable v1.2.0](https://open-vsx.org/extension/SanskarCodes/lineloom). Its registry API confirms `version: 1.2.0`, `preRelease: false`, `downloadable: true`, and `verified: true`.

### Alternative: install the GitHub stable VSIX

The [GitHub v1.2.0 stable release](https://github.com/sanskarIN/LineLoom/releases/tag/v1.2.0) includes `LineLoom-1.2.0.vsix` for offline/manual installation. Download the VSIX and use **VS Code → Extensions → ... → Install from VSIX** (or `code --install-extension LineLoom-1.2.0.vsix`).

**Important for Windows:** Do not double-click the VSIX file. Windows may open **Visual Studio VSIX Installer**, which correctly rejects VS Code extensions and displays “One or more extensions are for Visual Studio Code.” Open **Visual Studio Code** and select **Extensions → … → Install from VSIX…** instead. [Step-by-step installation and troubleshooting](https://sanskarin.github.io/LineLoom/install.html).

**Registry status (2026-10-20):** [Open VSX](https://open-vsx.org/extension/SanskarCodes/lineloom) lists **v1.2.0 Stable** as downloadable with a verified namespace. The [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=SanskarCodes.lineloom) is separately managed; its v1.2.0 rollout has not been verified here. GitHub owner `sanskarIN` and publisher `SanskarCodes` are intentionally different. [Publisher instructions](docs/publishing.md).

## Project website and documentation

The [LineLoom website](https://sanskarin.github.io/LineLoom/) is live and maintained in [`site/`](site/), deployed through the [GitHub Pages workflow](.github/workflows/pages.yml). The [deployment guide](docs/github-pages.md) documents verification and maintenance.

Website content is excluded from the extension VSIX package. This does not add hosted inference, an account requirement or telemetry.

## Release verification status

The v1.2.0 GitHub stable packaging workflow checks archive integrity **and** installs the packaged VSIX in an isolated real VS Code command-line profile. This is stronger than ZIP validation, but it does not prove real Ollama inference or interactive ghost-text acceptance. [Manual verification matrix](docs/qa/v0.9.5-readiness.md) tracks the remaining Windows, macOS, Linux, privacy, offline and model-performance tests. **Visual Studio Marketplace and Open VSX are live; hands-on real-model QA remains ongoing.**

## Features

- **Stricter send-time privacy controls:** rechecks active model, file exclusions, workspace trust and remote-endpoint permission before sending completion context. Pending model-picker choices are also discarded if the Ollama endpoint or remote approval changes.
- **Per-language Ollama models:** assign a different installed model to each supported language using **LineLoom: Assign Language Model** or the status-bar Quick Actions picker. Unassigned languages use the default `lineloom.model`; JSX/TSX use the JavaScript/TypeScript override. No automatic model downloads.
- Native VS Code inline suggestions for **nine language IDs**: Python, JavaScript/JSX, TypeScript/TSX, Rust, Kotlin, **Go, Java, C and C++**. Go, Java, C and C++ remain experimental.
- **Smarter automatic request timing:** suppresses background inference directly before existing identifier characters (including Unicode letters, combining marks, connector punctuation and joiners). Configure `lineloom.suppressMidTokenAuto` (default on) to opt out; manual requests always work, and skip the typing debounce.
- **Typed suggestion continuation:** when you type the beginning of an inline suggestion, LineLoom can offer the remaining text immediately from short-lived memory without another Ollama generation. Context, settings, active editor, workspace privacy **and the actual single-insertion edit event** must all match. Multi-edit changes, selection replacements and edits elsewhere invalidate reuse. No cross-file reads.
- Multi-line continuation, bounded prefix/suffix context, and optional FIM using a recognized Qwen2.5 Coder model family. Improved cleanup removes common model control tokens and explanations outside leading fenced code blocks. Ollama streams have total-byte, event-count and per-event safety limits.
- **Quick Actions from the status bar:** enable/disable completion, pause/resume automatic suggestions, trigger manually, choose a default or per-language model, manage languages, check connection, open diagnostics or settings. Model discovery and connection checks run only when selected by the user.
- User-selected installed model, endpoint, timeouts, output limits, temperature, automatic-trigger controls and **per-language opt-in/out settings**.
- Cancellation on newer requests, active cursor/editor changes and timeouts; a short-lived backoff stops repeatedly sending identical automatic requests after an empty model result. Explicit user-triggered requests bypass this backoff. Additional checks run before sending code or reusing a cached suggestion. No insertion is attempted for selected text or multiple cursors, and automatic suggestions defer to active native IntelliSense completions.
- Only the active trusted-workspace document is used for completion; rejects symlinks escaping the workspace and excludes sensitive filenames and nested `.gitignore`, `.lineloomignore` and user-specified patterns.
- Local loopback by default; remote HTTPS needs both a setting and per-origin interactive approval. **HTTP redirects are rejected** to prevent transferring code to an unapproved destination. No background model downloads.
- Automatic completion requires two non-whitespace characters on the active line by default (configurable 0–32); manual triggers bypass this threshold. Active-document context is read through bounded editor ranges, even in large files.

## Getting started

1. Install [VS Code](https://code.visualstudio.com/) and [Ollama](https://ollama.com/download) for Windows, Linux or macOS.
2. Start Ollama according to its platform instructions. Confirm that `http://127.0.0.1:11434/api/tags` is reachable locally.
3. Install a coding model yourself: `ollama pull qwen2.5-coder:1.5b`. Downloads consume storage; see model licensing and system requirements.
4. [Install LineLoom from Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=SanskarCodes.lineloom) (recommended), or use the GitHub VSIX as described above. For local development from source instead, run `npm ci`, `npm run build`, open the repo in VS Code and press **F5**.
5. In VS Code (or the Extension Development Host), open a **trusted folder** containing a supported source file (e.g. `.py`, `.js`, `.ts`, `.rs`, `.kt`, `.go`, `.java`, `.c`, or `.cpp`).
6. Type some code, or run **LineLoom: Trigger Completion**. Accept native inline text with your VS Code inline-suggest keybinding.
7. Run **LineLoom: Check Ollama Connection** or **LineLoom: Select Model** if suggestions do not appear.

Open the Command Palette and run **LineLoom: Show Setup Guide** for the short interactive guide. Click **LineLoom** in the VS Code status bar to open **Quick Actions**. Pausing automatic suggestions keeps manual **LineLoom: Trigger Completion** available; the pause choice remains in VS Code settings until you resume.

## Commands

Quick Actions · Pause or Resume Automatic Suggestions · Enable Autocomplete · Disable Autocomplete · Trigger Completion · Select Model · Manage Autocomplete Languages · Check Ollama Connection · Open Settings · Open Diagnostics · Show Setup Guide · Show Completion Performance.

Settings are under `lineloom.*` in VS Code Settings. `lineloom.enabledLanguages` lists which of the nine language IDs can receive suggestions; the JSX and TSX editor modes follow the JavaScript and TypeScript choices. An empty list disables suggestions for all languages. Defaults: model `qwen2.5-coder:1.5b`, endpoint `http://127.0.0.1:11434`, debounce 250 ms, timeout 12 s, 8,000 context characters, 128 generated tokens, eight maximum suggestion lines (configurable 1–20), two minimum automatic-trigger characters (configurable 0–32), and mid-token auto-suppression enabled. Cross-file context is **not implemented** in v1.0.0 even if the reserved setting is enabled.

## Privacy and safety

The extension transmits a bounded snippet **from the current document** to the configured Ollama endpoint to generate suggestions. Localhost requests stay on the local network stack; using a remote endpoint sends snippets to that server. No telemetry or repository indexing exists. A local model is not a guarantee of safe, correct, or licensed output; review code before use.

- [Privacy policy](PRIVACY.md) and [ignore rules](docs/privacy/ignore-rules.md)
- [Architecture](docs/architecture/README.md)
- [Development and testing](CONTRIBUTING.md)
- [Troubleshooting](docs/troubleshooting/README.md)
- [v1.0.0 stable release notes](docs/releases/v1.0.0.md) and [ongoing manual QA checklist](docs/qa/v0.9.5-readiness.md)

## npm and GitHub Packages installer (optional)

**Published on GitHub Packages (2026-10-24):** `@sanskarin/lineloom-cli@0.1.0` is a separate, dependency-free npm-format installer. Its `lineloom install` command downloads and SHA-256 verifies the published **v1.2.0 stable** VSIX; `--preview` selects published **v1.2.4**. Installing this package alone does not install the extension or run install-time hooks. GitHub's npm registry requires package-read authentication. [Verified publishing workflow](https://github.com/sanskarIN/LineLoom/actions/runs/40085599452) · [installation and security guide](docs/packages.md). This **does not mean** it is published on npmjs.com; a real authenticated end-user install remains to be manually verified.

## Development

```sh
npm install
npm run check
npm run package
```

The GitHub v1.0.0 stable release ships an installable VSIX for community testing, including nine language IDs, per-language selection, nested ignore protection, bounded editor context, foreground-editor preflight checks, a short-lived empty-result retry backoff, typed-prefix continuation reuse, bounded NDJSON parsing and redirect-safe Ollama requests. It includes a mocked-Ollama editor-level integration check. Real Ollama model quality, offline behavior and manual cross-platform verification remain unverified; see the release notes. Both the [VS Code Marketplace listing](https://marketplace.visualstudio.com/items?itemName=SanskarCodes.lineloom) and [Open VSX listing](https://open-vsx.org/extension/SanskarCodes/lineloom) are public; each future update must be published separately. [Roadmap](docs/roadmap.md).

## Maintainer

GitHub: [sanskarIN](https://github.com/sanskarIN) · Website: [sanskarin.github.io](https://sanskarin.github.io/)

## Voluntary support

LineLoom is free and has **no subscription or paywall**. If useful, you may support maintenance via [Buy Me a Coffee](https://buymeacoffee.com/SanskarCodes), [Razorpay](https://razorpay.me/@SanskarCodes), or [PayPal.Me](https://paypal.me/SanskarCodes).

## License

[MIT License](LICENSE). [Licensing history and third-party notices](docs/licensing.md). LineLoom is an independent project; no affiliation or endorsement by Microsoft, GitHub, Ollama or model providers is implied.

## v1.3.0 design work (not released)

[Draft PR #93](https://github.com/sanskarIN/LineLoom/pull/93) prepares a default-off, explicitly user-selected **related-file context** feature. It permits at most two small (2 KiB each), policy-eligible source files to be used as anonymous untrusted reference snippets in a completion prompt. There is no repository scanning, persistent index or hidden background file selection. The user must enable the setting, pick files and confirm the disclosure each session; a separately approved remote Ollama host could receive those extra snippets.

**This is development source, not a stable or preview release.** See the [privacy/threat model RFC](docs/privacy/selected-context.md), [v1.3.0 candidate plan](docs/releases/v1.3.0-plan.md) and [manual QA matrix](docs/qa/v1.3.0-manual-acceptance.md). v1.2.0 remains the public stable; v1.2.4 is the latest published GitHub preview. Security issue [#79](https://github.com/sanskarIN/LineLoom/issues/79) still blocks new extension publishing.
