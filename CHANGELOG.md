# Changelog

All notable changes follow Semantic Versioning.

## [0.4.1] — 2026-10-18 — Editor Safety Maintenance Preview

- Revalidate the active document, its original version, cursor position and single empty selection before reading/sending the completion prompt, after debounce, and after asynchronous privacy checks.
- Avoid sending current-document snippets when the request was invalidated while a nested ignore policy was being evaluated.
- Reject inline completions for selected text and multi-cursor editing, where a single-cursor ghost-text insertion could be confusing.
- Do not compete with the selected VS Code IntelliSense completion when the request is automatic; manual triggers remain supported when no text is selected.
- Apply the same cursor/selection validation to cached suggestions and final streamed-model responses.
- Add unit tests for single-cursor eligibility and VS Code extension-host regression checks for selected text, multi-cursor states, native completion collisions and cursor changes while waiting for debounce.
- Retain all nine existing language IDs, Ollama-first operation and existing privacy, exclusions and remote HTTPS approval.

**Still preview-only:** real Ollama generation quality, manual installation on Windows/macOS/Linux, hardware performance and offline usage have not been independently accepted. No new external services or cloud model downloads were added.

## [0.4.0] — 2026-10-17 — Language Expansion Preview

- Added experimental native VS Code inline completion support for **Go, Java, C and C++**, increasing the recognized language IDs from five to nine.
- Added language-specific guidance for generic Ollama model prompts, editor registrations and runnable example files for the four new languages.
- Introduced `lineloom.enabledLanguages` with validation, unknown-value filtering and explicit support for an empty list that disables autocomplete in all languages.
- Added **LineLoom: Manage Autocomplete Languages** to choose enabled language modes from VS Code's Command Palette.
- Covered all nine registered modes in unit tests; added mocked Ollama provider integration checks for Go, Java, C and C++, as well as disabled-language denial.
- Maintained local-only Ollama defaults, trust and sensitive-file exclusions, cancellation, telemetry-free design and existing five-language behavior.

**Preview limitations:** Go, Java, C and C++ support means model-driven inline completion *registration* and simulated integration tests, not verified suggestion correctness with real inference. Real models, offline installation, CPU/GPU performance and end-user cross-platform VSIX testing remain necessary for stable v1.0.0.

## [0.3.0] — 2026-10-17 — Privacy & Smart Completion Preview

- Added nested `.gitignore` and `.lineloomignore` exclusion checks along the document path, including canonical symlink targets in the same workspace.
- Applied each ignore source conservatively, so a nested negation cannot override an exclusion established by another source.
- Capped ignore traversal to 24 directory scopes per relative file path, with fail-closed errors; cached rules for 20 seconds with file watcher invalidation.
- Reduced memory usage with bounded VS Code text-range reads instead of copying the entire active file for autocomplete context.
- Added configurable `lineloom.minAutoTriggerChars` (default 2, 0–32), delaying automatic local inference until the current line has enough meaningful text; explicit/manual triggers are unaffected.
- Expanded unit tests for nested ignore precedence, root and sibling scopes, windowed context reads and automatic-trigger settings.
- Added VS Code extension-host integration checks against nested ignore rules using synthetic fixtures.

**Pre-release limitations:** real-model output quality and latency, offline operation, full manual cross-platform VSIX acceptance and content-based secret detection still need user/hardware validation. Stable v1.0.0 remains blocked.

## [0.2.1] — 2026-10-17 — Pre-release maintenance

- Added abort-signal cancellation for stalled NDJSON Ollama response streams, even when no further bytes arrive.
- Enforced a 256 KB maximum on downloaded Ollama model discovery JSON before parsing.
- Avoided including raw model-server errors that might contain source code or credentials in exception messages.
- Abort obsolete model requests when the active editor, cursor position or document version changes.
- Added unit tests for split UTF-8 stream chunks, cancellation of stalled streams, excessive generation output, model-list safety limits and server error handling.
- Improved VS Code extension-host regression coverage around cursor movement and cancellation.
- No new model downloads, remote services, telemetry or permission requirements.

**Pre-release limitations:** real locally installed Ollama output quality, offline smoke tests, representative CPU/GPU response timings and manual installation on Windows, macOS and Linux still require independent verification. Stable v1.0.0 remains blocked.

## [0.2.0] — 2026-10-17 — Pre-release

- Added configurable maximum inline suggestion lines (default 8, range 1–20).
- Improved generated code filtering: bounded partial echo removal, line-ending/NUL normalization, indentation preservation and truncation.
- Added a short-lived eight-entry memory-only cache for identical model and editor context; digested keys and automatic clear on extension cancellation/configuration changes.
- Added a real VS Code editor/provider integration test with a simulated local Ollama server, cache reuse and private-file denial.
- Expanded unit coverage for filtering edge cases and cache expiration/eviction.
- Retained five initial language families, local-first model inference and opt-in remote endpoint restrictions.

**Early-preview limitation:** real model output quality, CPU/GPU timings and manual cross-platform VSIX installation are not yet independently verified.

## [0.1.1] — 2026-10-17 — Pre-release maintenance update

- Resolve workspace symlinks before reading source context; disallow symlinks that point outside the trusted workspace or to an excluded canonical target.
- Block completions when ignore files exist but cannot be read, rather than inadvertently treating them as missing.
- Discard completions when the editor, active cursor, workspace ignore rules or document version changes while Ollama is generating.
- Bound Ollama model listing and compatibility probes to approximately eight seconds by default.
- Avoid reading and including potentially sensitive or unbounded Ollama HTTP error bodies in diagnostics.
- Add automated tests for workspace traversal, symlinks, malformed model listings and endpoint errors.
- Retain the original five language families and local-first inference model; no new permissions or cloud services.

**Remaining preview limitations:** quality and latency with a real local model, offline smoke testing, installation/acceptance in real editors across all supported operating systems and nested ignore-file coverage are not yet fully verified.

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
