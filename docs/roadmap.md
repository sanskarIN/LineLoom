# Roadmap (not commitments)

**v0.1.0 (pre-release):** five-language local completion preview with installation and early feedback.

**v0.1.1 (pre-release):** privacy hardening, stale-suggestion prevention, and bounded model discovery.

**v0.2.0 (pre-release):** improved completion cleanup, suggestion-line limit, short-lived repeat-request cache and VS Code provider integration regression checks.

**v0.2.1 (pre-release):** hardened model discovery/streaming and event-driven stale-request cancellation.

**v0.3.0 (pre-release):** nested privacy ignores, bounded active-document range reads, smart automatic-trigger threshold and integration coverage.

**v0.4.0 (pre-release):** Go, Java, C, C++ editor registrations and configurable language-selection UI with regression tests.

**v0.4.1 (pre-release):** editor-state revalidation, single-cursor insertion safety and IntelliSense cooperation, with regression checks.

**v0.5.0 (pre-release):** empty-result retry backoff, stricter model response cleanup and unit/editor regression tests.

**v0.5.1 (pre-release):** bounded streaming resources, event-schema validation and chunk-boundary regression coverage.

**v0.6.0 (pre-release):** status-bar Quick Actions, automatic suggestion pause/resume with manual fallback and integrated workflow tests.

**v0.6.1 (pre-release):** HTTP redirect rejection for Ollama requests and privacy regression tests.

**v0.7.0 (pre-release):** typed suggestion continuation reuse without extra model calls, hashed context guards and end-to-end mocked editor verification.

**v0.7.1 (pre-release):** conservative typed-suggestion invalidation using actual editor edit events, with unit and extension-host tests.

**v0.8.0 (pre-release):** MIT licensing update with historical notices; manual completion bypasses typing debounce; automatic mid-token identifier guard with opt-out and editor tests.

**v0.8.1 (pre-release):** complete Unicode identifier boundary handling; post-inference settings and remote-origin revalidation; corrected automatic debounce regression tests.

**v0.9.0 (pre-release):** optional per-language installed Ollama model routing with Quick Actions management and provider integration regressions.

**v0.9.1 (pre-release):** dispatch-time configuration and workspace privacy revalidation; fail-closed model picker updates when endpoint consent changes; automated editor regressions.

**v0.9.2 (pre-release):** use the SanskarCodes publisher identity, explicit Marketplace preview VSIX metadata, release/version integrity tests and separate registry onboarding documentation.

**v0.9.3 (pre-release):** add a responsive static GitHub Pages website, automated deployment workflow, static-site regression tests and clear preview onboarding.

**v0.9.4 (pre-release):** clarify VS Code extension installation versus the full Visual Studio VSIX Installer; add a GitHub Pages help page and automated VSIX archive/manifest verification.

**v0.9.5 (pre-release):** automate isolated VS Code CLI installation of the packaged VSIX and track genuine cross-platform/model acceptance evidence before v1.0.0.

**v1.0.0 (released 2026-10-19):** Stable GitHub VSIX, [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=SanskarCodes.lineloom) and [Open VSX](https://open-vsx.org/extension/SanskarCodes/lineloom) publication. Independently measured Ollama model quality and manual cross-platform acceptance remain ongoing; do not claim these unperformed tests have passed.

**Next distribution milestone:** maintain both published registries, pursue Open VSX publisher verification if eligible (registry currently reports `verified: false`), and coordinate future version updates across GitHub, Visual Studio Marketplace and Open VSX.

**Next maintenance:** user-reported completion-quality fixes, more editor behavior checks and real-model verification.

**v1.0.0 scope:** native editor completion, local Ollama integration, user-controlled models, privacy gate, automated tests and verified stable-channel VSIX. Experimental languages and incomplete hands-on model QA remain disclosed in the release notes.

**v1.1.0 (in development):** native Activity Bar sidebar for model, language, privacy and completion controls. Continue language-aware model quality checks, request timing and context-cache tuning as release gates; do not call it shipped until the stable tag and both registries are updated.

**v1.2.0:** add C# and Dart, richer language-aware suggestions and partial acceptance if stable VS Code APIs support it.

**v1.3.0:** opt-in selective repository context with documented exclusions and privacy review.

**v2.0.0:** optional additional providers and deeper language intelligence, remaining local-first by default.

No roadmap feature should be marketed as shipped before implementation and verification.
