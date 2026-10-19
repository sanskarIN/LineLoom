# Changelog

All notable changes follow Semantic Versioning.

## [0.9.5] — 2026-10-19 — Packaged Installation Smoke & Stable Readiness

- Verified that the previous Windows user screenshot demonstrates v0.9.4 installation **inside VS Code**, rather than real model completion or a broken VSIX download.
- Added an isolated real VS Code CLI smoke test that installs the shipped preview VSIX and checks `SanskarCodes.lineloom@0.9.5` appears in the installed extensions list, with no user-profile mutation.
- Made CI and the release workflow require this packaged-install check alongside existing ZIP integrity, mocked extension-host, cross-platform, site and dependency security checks.
- Added a manual QA evidence matrix for genuine suggestions, acceptance, privacy, model diagnostics, and Windows/macOS/Linux tests before eventual stable v1.0.0.
- Updated installation docs, GitHub Pages download links, pre-release version and lockfile. No stable or external registry publishing is performed.


## [0.9.4] — 2026-10-19 — VS Code Installation & VSIX Verification Preview

- Clarified that VSIX files for LineLoom must be installed in **Visual Studio Code**, not the full Visual Studio IDE's VSIX Installer. Windows file associations can misleadingly open the wrong program despite a successful download.
- Added a dedicated GitHub Pages installation/troubleshooting page and linked it from the homepage, README and developer guides, including Windows PowerShell and VS Code Extensions UI instructions.
- Added a read-only VSIX ZIP/package identity verification step to CI and the pre-release pipeline, checking bundled extension files, publisher/version consistency and exclusion of web assets or environment files.
- Updated version and lockfile to **0.9.4**, keeping the `SanskarCodes.lineloom` extension ID, pre-release VSIX flag and MIT license.
- No change to inference algorithms; **stable v1.0.0 remains blocked** until real-model and physical cross-platform testing.


## [0.9.3] — 2026-10-19 — GitHub Pages Website & Preview Distribution

- Created a responsive, accessible static marketing and installation website in `site/` with original vector assets, honest preview limitations, manual setup and privacy guidance.
- Added a dedicated GitHub Pages deployment workflow using GitHub's official artifact/deploy actions. Site activation requires the repository's Pages source to be configured for GitHub Actions; publishing code alone is not sufficient.
- Added static-site regression tests and made the existing CI/release `npm run check` suite validate them on every preview.
- Removed website source from distributed VSIX contents via `.vscodeignore`.
- Updated the `SanskarCodes` preview documentation, installation links, and next-release pipeline. This is **not** stable v1.0.0 or an external registry publication.


## [0.9.2] — 2026-10-19 — Marketplace Identity & Preview Packaging

- Updated the extension `publisher` to **SanskarCodes** to match the newly created Visual Studio Marketplace publisher; the GitHub organization/user remains `sanskarIN`.
- Updated package and npm lockfile to `0.9.2`. Added a regression test guarding extension identity, package/lockfile version alignment and default VSIX pre-release packaging.
- Made `npm run package`, CI candidates and the GitHub release workflow use `vsce package --pre-release`, so assets are explicitly marked for VS Code's preview channel.
- CI now derives preview artifact names from `package.json` and requires Linux extension-host integration before uploading preview candidates.
- Added practical manual instructions for Microsoft Marketplace and Open VSX publisher setup, separate from the GitHub pre-release.
- Preserved the existing nine-language completion engine and privacy controls; this is a **distribution/readiness** update, not a claim of improved model accuracy.

**Registry status:** v0.9.2 is a GitHub pre-release; the Microsoft Marketplace and Open VSX require separate verified publishing actions. **Stable v1.0.0 remains blocked** pending real-model and manual cross-platform verification.

## [0.9.1] — 2026-10-19 — Pre-Dispatch Privacy & Model-Picker Safety Preview

