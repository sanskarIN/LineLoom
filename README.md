# LineLoom

**Write less. Build more. Stay in control.**

LineLoom is a free Apache-2.0-licensed VS Code extension for context-aware inline autocomplete with your own Ollama model. It uses native editor ghost text, and does not require a LineLoom account, cloud inference provider, or telemetry.

> **Development status:** v1.0.0 candidate code. Not a published stable release. See [what_changed.md](what_changed.md) for outstanding verification and packaging requirements. Results vary by model and hardware.

## Features

- Native VS Code inline suggestions for **Python, JavaScript, TypeScript, Rust and Kotlin**.
- Multi-line continuation, bounded prefix/suffix context, and optional FIM using a recognized Qwen2.5 Coder model family.
- User-selected installed model, endpoint, timeouts, output limits, temperature and automatic-trigger controls.
- Cancellation on newer requests, editor changes and timeouts; conservative completion cleanup.
- Only the active trusted-workspace document is used for completion; excludes sensitive filenames and root-level `.gitignore`, `.lineloomignore` and user-specified patterns.
- Local loopback by default; remote HTTPS needs both a setting and per-origin interactive approval. No background model downloads.

## Getting started

1. Install [VS Code](https://code.visualstudio.com/) and [Ollama](https://ollama.com/download) for Windows, Linux or macOS.
2. Start Ollama according to its platform instructions. Confirm that `http://127.0.0.1:11434/api/tags` is reachable locally.
3. Install a coding model yourself: `ollama pull qwen2.5-coder:1.5b`. Downloads consume storage; see model licensing and system requirements.
4. For local development: `npm install`, `npm run build`, then open the repo in VS Code and press **F5** to launch an Extension Development Host.
5. In the Extension Development Host, open a **trusted folder** containing a `.py`, `.js`, `.ts`, `.rs` or `.kt` file.
6. Type some code, or run **LineLoom: Trigger Completion**. Accept native inline text with your VS Code inline-suggest keybinding.
7. Run **LineLoom: Check Ollama Connection** or **LineLoom: Select Model** if suggestions do not appear.

Open the Command Palette and run **LineLoom: Show Setup Guide** for the short interactive guide.

## Commands

Enable Autocomplete · Disable Autocomplete · Trigger Completion · Select Model · Check Ollama Connection · Open Settings · Open Diagnostics · Show Setup Guide · Show Completion Performance.

Settings are under `lineloom.*` in VS Code Settings. Defaults: model `qwen2.5-coder:1.5b`, endpoint `http://127.0.0.1:11434`, debounce 250 ms, timeout 12 s, 8,000 context characters, 128 generated tokens. Cross-file context is **not implemented** in v1.0.0 even if the reserved setting is enabled.

## Privacy and safety

The extension transmits a bounded snippet **from the current document** to the configured Ollama endpoint to generate suggestions. Localhost requests stay on the local network stack; using a remote endpoint sends snippets to that server. No telemetry or repository indexing exists. A local model is not a guarantee of safe, correct, or licensed output; review code before use.

- [Privacy policy](PRIVACY.md) and [ignore rules](docs/privacy/ignore-rules.md)
- [Architecture](docs/architecture/README.md)
- [Development and testing](CONTRIBUTING.md)
- [Troubleshooting](docs/troubleshooting/README.md)
- [v1.0.0 validation checklist](docs/releases/v1.0.0.md)

## Development

```sh
npm install
npm run check
npm run package
```

The release process additionally requires real VS Code integration testing, hardware/model checks and a verified Marketplace publisher identity. Do **not** publish from an unverified build. [Roadmap](docs/roadmap.md).

## Maintainer

GitHub: [sanskarIN](https://github.com/sanskarIN) · [X](https://x.com/SanskarCodes) · [LinkedIn](https://linkedin.com/in/SanskarCodes)

## Voluntary support

LineLoom is free and has **no subscription or paywall**. If useful, you may support maintenance via [Buy Me a Coffee](https://buymeacoffee.com/SanskarCodes), [Razorpay](https://razorpay.me/@SanskarCodes), or [PayPal.Me](https://paypal.me/SanskarCodes).

## License

[Apache License 2.0](LICENSE). LineLoom is an independent project; no affiliation or endorsement by Microsoft, GitHub, Ollama or model providers is implied.
