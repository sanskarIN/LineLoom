# Feature proposals after LineLoom v1.3.0

**Proposal status: none of the features below is shipped or approved for release.** This page records candidates with explicit risks and go/no-go evidence. The published GitHub stable is [v1.3.0](https://github.com/sanskarIN/LineLoom/releases/tag/v1.3.0). See the [v1.3.1 maintenance plan](releases/v1.3.1-plan.md) for urgent correctness and release gates.

## Principles

1. **Local-first, trustworthy by default:** localhost Ollama is the default. Remote HTTPS remains separately enabled and approved per origin. No telemetry, accounts, unsolicited model downloads or automatic scanning.
2. **Explicit context scope:** extra files are never inferred from a workspace silently. Expansion beyond today's two explicitly selected 2,048-byte files would require a separate privacy design, UI and red-team tests.
3. **Usable with no context opt-in:** all core completion, setup, language and sidebar functions must work when selected-file context is OFF.
4. **Measurable value:** advance a feature only after clear quality/latency criteria, source-safe fixtures, accessibility review, and regression coverage.
5. **Channels are separate:** versioned GitHub VSIX, VS Code Marketplace, Open VSX, GitHub Packages npm CLI and possible npmjs.com publication each need their own verification and authorization.

## Candidate backlog (priorities are proposals)

| Candidate | Earliest sensible target | User value | Privacy/compatibility conditions | Decision |
| --- | --- | --- | --- | --- |
| Clearer inline completion states and recovery | v1.3.1 patch | Explain model-not-found, timeout, blocked editor and cancelled requests | No filenames/prompts/endpoints in diagnostics; accessible native VS Code UI | P1 / scoped |
| Quality and latency comparison harness | v1.4.0 research | Reproducible model choice and tuneable defaults | Synthetic source only; explicit user-run local Ollama; no uploaded benchmarks | **30-case harness and local evaluation stream hardening merged; 64-sample source-free in-editor p50/p95 now in unreleased development. Real models NOT RUN.** |
| Sidebar navigation and keyboard accessibility | v1.4.0 | Easier model switching, per-language choices and privacy inspection | No background probes; maintain simple Tree View; actual screen-reader QA | **Pending-check guidance and honest status tooltip implemented in unreleased source; real screen-reader QA NOT RUN** |
| Opt-in model readiness panel | v1.4.0 | Distinguish server reachable, model installed and editor eligible | Trigger network only on explicit command; no periodic polling or remote probing | P1 / design |
| Completion-acceptance and cancellation tuning | v1.4.0 | Reduce irrelevant suggestions and wasted requests | One-time bounded callback tokens; in-memory counts only, no source/paths | **Accepted-suggestion counter implemented in unreleased source; real human acceptance NOT RUN** |
| C# and Dart language support | v1.4.x or later | Additional developer workflows | VS Code language IDs, fixtures, tests, model quality evaluation; default-off until validated | P2 / evaluate |
| Opt-in explicitly selected reference snippets with improved prompt strategy | v1.4.x or later | Better suggestions when referencing two chosen files | Keep hard bounds, per-file consent, post-response policy checks; compare Qwen FIM fallback quality | P2 / evaluate |
| Project-aware symbols or imports | v1.5.x or later | Higher relevance in large codebases | **No indexing by default.** New security RFC, bounded opt-in parser, explicit I/O budget, cancellation and path exclusion audit | P3 / RFC only |
| Provider abstraction / optional additional local backends | v2.0 exploration | Local choice without model lock-in | Preserve loopback defaults; explicit remote consent; bounded streaming, disabled providers by default | Research / no target |

### Proposed dedicated completion model track

Initial model evaluation targets **Rust, C, C++, Python and TypeScript** (separate C vs C++ cases); this **does not remove** existing extension language support. See [model research](../model/README.md), [training plan](../model/TRAINING_PLAN.md) and [data governance](../model/DATA_POLICY.md). There are no model weights or trained LineLoom checkpoint; no new provider, automatic model download or source collection is introduced.

### Suggested v1.4.0 scope

**One theme: make the current workflow easier to understand and validate, not more invasive.**

- Better error-to-action guidance in sidebar/Quick Actions, separately indicating **extension active**, **model reachable after a user-invoked check**, and **file allowed after privacy inspection**. These are different states.
- Measured completion-quality/latency baseline for a small fixed set of Python, TypeScript and Rust synthetic fixtures; publish methodology and anonymized aggregates, not source prompts.
- Keyboard/high-contrast review and accessible labels, plus editor focus/cancellation regressions.
- Documentation and install/upgrade clarity for GitHub vs independently published extension registries.

All tasks remain proposals until implemented, tested and reviewed; v1.4.0 must not ship merely because a date or label appears on this page.

## Detailed design questions for future PRs

### Quality benchmark and model ergonomics

- Which small representative synthetic fixtures for each language detect over-generation, echo, indentation and invalid identifiers?
- Is the single-file FIM strategy better than generic prompting when extra references are provided? Measure **acceptance rate, false positives and end-to-end p50/p95 latency** using named locally installed models and machine configurations.
- Avoid presenting a test count as a proven code-quality metric. Record the distinction between unit/mock tests and developer judgment on actual suggestions.

### Sidebar and feedback

- Can a user understand why a suggestion is unavailable without exposing the active file path, privacy patterns or configured remote host?
- Prefer native VS Code commands, Tree View states and accessible labels over custom Webview telemetry or a new process.
- No automatic `/api/tags` or `/api/show` calls when the sidebar opens or refreshes.

### Adding a language

- Register the exact VS Code language ID/aliases; confirm syntax-sensitive fixtures and model prompts.
- Add the language only after optional opt-in experiments, test coverage and practical keyboard editor acceptance. There is no promise that all Ollama models work equally well.

### Larger cross-file intelligence

- **Reject** hidden repository traversal, persistent embeddings and unrestricted collection in the near term.
- Before any AST/dependency features: propose allowed file discovery rules, explicit consent UX, canonically bounded reads, attack cases (ignore changes, symlinks, malformed source, nested projects, remote paths), resource limits and a way to revoke consent.
- No features requiring cloud upload as a default.

## Proposed delivery process

1. Open an issue defining the user problem, constraints, success/rollback criteria and proposed target.
2. Write a short RFC for features affecting privacy, endpoint access, persistence or workspace I/O.
3. Implement in focused branches with unit tests and Linux VS Code extension-host regressions; require Windows/macOS/Linux CI.
4. Review performance, accessibility, dependencies, packaging and release notes with evidence.
5. Release to an opt-in channel only with explicit owner authorization and documented manual QA status; never silently synchronize registries.

Related: [roadmap](roadmap.md) · [privacy design](privacy/selected-context.md) · [sidebar](sidebar.md) · [release evidence procedure](qa/release-evidence.md).