- Added a **send-time safety gate** to the completion provider: after typing debounce and asynchronous sensitive-file checks, the extension revalidates current inference settings, model assignments, trusted-workspace state, and explicit remote-endpoint consent before building and sending a prompt.
- Rechecked the same settings on cached suggestions and typed-prefix continuation returns, preventing obsolete model/settings candidates from being displayed while a configuration event is delayed.
- Added fail-closed comparisons for changed custom excluded paths and request timeout settings, in addition to existing model, endpoint, language and generation parameters.
- Hardened model discovery and selection: both default and per-language model pickers verify the Ollama origin is **still the configured and approved endpoint** when a choice is saved. An endpoint or remote-HTTPS policy change while a picker is open silently discards the obsolete choice.
- Prevented storing newly approved remote origins if a user changes or disables the endpoint during the HTTPS approval prompt.
- Added unit tests for endpoint change/consent withdrawal and changed exclusions; added real VS Code extension-host regression checks showing stale model or excluded-file configuration during automatic debounce sends **zero** mock Ollama inference requests.
- Preserved the existing MIT license, nine language IDs, local-first Ollama operation, sensitive path protection, redirect rejection, and no telemetry or new dependencies.

**Important limitations:** these checks prevent starting a request under superseded settings; they cannot retract context that was previously sent to an approved server. Mock-model tests do not establish real-model accuracy, end-user latency, or manual cross-platform installation quality.

## [0.9.0] — 2026-10-19 — Per-Language Ollama Models Preview

- Added a configurable `lineloom.languageModels` map for optional per-language Ollama model tags, falling back to the existing global `lineloom.model` when no override is assigned.
- Added **LineLoom: Assign Language Model**, available directly from Quick Actions or the Command Palette. Choose one of nine language IDs and a model from the configured endpoint's installed list; **Use Default Model** clears the override.
- Kept JSX and TSX aliases mapped to the existing JavaScript/TypeScript model assignments. Model names are validated, trimmed and bounded; unknown language keys and malformed configuration values are ignored rather than being used for inference.
- Updated exact suggestion caching, typed-prefix continuation fingerprints, native FIM prompt selection and actual Ollama generation to consistently use the **resolved language model**.
- Fail-closed revalidation now rejects stale model responses if per-language assignments change while a model request is running; VS Code configuration events also invalidate in-memory suggestion caches.
- Added unit tests for model resolution, malformed settings, preference changes and Quick Action registration; verified the actual generated model tag through the mocked Ollama endpoint in VS Code integration tests.
- The model picker contacts only the already configured and validated Ollama endpoint after user initiation; remote HTTPS approval is still required. No extra context files, telemetry, model downloads, accounts or new dependencies.
- MIT license retained. Earlier Apache-2.0 release tags are unchanged.

**Still preview:** successful synthetic model routing does not establish real-model code quality, end-user ghost-text acceptance or on-device CPU/GPU performance.

## [0.8.1] — 2026-10-19 — Unicode & Response-State Safety Preview

- Improved the automatic mid-identifier guard for Unicode combining marks, connector punctuation and zero-width identifier joiners. Manual triggering and the configurable opt-out continue to work.
- Corrected an outdated editor integration regression: automatic cursor cancellation is tested during the configured typing debounce; explicit manual completion intentionally skips that debounce.
- Added a final configuration-state gate when Ollama finishes generating: superseded settings, disabled autocomplete, a removed language mode, altered model/endpoint parameters or withdrawn remote-HTTPS approval cannot yield a suggestion, even if a VS Code configuration event is delayed.
- Expanded pure unit tests for current inference preferences, automatic/manual eligibility, model changes and output-affecting settings.
- Preserved MIT licensing, the local-first privacy model, nine supported editor language IDs, no telemetry and no new runtime dependencies.

**Limitations:** these are source and mocked-Ollama editor checks. Real-model code quality, GPU/CPU responsiveness, offline user setup and manual VSIX install verification remain open pre-stable requirements.

## [0.8.0] — 2026-10-19 — Manual Responsiveness & MIT Preview

