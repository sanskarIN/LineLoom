# Publishing LineLoom CLI to the public npm registry

This document covers the optional installer CLI, **`@sanskarin/lineloom-cli`**, not the VS Code extension itself. npmjs.com, GitHub Packages, the VS Code Marketplace and Open VSX are independent distribution channels. Publishing one does **not** publish the others or migrate the extension publisher ID.

## Current source and registry boundaries

- Source directory: [`packages/lineloom-cli/`](../packages/lineloom-cli).
- CLI source version when this guide was written: **0.3.0**. This is *not* a claim that npmjs.com serves it.
- GitHub Packages previously published **0.1.0** from a separate version-pinned workflow. Do not change [`package-publish.yml`](../.github/workflows/package-publish.yml) for npmjs.
- The CLI only installs hardcoded, checksum-pinned official VSIX versions; it does not automatically install the latest extension release. Review [the CLI README](../packages/lineloom-cli/README.md) for the supported pins.
- The checked-in CLI manifest has `publishConfig.registry=https://npm.pkg.github.com` intentionally. **Do not permanently change it to npmjs.** The npmjs workflow changes it only on a disposable GitHub Actions runner.

## One-time setup: npm account, scope and bootstrap publication

1. Sign in to [npmjs.com](https://www.npmjs.com/) with the account that will *own* the package. Enable **two-factor authentication**. The npm **personal scope** `@sanskarin` must belong to the npm user `sanskarin`; owning `sanskarIN` on GitHub does not grant ownership on npm. If that npm username belongs to someone else, **stop** and select a scope you control; update the package name, lockfile, tests, workflow and docs before publishing.
2. First determine whether `@sanskarin/lineloom-cli` already exists on **npmjs.com**, and whether your npm account owns it. Do not overwrite or assume that a GitHub Packages package of the same name exists on npmjs.
3. A brand-new package cannot have an npm Trusted Publisher configured yet: the first release must be published interactively (npm docs require the package to exist before `npm trust` configuration). Use a **clean local clone** of this repository to prepare that initial release and independently check its tests and pinned VSIX digests. At the time of writing the candidate source version is 0.3.0; only publish it after its release acceptance checks are complete.
4. In a terminal in `packages/lineloom-cli` (Node.js 24 recommended), run:

   ```sh
   npm install --global 'npm@^11.15.0'
   npm login --registry=https://registry.npmjs.org
   npm whoami --registry=https://registry.npmjs.org
   npm ci --ignore-scripts --no-audit
   npm test
   npm run check:pack
   npm run smoke:consumer
   npm audit --audit-level=high --registry=https://registry.npmjs.org
   ```

5. In that **local checkout only**, change the publish destination and validate it:

   ```sh
   npm pkg set publishConfig.registry=https://registry.npmjs.org publishConfig.access=public
   npm pkg get name version publishConfig
   npm run check:pack
   npm stage publish --access public --ignore-scripts --registry=https://registry.npmjs.org
   ```

   `npm stage publish` queues the candidate for review; it is **not publicly installable** until a package maintainer explicitly approves it with 2FA. On npmjs.com open your staged package, review its files, and approve it. If a new package is staged, npm may expose a `0.0.0-stage` placeholder while awaiting approval; **that is not the released CLI version**. If you choose direct manual publication instead, it also requires 2FA and an explicit release decision.

6. Verify the package page, version, tarball contents and a clean public-registry install **after approval**. Do not advertise an `npx` installation until that verification passes. The modified `package.json` from step 5 is only for the local npmjs bootstrap; do not commit it to `main`.

## Configure token-free staging for future CLI releases

Once the package exists on npmjs.com and is owned by your account:

1. On GitHub, open **LineLoom → Settings → Environments**, create an environment named **`npmjs`**, restrict deployments to `main`, and configure required reviewers when supported by your repository/account. This is an additional safety gate, not an npm registry credential.
2. Open the npm package's **Settings → Trusted publishing → GitHub Actions** and enter exactly:

   | Field | Value |
   | --- | --- |
   | Organization or user | `sanskarIN` |
   | Repository | `LineLoom` |
   | Workflow filename | `npmjs-stage.yml` |
   | Environment | `npmjs` |
   | Allowed actions | **Stage only** (`npm stage publish`) |

   The workflow filename must be given **without** `.github/workflows/`. The settings are case-sensitive. Newly created npm Trusted Publisher configurations must complete an initial successful trusted-publisher stage/publish within **two days** or they expire; if it expires, recreate it.

3. **No `NPM_TOKEN`, `NODE_AUTH_TOKEN` or GitHub secret is required for npm publishing in this workflow.** GitHub-hosted Actions supplies an OIDC token via `id-token: write`. The workflow uses Node 24, npm 11.15+, validates package metadata/lockfile, runs tests, audits the package, inspects the tarball and modifies the registry on the ephemeral runner only. npm supplies provenance for a public package published via supported OIDC trusted publishing.
4. For each later version, bump the CLI package **and lockfile** together, update/check tests and checksum pins if needed, merge passing CI into `main`, then open **Actions → Stage LineLoom CLI on npmjs (OIDC) → Run workflow**:
   - Branch: `main`
   - `version`: the exact current CLI manifest version (such as `0.3.1` **only if that version is actually committed and validated**).
   - `confirmation`: `STAGE_NPMJS_LINELOOM`
5. Review the GitHub Actions logs, then inspect and explicitly approve the staged candidate on npmjs.com with 2FA. Verify that npmjs lists the **exact** new version and test an unauthenticated install. The workflow intentionally does not publish automatically on push and does not change GitHub Packages, GitHub Releases or either extension marketplace.

After trusted publishing works, consider disallowing traditional token-based publishing under the npm package's **Settings → Publishing access**. This does **not** block correctly configured OIDC trusted publishing.

## What users can run after npmjs publication is verified

If a user previously configured the `@sanskarin` scope for GitHub Packages, they must first remove that mapping from their **own** npm config to use the public npmjs registry:

```sh
npm config delete @sanskarin:registry
npm config get @sanskarin:registry
npm install --global @sanskarin/lineloom-cli --registry=https://registry.npmjs.org
lineloom install --dry-run
lineloom install
```

Without a global install:

```sh
npm exec --yes --registry=https://registry.npmjs.org --package=@sanskarin/lineloom-cli -- lineloom --help
```

Installing the npm CLI **does not** automatically install the VS Code extension. The user must explicitly invoke `lineloom install`; the CLI installs only pinned, SHA-256-verified releases.

## Troubleshooting

- `ENEEDAUTH`: confirm you actually own the package on npm, the trusted publishing configuration exists, and the workflow's exact owner/repository/filename/environment match. OIDC cannot bootstrap a not-yet-existing npm package.
- `E403` or scope permission error: confirm npm account ownership of `@sanskarin`; GitHub identity alone is insufficient.
- Attempt to re-publish an existing package version: npm versions are immutable; bump the package version and lockfile, validate, and use a new staging run.
- Package unexpectedly targeting GitHub Packages: check the **local** `publishConfig.registry` and `npm config get @sanskarin:registry`. Keep the checked-in GitHub Packages configuration intact.
- Staged run succeeded but package not installable: it may still require the npm maintainer's 2FA approval and post-release validation.

References: [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/), [npm Staged Publishing](https://docs.npmjs.com/staged-publishing/) and [GitHub Actions npm OIDC guidance](https://github.com/actions/setup-node/blob/main/docs/advanced-usage.md).
