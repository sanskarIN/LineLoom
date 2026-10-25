# LineLoom documentation

**Current GitHub stable:** [v1.3.0](https://github.com/sanskarIN/LineLoom/releases/tag/v1.3.0), published 2026-10-25. **Latest GitHub pre-release:** [v1.3.1](https://github.com/sanskarIN/LineLoom/releases/tag/v1.3.1), published the same day; it is not a stable or registry release. Open VSX v1.3.0 Stable was independently verified as latest on 2026-10-25, and the maintainer separately updated Marketplace to v1.3.0. GitHub stable, previews and package-manager versions remain independent; check each distribution's own version.

This is a documentation index for users, maintainers and contributors. Proposed plans are labeled separately from implemented features.

## Install and use

| Guide | Contents |
| --- | --- |
| [Main README](../README.md) | What LineLoom is, install methods, settings, supported languages and general setup |
| [GitHub v1.3.0 stable release](releases/v1.3.0.md) | Downloadable stable VSIX, checksum and shipped features |
| [GitHub v1.3.1 pre-release](releases/v1.3.1.md) | Preview VSIX and SHA-256, sidebar refinements, explicitly outstanding manual QA |
| [Native sidebar](sidebar.md) | Control Center commands, model status, privacy and opt-in related-file selection |
| [Quick Actions](quick-actions/README.md) | Status-bar actions and workflows |
| [Troubleshooting](troubleshooting/README.md) | First-run, model and editor issues |
| [Model/language configuration](languages/README.md) | Supported language selection and routing |
| [GitHub Pages guide](github-pages.md) | Website deployment and update checks |
| [Package-manager guide](packages.md) | Published npm installer vs unpublished CLI proposals, registry authentication and pinned VSIX versions |

## Privacy and security

| Guide | Contents |
| --- | --- |
| [Privacy policy](../PRIVACY.md) | Data flows, local vs approved remote inference, diagnostic boundaries |
| [Ignore rules](privacy/ignore-rules.md) | Scoped path exclusions, safe file eligibility |
| [Selected related-file context](privacy/selected-context.md) | Explicit selection, 2 KiB/file bounds, revocation and limitations |
| [Security reporting](../SECURITY.md) | How to report vulnerabilities without exposing details |
| [VSIX packager mitigation](security/vsce-advisory-mitigation.md) | Historical high-severity mitigation, remaining moderate development dependencies |

## Contribute and validate

| Guide | Contents |
| --- | --- |
| [Contributing](../CONTRIBUTING.md) | Development setup, coding standards and review |
| [Architecture](architecture/README.md) | Extension subsystems and boundaries |
| [Development](development/README.md) | Build and test workflow |
| [Source-tree checks](development/source-tree.md) | Required TypeScript module inventory |
| [Performance](performance/README.md) | Benchmarks and measurement limits |
| [Code model research](../model/README.md) | Five-language synthetic evaluation and future training/privacy gates |
| [v1.3.0 human acceptance](qa/v1.3.0-manual-acceptance.md) | Unverified physical/model/accessibility scenarios |
| [Release evidence procedure](qa/release-evidence.md) | Sanitized pass/fail/deferral and cross-channel release truthfulness |

## Planning and history

- [Roadmap](roadmap.md): current state, proposed milestone sequencing and prioritization.
- [v1.3.1 maintenance plan](releases/v1.3.1-plan.md): historical preview scope, automated gates and **uncompleted manual/stable QA**. The GitHub preview has shipped, but a stable/registry release has not.
- [Upcoming feature proposals](feature-proposals.md): optional model readiness, sidebar polish, performance benchmarks, C#/Dart investigations and longer-term research. **Not shipped.**
- [v1.3.0 release plan/history](releases/v1.3.0-plan.md): completed publishing vs deferred hands-on checks.
- [Changelog](../CHANGELOG.md) and [GitHub Releases](https://github.com/sanskarIN/LineLoom/releases): historical source and public artifact status.

**Note:** The presence of an issue, roadmap item, development branch or passing CI test is not proof a feature has been released, the live registry was updated, or manual acceptance was completed.
