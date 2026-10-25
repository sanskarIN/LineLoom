# @sanskarin/lineloom-cli

Optional npm-formatted **installer CLI** for [LineLoom](https://sanskarin.github.io/LineLoom/). This package is not the extension's source or bundled VSIX. It downloads an official published GitHub VSIX, verifies a hardcoded, independently checked SHA-256 digest, then invokes your editor's native extension installer without a shell.

- Default: LineLoom **v1.2.0 GitHub stable**.
- Opt-in --preview: LineLoom **v1.2.4 GitHub pre-release**.
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

**The source is now CLI v0.3.0 (development, not published).** GitHub Packages currently serves v0.1.0; neither the v0.2.0 offline verification nor v0.3.0 offline installation commands are published.

## Offline VSIX verification (v0.2.0 candidate)

After manually downloading a published VSIX, check its bytes against the embedded official release digest without a network request or installing it:

```sh
lineloom verify ./LineLoom-1.2.0.vsix
lineloom verify ./LineLoom-1.2.4.vsix --preview
```

The verifier requires a regular local .vsix file, has a 10 MiB file size cap, and rejects any checksum mismatch. **These commands are not yet in published CLI v0.1.0.** CLI versions are independent of the extension version. Installing this npm package does not run an automatic extension install; explicitly run `lineloom install`. Distribution through **npmjs.com** requires separate npm scope ownership and publication. Read [package distribution notes](https://github.com/sanskarIN/LineLoom/blob/main/docs/packages.md).

## Offline VSIX installation (v0.3.0 source candidate)

Install an already-downloaded official release with **no HTTP requests**:

```sh
lineloom install --file ./LineLoom-1.2.0.vsix
lineloom install --file ./LineLoom-1.2.4.vsix --preview
lineloom install --file ./LineLoom-1.2.0.vsix --editor codium
```

This command accepts a regular local VSIX, copies it into a private, bounded temporary file, verifies the **staged bytes** against the built-in stable/preview SHA-256 digest, and only then invokes a supported editor CLI. Invalid/tampered downloads are rejected; the temporary copy is removed after success or failure, and the original file is unchanged. `--file` cannot be combined with `--dry-run`. **Not available in the published CLI v0.1.0.** This command neither downloads a VSIX nor contacts Ollama.
