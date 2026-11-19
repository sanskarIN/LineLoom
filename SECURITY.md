# Security policy

## Supported versions and release channels

As of **19 November 2026**, the [latest published GitHub stable release](https://github.com/sanskarIN/LineLoom/releases/tag/v1.3.0) is **v1.3.0**; the [latest published GitHub testing pre-release](https://github.com/sanskarIN/LineLoom/releases/tag/v1.4.4) is **v1.4.4**. These are different distribution channels: a GitHub preview does not update the Visual Studio Marketplace, Open VSX or npm, and a newer `main` commit is not a published release.

| Channel | Security maintenance |
| --- | --- |
| Latest published stable (currently **v1.3.0**) | Primary supported version for routine security fixes and disclosure triage |
| GitHub pre-release (currently **v1.4.4**) | Testing only; reported security defects are investigated, but preview compatibility and release timing are not guaranteed |
| Older stable/preview versions | No routine support commitment; users should evaluate the latest appropriate published channel |
| Unreleased `main` | Development source; a merged fix or passing non-security test is not evidence that a safe public VSIX has shipped |

Check [GitHub Releases](https://github.com/sanskarIN/LineLoom/releases) and the relevant registry listing for the current version before reporting or recommending an update. These version numbers are a dated snapshot, not an automatic support guarantee for future releases.

## Responsible disclosure

Use the repository's **Security → Report a vulnerability** private advisory workflow, if available. **Do not** place exploit details, private tokens, sensitive project source, internal paths or unredacted model prompts into public issues, comments or CI logs. If private advisory reporting is unavailable, open a minimal public issue requesting a private reporting channel *without* disclosing the vulnerability.

A useful report includes the affected LineLoom version and distribution channel, VS Code and operating-system versions, concise redacted reproduction steps, expected versus actual behavior, impact, and an optional mitigation. If relevant, distinguish bugs in the installed extension from problems in development dependencies or VSIX publishing tools.

Maintainers will triage valid reports as capacity permits; no response or patch-time SLA is promised. Disclosure is not authorization to test against third-party systems or expose other people's data.

## Trust boundaries and limitations

- Workspace files and comments are **untrusted data**. Model-generated completions are also untrusted and are not executed automatically.
- LineLoom is local-first. The default Ollama endpoint uses loopback; sending snippets to a remote HTTPS endpoint requires separate explicit approval and may send source code off the device.
- Cross-file context is disabled by default and requires explicit, session-scoped related-file selection, subject to privacy-eligibility checks. This is not permission for unrestricted repository indexing.
- Path exclusions such as `.lineloomignore` and `.gitignore` help reduce accidental reads. They are **not** a complete secret detector, filesystem snapshot guarantee or substitute for handling private data carefully.
- Developer tools and VSIX packaging have their **own** supply-chain risks, even when affected npm packages are absent from the runtime-only dependency tree.

See [PRIVACY.md](PRIVACY.md), [selected-file privacy documentation](docs/privacy/selected-context.md) and [release evidence requirements](docs/qa/release-evidence.md) for the intended safeguards and their limits.

## Security verification before releases

LineLoom's [dependency security workflow](.github/workflows/security.yml) checks the pinned VSIX packaging dependency relationship, the non-development npm graph and the **full** build/publishing dependency graph. A green build, a green runtime-only audit or successful extension-host tests do **not** replace a failing full audit.

The [18 November 2026 audit tracking issue](https://github.com/sanskarIN/LineLoom/issues/297) documents historical high-severity development-tool findings. The [picomatch advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) referenced in that audit was marked **withdrawn on 18 November 2026**, after the failed CI runs. That status change alone does **not** establish that the audit now passes or that all dependency concerns are resolved. See [the dated triage record](docs/security/dependency-audit-2026-11-18.md) for the exact historical evidence and required fresh verification.

Do not disable audit gates, run forced incompatible dependency upgrades or claim security clearance based on an advisory withdrawal. Verify a fresh candidate commit through the full security workflow, cross-platform CI, VSIX parity/integrity checks and the applicable manual acceptance requirements. Publisher migration and registry publication require their own separate evidence and approval.
