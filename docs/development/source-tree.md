# Project-owned TypeScript source inventory

LineLoom is implemented in TypeScript, with `src/extension.ts` as the VS Code extension entry point. The **source code is in this repository**; VSIX distributions bundle the reachable project-owned TypeScript and the privacy/engine modules as a single `dist/extension.js` using esbuild. They intentionally exclude `src/`, `scripts/`, `test/`, `site/` and `node_modules/`.

The runtime module tree comprises `src/completion/` (trigger, debounce, generation, caches and filtering), `src/context/` (bounded context extraction), `src/languages/` (supported language registry), `src/models/` (Ollama transport and errors), `src/privacy/` (trust, sensitive paths, exclusions and ignore rules), `src/settings/` (validated preferences and endpoints), and `src/ui/` (native sidebar and status/actions).

Run:

```shell
npm ci
npm run test:source-tree
npm run check
npm run test:integration
```

`test:source-tree` verifies every `src/` TypeScript file has a complete relative-import path to `src/extension.ts` and that every project-owned source import resolves; tests cover missing and orphaned files. The build verifies TypeScript types and produces `dist/extension.js`. CI additionally checks the bundled VSIX's required icons and metadata, runs a mocked VS Code editor-host test, and installs the resulting extension in a disposable VS Code CLI profile.

These checks detect missing/referenced source files and packaging regressions. They do **not** prove a real model, every optional editor action, user hardware or marketplace installation has been tested. Test the real Ollama model and physical OS/editor behavior using [the manual QA checklist](../qa/v1.2.1-local-ollama-smoke.md).
