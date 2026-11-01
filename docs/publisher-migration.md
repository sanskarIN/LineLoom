# LineLoom publisher migration: SanskarCodes → Sanskar

**Status: GitHub v1.4.3 dual-publisher pre-release published November 1, 2026; marketplace transfer remains incomplete.**
The original extension identity is `SanskarCodes.lineloom`. The proposed
new identity is `Sanskar.lineloom`. Publisher ownership and publication
must be completed separately on **each** registry; an unverified new
Marketplace/Open VSX URL is not evidence of a live downloadable listing.

## Why this is a reinstall, not an automatic update

A VS Code extension is identified by `publisher.name`. Therefore the two
identifiers are **different extensions** and can temporarily coexist, even
when their code and version match. VS Code does not automatically transfer
existing installs, reviews, download counts, sync state or extension-private
storage to the new publisher. Publishing `Sanskar.lineloom` does not
replace `SanskarCodes.lineloom` in either registry.

## Before switching

1. In VS Code Settings, review your `lineloom.*` preferences, excluded paths,
   model selection and any per-language overrides. Keep a settings backup.
2. If you previously allowed a remote Ollama endpoint, the new extension may
   require **fresh approval**; never copy secrets or internal approval state.
3. Download the independently verified `Sanskar` VSIX only from a published
   [v1.4.3 GitHub pre-release](https://github.com/sanskarIN/LineLoom/releases/tag/v1.4.3). Download
   [LineLoom-1.4.3-Sanskar.vsix](https://github.com/sanskarIN/LineLoom/releases/download/v1.4.3/LineLoom-1.4.3-Sanskar.vsix) and
   [its SHA-256 checksum](https://github.com/sanskarIN/LineLoom/releases/download/v1.4.3/LineLoom-1.4.3-Sanskar.sha256) and verify the digest before installing.
4. Open Extensions in VS Code and **uninstall** `SanskarCodes.lineloom` before
   enabling `Sanskar.lineloom`. Reload VS Code to clear old command/provider
   registrations. Do not keep two enabled copies: the command IDs and
   configuration namespace are shared, which can cause conflicts.
5. In VS Code Extensions → `...` → **Install from VSIX…**, choose the verified
   `LineLoom-1.4.3-Sanskar.vsix` and reload if asked. Do not open the file
   with Visual Studio's (different product) VSIX Installer.
6. Revisit settings, ensure path exclusions and `lineloom.allowRemoteEndpoints`
   are correct, start your own Ollama, select the model, and test a local file.
   Existing `lineloom.*` user settings may remain in VS Code settings.json,
   but extension-private globalState does **not** automatically migrate.

For CLI users **after the new listing exists**:

```sh
code --uninstall-extension SanskarCodes.lineloom
code --install-extension Sanskar.lineloom
```

For a manually downloaded and checksum-verified GitHub VSIX:

```sh
code --uninstall-extension SanskarCodes.lineloom
code --install-extension ./LineLoom-1.4.3-Sanskar.vsix
```

The corresponding package for users **staying on the old publisher** is
`LineLoom-1.4.3-SanskarCodes.vsix` (also a GitHub testing preview). Its
same-ID upgrades must still be tested separately. The current stable
GitHub extension remains
[v1.3.0 under SanskarCodes](https://github.com/sanskarIN/LineLoom/releases/tag/v1.3.0).

## Publisher creation and upload checklist for the maintainer

1. Create/claim the exact publisher ID **Sanskar** in
   [Visual Studio Marketplace publisher management](https://marketplace.visualstudio.com/manage).
   Separately create/verify the **Sanskar** namespace in
   [Open VSX](https://open-vsx.org/). Availability/ownership is **not verified**.
2. Use the signed-in publisher's proper publish credentials, stored privately.
   Do not put publishing tokens in GitHub commits, public logs or release assets.
3. Obtain both `LineLoom-1.4.3-*.vsix` archives and corresponding SHA-256 files
   from the [published GitHub v1.4.3 pre-release](https://github.com/sanskarIN/LineLoom/releases/tag/v1.4.3). Confirm the new VSIX
   contains `publisher: "Sanskar"`, `name: "lineloom"` and the real
   preview-channel marker; the old VSIX must contain `SanskarCodes`.
4. Publish **only** the matching `Sanskar` package to the **Sanskar**
   publisher on each registry. If also publishing under **SanskarCodes**,
   use the separate legacy VSIX, never upload one identity to both.
5. Verify both newly published listings, versions, downloadability and
   publisher namespaces independently before changing homepage primary
   buttons from the current verified `SanskarCodes` listings.
6. Communicate the manual migration, prompt users to back up settings and
   avoid two concurrently enabled copies. Maintain a rollback link.

Useful references:
[release/publishing guide](publishing.md) ·
[website migration steps](https://sanskarin.github.io/LineLoom/publisher-migration.html) ·
[existing Marketplace listing](https://marketplace.visualstudio.com/items?itemName=SanskarCodes.lineloom) ·
[existing Open VSX listing](https://open-vsx.org/extension/SanskarCodes/lineloom).

This procedure neither trains a new LineLoom Code model nor publishes to
any marketplace automatically.
