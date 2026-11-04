# Experimental C# completion — manual acceptance

**Status: NOT RUN (2026-11-04).** This document is a test plan, not observed device results or approval to ship a new extension/model release. C# is opt-in source support added in #255; it is not part of the five-language first-party LineLoom Code training/evaluation target.

## Automated source checks

- Unit tests verify the `csharp` registry entry, manifest parity, unchanged nine-language defaults, explicit model override, and distinct C#/C/C++ Markdown fence compatibility.
- The mocked VS Code extension-host flow verifies that an editor reporting `csharp` cannot infer by default, and that enabling `csharp` with an explicitly selected local model results in exactly one local mock generation using C# guidance.
- The extension-host test is conditional on that editor distribution registering `csharp`; a skipped language mode is **not** a successful physical C# editor test. The mock returns a fixed synthetic suggestion and does not test generated-code correctness.
- CI builds and candidate VSIX install/upgrade checks do not prove real Ollama model quality or .NET compilation.

## Physical VS Code acceptance — all NOT RUN

| Check | Windows | macOS | Linux |
| --- | --- | --- | --- |
| C# language mode registered for `.cs` and `.csx` | NOT RUN | NOT RUN | NOT RUN |
| Default setting sends no manual or automatic C# requests | NOT RUN | NOT RUN | NOT RUN |
| Explicit opt-in permits bounded local requests | NOT RUN | NOT RUN | NOT RUN |
| Explicit `lineloom.languageModels.csharp` selects intended installed model | NOT RUN | NOT RUN | NOT RUN |
| Disable language mid-request; stale suggestion discarded | NOT RUN | NOT RUN | NOT RUN |
| Ignore rules, file pause and workspace trust block requests | NOT RUN | NOT RUN | NOT RUN |
| Remote HTTPS origin requires explicit prior consent | NOT RUN | NOT RUN | NOT RUN |
| C# completions reviewed and compiled with a suitable .NET SDK | NOT RUN | NOT RUN | NOT RUN |
| Keyboard, high-contrast and screen-reader acceptance | NOT RUN | NOT RUN | NOT RUN |

## Verification procedure

1. Start from a verified candidate VSIX in a disposable VS Code profile. Record OS, editor build, exact package identity and SHA-256; do not conflate `SanskarCodes.lineloom` and `Sanskar.lineloom`.
2. Use a trusted local test workspace with original, nonprivate C# snippets. Confirm VS Code reports `csharp` (not merely a `.cs` filename). Install or enable an appropriate trusted C# editor mode if needed.
3. Confirm no requests occur with the nine-language default list, including an explicit manual trigger. Then enable only `csharp` in addition to the existing defaults.
4. With a separately reviewed, already installed local Ollama coding model, test ordinary methods, generics, nullable references, async/await and incomplete suffixes. Independently review and compile completions; do not treat exact textual match as correct code.
5. Verify C# model overrides, mixed-language code-fence rejection, cancellation, privacy exclusions, per-file pause, workspace-trust revocation and endpoint consent. Use only synthetic samples and source-free counts in shared evidence.
6. Repeat on all three operating systems with keyboard navigation, high contrast and a screen reader. Record dated PASS/FAIL/NOT RUN results and redacted failure explanations.

**Release boundary:** No new C# language service, .NET SDK, checkpoint, model download, persistent source indexing, training rights or model weights are included. Automated mock checks and a signed VSIX do not authorize a stable release, registry publication or publisher migration.
