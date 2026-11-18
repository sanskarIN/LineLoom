# LineLoom publisher migration: SanskarCodes → Sanskar

**Status (November 18, 2026): the maintainer confirmed Owner access to the existing `Sanskar` Microsoft Visual Studio Marketplace publisher on November 8. A publisher-transfer support email was sent on November 18, but no approved transfer decision or completed migration has been verified. No `Sanskar.lineloom` Marketplace listing is verified. Open VSX namespace ownership/publication are independent and unverified. GitHub v1.4.4 was published as a dual-publisher pre-release on November 8; no external registry upload is implied.**
The original extension identity is `SanskarCodes.lineloom`. The proposed
new identity is `Sanskar.lineloom`. Publisher ownership and publication
must be completed separately on **each** registry; an unverified new
Marketplace/Open VSX URL is not evidence of a live downloadable listing.

## Release decisions: v1.4.5 preview, v1.5.0 Stable, then Open VSX

- **v1.4.5 is a planned GitHub pre-release migration-preparation milestone**, not a published version. Document user settings/installation/rollback and perform independently reviewed two-publisher packaging tests. It does **not** authorize a Microsoft Marketplace or Open VSX publication, nor imply that Microsoft has approved a transfer. [v1.4.5 release plan](releases/v1.4.5-plan.md).
- **v1.5.0 Stable is blocked** until Microsoft supplies a supported publisher reassignment decision, the accepted migration is completed and its public listing/installation behavior verified, and security, QA and owner release approval pass. A support response without completion is not enough. [v1.5.0 stable gate](releases/v1.5.0-plan.md).
- **Open VSX is a separate later workstream**, with its own `Sanskar` namespace ownership, registry instructions, publishing permission, independent evidence and separate approval. Microsoft's decision does not transfer Eclipse permissions. [Open VSX migration plan](open-vsx-migration.md).
- **Do not delete, unpublish or supersede the existing public identity** while the migration route or update/rollback implications are unknown. Never infer that an old extension installation receives a new publisher ID automatically.

**Support record:** request sent 2026-11-18 asking about official transfer, name collision, install/review continuity and preservation of the existing listing. The request is **not** evidence of an accepted transfer. Keep any future reply/case identifier privately; summarize only the approved technical outcome publicly.

## Marketplace name-collision gate (do not delete the old extension)

Microsoft's [official VS Code publishing guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
warns that extension names and display names must be unique in the Marketplace.
Even though the maintainer now owns publisher `Sanskar`, attempting to create
`Sanskar.lineloom` alongside `SanskarCodes.lineloom` can be rejected as a
name collision. **Do not remove the old listing to free its name:** Microsoft's
guide also says removing an extension permanently reserves the name.

