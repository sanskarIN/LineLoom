# Changelog

All notable changes follow Semantic Versioning.

## Unreleased — v1.2.5 development (merged source, not published)

- **Candidate context-boundary hardening (not yet merged or released):** refuse invalid NaN/Infinity cursor/document/budget metadata before any source window read and cap direct context-extraction budgets to the configured 30,000 UTF-16-unit maximum; add deterministic regressions. This does not perform real-model or desktop acceptance.

- **Merged but unreleased ([PR #76](https://github.com/sanskarIN/LineLoom/pull/76)):** protect bounded UTF-16 source context windows from splitting a Unicode surrogate pair at prefix/suffix edges or at a caret inside an astral character. Drop only incomplete boundary code units, preserve intact emoji and international identifiers, and keep the original context-size limit; include deterministic unit regressions.

- **Source merged, still unreleased — diagnostics opt-out hygiene ([PR #74](https://github.com/sanskarIN/LineLoom/pull/74)):** erase opt-in inference-latency aggregates (last, total and measured request count) when the user disables performance diagnostics, while preserving source-free request/completion counts and autocomplete settings. Reject late model-response measurements started before opt-out, including when diagnostics are later reenabled; verify with mocked VS Code editor-host tests.

- **Source-merged but unreleased post-response race fix ([PR #72](https://github.com/sanskarIN/LineLoom/pull/72)):** revalidate excluded paths, model settings, workspace trust, editor focus and remote endpoint approval *after* the asynchronous final ignore-file scan, not just before it. Reject an Ollama result if permission changes while local policy I/O is pending, even before VS Code dispatches cancellation events; add deterministic deferred-I/O regression tests.

- **Merged but unreleased QA reliability improvement ([PR #70](https://github.com/sanskarIN/LineLoom/pull/70)):** the explicitly user-run local Ollama smoke test now rejects malformed or truncated UTF-8, whitespace-only completions, unsafe control/bidi characters and invalid surrogate fragments before reporting PASS, using bounded character counts without revealing generated code. Include mocked Unicode-boundary and invalid-output tests; this does not establish manual desktop or real-model acceptance.

- **Merged but unreleased completion-text integrity fix ([PR #68](https://github.com/sanskarIN/LineLoom/pull/68)):** discard Ollama output containing unsafe terminal/control bytes, Unicode bidi formatting controls or unpaired UTF-16 surrogates, rather than silently rewriting generated source. Preserve ordinary indentation/newlines/Unicode and avoid splitting an astral character at the 6,000-code-unit suggestion cap; cover with unit and mocked VS Code integration regressions.

- **Unreleased candidate:** user-initiated **Check Active File Privacy** action in Command Palette, Quick Actions and the sidebar, calling the existing local exclusion gate without reading source text, contacting Ollama or adding timing metrics. Warn on stale checks and distinguish file policy from model readiness; covered by editor-host regression tests.

- Add **LineLoom: Reset Privacy Timing Statistics** to the native Command Palette and opt-in-only sidebar / Quick Actions, clearing only in-memory eligibility check latency counters on demand while keeping the diagnostics preference and model/ignore settings unchanged.
- Discard late asynchronous timing measurements that began before a manual reset, preventing old policy reads from refilling cleared counters.
- Cover command registration and real VS Code editor-host invocation, plus reset-and-resume statistics in unit tests.
- Advance the development manifest/lockfile and private preview CI candidate to v1.2.5. PR #56 is merged into main and combined candidate CI passed; no v1.2.5 tag or GitHub/registry publication exists. v1.2.4 is already published as a GitHub-only preview; publication of v1.2.5 still requires separate authorization.

- Reject malformed UTF-8 and NUL-containing `.gitignore` / `.lineloomignore` policy files before local model inference, preserving the merged fail-closed hardening from PR #59.
- Hard-exclude `.gitignore`, `.lineloomignore`, `.dockerignore` and `.npmignore` files themselves at any workspace depth, including mixed-case names, even if their contents or ignore rules would otherwise permit inference. Ensure Active File Privacy also reports blocked; cover with path and VS Code filesystem regressions.
- Reject corrupted or incomplete UTF-8 from Ollama's model-list JSON and streamed generated code instead of silently inserting replacement characters; retain strict byte limits and safe error wording, with split-Unicode and malformed-byte regressions.

## [1.2.4] — 2026-10-23 — GitHub Pre-release

- Published [GitHub v1.2.4 preview](https://github.com/sanskarIN/LineLoom/releases/tag/v1.2.4) with a genuine VS Code pre-release VSIX and SHA-256 checksum.
- Added opt-in, in-memory, source/path-free eligibility timing diagnostics (64-sample rolling p95 and session aggregates). Collection is disabled by default and resets on opt-out.
- Verified pinned v1.2.0 stable and v1.2.3 preview → v1.2.4 candidate upgrades with synthetic preferences preserved, alongside cross-platform CI, mocked editor integration and dependency audit. [Publishing CI passed](https://github.com/sanskarIN/LineLoom/actions/runs/39903006652).
- Physical Windows/macOS/Linux, real Ollama, watcher and accessibility QA remain unverified. v1.2.0 stays stable; Marketplace and Open VSX not updated.

## [1.2.3] — 2026-10-23 — GitHub Pre-release

- Recheck the existence, type, size and mtime of all applicable root/nested .gitignore and .lineloomignore sources before reusing cached allow decisions; include previously absent sources.
- Fingerprint raw ignore-policy bytes with in-memory SHA-256 to detect same-size/same-timestamp rule edits even when VS Code watcher events are missing.
- Use bounded eight-way concurrent policy reads, retaining root-to-leaf rule order, fail-closed errors and deterministic deep-scope tests.
- Verify protected files never trigger model requests in mocked VS Code editor-host integration; package genuine preview-channel VSIX, checksum and synthetic stable-to-preview upgrade smoke.
- Publish [GitHub v1.2.3 pre-release](https://github.com/sanskarIN/LineLoom/releases/tag/v1.2.3) with VSIX and SHA-256; manual real-model, physical OS, accessibility and latency acceptance remain unverified. Marketplace and Open VSX unchanged.

## [1.2.2] — 2026-10-22 — GitHub Pre-release

- Hardened default Ollama model and per-language override names using one bounded, control-character-free tag normalizer. Malformed default model settings become unavailable rather than crashing.
- Invalid endpoint settings remain invalid; keep-alive falls back safely; malformed exclusions fail closed, including blank and control-character-bearing entries.
- Added pure preference tests, source-tree verification, and isolated v1.2.0-to-preview CLI upgrade checks.
- Published [v1.2.2 GitHub pre-release](https://github.com/sanskarIN/LineLoom/releases/tag/v1.2.2) with a genuine VS Code preview VSIX and checksum; real-model/manual QA and external registries remain separate.
## v1.2.1 — GitHub pre-release candidate

- Expanded VS Code extension-host privacy regression coverage: call the actual completion provider on synthetic hard-excluded and ignored files, asserting that no Ollama generation request is sent.
- Added a verified source-tree/import inventory gate and GitHub-only, owner-flagged v1.2.1 preview release workflow with a genuine VS Code pre-release VSIX marker. Automated acceptance does not substitute for real-model and desktop QA.
- Verified a synthetic isolated VS Code CLI upgrade from pinned published v1.2.0 to a v1.2.1 candidate, including settings retention, without modifying a real user profile.
- Hardened ignore-file change cancellation and sensitive ancestor-directory exclusions, with unit and mocked editor-host regressions.

### Earlier v1.2.1 maintenance development

- Added an explicitly opt-in `npm run qa:ollama -- --run --model <installed-tag>` loopback-only real-model smoke test using a fixed public fixture. Its output contains bounded metrics only, not generated code; remote endpoints and automatic model downloads are refused. Mocked CLI/network safety tests run in CI; real desktop acceptance remains pending.

- Hardened non-overridable local-file exclusions for direnv, Terraform state and variable files, cloud credential directories, SQLite/KeePass files and additional key formats. These paths remain ineligible for inline inference, including when a remote HTTPS endpoint was approved; added cross-platform unit regression tests.

- Added a dedicated **Stop Current Generation** command to the Command Palette,
  Quick Actions and the native Activity Bar sidebar. Cancels queued/debounced
  and in-flight requests while preserving enable/auto-trigger settings.
- Extended command, manifest, sidebar and mocked extension-host test coverage.
- Advanced development package/lockfile to 1.2.1 and isolated CI patch-candidate
  VSIX uploads. **The development package is not a stable registry release.**
- Public GitHub stable remains v1.2.0; external Marketplace/Open VSX
  publication and hands-on Ollama/accessibility acceptance are separate tasks.

## [1.2.0] — 2026-10-20 — GitHub Stable Release

- Added native sidebar completion engine state with explicit ready/generating,
  unavailable, disabled and error feedback. A configured model name does not
  imply Ollama connectivity is verified.
- Added in-memory cancellation counts, cache hits, typed-continuation reuses,
  empty results, and an optional measured average latency display.
- Improved local Ollama error recovery messaging with bounded error categories and no raw server output.
- Hardened Ollama model discovery against duplicate, overlong or control-character-bearing names; cap picker entries and reject unusable catalogs. A changed endpoint or revoked consent now invalidates a late Select Model list before showing results.
- Preserved no-request sidebar rendering, workspace trust, file-only scheme
  and remote endpoint approval boundaries.
- Advanced package and lockfile to 1.2.0 for a **stable-channel VSIX**.
  CI packages without `--pre-release` and rejects preview markers, risky
  archive contents, wrong publisher/version and missing sidebar icons.
- Published [GitHub v1.2.0 stable](https://github.com/sanskarIN/LineLoom/releases/tag/v1.2.0) through a one-time owner-authorized workflow with verified VSIX, checksum and install smoke test. Manual real-Ollama and cross-OS QA acceptance remains documented and open.
- **GitHub stable is published; manual QA is outstanding:** real-model, hardware latency, upgrade and interactive cross-platform/accessibility gates still lack evidence. Marketplace and Open VSX retain independently published v1.0.0 until separately updated.
- C# and Dart are not implemented in v1.2.0.

## [1.1.1] — 2026-10-20 — GitHub Pre-release

- Add a local-only **Active Editor** sidebar section showing supported
  language, effective Ollama model (default or language override), and
  preliminary settings-level completion availability.
- Explain unsupported languages, restricted workspaces, disabled languages,
  invalid/blocked remote endpoints and pending approval without accessing
  the current document's path or source contents.
- Refresh editor context as tabs/editors change, and improve native tree
  item accessibility labels for keyboard and screen-reader workflows.
- Extend pure and extension-host regression coverage; manual cross-platform,
  accessibility and actual-model acceptance remain explicitly unverified.
- Hardened the Active Editor settings diagnostic to respect the VS Code inline
  completion provider's file-only scheme: untitled and virtual editors are
  not falsely labeled as eligible. The UI inspects only the non-sensitive URI
  scheme and language ID, never a file path or code content.
- Updated package and lockfile to v1.1.1 with isolated preview VSIX release
  verification; v1.2.0 is the planned next stable version.
- This GitHub preview does not update stable v1.0.0 registry packages.

## [1.1.0] — 2026-10-20 — GitHub Pre-release

- **Pre-release channel only:** v1.0.0 remains the stable version distributed
  on Visual Studio Marketplace and Open VSX; this preview is distributed via
  a versioned GitHub VSIX with the VS Code pre-release marker.
- Added the LineLoom native Activity Bar **Control Center** with completion,
  model and language actions, workspace/endpoint privacy status, session
  counters, connection checks and shortcuts to diagnostics.
- Sidebar opening/refresh is local-only: it does not discover models, access
  editor source, initiate HTTP requests, or expose endpoint host/port details.
- Fixed Open Settings and Setup Guide extension lookup to use the published
  `SanskarCodes.lineloom` ID.
- Added model/manifest/view regression tests, Linux extension-host coverage,
  packaged SVG/VSIX integrity checks, and preview-specific release gates.
- **Acceptance outstanding:** real Ollama model output and latency on developer
  machines, Windows/macOS/Linux hands-on sidebar checks and accessibility.

## [1.0.0] — 2026-10-19 — First Stable Release

**Post-release distribution update (no source/version change):** v1.0.0 is also published on [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=SanskarCodes.lineloom) under `SanskarCodes.lineloom`. Installation is available directly through VS Code Extensions or `code --install-extension SanskarCodes.lineloom`. [Open VSX Registry](https://open-vsx.org/extension/SanskarCodes/lineloom) now also lists stable v1.0.0 under the same publisher; its publisher verification badge is not yet verified. GitHub v1.0.0 tag and shipped VSIX have not been modified.

- First **stable-channel GitHub VSIX release** of LineLoom under publisher `SanskarCodes` with the release/lockfile version set to 1.0.0.
- Switched default VSIX packaging and automated release artifacts to omit the VS Code pre-release flag; preserved explicit `npm run package:preview` for experimental builds.
- Maintained CI across Windows, macOS and Linux, mocked Ollama extension-host tests, privacy unit checks, website tests, and the clean VS Code CLI installation smoke test.
- Continued versioned download and installation documentation on GitHub Pages; stored ZIP/manifest verification and SHA-256 alongside release assets.
- The current code supports native editor inline completions with user-installed Ollama models, language controls, privacy gates and local-first settings.
- **Testing caveat:** no independently recorded real-model cross-platform editor acceptance or CPU/GPU latency measurements were provided at publication; no unperformed checks are presented as passed. Marketplace and [Open VSX](https://open-vsx.org/extension/SanskarCodes/lineloom) are now publicly available.


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
