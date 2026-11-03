# VSIX packaging dependency mitigation — shipped in GitHub v1.3.0

**Status 2026-10-25:** The reviewed compatibility configuration was integrated into the [GitHub v1.3.0 stable release](https://github.com/sanskarIN/LineLoom/releases/tag/v1.3.0). The independent GitHub release publisher and high-severity audit passed, but **four moderate dev-tool transitive findings remain under review** in [issue #79](https://github.com/sanskarIN/LineLoom/issues/79). Real marketplace publisher authentication, actual Ollama model quality and physical operating-system acceptance are **NOT VERIFIED**; v1.3.0 GitHub publication does not approve either external registry.

## Why this change exists

The formerly installed `@vscode/vsce@4.0.0` (dev-only packager/publisher) resolves `@azure/identity@4.14.0` and `@azure/msal-node@6.0.1`, triggering high-severity [GHSA-xcx6-jx8p-x3h5](https://github.com/advisories/GHSA-xcx6-jx8p-x3h5). MSAL Node 7.1.0+ fixes the issue, but Azure Identity 4.14.0 depends on an older, incompatible MSAL major. We do not force an MSAL 7 override into Azure Identity 4.14.0.

## Compatibility configuration used by v1.3.0

- Pin direct development packaging dependency `@vscode/vsce@3.9.2`.
- Temporarily select `@azure/identity@4.2.1` via an npm override, within the older VSIX tool's declared `^4.1.0` supported range. Its resulting transitive `@azure/msal-node@2.16.3` is **outside the vulnerable range of this particular high-severity advisory**.
- Commit the **npm-generated reproducible lockfile**, not a hand-modified transitive graph.
- The project-specific `test:packager-security` guards this reviewed pairing. The independent npm audit remains authoritative for newly disclosed vulnerabilities. Do not downgrade/override unrelated packages to silence checks.

The isolated [compatibility experiment](https://github.com/sanskarIN/LineLoom/actions/runs/40175617026) passed `npm ci --ignore-scripts`, `npm audit --audit-level=high`, `npm run check`, and an actual VSIX packaging + archive/manifest verification.

**Caveat:** It still reported **four moderate-severity npm audit findings** associated with the old package graph (including transitive `uuid`). A passing *high-threshold* audit does not equal zero advisories. All four findings are in the dev-time packaging chain `@vscode/vsce -> @azure/identity -> @azure/msal-node -> uuid`, not four separate newly found root-package advisories. The direct underlying advisory is [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) for `uuid < 11.1.1`; transitive packages inherit audit findings. `npm audit --omit=dev --audit-level=moderate` separately checks dependencies that could ship in an extension, while the full audit continues to block high/critical risk.

The old release tool also introduces more packages and a different publishing/authentication implementation. Before allowing actual publication, test the authorized GitHub release workflow in an isolated no-credential smoke and verify publisher authentication using an approved, non-production workflow that never exposes tokens.

## 2026-11-02 recheck: no authorized stable upgrade yet

The npm registry now lists newer `@vscode/vsce` releases and Azure Identity
`4.14.1`; an upstream Azure Identity changelog previews a transition to
`@azure/msal-node ^7.1.0` in **4.15.0-beta.2 (unreleased)**. The existence of
a newer tool version does **not** establish a tested, supported replacement
dependency graph or compatible publishing authentication. In particular,
forcing MSAL 7 under this repository's reviewed Identity 4.2.1 (`^2.9.2`)
is incompatible. The independently verified current lockfile continues to
resolve development-only `vsce@3.9.2`, Identity `4.2.1` and MSAL
`2.16.3`. The older MSAL 2 series falls **outside the affected version range
of GHSA-xcx6-jx8p-x3h5**; that is not a claim of zero vulnerabilities
elsewhere in the dependency graph.

The extra guard in this repository now checks **every locked copy** of the
VSIX packager, Azure Identity and MSAL Node, not only one top-level
`node_modules` path. It fails closed if another nested copy appears, if
the reviewed dependency relationships change, if the locked MSAL version
does not satisfy the actual `^2.9.2` constraint or if these packages stop
being development-only. A patched MSAL 7.x version is not automatically
interchangeable with the pinned Identity 4.2.1 merely because it is outside
the vulnerability range. Unit tests exercise these failure cases.

This is defense in depth against drift in a **committed lockfile** and does
not replace the independent `npm audit` gate, an upstream vulnerability
review, `npm ci`, artifact integrity checks, or credentials-safe VSIX
publisher testing. The existing moderate advisory findings still require
tracking. No secret tokens or real publishing authentication were used
for this source-only change. A future upgrade must be a separate,
npm-generated lockfile PR with explicit dependency-edge review, cross-OS
CI, a high-severity npm audit, real package/install checks and separately
authorized credential-safe publishing QA. Issue #79 remains open.

Source references: [Azure Identity release history](https://github.com/Azure/azure-sdk-for-js/blob/main/sdk/identity/identity/CHANGELOG.md),
[upstream VSIX package](https://github.com/microsoft/vscode-vsce),
[MSAL advisory](https://github.com/advisories/GHSA-xcx6-jx8p-x3h5).

## Exit criteria

- Review exact lockfile graph and four moderate transitive audit findings, including whether to use a more recent supported publisher package.
- Pass regular Linux/macOS/Windows CI and VSIX clean-install/upgrade tests with the *committed* lockfile and scripts.
- Confirm `vsce publish` authentication compatibility through an authorized secure test; never print credentials in public logs.
- Prefer upgrading to supported patched upstream VSIX/Azure dependencies when available; replace the temporary override instead of keeping an outdated packager indefinitely.
- Do not authorize **future version tags or registry publishing** based solely on an earlier GitHub v1.3.0 CI success. Review new dependency changes, publishing authentication, manual QA gaps and the explicit owner authorization for each target channel.
