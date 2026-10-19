# Extension registry publishing (pre-release only)

LineLoom is an **independent MIT-licensed VS Code extension**. Its GitHub repository is at https://github.com/sanskarIN/LineLoom. The project owner has selected the public publisher ID **SanskarCodes** (display name: **Sanskar**). The GitHub username **sanskarIN** is *not* the extension publisher ID.

**Current publication status:** GitHub publishes the VSIX as a pre-release. Do **not** claim that VS Code Marketplace or Open VSX listings exist until each listing is actually visible. Publishing to either registry requires the publisher's own authenticated action. No token, account credential, or registry secret belongs in this repository.

## Preview safety and required checks

- Keep the extension on `0.x` and use `--pre-release` when creating VSIX assets for marketplace beta/pre-release channels.
- `package.json` must contain `"publisher": "SanskarCodes"`; changing this later changes the installed extension ID.
- `npm ci && npm run check`; on Linux CI run `xvfb-run -a npm run test:integration`.
- `npm audit --audit-level=high`; confirm test results before release.
- `npm run package` generates a pre-release VSIX by default. To choose an explicit destination, run:

```sh
npx vsce package --pre-release --no-dependencies -o LineLoom-0.9.4.vsix
```

- For Windows, do not double-click the downloaded VSIX; Microsoft Visual Studio VSIX Installer is for a different product. Open Visual Studio Code → Extensions → … → **Install from VSIX…**. The user-friendly guide is at https://sanskarin.github.io/LineLoom/install.html.\n- Inspect included files (`npx vsce ls --no-dependencies`) and the VSIX archive (`npm run verify:vsix -- LineLoom-0.9.4.vsix` on a Linux shell with `unzip`). Do not include secrets, personal files, or `node_modules`.
- Install the exact VSIX in a fresh compatible VS Code user profile and test both automatic ghost text and accepting a suggestion with a **real** independently installed Ollama model. Repeat for all supported operating systems before claiming stable readiness.
- The GitHub release pipeline uses `--prerelease` and `--latest=false`. Neither setting publishes to external registries, and neither substitutes for the VSIX `--pre-release` option.

## Microsoft Visual Studio Marketplace (manual initial publication)

1. Visit https://marketplace.visualstudio.com/manage/publishers/ and sign in as an authorized owner of the publisher **SanskarCodes**.
2. Choose **New extension -> Visual Studio Code** (not the separate full Visual Studio extension format).
3. Upload the verified `LineLoom-0.9.4.vsix` from the GitHub v0.9.4 release. It is packaged with VS Code's `--pre-release` metadata.
4. Verify the listing, selected pre-release channel, icon, license, README, repository link, privacy notice and installation guidance. If review or publication is pending, do not advertise a public listing.
5. Store links may be added to the README **after** they resolve to a published page.

Official guide: https://code.visualstudio.com/api/working-with-extensions/publishing-extension

Future automation should prefer Microsoft's documented OIDC/Entra workload-federation approach where available. Do not commit publishing credentials or PATs. Initial upload remains manual.

## Eclipse Open VSX (manual namespace and initial publication)

1. Sign in at https://open-vsx.org/ through GitHub (`sanskarIN`) and link the Eclipse Foundation account, including the Eclipse profile's GitHub Username `sanskarIN`.
2. Sign the Open VSX Publisher Agreement after reading it.
3. Ensure the `SanskarCodes` namespace exists and that the authenticated account has publishing rights. Creating a namespace **does not** necessarily verify exclusive ownership.
4. For a namespace ownership claim, follow the current Open VSX claim template; truthful proof matters. Because the Microsoft Marketplace publisher already exists, its **publisher with published extension/repository** evidence route is preferable *after* publishing LineLoom to Marketplace. Do not mark account age or ownership assertions without checking.
5. Only after permission is granted, authenticate with `ovsx` (or configure trusted OIDC publishing) and publish the **same verified** VSIX:

```sh
npx ovsx publish LineLoom-0.9.4.vsix
```

Follow your locally configured `ovsx` auth mechanism; tokens must not be committed or pasted into issues. Confirm `SanskarCodes.lineloom` on the registry before advertising it.

Official guide: https://github.com/eclipse-openvsx/openvsx/wiki/Publishing-Extensions

## Stable v1.0.0 gate

The `docs/releases/v1.0.0.md` checklist remains **BLOCKED** until manual editor install/acceptance checks, real CPU/GPU Ollama measurements, offline tests, privacy behavior, and Windows/macOS/Linux smoke tests are recorded. Having store listings is not proof of model or code-completion quality. Never create a stable GitHub or marketplace release merely because an automated packaging check passes.
