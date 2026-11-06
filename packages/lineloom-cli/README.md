# @sanskarin/lineloom-cli

Optional npm-formatted **installer CLI** for [LineLoom](https://sanskarin.github.io/LineLoom/). This package is not the extension's source or bundled VSIX. It downloads an official published GitHub VSIX, verifies a hardcoded, independently checked SHA-256 digest, then invokes your editor's native extension installer without a shell.

- Development source default: LineLoom **v1.3.0 GitHub stable**.
- Development source with `--preview`: LineLoom **v1.4.3 GitHub pre-release**, pinned to **SanskarCodes** by default. To opt into the separate **Sanskar.lineloom** preview identity, explicitly add `--publisher Sanskar` (requires `--preview`). Both assets have independent SHA-256 pins.
- No runtime npm dependencies, no lifecycle install scripts, no code uploads.
- Node.js **22+** and a supported editor command on PATH are required.

## Installing from GitHub Packages

The package is published to GitHub Packages only after the release workflow succeeds. GitHub's npm registry requires package-read authentication: consult [GitHub's npm registry guide](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry), and keep personal access tokens outside committed configuration. Set the scope registry and authenticate securely before installing:

```sh
npm config set @sanskarin:registry https://npm.pkg.github.com
npm install --global @sanskarin/lineloom-cli
lineloom install --dry-run
lineloom install
lineloom install --preview
lineloom install --editor codium
```

A temporary file is erased after installation. Digest mismatch, unsafe redirects, oversized files and missing editors prevent installation.

**The source is CLI v0.3.0 (development, not published)** with updated stable/preview VSIX pins. GitHub Packages currently serves v0.1.0 with the **older** v1.2.0/v1.2.4 pins; neither the v0.2.0 offline verification, v0.3.0 offline installation, nor the updated pins are available in that published package.

## Offline VSIX verification (v0.2.0 candidate)

After manually downloading a published VSIX, check its bytes against the embedded official release digest without a network request or installing it:

```sh
lineloom verify ./LineLoom-1.3.0.vsix
lineloom verify ./LineLoom-1.4.3-SanskarCodes.vsix --preview
lineloom verify ./LineLoom-1.4.3-Sanskar.vsix --preview --publisher Sanskar
```

The verifier requires a regular local .vsix file, has a 10 MiB file size cap, and rejects any checksum mismatch. **These commands are not yet in published CLI v0.1.0.** CLI versions are independent of the extension version. Installing this npm package does not run an automatic extension install; explicitly run `lineloom install`. Distribution through **npmjs.com** requires separate npm scope ownership and publication. Read [package distribution notes](../../docs/packages.md) and the [npmjs.com first-publish / trusted-publishing guide](../../docs/npmjs-publishing.md). Do not assume the source CLI is available through public npm until a maintainer completes the manual bootstrap and approval.

## Offline VSIX installation (v0.3.0 source candidate)

Install an already-downloaded official release with **no HTTP requests**:

```sh
lineloom install --file ./LineLoom-1.3.0.vsix
lineloom install --file ./LineLoom-1.4.3-SanskarCodes.vsix --preview
lineloom install --file ./LineLoom-1.4.3-Sanskar.vsix --preview --publisher Sanskar
lineloom install --file ./LineLoom-1.3.0.vsix --editor codium
```

The v1.4.3 preview uses the existing `SanskarCodes` identity **by default**. The `--publisher Sanskar` flag is a deliberate opt-in to install or verify a distinct VSIX with its own digest; `--publisher Sanskar` without `--preview` fails closed. To inspect the exact destination **without downloading or installing**, run:

```sh
node bin/lineloom.mjs install --preview --publisher Sanskar --dry-run
```

Before installing that new publisher ID, back up your `lineloom.*` settings, **uninstall `SanskarCodes.lineloom`** and reload VS Code as described in [the migration guide](../../docs/publisher-migration.md). Two enabled copies can register conflicting commands and completion providers.

**New migration safety check (development source):** For an actual `--preview --publisher Sanskar` install, the CLI first runs the selected editor's `--list-extensions` command without a shell. If `SanskarCodes.lineloom` is still installed, the editor cannot list its extensions, or the check fails, installation is refused **before downloading or staging the VSIX**. A merely disabled old extension is still reported as installed; uninstall it to pass the check. The check runs in the selected editor (`code`, `code-insiders` or `codium`), so verify the relevant editor profile yourself. `--dry-run` and `verify` do not inspect installed extensions or change the editor. The default `SanskarCodes` installer path does not gain this new requirement.

The CLI does **not** uninstall old extensions, migrate extension-private settings or publish either marketplace listing.

This command accepts a regular local VSIX, copies it into a private, bounded temporary file, verifies the **staged bytes** against the built-in stable/preview SHA-256 digest, and only then invokes a supported editor CLI. Invalid/tampered downloads are rejected; the temporary copy is removed after success or failure, and the original file is unchanged. `--file` cannot be combined with `--dry-run`. **Not available in the published CLI v0.1.0.** This command neither downloads a VSIX nor contacts Ollama.
