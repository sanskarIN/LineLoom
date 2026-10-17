# Changelog

All notable changes follow Semantic Versioning.

## [0.1.0] — 2026-10-17 — Pre-release

**First public preview (not stable).**

- Native VS Code inline completions, with automatic and manual triggers.
- Initial language families: Python, JavaScript/JSX, TypeScript/TSX, Rust, and Kotlin.
- Local Ollama model selection, streamed code generation, bounded context, cancellation, and generation timeouts.
- Native status indicator, setup commands, optional performance diagnostics, and configurable limits.
- Sensitive path exclusion with root-level `.gitignore`/`.lineloomignore`, workspace-trust gate, and opt-in remote HTTPS confirmation.
- Automated TypeScript, lint, unit, mocked VS Code extension-host, security, and reproducible packaging checks.
- Original extension icon, documentation, tests, and sample code.
- Restored compatibility with the supported TypeScript-ESLint toolchain after an incompatible TypeScript 7 update.

**Known limitations:** real Ollama-powered completion quality, offline usage after setup, acceptance behavior across all five languages on actual editors, CPU/GPU timings, and manual Windows/macOS/Linux installation are not yet fully verified. No Marketplace or Open VSX publication is claimed.