Before any `Sanskar` Marketplace upload, obtain Microsoft's response to the
**Contact Microsoft** transfer request sent 2026-11-18. Ask for the exact
supported publisher reassignment procedure and whether installs/reviews can be
preserved. Do not assume such a transfer is supported or completed. If Microsoft
cannot transfer the exact ID, obtain explicit owner approval for a *distinct*
new extension name/display name before creating a new listing; this also
requires a deliberate user migration. GitHub VSIX previews remain installable
without a Marketplace upload.

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
   [v1.4.4 GitHub pre-release](https://github.com/sanskarIN/LineLoom/releases/tag/v1.4.4). Download
   [LineLoom-1.4.4-Sanskar.vsix](https://github.com/sanskarIN/LineLoom/releases/download/v1.4.4/LineLoom-1.4.4-Sanskar.vsix) and
   [its SHA-256 checksum](https://github.com/sanskarIN/LineLoom/releases/download/v1.4.4/LineLoom-1.4.4-Sanskar.sha256) and verify the digest before installing.
4. Open Extensions in VS Code and **uninstall** `SanskarCodes.lineloom` before
   enabling `Sanskar.lineloom`. Reload VS Code to clear old command/provider
   registrations. Do not keep two enabled copies: the command IDs and
   configuration namespace are shared, which can cause conflicts.
5. In VS Code Extensions → `...` → **Install from VSIX…**, choose the verified
   `LineLoom-1.4.4-Sanskar.vsix` and reload if asked. Do not open the file
   with Visual Studio's (different product) VSIX Installer.
6. Revisit settings, ensure path exclusions and `lineloom.allowRemoteEndpoints`
   are correct, start your own Ollama, select the model, and test a local file.
   Existing `lineloom.*` user settings may remain in VS Code settings.json,
   but extension-private globalState does **not** automatically migrate.

## Optional development-source npm CLI preview

The **unpublished CLI v0.3.0 development source** now pins the independently verified **v1.4.4** GitHub preview, with separate SHA-256 checksums for `SanskarCodes` and `Sanskar`. It supports both `install --preview` and offline `verify`, but the released GitHub Packages CLI `0.1.0` still uses older extension pins; the new source commands are not yet published to npmjs or GitHub Packages. CLI preview installation never needs the new extension's Marketplace listing. This is **not** automatic publisher migration. Before installation, follow the backup, uninstall/disable and VS Code reload steps above; the CLI never removes `SanskarCodes.lineloom` or copies extension-private state.

```sh
# From packages/lineloom-cli in a reviewed local checkout:
node bin/lineloom.mjs install --preview --publisher Sanskar --dry-run
# Only after disabling/uninstalling SanskarCodes.lineloom and reloading:
node bin/lineloom.mjs install --preview --publisher Sanskar
# Or verify the exact manually downloaded VSIX without installation:
node bin/lineloom.mjs verify ./LineLoom-1.4.4-Sanskar.vsix --preview --publisher Sanskar
```

The CLI now checks the selected editor's installed extension IDs with a bounded `--list-extensions` invocation **before downloading a `Sanskar` preview VSIX or staging a locally verified copy, and rechecks immediately before VS Code installation**. This second check reduces the chance of a conflict when extension state changes during a slow download or file verification; it does not eliminate all possible concurrent races. It refuses to proceed if `SanskarCodes.lineloom` is still installed or if the listing cannot be obtained reliably. Uninstall the old publisher, then reload the editor; disabling alone does not satisfy this conservative guard. It does not uninstall anything, alter settings, inspect source files or prove the state of unrelated editor profiles. An explicit `--dry-run` only shows the selected asset without querying the editor.

The default `lineloom install --preview` continues to target the separate `SanskarCodes` GitHub preview. No `Sanskar` stable VSIX is pinned, so selecting that publisher without `--preview` is rejected. These development-source commands are **not yet available in the publicly published GitHub Packages CLI 0.1.0** and do not imply npmjs publication.

For CLI users **after the new listing exists**:

```sh
code --uninstall-extension SanskarCodes.lineloom
code --install-extension Sanskar.lineloom
```

For a manually downloaded and checksum-verified GitHub VSIX:

```sh
code --uninstall-extension SanskarCodes.lineloom
code --install-extension ./LineLoom-1.4.4-Sanskar.vsix
```

The corresponding package for users **staying on the old publisher** is
`LineLoom-1.4.4-SanskarCodes.vsix` (also a GitHub testing preview). Its
same-ID upgrades must still be tested separately. The current stable
GitHub extension remains
[v1.3.0 under SanskarCodes](https://github.com/sanskarIN/LineLoom/releases/tag/v1.3.0).

## Publisher creation and upload checklist for the maintainer

1. **Visual Studio Marketplace:** ownership of publisher ID **Sanskar** is confirmed by the maintainer on November 8, 2026. Sign in through the permanent Microsoft account and confirm the Members tab still lists the correct Owner. **Do not delete/recreate this publisher.**
   **Open VSX:** independently confirm the **Sanskar** namespace is claimed by the correct account before attempting any registry upload; Microsoft ownership does not grant Open VSX rights.
2. Use the signed-in publisher's proper publish credentials, stored privately.
   Do not put publishing tokens in GitHub commits, public logs or release assets.
3. Obtain both `LineLoom-1.4.4-*.vsix` archives and corresponding SHA-256 files
   from the [published GitHub v1.4.4 pre-release](https://github.com/sanskarIN/LineLoom/releases/tag/v1.4.4). Confirm the new VSIX
   contains `publisher: "Sanskar"`, `name: "lineloom"` and the real
   preview-channel marker; the old VSIX must contain `SanskarCodes`.
4. Run `node scripts/verify-publisher-pair.mjs <legacy.vsix> <Sanskar.vsix>`
   against the two *same-version, same-channel* checked candidate packages.
   This offline gate verifies the complete configuration/command manifest,
   identical full shipped file inventory and byte contents (including runtime,
   icons, license, privacy policy, README and archive metadata), allowing only
   the independently verified publisher-specific package and VSIX identity
   metadata to differ. Unexpected extra files fail the gate. Passing it **does not**
   authorize registry publication or replace human QA.
5. **Only after the corresponding registry owner authorization and verified migration path**, publish the correctly identified package to that registry. Microsoft and Open VSX require **separate** approvals and may have different transfer procedures. If independently publishing under **SanskarCodes**, use its separate legacy VSIX; never upload one identity under both publishers.
6. Verify both newly published listings, versions, downloadability and
   publisher namespaces independently before changing homepage primary
   buttons from the current verified `SanskarCodes` listings.
7. Communicate the manual migration, prompt users to back up settings and
   avoid two concurrently enabled copies. Maintain a rollback link.

Useful references:
[release/publishing guide](publishing.md) ·
[website migration steps](https://sanskarin.github.io/LineLoom/publisher-migration.html) ·
[existing Marketplace listing](https://marketplace.visualstudio.com/items?itemName=SanskarCodes.lineloom) ·
[existing Open VSX listing](https://open-vsx.org/extension/SanskarCodes/lineloom).

This procedure neither trains a new LineLoom Code model nor publishes to
any marketplace automatically.
