# LineLoom

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/SanskarCodes.lineloom?label=VS%20Code%20Marketplace&logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=SanskarCodes.lineloom)
[![Open VSX Registry](https://img.shields.io/open-vsx/v/SanskarCodes/lineloom?label=Open%20VSX)](https://open-vsx.org/extension/SanskarCodes/lineloom)
[![GitHub release](https://img.shields.io/github/v/release/sanskarIN/LineLoom?label=GitHub%20release)](https://github.com/sanskarIN/LineLoom/releases/tag/v1.0.0)
[![MIT license](https://img.shields.io/badge/license-MIT-70d6ce)](LICENSE)

**Write less. Build more. Stay in control.**

LineLoom is a free MIT-licensed VS Code extension for context-aware inline autocomplete with your own Ollama model. It uses native editor ghost text, and does not require a LineLoom account, cloud inference provider, or telemetry.

> **Stable GitHub release:** v1.0.0 is the first major release. Automated tests verify packaging and mocked-model behavior; actual model quality, interactive editor acceptance and hardware latency are not independently certified. See [v1.0.0 release notes](docs/releases/v1.0.0.md) for verified tests and known limitations.

## v1.1.1 Active Editor sidebar pre-release (GitHub)

**Published v1.1.1 is an opt-in GitHub pre-release** containing the native Activity Bar
Control Center from v1.1.0, plus the new **Active Editor** section with
language detection, default/per-language effective model, and a provisional
settings-level completion status. The UI uses only the language ID and
non-identifying document scheme, never source text, paths or endpoint URLs.
Untitled or virtual editors do not incorrectly appear eligible for completion.

Download the published [LineLoom v1.1.1 VSIX](https://github.com/sanskarIN/LineLoom/releases/download/v1.1.1/LineLoom-1.1.1.vsix)
from the [GitHub v1.1.1 pre-release](https://github.com/sanskarIN/LineLoom/releases/tag/v1.1.1)
and install using **VS Code → Extensions → … → Install from VSIX…**, or
`code --install-extension LineLoom-1.1.1.vsix`.
The [v1.1.1 release notes](docs/releases/v1.1.1.md) describe the changes,
known limitations and checksum. Earlier
[v1.1.0 preview](https://github.com/sanskarIN/LineLoom/releases/tag/v1.1.0)
remains available.

The next target is **v1.2.0 stable**. See the
[stable release plan](docs/releases/v1.2.0-plan.md) and
[manual test matrix](docs/qa/v1.1.1-sidebar-acceptance.md).
Neither v1.1.1 nor v1.2.0 should be called stable until appropriate release
gates pass.

**Registry versions:** Visual Studio Marketplace and Open VSX continue to
distribute stable v1.0.0 until their public versions change. GitHub preview
assets do not automatically update either registry.

## Install LineLoom

Install the stable v1.0.0 from your editor's supported registry:

- **[Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=SanskarCodes.lineloom)** — for VS Code users.
- **[Open VSX Registry](https://open-vsx.org/extension/SanskarCodes/lineloom)** — for compatible editors using the Open VSX extension registry.
- Both official listings use publisher `SanskarCodes`, extension ID `SanskarCodes.lineloom`, and version **1.0.0**.

In VS Code, open Extensions (`Ctrl+Shift+X`), search for **LineLoom**, verify the publisher **SanskarCodes**, and choose **Install**. You can also use the Command Palette's **Extensions: Install Extensions** action, or the VS Code CLI:

```sh
code --install-extension SanskarCodes.lineloom
```

If your editor obtains extensions from Open VSX, open its Extensions view, search for **LineLoom**, and verify the publisher **SanskarCodes**. The same stable v1.0.0 is also available from [Open VSX](https://open-vsx.org/extension/SanskarCodes/lineloom). The Open VSX entry is publicly downloadable; publisher verification/badge status is separate.

### Alternative: install the GitHub stable VSIX

The [GitHub v1.0.0 stable release](https://github.com/sanskarIN/LineLoom/releases/tag/v1.0.0) includes `LineLoom-1.0.0.vsix` for offline/manual installation. Download the VSIX and use **VS Code → Extensions → ... → Install from VSIX** (or `code --install-extension LineLoom-1.0.0.vsix`).

**Important for Windows:** Do not double-click the VSIX file. Windows may open **Visual Studio VSIX Installer**, which correctly rejects VS Code extensions and displays “One or more extensions are for Visual Studio Code.” Open **Visual Studio Code** and select **Extensions → … → Install from VSIX…** instead. [Step-by-step installation and troubleshooting](https://sanskarin.github.io/LineLoom/install.html).

**Registry status:** LineLoom **v1.0.0 is published on [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=SanskarCodes.lineloom) and [Open VSX](https://open-vsx.org/extension/SanskarCodes/lineloom)**. The Open VSX registry currently reports `verified: false` for the publisher; this does **not** mean the extension is unpublished. GitHub owner `sanskarIN` and extension publisher ID `SanskarCodes` are intentionally different. [Publisher and update instructions](docs/publishing.md).

## Project website and documentation

The [LineLoom website](https://sanskarin.github.io/LineLoom/) is live and maintained in [`site/`](site/), deployed through the [GitHub Pages workflow](.github/workflows/pages.yml). The [deployment guide](docs/github-pages.md) documents verification and maintenance.

Website content is excluded from the extension VSIX package. This does not add hosted inference, an account requirement or telemetry.

## Release verification status

The v1.0.0 stable packaging workflow checks archive integrity **and** installs the packaged VSIX in an isolated real VS Code command-line profile. This is stronger than ZIP validation, but it does not prove real Ollama inference or interactive ghost-text acceptance. [Manual verification matrix](docs/qa/v0.9.5-readiness.md) tracks the remaining Windows, macOS, Linux, privacy, offline and model-performance tests. **Visual Studio Marketplace and Open VSX are live; hands-on real-model QA remains ongoing.**

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

## Development

```sh
npm install
npm run check
npm run package
```

The GitHub v1.0.0 stable release ships an installable VSIX for community testing, including nine language IDs, per-language selection, nested ignore protection, bounded editor context, foreground-editor preflight checks, a short-lived empty-result retry backoff, typed-prefix continuation reuse, bounded NDJSON parsing and redirect-safe Ollama requests. It includes a mocked-Ollama editor-level integration check. Real Ollama model quality, offline behavior and manual cross-platform verification remain unverified; see the release notes. Both the [VS Code Marketplace listing](https://marketplace.visualstudio.com/items?itemName=SanskarCodes.lineloom) and [Open VSX listing](https://open-vsx.org/extension/SanskarCodes/lineloom) are public; each future update must be published separately. [Roadmap](docs/roadmap.md).

## Maintainer

GitHub: [sanskarIN](https://github.com/sanskarIN) · [X](https://x.com/SanskarCodes) · [LinkedIn](https://linkedin.com/in/SanskarCodes)

## Voluntary support

LineLoom is free and has **no subscription or paywall**. If useful, you may support maintenance via [Buy Me a Coffee](https://buymeacoffee.com/SanskarCodes), [Razorpay](https://razorpay.me/@SanskarCodes), or [PayPal.Me](https://paypal.me/SanskarCodes).

## License

[MIT License](LICENSE). [Licensing history and third-party notices](docs/licensing.md). LineLoom is an independent project; no affiliation or endorsement by Microsoft, GitHub, Ollama or model providers is implied.
