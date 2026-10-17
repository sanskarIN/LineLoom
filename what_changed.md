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
