# Contributing to LineLoom

Thanks for contributing to privacy-respecting developer tooling. Review [SECURITY.md](SECURITY.md) before reporting security issues.

## Setup and checks

Prerequisites: Node.js 22+, npm, VS Code 1.96+, and Ollama for real-model evaluation.

```sh
git clone https://github.com/sanskarIN/LineLoom.git
cd LineLoom
npm install
npm run typecheck
npm run lint
npm test
npm run build
```

Open the folder in VS Code and run **Run Extension** (F5). To test real completions, install an Ollama coding model manually; the tests must not download one unexpectedly.

## Layout

`src/context` extracts bounded active-document text; `src/languages` holds the registry; `src/privacy` gates files; `src/models` handles the Ollama protocol; `src/completion` builds prompts and filters suggestions; `src/ui` handles native status; `src/extension.ts` wires commands and activation. Tests live under `test`.

## Contribution workflow

Create a focused branch such as `feat/python-imports` or `fix/cancellation`. Make small, meaningful Conventional Commits. Keep strict TypeScript typing, format with Prettier, and add tests for behavior changes. Avoid speculative abstractions and dependency bloat. Only use dependencies and assets with compatible licenses; explain new third-party code and required attribution. Update documentation and relevant examples. Open a PR using the provided template, describe risks and test evidence.

To add a language, extend `src/languages/registry.ts`, add representative language fixtures/tests, and verify VS Code's language identifier. Don't copy the completion engine.

## Quality gates

No hidden telemetry, automated code execution, unsolicited account/login, model downloads, or claims about untested accuracy. Test on Windows, Linux and macOS where possible and mark gaps explicitly. Do not submit confidential source code as a test fixture.

## Licensing contributions

LineLoom's current license is **MIT**. By contributing, confirm that you have the rights to submit your original work under the project's MIT terms, and preserve any required third-party copyright and license notices. The project cannot automatically relicense work owned by others; disclose reused code, fonts, media and licensing constraints in pull requests. Historical Apache-2.0 releases remain governed by the licenses shipped with those tags. See [licensing history](docs/licensing.md).
