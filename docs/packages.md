# LineLoom package-manager distribution

LineLoom's **VS Code extension** and optional **npm CLI installer** are different artifacts. The extension remains identified as `SanskarCodes.lineloom` on the VS Code Marketplace, Open VSX, and the existing GitHub VSIX releases. Package-manager distribution does not change or replace those listings.

## GitHub Packages npm installer

- GitHub scope/name: `@sanskarin/lineloom-cli`.
- Published package version: `0.1.0`; current CLI development candidate: `0.3.0` (independent of extension version; v0.2.0 was not published).
- Source: `packages/lineloom-cli/`.
- Target: GitHub's npm registry, `https://npm.pkg.github.com`; GitHub Packages attaches it to this repository via package metadata after a successful publish.
- No dependencies or automatic installation lifecycle scripts.
- Downloads only **pinned published** GitHub VSIX artifacts: stable v1.2.0 or opt-in preview v1.2.4. A new CLI release must explicitly review/version the pinned artifact digests.

**Published on GitHub Packages (2026-10-24):** [The package publishing workflow](https://github.com/sanskarIN/LineLoom/actions/runs/40085599452) completed successfully with `npm publish` reporting `+ @sanskarin/lineloom-cli@0.1.0` on `https://npm.pkg.github.com` and an independent audit reporting **0 vulnerabilities**. The package metadata links to this repository so GitHub can associate it with the repository's **Packages** section. Public visibility in the GitHub UI and an authenticated end-user install have **not** been independently verified. This package was **not** published on npmjs.com.

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

## Unpublished CLI candidates: v0.2.0 verification and v0.3.0 offline installation

CLI v0.2.0 adds a manual **offline verify** subcommand for downloaded release assets:

```sh
lineloom verify ./LineLoom-1.2.0.vsix
lineloom verify ./LineLoom-1.2.4.vsix --preview
```

It reads only a chosen local VSIX, enforces a 10 MiB bound and compares its SHA-256 with the pinned stable/preview digest. It cannot download, install or contact the Ollama service. **The current published v0.1.0 GitHub Packages CLI does not contain this feature.** Neither v0.2.0 nor v0.3.0 is published. Any future package publication requires fresh owner authorization and a version-specific workflow; the existing v0.1.0 authorization cannot publish newer CLI versions.

The newer **v0.3.0 development candidate** can install a downloaded, official VSIX entirely offline:

```sh
lineloom install --file ./LineLoom-1.2.0.vsix
lineloom install --file ./LineLoom-1.2.4.vsix --preview
```

The installer copies the selected regular file into a private temporary directory, compares the **staged bytes** against the pinned digest before running the editor, and cleans up afterwards. It has no network fallback and does not alter the chosen download. `--file` and `--dry-run` cannot be combined. The currently published v0.1.0 package cannot perform offline installation.

## CI and release process

1. PR and main-branch changes to `packages/lineloom-cli/**` trigger [package CI](../.github/workflows/package-check.yml) on Windows, macOS and Linux. It checks unit tests, offline behavior, a dry-run and the actual npm tarball contents.
2. Before the first GitHub Packages release, review package version, pinned extension SHA-256 digests, package security tests, and registry identity. Package CI is **not** a substitute for real desktop installation acceptance.
3. A separate, **explicitly owner-authorized** file `.github/package-publish-v0.1.0.flag` on `main` triggers [the one-time GitHub Packages publishing workflow](../.github/workflows/package-publish.yml). It validates identity/version and reruns package tests and an independent dependency audit before invoking npm publish.
4. Only that publisher job receives `packages: write` and the repository `GITHUB_TOKEN`. It cannot publish the VS Code extension to either registry and cannot publish on npmjs.com.
5. The first publisher workflow succeeded on 2026-10-24 and verified the package name/version, package-only audit and upload. Confirm the repository Packages link, public visibility and a real authenticated install separately; these manual checks remain outstanding.
6. Keep the extension v1.2.5 pre-release blocked on [security issue #79](https://github.com/sanskarIN/LineLoom/issues/79) and outstanding physical/manual Ollama and accessibility QA. Independent package publication doesn't waive those gates.

## Optional npmjs.com publication (separate action)

Public `npx` without GitHub Packages authentication needs **npmjs.com** publication, with ownership/control of the matching `@sanskarin` scope on npm. Don't assume GitHub account ownership grants npm account ownership. Choose and verify an owned npmjs scope, create the public package, then configure [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) with an explicitly authorized GitHub workflow using OIDC rather than a long-lived secret. The separate npmjs workflow must validate package identity, exact version, pinned hashes, and public provenance before publishing. Never switch `publishConfig.registry` in the GitHub Packages workflow implicitly or claim both registries are synchronized.

See [full extension publishing instructions](publishing.md).
