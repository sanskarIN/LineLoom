# Evidence and release-status reporting

This is an operational template, **not a record of tests that were run**. For actual v1.3.0 hands-on acceptance use [v1.3.0 manual QA](v1.3.0-manual-acceptance.md); planned patch gates are in [v1.3.1 plan](../releases/v1.3.1-plan.md).

## Four independent status categories

| Status | What it means | What not to imply |
| --- | --- | --- |
| **Published** | Exact public GitHub release/registry artifact exists and its version and checksum were verified | A GitHub VSIX release automatically updates both marketplaces or npm |
| **Automated pass** | Specific workflow, SHA, named jobs and published test logs completed successfully | Real local Ollama usefulness, physical desktop UX or accessibility |
| **Manual pass** | A human ran a documented reproducible scenario and recorded sanitized evidence | A manual sample covers all platforms/models |
| **Not run / deferred / failed** | No valid evidence, a documented exception, or a reproducible failure | Green, complete or safe by assumption |

**Never convert a checklist from NOT RUN to PASS from a successful GitHub Actions check.** An explicitly accepted deferral can authorize a carefully disclosed GitHub release; it does not transform the task into a completed test.

## Minimal sanitized test record

Copy this template *without* private code, paths, tokens, prompts or remote endpoint URLs.

```md
### Case: <short stable ID / scenario name>
- Date (UTC): YYYY-MM-DD
- Reviewer: <public handle or role>
- Git commit: <full SHA>
- Artifact: <version, distribution/channel and SHA-256 digest, if installed>
- OS/editor: <Windows/macOS/Linux, version, VS Code version>
- Model: <local model family, tag, model source; no account secrets>
- Privacy mode: <single-file OFF / selected-file ON with count only>
- Steps: <synthetic test fixture identifier, non-sensitive actions>
- Expected: <observable behavior>
- Actual: <PASS | FAIL | NOT RUN | DEFERRED>
- Measurements: <aggregate sample count, p50/p95 milliseconds if available>
- Evidence: <run or issue URL; no source or path details>
- Follow-up: <issue link; what remains>
```

## Suggested hands-on scenarios

- **Local completion:** trusted workspace, synthetic Python/TypeScript/Rust fixture, manual and auto triggers, inline acceptance, indentation and Unicode.
- **No extra context:** `lineloom.crossFileContext=false`; verify there are no additional file reads or reference snippets in a local **test** server request.
- **Explicit related context:** enable setting, select one then two synthetic tiny same-folder source files, confirm modal and reference bounds; reject 3, symlink, ignored and invalid UTF-8 sources.
- **Revocation:** edit a selected file, change a LineLoom setting, switch editor, or run **Clear Selected Related Files** while a synthetic Ollama response is delayed; old suggestion never appears.
- **Accessibility:** keyboard-only picker/disclosure, high contrast, focus recovery and screen reader names on physical environments.
- **Install and upgrade:** clean stable VSIX, protected local settings, real editor startup and version displayed by VS Code; independently verify packages from their claimed distribution channels.

## Publishing gate

1. Confirm scope (extension or npm CLI) and exact intended channel; never infer authorization for a second registry.
2. Validate committed lockfile, cross-platform CI, mocked VS Code editor-host tests and dependency audits. Any high or critical advisory is a blocker until addressed or a newly documented risk decision is approved.
3. Build the exact stable/preview VSIX with correct channel, verify publisher/identity, cryptographic checksum and clean install and upgrade. The signed/verified claim must match actual evidence.
4. Record real-model, performance, privacy, accessibility and physical OS QA as passed, failed, not run or explicitly deferred with owner review.
5. Request **separate owner authorization** for the version and target distribution channel before tag/release/publish.
6. After publication, check the public asset and update README, website, changelog and package documentation. Do not advertise an unpublished CLI command or marketplace version.

For security issues, follow [SECURITY.md](../../SECURITY.md). Never paste credentials, proprietary code, local absolute filenames or raw request/response bodies in public CI logs or issue comments.
