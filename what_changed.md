# LineLoom development record

## 2026-10-17 — Foundation

- Repository originally contained only the Apache-2.0 license.
- Added TypeScript VS Code extension manifest, settings, commands, build tooling, formatting and lint setup.
- `publisher` is a packaging identifier candidate, **not proof that the publisher account is registered or authorized**.
- Stable release must remain blocked until full tests, real Ollama completions, cross-platform installation, offline verification and VSIX checks succeed.
- Published commits were checked on GitHub: author and committer are Sanskar <sanskarin@outlook.in>.


## Implementation and verification status

- Added five-language context registry, Ollama NDJSON streaming, editor completion provider and native commands.
- Added unit test suite and a VS Code extension-host integration suite (mocked Ollama).
- CI, dependency audit and draft-only tag-based release pipelines added. Workflow runs and real Ollama hardware checks still require verification.
- Automatic lockfile bootstrap workflow generates a dependency lock on `main`; check that it ran and the generated file was actually committed.
- Do **not** tag or publish a stable release until [docs/releases/v1.0.0.md](docs/releases/v1.0.0.md) gates pass.

## CI feedback fixes

- GitHub CI initially reported one ESLint `no-useless-escape` error in completion prompt matching; removed the escape.
- Security audit revealed vulnerable transitive packages in Vitest 3 and @vscode/vsce 3; updated to Vitest 5 and @vscode/vsce 4 for a fresh security run.
- Added an original 128×128 PNG extension icon, SVG design source and five small example files.

- Updated esbuild to 0.28 to satisfy Vite 8's optional peer requirements with Vitest 5; fixes ERESOLVE from the first upgrade attempt.

## Additional completion refinements

- Registered JSX and TSX VS Code language IDs as aliases for the JavaScript and TypeScript language families; still exactly five v1 language families.
- Fixed timeout state handling so aborted timeouts do not leave the status bar spinning.
- Added privacy-safe, synthetic-fixture model benchmark instructions and a command-line benchmark script.
- Verified the GitHub commit author and committer identity in the repository Git history uses sanskarin@outlook.in.

## Validation evidence and external CI blocker

- A GitHub Actions run verified TypeScript type checking, linting, Vitest, and build on Windows, macOS and Ubuntu with Vitest 5 and VSCE 4.
- An earlier Ubuntu extension-host integration test with mocked Ollama passed; a later run failed **during VS Code download** due to network ETIMEDOUT (not a test assertion). Latest commit still needs completed integration verification.
- Security audit on updated dependencies reported **0 vulnerabilities** in the successful run.
- VSIX candidate packaging is now independent of the external VS Code download step, so a preview artifact can be inspected even when integration cannot download VS Code. This does **not** remove integration from stable release gates.

## Privacy hardening and development host

- Separated root `.gitignore`, `.lineloomignore`, and user exclusion groups so negations cannot override exclusions from another group.
- Denied additional credential and private-configuration paths such as `.npmrc`, `.ssh`, and `.aws`.
- Installed ignore-file change watchers to clear the cached rules.
- Added VS Code F5 launch and build tasks with documented development host instructions.

- Added unit coverage for ignore-group negation precedence to guard against privacy regressions.


## v1.0.0 candidate: verified engineering report (2026-10-17)

**Decision: installable release candidate built; stable release BLOCKED.** No stable GitHub release was published and neither Visual Studio Marketplace nor Open VSX publication is claimed.

### Delivered architecture and features

- Native inline completion via VS Code API, with native ghost-text acceptance.
- Exactly five supported programming language families: Python, JavaScript (including JSX), TypeScript (including TSX), Rust and Kotlin.
- Ollama HTTP client: installed model discovery, model choice, model verification, streaming NDJSON generation, bounded output, timeouts and request cancellation.
- Document-only prefix/suffix context; language-aware completion prompts and filtering.
- Status bar, on/off commands, manual trigger, diagnostics, settings and opt-in aggregate metrics.
- Trusted-workspace restriction, sensitive filename denial, separate root .gitignore and .lineloomignore rules, explicit HTTPS remote approval and zero telemetry.
- Original PNG extension branding, example programs, GitHub CI, security workflow, lockfile bootstrap, draft release workflow, tests and documentation.

### Actual automated verification

**CI passed** on Windows, macOS and Ubuntu: npm ci, TypeScript strict check, ESLint, Vitest, esbuild. A VS Code Extension Development Host integration test passed on Ubuntu with a mocked Ollama server (activation, command registration, settings control, model list/show and generated response). Source: https://github.com/sanskarIN/LineLoom/actions/runs/39023436310

**Dependency security scan passed** with the updated toolchain. Source: https://github.com/sanskarIN/LineLoom/actions/runs/39023436311

