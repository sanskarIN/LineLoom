# Extension registry publishing (GitHub stable v1.0.0)

LineLoom is an **independent MIT-licensed VS Code extension**. Its GitHub repository is at https://github.com/sanskarIN/LineLoom. The project owner has selected the public publisher ID **SanskarCodes** (display name: **Sanskar**). The GitHub username **sanskarIN** is *not* the extension publisher ID.

**Current publication status (2026-10-19):** LineLoom **v1.0.0** is public on [Microsoft Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=SanskarCodes.lineloom) as **SanskarCodes.lineloom** and the independent [GitHub stable release](https://github.com/sanskarIN/LineLoom/releases/tag/v1.0.0). **Open VSX is not published/verified yet**; its namespace and registry upload require separate authorized action. No token, account credential, or registry secret belongs in this repository.

## Stable release package safety and required checks

- The default v1.0.0 VSIX is a **stable channel** package and must **not** include `--pre-release`. Use `npm run package:preview` only for future explicitly marked experimental updates.
- `package.json` must contain `"publisher": "SanskarCodes"`; changing this later changes the installed extension ID.
- `npm ci && npm run check`; on Linux CI run `xvfb-run -a npm run test:integration`.
- `npm audit --audit-level=high`; confirm test results before release.
- `npm run package` generates a stable VSIX by default. To choose an explicit destination, run:

```sh
npx vsce package --no-dependencies -o LineLoom-1.0.0.vsix
```

- For Windows, do not double-click the downloaded VSIX; Microsoft Visual Studio VSIX Installer is for a different product. Open Visual Studio Code → Extensions → … → **Install from VSIX…**. The user-friendly guide is at https://sanskarin.github.io/LineLoom/install.html.
- Inspect included files (`npx vsce ls --no-dependencies`) and the VSIX archive (`npm run verify:vsix -- LineLoom-1.0.0.vsix` on a Linux shell with `unzip`). Do not include secrets, personal files, or `node_modules`.
- The GitHub release workflow installs the VSIX in a **temporary VS Code CLI profile** and lists `SanskarCodes.lineloom`; this is not proof of real-model completion. See [manual QA evidence matrix](qa/v0.9.5-readiness.md).
- Install the exact VSIX in a fresh compatible VS Code user profile and test both automatic ghost text and accepting a suggestion with a **real** independently installed Ollama model. Repeat for all supported operating systems before claiming stable readiness.
- The GitHub v1.0.0 release is tagged **stable**, not pre-release. GitHub Releases never publish to external registries by themselves.

## Microsoft Visual Studio Marketplace — published

The v1.0.0 stable VSIX was uploaded through the **Sanskar (SanskarCodes)** publisher and its [public listing](https://marketplace.visualstudio.com/items?itemName=SanskarCodes.lineloom) is live.

1. In VS Code, open **Extensions** and search **LineLoom**; confirm publisher **SanskarCodes**, then click **Install**.
2. Or use `code --install-extension SanskarCodes.lineloom` in a terminal with the VS Code CLI installed.
3. For future **versioned updates**, use [Manage Publishers & Extensions](https://marketplace.visualstudio.com/manage/publishers/) under **SanskarCodes**; upload a new VSIX for the same extension ID instead of creating a second listing.
4. Verify the public listing's updated version, README, extension icon, MIT license, website and privacy links after each submission. A published GitHub release does not automatically update Marketplace.

**Public Marketplace listing:** https://marketplace.visualstudio.com/items?itemName=SanskarCodes.lineloom
**Publisher ID:** `SanskarCodes` · **Extension ID:** `SanskarCodes.lineloom`
**GitHub owner:** `sanskarIN` · **Release:** `v1.0.0`

Official guide: https://code.visualstudio.com/api/working-with-extensions/publishing-extension

Future automation should prefer Microsoft's documented OIDC/Entra workload-federation approach where available. Do not commit publishing credentials or PATs. Initial upload remains manual.

## Eclipse Open VSX (manual namespace and initial publication)

1. Sign in at https://open-vsx.org/ through GitHub (`sanskarIN`) and link the Eclipse Foundation account, including the Eclipse profile's GitHub Username `sanskarIN`.
2. Sign the Open VSX Publisher Agreement after reading it.
3. Ensure the `SanskarCodes` namespace exists and that the authenticated account has publishing rights. Creating a namespace **does not** necessarily verify exclusive ownership.
4. For a namespace ownership claim, follow the current Open VSX claim template; truthful proof matters. The Marketplace publisher now has a published extension with a public repository: provide the [Marketplace listing](https://marketplace.visualstudio.com/items?itemName=SanskarCodes.lineloom) and [GitHub repository](https://github.com/sanskarIN/LineLoom) as claim evidence where requested. Do not mark account age or ownership assertions without checking.
5. Only after permission is granted, authenticate with `ovsx` (or configure trusted OIDC publishing) and publish the **same verified** VSIX:

```sh
npx ovsx publish LineLoom-1.0.0.vsix
```

Follow your locally configured `ovsx` auth mechanism; tokens must not be committed or pasted into issues. Confirm `SanskarCodes.lineloom` on the registry before advertising it.

Official guide: https://github.com/eclipse-openvsx/openvsx/wiki/Publishing-Extensions

## Post-release verification and limitations

GitHub v1.0.0 and the Visual Studio Marketplace listing are public, but manual editor acceptance, real CPU/GPU Ollama measurements, offline use, privacy controls, and Windows/macOS/Linux hands-on model tests remain unverified and must not be described as passed. See `docs/qa/v0.9.5-readiness.md`. Open VSX is still a separate authorized upload and should not be advertised as published until verified.