- **License:** changed current project-owned LineLoom source distribution from **Apache-2.0 to MIT**. Updated the root `LICENSE`, npm package metadata, README, contribution guidance and a historical licensing note. Existing Apache-2.0 releases remain available under their original terms; dependencies and third-party ownership rights remain separate.
- **Manual responsiveness:** explicit **LineLoom: Trigger Completion** requests bypass the normal typing debounce, while retaining all existing cursor, workspace-trust, ignored-file, approved-endpoint and cancellation checks.
- **Smarter automatic inference:** a new editor-local guard avoids automatic completions when the cursor is directly before an identifier character (including Unicode letters and digits, underscores and dollar signs). This reduces unintended suggestions while editing existing identifiers, without reading additional files.
- **Control:** added `lineloom.suppressMidTokenAuto` (default `true`) so developers can opt out of this heuristic. Explicit/manual completion is unaffected.
- **Regression coverage:** unit tests for Unicode identifier boundaries, manual override and opt-out; a mocked VS Code extension-host check for mid-token suppression and manual fallback; and a consistency test for the project MIT license and locked npm package metadata.
- **Safety:** keeps the nine registered languages, local-first Ollama behavior, redirection rejection, sensitive-file protection, typed-continuation validation and no telemetry. No new runtime dependencies were added.

**Pre-release limitations:** actual hardware latency, real coding-model usefulness, full offline setup and manual VSIX acceptance across Windows/macOS/Linux remain unverified. The mid-token gate is a conservative character-boundary heuristic rather than an AST-aware parser.

## [0.7.1] — 2026-10-18 — Typed Continuation Edit Safety Preview

- Hardened v0.7.0 typed-prefix reuse to verify **the actual VS Code text edit**, rather than relying on matching before/after text alone.
- A cached continuation is retained only for a single forward insertion at the previous cursor, containing 1–32 characters that match the beginning of the existing suggestion. It is discarded on replacements, multi-part edits, edits elsewhere, mismatched text, non-consecutive document versions and full suggestion acceptance.
- Connected the completion engine to `onDidChangeTextDocument` so the same real VS Code document-change event used by the editor decides whether previously generated text is still eligible for reuse.
- Kept original trust, ignore-file, cursor, document and model/settings checks. Candidate text and context fingerprints are still short-lived in memory, not persisted.
- Expanded unit tests for edit-shape rejection and the VS Code extension-host test to verify that unrelated changes force a fresh mocked Ollama request. The extension-host integration test consumes real VS Code edit notifications.
- No new remote providers, inference permissions, cross-file context, telemetry or automatic model downloads.

**Pre-release limits:** real-model autocomplete usefulness, offline setup, human ghost-text acceptance, CPU/GPU performance and manual installed-VSIX checks on Windows, macOS and Linux still need independent validation.

## [0.7.0] — 2026-10-18 — Typed Suggestion Continuations Preview

- Added typed-prefix continuation reuse: when a developer enters the first part of a displayed completion, LineLoom may instantly propose only the remaining text rather than sending an identical follow-up prompt to Ollama.
- Reuse is restricted to one consecutive document version, one forward insertion of 1–32 matching characters, the same file and VS Code language mode, the exact same surrounding context and suffix (SHA-256 digests), and unchanged endpoint/model/completion settings.
- The continuation cache holds only **one generated suggestion** plus hashed context and metadata in memory, expires after 12 seconds, and is cleared on settings changes, unrelated edits and provider disposal. It does not write source or prompts to disk.
- Existing trusted-workspace and ignore-file privacy checks run **before** any continuation reuse, and manual completion requests still go through normal Ollama behavior.
- Added a privacy-safe local aggregate `typed continuation reuses` counter to LineLoom diagnostics; no raw code or suggestions are logged.
- Added unit tests for successful and rejected reuse (mismatched code, suffix, language, settings, editor, version, expiry), and a VS Code extension-host test confirming typed continuation emits no extra model request.
- Kept all nine registered language modes, redirect protection, local Ollama default, explicit remote HTTPS approval and Quick Actions unchanged.

**Preview limitations:** continuation reuse is intentionally conservative and may fall back to inference in long sliding context windows or multi-edit sequences. Automated mocked-model tests do not establish real-model quality or measured user-perceived latency.

## [0.6.1] — 2026-10-18 — Ollama Redirect Safety Preview

