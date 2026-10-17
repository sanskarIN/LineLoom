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
