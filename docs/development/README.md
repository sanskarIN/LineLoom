# Development host

Run `npm ci` with Node.js 22+, then open the repository in VS Code and press **F5**. Select **Run LineLoom Extension**. The `npm: build` task creates the esbuild bundle before the Extension Development Host launches.

Use `npm run watch` during development and `npm run check` for TypeScript, linting, tests and bundling. `npm run test:integration` invokes the official VS Code extension test runner and downloads a VS Code build. Linux CI uses `xvfb-run -a npm run test:integration`.

Mocked integration does not prove real-model completion quality or visible ghost text; install Ollama manually and test in the editor before releasing.

## v0.2.0 test extension host

The integration runner opens a throwaway trusted workspace with synthetic source fixtures, starts a mocked local Ollama HTTP server, invokes the real VS Code inline provider, tests cache reuse and checks that .env files are denied. This does **not** replace manual model-inference/UX tests on Windows, Linux and macOS.

## v0.2.1 regression checks

Unit tests cover interrupted NDJSON streams (including stalled readers), split multibyte UTF-8 characters, 10,000-character streaming output safety limits and 256 KB model-list size limits. VS Code extension-host tests exercise the inline provider with a mocked local Ollama server. The full cross-platform CI is required to succeed before triggering GitHub preview publication.

## v0.3.0 integration fixtures

The extension-host runner creates nested `src/.gitignore` and `src/.lineloomignore` fixtures alongside allowed/blocked example TypeScript files. It asserts that nested exclusions deny completion while a sibling source file remains eligible. Unit tests cover independent scopes, negation precedence, automatic trigger thresholds and bounded editor context reads. These tests use a synthetic workspace and mocked local Ollama server and do **not** verify real model quality.

## v0.4.0 new-language regression tests

The unit suite validates all nine language identifiers, JSX/TSX aliases, per-language enablement, and generic model language-specific prompts. The VS Code extension-host integration suite opens synthetic `.go`, `.java`, `.c` and `.cpp` files, checks their detected editor language modes, verifies completion provider responses from a mocked Ollama server, and ensures disabling Go excludes it. Four corresponding sample programs are located under `examples/`. These tests establish wiring, **not** useful suggestions from real model weights or quality assurance for the new compilers.

## v0.4.1 foreground editor safety tests

The pure single-cursor guard tests reject selection replacements, multiple cursors, and stale positions. In the VS Code extension-host integration suite (using synthetic code and a simulated local Ollama service), regression checks verify that these states, native IntelliSense collisions, and a cursor shift during debounce make **zero extra inference requests**. The provider also rechecks the original document/version/position after async workspace privacy gates. These tests do not prove real-model usefulness.

## v0.5.0 response-quality checks

The unit suite now checks short-lived backoff expiry, LRU eviction, fingerprint isolation and clearing. Completion cleanup tests cover boundary FIM/chat tokens, opening fenced code blocks with extra prose afterward and intact control-token-like strings inside legitimate source code. The VS Code extension-host integration test uses a simulated Ollama response that produces no code; it verifies a repeated automatic request makes no additional HTTP inference call, while a manual request is allowed through immediately. A mocked model cannot establish real completion quality.

## v0.5.1 Ollama streaming regressions

The unit suite exercises byte- and event-count limits, individual oversized NDJSON lines, valid large chunks composed of small events, invalid event shapes and trailing data after a terminal `done: true` response. The Linux VS Code extension-host integration suite continues to use a simulated local Ollama server rather than installed model weights. Do not claim model-quality or latency improvements without independent real-model measurements.

## v0.6.0 Quick Actions regression checks

Unit tests verify the action allowlist, enable/disable state mapping and automatic pause/resume labels. The VS Code extension-host suite checks that `lineloom.quickActions` and `lineloom.toggleAutomatic` are registered; pausing blocks automatic inference while preserving manually triggered completions. Tests exercise a **mocked Ollama server**, not live model inference. Confirm status-bar menu ergonomics manually in real VS Code before a stable release.

## v0.6.1 network redirect privacy regression

The HTTP test suite checks `redirect: "error"` on model listing, model lookup and completion generation. An additional test starts two ephemeral local HTTP servers: one returns an HTTP 307 pointing to the other, and the suite confirms that the destination receives zero requests. These tests use synthetic prompts, never private workspace data. VS Code extension-host tests continue to use mocked Ollama responses; no real-model output quality is implied.

## v0.7.0 typed-continuation tests

Unit tests cover one-step typing and expiry, exact prefix/suffix fingerprints, rejected context mutations, profile/document/language changes, non-consecutive versions, and oversized candidates. The VS Code extension-host suite types the first character of a synthetic mock suggestion into a test file and checks that LineLoom provides only the remainder **without a second simulated Ollama request**. This verifies the provider's wiring but not user-perceived ghost-text quality or real-model inference speed on actual hardware.

## v0.7.1 edit-event regression checks

Run `npm run check` and `npm run test:integration`. Unit tests exercise correct same-position one-step insertions and reject replacements, multi-part changes, different cursor offsets, wrong inserted text, skipped document versions and full suggestion acceptance. The extension-host suite subscribes to **actual** `vscode.workspace.onDidChangeTextDocument` notifications while editing a disposable synthetic source file. It confirms that valid typing can reuse the remaining mock suggestion without HTTP traffic, whereas an unrelated edit causes a fresh mocked Ollama request. Real-model quality is not measured by these tests.

## v0.8.0 editor responsiveness and licensing checks

Unit tests cover the automatic mid-token boundary for ASCII/Unicode identifiers, punctuation and empty suffixes, plus the user-selectable opt-out and manual override. The VS Code extension-host integration test invokes the actual provider in the middle of a synthetic identifier and confirms no additional **mock Ollama** request occurs until manual triggering or disabling the guard. Run `npm ci && npm run check && npm run test:integration` to verify the feature. The MIT test checks root license text and both npm license fields; it accepts Windows CRLF line endings. No automatic real-model quality or latency measurements are claimed.

## v0.8.1 regression coverage

Unit tests cover Unicode identifier continuation characters and the strict post-generation preference guard. The VS Code extension-host test now exercises the **automatic** trigger for debounce cancellation; manual invocations intentionally bypass the debounce since v0.8.0. End-to-end tests use a mock Ollama server and cannot establish actual model quality or measured latency.

## v0.9.0 model routing checks

Unit tests cover supported language maps, aliases, malformed model tags, unknown keys, fallback to the global Ollama model and rejection of late responses after an override changes. VS Code's extension-host integration suite configures a TypeScript override, observes the actual `model` field sent to the **mock Ollama HTTP** endpoint, clears the override and verifies a new request uses the global default. The extension does not automatically pull, inspect model quality or benchmark distinct models.

## v0.9.1 privacy regression tests

Run `npm ci && npm run check` and `npm run test:integration`. Pure tests verify that endpoint changes, revoked HTTPS consent, invalid endpoint URLs, timeout changes and additional excluded paths invalidate their prior authorization. In the VS Code extension-host test, an automatic completion is queued with a nonzero debounce; changing either the model or a newly excluded file path before dispatch must result in **zero mock Ollama generation calls**. The suite uses synthetic source files and an ephemeral local test server. Real third-party model data handling and responsiveness cannot be determined from these tests.