- **Privacy/security:** explicitly set `redirect: "error"` on all Ollama `fetch` requests, including generation, model discovery and model lookup. An HTTP 3xx response cannot automatically forward a source snippet to another origin.
- Fail closed when an endpoint attempts to redirect, rather than silently treating a new destination as the same approved endpoint.
- Added HTTP unit coverage asserting redirects are rejected across all three API routes and a real loopback HTTP server test checking that an attempted redirect to a separate listener sends it **zero requests**.
- Kept the existing trusted-workspace gate, nested ignore rules, explicit remote-HTTPS origin approval and editor-state checks unchanged.
- No new services, model downloads, data collection or permissions.

**Pre-release caveat:** this prevents automatic HTTP redirect forwarding, not data retention by an already approved remote server, network proxy behavior or errors in generated code. Manual offline/model-quality verification is still required before stable v1.0.0.

## [0.6.0] — 2026-10-18 — Editor Quick Actions Preview

- Changed the LineLoom status-bar click action from diagnostics-only to **LineLoom: Quick Actions**, an editor-native menu for commonly used tasks.
- Added a single menu to enable/disable all suggestions, pause/resume only automatic suggestions, manually trigger completion, select an installed Ollama model, manage active languages, check the endpoint, open diagnostics and open settings.
- Added **LineLoom: Pause or Resume Automatic Suggestions**; manual inline completion remains available while automatic inference is disabled. The setting persists until the user changes it.
- Updated the ready status-bar label to **LineLoom Manual** while automatic suggestions are paused, with a Quick Actions tooltip.
- Preserved the explicit remote-HTTPS approval step: opening Quick Actions alone does not initiate inference, fetch a model list or contact a remote endpoint.
- Expanded pure unit tests for menu action mapping and VS Code extension-host integration checks for pausing/resuming automatic generation and retaining manual completion.
- No additional data collection, network providers, accounts or automatic model downloads.

**Pre-release limitations:** real-model completion usefulness, offline setup, CPU/GPU responsiveness and manual VSIX/editor verification on Windows, macOS and Linux still need user testing before stable v1.0.0.

## [0.5.1] — 2026-10-18 — Streaming Resilience Preview

- Bounded Ollama generation response streams to **1,000,000 total transferred bytes** and **4,096 NDJSON events**, in addition to the existing 10,000-character generated output cap.
- Fixed chunk-boundary handling so a single network read containing many ordinary NDJSON events is not rejected as one oversized event; individual incomplete events remain limited to 50,000 characters.
- Stopped processing events immediately after the first terminal `done: true` marker, avoiding contradictory events trailing an already-finished response.
- Validated model-stream event structure and rejected non-string `response` values, invalid `done` types and array events, rather than interpreting them as valid completions.
- Expanded streaming regression tests for large multi-event chunks, malformed events, excessive event counts, oversized transfers and terminal event handling.
- No new providers, permissions or automatic model downloads. The existing nine language IDs and workspace privacy gates remain unchanged.

**Still pre-release:** Ollama model-quality measurements, manual Windows/macOS/Linux VSIX installation tests, offline behavior and representative hardware performance remain to be verified before stable v1.0.0.

## [0.5.0] — 2026-10-18 — Completion Quality & Efficiency Preview

- Added a bounded memory-only 5-second backoff for identical automatic completion requests that produce no insertable code.
- Manual completion bypasses the empty-result backoff so developers can retry immediately.
- Scoped backoff entries to SHA-256 fingerprints incorporating the active document, language mode, version, cursor, model, endpoint and bounded context. Entries are cleared whenever the engine is reset.
- Improved model-output cleaning for leading fenced code blocks followed by commentary and common boundary FIM/chat tokens, while leaving token-like text inside code string literals intact.
- Added local aggregate counters for empty suggestions and suppressed retries to privacy-preserving diagnostics.
- Expanded unit tests for backoff expiry, isolation, LRU eviction and boundary token filtering, along with an extension-host integration test for suppressed automatic retries and an immediate manual retry.
- Retained nine VS Code language IDs, Ollama inference, conservative file exclusions and the explicit remote HTTPS approval boundary.

**Limitations:** the empty-result backoff applies only when the entire request fingerprint matches; it is not a model-quality guarantee. Real Ollama output quality, real-world editor UX and hardware benchmarking across all nine languages still need independent validation before a stable release.

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