**VSIX packaging passed** via @vscode/vsce, with a successful ZIP integrity check and an inspected manifest, bundled extension, README, license, security/privacy files and original icon. Package contained no source maps, node_modules, editor source tree or environment files.

### Release artifact details

- CI workflow artifact: LineLoom-1.0.0-candidate (artifact ID 12097157971)
- VSIX filename: LineLoom-1.0.0.vsix
- Exact VSIX size: 31,179 bytes
- SHA-256: c14aba19aaf05859e9a12dbd0e29d13ef19618094728cdc25c72e5ede90ca331
- SHA-256 text file is included alongside the VSIX in the CI artifact.
- Artifact page: https://github.com/sanskarIN/LineLoom/actions/runs/39023436310

### Feature validation limitations

Python, JavaScript, TypeScript, Rust and Kotlin completion registration and compilation are covered by tests and CI. **Real-model generated suggestion quality has NOT been verified for any of the five languages.** Real ghost-text display/acceptance, multi-line accuracy, FIM performance, offline functionality and a fresh VSIX installation in a user VS Code installation have not been tested here.

Default model is qwen2.5-coder:1.5b, but no model weights were installed and no live Ollama call was made during this development session. No CPU/GPU results have been measured; the benchmark script provides a synthetic test fixture and must be run on actual target hardware. Do not invent performance claims.

### Security limitations

- Nested .gitignore files and content-level secret detection are not implemented. Root-level ignores and sensitive paths are enforced.
- Code snippets may leave the device if the user opts into a remote inference origin. Remote server retention is outside this project's control.
- Generated code is never executed by the extension and is not guaranteed correct, secure or license-safe.
- The packaging publisher string is not proof that a corresponding Marketplace publisher account is authorized.

### Stable v1.0.0 release blockers and next actions

1. Install the generated VSIX in fresh compatible VS Code instances on Windows, Linux and macOS.
2. Manually validate useful ghost-text completions and acceptance in each of the five languages.
3. Validate real locally installed Ollama coding models, offline behavior, FIM, multiline, error states and request cancellation.
4. Measure CPU-only and GPU-assisted responsiveness and document the model tag, hardware and methodology.
5. Confirm Marketplace publisher account access and Open VSX credentials before publishing externally.
6. Only after these checks pass, create the v1.0.0 tag and publish the stable GitHub release with the verified checksum.

### Commit information and file audit

The initial repository contained the Apache-2.0 LICENSE, which was preserved. Meaningful Conventional Commits were pushed to main. Verified author and committer identity in Git history: Sanskar <sanskarin@outlook.in>. The generated dependency lockfile was committed using that configured email.

Tracked files reviewed for this report (67 files):

- .editorconfig
- .github/CODEOWNERS
- .github/FUNDING.yml
- .github/ISSUE_TEMPLATE/bug_report.yml
- .github/ISSUE_TEMPLATE/feature_request.yml
- .github/PULL_REQUEST_TEMPLATE.md
- .github/dependabot.yml
- .github/workflows/bootstrap-lock.yml
- .github/workflows/ci.yml
- .github/workflows/release.yml
- .github/workflows/security.yml
- .gitignore
- .prettierrc.json
- .vscode/launch.json
- .vscode/tasks.json
- .vscodeignore
- CHANGELOG.md
- CODE_OF_CONDUCT.md
- CONTRIBUTING.md
- LICENSE
- PRIVACY.md
- README.md
- SECURITY.md
- assets/icons/lineloom.png
- assets/icons/lineloom.svg
- docs/architecture/README.md
- docs/development/README.md
- docs/performance/README.md
- docs/privacy/ignore-rules.md
- docs/releases/v1.0.0.md
- docs/roadmap.md
- docs/troubleshooting/README.md
- eslint.config.mjs
- examples/javascript/example.js
- examples/kotlin/Example.kt
- examples/python/example.py
- examples/rust/example.rs
- examples/typescript/example.ts
- package-lock.json
- package.json
- scripts/benchmark.mjs
- scripts/build.mjs
- scripts/integration.mjs
- src/completion/engine.ts
- src/completion/filter.ts
- src/completion/prompt.ts
- src/context/extract.ts
- src/extension.ts
- src/languages/registry.ts
- src/models/ollama.ts
- src/privacy/exclusions.ts
- src/privacy/matching.ts
- src/privacy/rules.ts
- src/settings/config.ts
- src/settings/endpoint.ts
- src/ui/status.ts
- test/integration/suite.ts
- test/unit/context.test.ts
- test/unit/endpoint.test.ts
- test/unit/filter.test.ts
- test/unit/ignore-groups.test.ts
- test/unit/ollama.test.ts
- test/unit/privacy.test.ts
- test/unit/prompt.test.ts
- test/unit/registry.test.ts
- tsconfig.json
- what_changed.md
