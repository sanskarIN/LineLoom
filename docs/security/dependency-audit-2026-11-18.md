# Dependency security audit triage — 18 November 2026

**Status: BLOCKING / NO RELEASE APPROVAL.** This is a snapshot of a failing, independent GitHub Actions dependency audit, **not** a mitigation or waiver. Follow the live [security tracking issue #297](https://github.com/sanskarIN/LineLoom/issues/297) and current CI before making a publishing decision.

## Evidence and precise scope

- [Failing full audit from PR #296](https://github.com/sanskarIN/LineLoom/actions/runs/44317656296): `npm audit --audit-level=high` reported **23 findings: 12 moderate and 11 high**. This is an npm dependency-tree count, **not** proof of 23 distinct exploitable vulnerabilities in the published extension.
- In the same run, `npm audit --omit=dev --audit-level=moderate` reported **zero vulnerabilities** for the resolved non-development dependency tree. This result **does not** mean the entire build/publisher toolchain is secure.
- [Earlier failing audit from PR #295](https://github.com/sanskarIN/LineLoom/actions/runs/44304748764) independently showed the same high-level breakdown. No source or path content is needed to reproduce the audit.
- The current checked-in `package.json` directly installs the runtime-only `ignore` package and uses `@vscode/vsce`, Vitest, ESLint, Vite's transitive build/test tools and other developer tools as development dependencies. The relevant exact `package-lock.json` entries below are marked `dev: true`.

| Locked package path | Version | Graph classification | Relevant audit finding or role |
| --- | --- | --- | --- |
| `node_modules/picomatch` | `4.0.7` | Development only | [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf), high-severity repeated-extglob ReDoS |
| `node_modules/micromatch/node_modules/picomatch` | `2.3.2` | Development only | Same advisory range; nested copy |
| `node_modules/glob` | `13.0.6` | Development only | [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4), cancellation/traversal advisory |
| `node_modules/minimatch` | `10.2.6` | Development only | [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), globparts amplification |
| `node_modules/uuid` | `8.3.2` | Development only | [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq), buffer bound check when supplying a buffer |
| `node_modules/@vscode/vsce` | `3.9.2` | Development only | Intentionally reviewed VSIX packaging baseline |
| `node_modules/@azure/identity` | `4.2.1` | Development only | Intentionally reviewed compatibility override |
| `node_modules/@azure/msal-node` | `2.16.3` | Development only | Compatible with the reviewed Azure Identity baseline |

The table is based on the committed lockfile at `main` commit `484fa5c544c08e062f9ce48a366cba615aa55873`. **It is not a fresh npm-registry patch-availability guarantee.** The picomatch high-severity advisory covers affected versions through 4.0.7 and did not provide a clearly established compatible fixed version at the time of this audit. Do not claim that an unknown upgrade resolves it.

## Exposure and temporary containment

A development-only package can still execute in CI, during VSIX packaging, or on a maintainer workstation. The runtime-only audit indicates that the named packages are not in the resolved non-dev npm graph, **not** that hostile input could never reach build tools. Assess supply-chain and untrusted glob-pattern exposure separately.

Until a compatible supported fix is verified:

1. Continue the production and complete-dependency audit jobs **without suppressing high-severity findings**. Keep failures visible; do not equate a green unit-test or compilation job with security clearance.
2. Avoid passing unreviewed external glob patterns, arbitrary user-supplied inputs or untrusted project archives into build/publisher tooling. Keep CI token permissions minimal and avoid running sensitive publishing credentials on untrusted pull-request code.
3. Do **not** use `npm audit fix --force` to switch Vitest or the VSIX publisher to an untested major version. Do not force an incompatible MSAL major under the intentionally pinned Azure Identity dependency.
4. When upstream provides usable fixes, regenerate the lockfile using npm in a clean checkout; validate the exact package graph with `npm ci`, reviewed VSIX packager compatibility, all cross-platform checks, mocked host tests, VSIX manifest/file-parity/checksum and clean install/upgrade.
5. Keep [#297](https://github.com/sanskarIN/LineLoom/issues/297) open until a reviewed remediation is proven. If upstream remains unpatched, require an **explicit, dated owner security decision** before any release exception; no such exception is granted by this document.

## Release-channel consequences

- The already published [GitHub v1.4.4 pre-release](https://github.com/sanskarIN/LineLoom/releases/tag/v1.4.4) is a historical artifact; its previous passing audit does not override **current** findings.
- The planned **v1.4.5 GitHub pre-release** must meet current release security gates or receive a separately documented owner-approved security decision; writing a release plan is not authorization.
- The conditional **v1.5.0 Stable** remains blocked by Microsoft publisher confirmation and completion, as well as current security, QA and owner approval. The Open VSX migration requires separate authorization and verification.
- No Marketplace, Open VSX, npm CLI or GitHub publication was performed during this audit triage.

Related: [packager compatibility history](vsce-advisory-mitigation.md), [publishing requirements](../qa/release-evidence.md), [planned v1.4.5 and v1.5.0 migration documentation](https://github.com/sanskarIN/LineLoom/pull/296) (pending review).
