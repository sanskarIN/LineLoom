# LineLoom

**Write less. Build more. Stay in control.**

LineLoom is a free Apache-2.0-licensed VS Code extension for context-aware inline autocomplete with your own Ollama model. It uses native editor ghost text, and does not require a LineLoom account, cloud inference provider, or telemetry.

> **Preview status:** LineLoom v0.4.0 is an early public **pre-release**, not a stable v1.0.0. Automated checks do not guarantee code-completion quality. See [v0.4.0 release notes](docs/releases/v0.4.0.md) for verified tests and known limitations.

## Features

- Native VS Code inline suggestions for **nine language IDs**: Python, JavaScript/JSX, TypeScript/TSX, Rust, Kotlin, **Go, Java, C and C++**. New v0.4.0 languages are experimental.
- Multi-line continuation, bounded prefix/suffix context, and optional FIM using a recognized Qwen2.5 Coder model family.
- User-selected installed model, endpoint, timeouts, output limits, temperature, automatic-trigger controls and **per-language opt-in/out settings**. Manage active languages through the Command Palette.
- Cancellation on newer requests, active cursor/editor changes and timeouts; bounded multi-line suggestions, echo cleanup and short-lived repeat-request caching.
- Only the active trusted-workspace document is used for completion; rejects symlinks escaping the workspace and excludes sensitive filenames and nested `.gitignore`, `.lineloomignore` and user-specified patterns.
- Local loopback by default; remote HTTPS needs both a setting and per-origin interactive approval. No background model downloads.
- Automatic completion requires two non-whitespace characters on the active line by default (configurable 0–32); manual triggers bypass this threshold. Active-document context is read through bounded editor ranges, even in large files.

## Getting started

1. Install [VS Code](https://code.visualstudio.com/) and [Ollama](https://ollama.com/download) for Windows, Linux or macOS.
2. Start Ollama according to its platform instructions. Confirm that `http://127.0.0.1:11434/api/tags` is reachable locally.
3. Install a coding model yourself: `ollama pull qwen2.5-coder:1.5b`. Downloads consume storage; see model licensing and system requirements.
4. For local development: `npm install`, `npm run build`, then open the repo in VS Code and press **F5** to launch an Extension Development Host.
5. In the Extension Development Host, open a **trusted folder** containing a supported source file (e.g. `.py`, `.js`, `.ts`, `.rs`, `.kt`, `.go`, `.java`, `.c`, or `.cpp`).
6. Type some code, or run **LineLoom: Trigger Completion**. Accept native inline text with your VS Code inline-suggest keybinding.
7. Run **LineLoom: Check Ollama Connection** or **LineLoom: Select Model** if suggestions do not appear.

Open the Command Palette and run **LineLoom: Show Setup Guide** for the short interactive guide.

## Commands

Enable Autocomplete · Disable Autocomplete · Trigger Completion · Select Model · Manage Autocomplete Languages · Check Ollama Connection · Open Settings · Open Diagnostics · Show Setup Guide · Show Completion Performance.

Settings are under `lineloom.*` in VS Code Settings. `lineloom.enabledLanguages` lists which of the nine language IDs can receive suggestions; the JSX and TSX editor modes follow the JavaScript and TypeScript choices. An empty list disables suggestions for all languages. Defaults: model `qwen2.5-coder:1.5b`, endpoint `http://127.0.0.1:11434`, debounce 250 ms, timeout 12 s, 8,000 context characters, 128 generated tokens, eight maximum suggestion lines (configurable 1–20), two minimum automatic-trigger characters (configurable 0–32). Cross-file context is **not implemented** in v0.4.0 even if the reserved setting is enabled.

## Privacy and safety

The extension transmits a bounded snippet **from the current document** to the configured Ollama endpoint to generate suggestions. Localhost requests stay on the local network stack; using a remote endpoint sends snippets to that server. No telemetry or repository indexing exists. A local model is not a guarantee of safe, correct, or licensed output; review code before use.

- [Privacy policy](PRIVACY.md) and [ignore rules](docs/privacy/ignore-rules.md)
- [Architecture](docs/architecture/README.md)
- [Development and testing](CONTRIBUTING.md)
- [Troubleshooting](docs/troubleshooting/README.md)
- [v0.4.0 preview release notes](docs/releases/v0.4.0.md) and [future v1.0.0 validation checklist](docs/releases/v1.0.0.md)

## Development

```sh
npm install
npm run check
npm run package
```

The GitHub pre-release ships an installable VSIX for community testing, including experimental Go, Java, C and C++ modes with language selection, nested ignore protection and bounded editor context. It includes a mocked-Ollama editor-level integration check. Real Ollama model quality, offline behavior and manual cross-platform verification remain unverified; see the release notes. Stable v1.0.0 and Marketplace publication have stricter gates. [Roadmap](docs/roadmap.md).

## Maintainer

GitHub: [sanskarIN](https://github.com/sanskarIN) · [X](https://x.com/SanskarCodes) · [LinkedIn](https://linkedin.com/in/SanskarCodes)

## Voluntary support

LineLoom is free and has **no subscription or paywall**. If useful, you may support maintenance via [Buy Me a Coffee](https://buymeacoffee.com/SanskarCodes), [Razorpay](https://razorpay.me/@SanskarCodes), or [PayPal.Me](https://paypal.me/SanskarCodes).

## License

[Apache License 2.0](LICENSE). LineLoom is an independent project; no affiliation or endorsement by Microsoft, GitHub, Ollama or model providers is implied.
