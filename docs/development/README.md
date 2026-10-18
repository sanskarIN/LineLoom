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
