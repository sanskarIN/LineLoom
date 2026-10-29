# LineLoom package-manager distribution

LineLoom's **VS Code extension** and optional **npm CLI installer** are different artifacts. The extension remains identified as `SanskarCodes.lineloom` on the VS Code Marketplace, Open VSX, and the existing GitHub VSIX releases. Package-manager distribution does not change or replace those listings.

## GitHub Packages npm installer

- GitHub scope/name: `@sanskarin/lineloom-cli`.
- Published GitHub Packages version: **`0.1.0`**. Source-only CLI **`0.2.0`** (offline verify) is merged but unpublished; **`0.3.0`** (offline install) is implemented in [development PR #92](https://github.com/sanskarIN/LineLoom/pull/92), not a published command. CLI versions are independent of the extension version.
- Source: `packages/lineloom-cli/`.
- Target: GitHub's npm registry, `https://npm.pkg.github.com`; GitHub Packages attaches it to this repository via package metadata after a successful publish.
- No dependencies or automatic installation lifecycle scripts.
- The **published v0.1.0 CLI** pins older, individually reviewed GitHub artifacts: stable v1.2.0 and opt-in preview v1.2.4. **The newer GitHub extension stable is v1.3.0**; do not assume `lineloom install` downloads it until the CLI's independently reviewed pinset and package version are updated.

**Published on GitHub Packages (2026-10-24):** [The package publishing workflow](https://github.com/sanskarIN/LineLoom/actions/runs/40085599452) completed successfully with `npm publish` reporting `+ @sanskarin/lineloom-cli@0.1.0` on `https://npm.pkg.github.com` and an independent audit reporting **0 vulnerabilities**. The package metadata links to this repository so GitHub can associate it with the repository's **Packages** section. Public visibility in the GitHub UI and an authenticated end-user install have **not** been independently verified. This package was **not** published on npmjs.com.

## Distribution and feature availability at a glance

| Artifact | Public release status | What it supports |
| --- | --- | --- |
| GitHub extension VSIX | **v1.3.0 stable published** | Explicitly selected related-file context, native sidebar, privacy controls |
| GitHub Packages `@sanskarin/lineloom-cli` | **v0.1.0 published** | Checksum-pinned download/install for older release VSIX versions; not automatically v1.3.0 |
| CLI `verify` | **v0.2.0 source only, unpublished** | Verify a manually downloaded pinned VSIX |
| CLI `install --file` | **v0.3.0 development-source candidate (unpublished)** | Offline installation from a manually downloaded, checksum-verified official VSIX |
| npmjs.com / Marketplace / Open VSX | **Independent registries** | Verify each live listing; no publication implied by GitHub release or GitHub Packages |

The [future release roadmap](roadmap.md) tracks upgrades and acceptance; consult [PR #92 checks](https://github.com/sanskarIN/LineLoom/pull/92) for integration evidence. Distribution remains independently gated.

## Install or execute with npm

Node.js 22+ and a VS Code-compatible editor CLI (`code`, `code-insiders`, or `codium`) must already be installed. GitHub Packages currently requires authenticated npm access even for public packages. Follow [GitHub's official npm registry authentication guide](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry) to configure package-read access in your *user* npm configuration; never commit access tokens or a token-bearing `.npmrc`.

```sh
npm config set @sanskarin:registry https://npm.pkg.github.com
npm install --global @sanskarin/lineloom-cli
lineloom install --dry-run
lineloom install
lineloom install --preview
lineloom install --editor codium
```

With the same authenticated scope configuration, `npm exec --package=@sanskarin/lineloom-cli -- lineloom install --dry-run` avoids global installation. Other npm-compatible clients such as pnpm can resolve the same registry package if correctly authenticated; no independent pnpm registry publish is necessary.

**Security controls:** Explicit command invocation only; release manifests are version-pinned; all redirects are restricted to GitHub asset hosts; downloads are size-limited and SHA-256-verified before editor installation; editor commands use an allowlist and no shell; temporary files are removed. The CLI sends no project data to an inference provider and never downloads a model.

## Unpublished CLI v0.2.0 verify and v0.3.0 offline-install source

CLI v0.2.0 adds a manual **offline verify** subcommand for downloaded release assets:

```sh
lineloom verify ./LineLoom-1.2.0.vsix
lineloom verify ./LineLoom-1.2.4.vsix --preview
```

The v0.2.0 **source-only** verify command reads a chosen local VSIX, enforces a 10 MiB bound and compares its SHA-256 with an existing pinned stable/preview digest. It cannot download, install or contact Ollama. The [v0.3.0 development PR #92](https://github.com/sanskarIN/LineLoom/pull/92) adds a separate offline `install --file ./LineLoom-1.2.0.vsix` operation using a bounded staged copy and checksum verification. For local development builds of CLI v0.3.0, `--file` installs only the byte-for-byte pinned official VSIX already on disk. It does not download anything:\n\n```sh\nlineloom install --file ./LineLoom-1.2.0.vsix\nlineloom install --file ./LineLoom-1.2.4.vsix --preview\n```\n\nFile verification occurs on a private staged copy before the supported editor CLI runs; neither a missing file nor a checksum mismatch can fall back to an online download. The source still pins **extension v1.2.0 stable and v1.2.4 preview**; it does not silently follow the latest GitHub releases. These commands require building/running the unpublished development source, and have **not** been included in the published package.\n\n**Neither CLI 0.2.0 nor 0.3.0 is available in the published v0.1.0 GitHub Packages artifact.** Do not copy or run the proposed commands using the published v0.1.0 package. Publication of either later CLI version requires independent package/security validation, real-editor installation evidence, a new authorization and a new version-specific publishing gate.

## CI and release process

1. PR and main-branch changes to `packages/lineloom-cli/**` trigger [package CI](../.github/workflows/package-check.yml) on Windows, macOS and Linux. It checks unit tests, offline behavior, a dry-run and the actual npm tarball contents.
2. Before the first GitHub Packages release, review package version, pinned extension SHA-256 digests, package security tests, and registry identity. Package CI is **not** a substitute for real desktop installation acceptance.
3. A separate, **explicitly owner-authorized** file `.github/package-publish-v0.1.0.flag` on `main` triggers [the one-time GitHub Packages publishing workflow](../.github/workflows/package-publish.yml). It validates identity/version and reruns package tests and an independent dependency audit before invoking npm publish.
4. Only that publisher job receives `packages: write` and the repository `GITHUB_TOKEN`. It cannot publish the VS Code extension to either registry and cannot publish on npmjs.com.
5. The first publisher workflow succeeded on 2026-10-24 and verified the package name/version, package-only audit and upload. Confirm the repository Packages link, public visibility and a real authenticated install separately; these manual checks remain outstanding.
6. **Current extension stable is GitHub v1.3.0** (published with explicit QA limitations); v1.2.5 was an integrated source milestone, not a standalone public release. Continue [packager security follow-up #79](https://github.com/sanskarIN/LineLoom/issues/79), [v1.3.0 manual acceptance #66](https://github.com/sanskarIN/LineLoom/issues/66), and manual real-model/accessibility evidence. CLI publication never waives those separate gates.

## Optional npmjs.com publication (separate action)

Public `npx` without GitHub Packages authentication needs **npmjs.com** publication, with ownership/control of the matching `@sanskarin` scope on npm. Don't assume GitHub account ownership grants npm account ownership. Choose and verify an owned npmjs scope, create the public package, then configure [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) with an explicitly authorized GitHub workflow using OIDC rather than a long-lived secret. The separate npmjs workflow must validate package identity, exact version, pinned hashes, and public provenance before publishing. Never switch `publishConfig.registry` in the GitHub Packages workflow implicitly or claim both registries are synchronized.

See [full extension publishing instructions](publishing.md).
