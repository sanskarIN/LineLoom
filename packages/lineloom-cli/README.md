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

**This CLI has its own version (0.1.0), independent of LineLoom's extension version.** Installing this npm package does not run an automatic extension install; explicitly run `lineloom install`. Distribution through **npmjs.com** requires separate npm scope ownership and publication. Read [package distribution notes](https://github.com/sanskarIN/LineLoom/blob/main/docs/packages.md).
