# LineLoom development record

## 2026-10-17 — Foundation

- Repository originally contained only the Apache-2.0 license.
- Added TypeScript VS Code extension manifest, settings, commands, build tooling, formatting and lint setup.
- `publisher` is a packaging identifier candidate, **not proof that the publisher account is registered or authorized**.
- Stable release must remain blocked until full tests, real Ollama completions, cross-platform installation, offline verification and VSIX checks succeed.
- GitHub connector commits do not permit specifying commit author e-mail directly; author identity must be checked on published commits.


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
