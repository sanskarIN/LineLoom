# LineLoom Open VSX — independent Sanskar namespace migration plan

**November 26 Marketplace update (separate registry):** Microsoft indicated `Sanskar.lineloom-sanskar` / **LineLoom by Sanskar** is acceptable in principle, not `Sanskar.lineloom`. This does not grant Open VSX rights or determine its package name. Before preparing either registry's new release, evaluate whether the same successor identity can be supported on both registries; using different extension IDs may lead to incompatible install/update paths. Continue read-only checks of the previously proposed Open VSX target; do not treat them as verification of the Marketplace successor.

**Status: PLAN ONLY / NOT AUTHORIZED TO PUBLISH (reviewed 2026-11-24).** The existing [`SanskarCodes.lineloom` listing](https://open-vsx.org/extension/SanskarCodes/lineloom) was independently verified at v1.3.0 Stable on 2026-10-25. Its current version must be rechecked before making a fresh claim. **No `Sanskar.lineloom` Open VSX listing or ownership is verified by this document.** Microsoft Marketplace publisher rights do not grant Eclipse Open VSX namespace access.

This is a **separate registry workstream** following GitHub preview preparation and a viable, owner-approved v1.5.0 Stable identity. Microsoft's 2026-11-19 reply ruled out **Marketplace** publisher-to-publisher transfers; it says nothing about the independently governed **Open VSX** namespace or transfer rules. Work on namespace discovery/ownership can be prepared in parallel, but no public cutover occurs without separate Open VSX authorization.

## Current Open VSX operator rules (verified 24 November 2026)

**A direct move of one extension between namespaces is not supported.** The operator's [Managing Extensions guide](https://github.com/EclipseFdn/open-vsx.org/wiki/Managing-Extensions) describes optional **whole-namespace renaming**, which affects *all* extensions in that namespace. The [namespace-management guide](https://github.com/EclipseFdn/open-vsx.org/wiki/Managing-Namespaces) states that an administrator reviews such a request; it may fail if dependent extensions exist. It is not an automatic per-extension migration or a promise to preserve installs, ratings, private extension data, or automatic updates.

**The first supported option to evaluate is a separate new namespace/listing.** Do not delete the historical `SanskarCodes.lineloom` listing, publish `Sanskar.lineloom` or change any current download link just to test availability. Confirm the intended strategy with the maintainer and, where appropriate, Open VSX administrators.

**Security updates:** [Open VSX's September 2026 Trusted Publishing announcement](https://blogs.eclipse.org/post/tamas-cservenak/trusted-publishing-open-vsx) allows GitHub Actions to publish without a stored permanent PAT **after** a first active version exists, provided the Publisher Agreement is signed and the target namespace is verified with OWNER permissions. The first authorized release still uses a private PAT; subsequent OIDC credentials are short-lived. A PAT or `OVSX_PAT` present in the workflow takes precedence over `--trusted-publishing`, so remove the PAT when explicitly migrating. Protect the registered workflow using repository rules and a reviewed deployment environment. Do not create a publishing workflow until an exact release and target namespace have been owner-authorized.

**Post-publish scanning:** [Eclipse's 2026 namespace-matching guidance](https://blogs.eclipse.org/post/brian-king/stronger-safety-nets-vs-code-marketplace-namespace-matching-open-vsx) warns that a command may report successful upload even when a matching Marketplace publisher triggers asynchronous ownership review/quarantine. A CLI exit code alone does not establish a public usable listing. Check the public Open VSX API and installation in an editor after any authorized upload.

## Read-only registry inspection available in the repository

The project includes a narrow, public, **GET-only** metadata checker. It cannot claim/rename a namespace, enumerate account permissions, publish or delete an extension, and never uses tokens. Its two supported targets are fixed to the known IDs:

```sh
npm run test:openvsx-public       # offline synthetic tests
npm run openvsx:check:legacy      # current SanskarCodes.lineloom public API
npm run openvsx:check:planned     # proposed Sanskar.lineloom public API
```

An HTTP 404 from `Sanskar.lineloom` means only that **the extension listing was not found at the time of inspection**. It does not prove the `Sanskar` namespace is available, unclaimed, verified, owned or ready for publication. Likewise, a valid version response does not establish namespace OWNER rights or installability. Use [Open VSX account settings](https://open-vsx.org/user-settings/profile) and [namespace settings](https://open-vsx.org/user-settings/namespaces) to check the human-owned publishing prerequisites. Do not put PATs in shell history, chat, repository content or CI logs.

## Identity and ownership prerequisites

1. Sign in to [Open VSX](https://open-vsx.org/) through the intended permanent Eclipse account, review its Publisher Agreement, and identify the namespace administration state.
2. Search for the exact `Sanskar` namespace. **Do not assume it is unclaimed, verified, transferable or available.** If eligible, create or claim it using the supported Open VSX procedure and verify actual member/owner permissions; a namespace may exist without being verified.
3. Confirm the extension's supported name and the old/new namespace policy with Open VSX administrators if there is an ownership or collision conflict. Microsoft says Marketplace publisher transfer is currently unsupported; **do not project that response onto Open VSX**, which has separate operator rules.
4. Keep any Open VSX access token or trusted-publishing credentials restricted to the correct account and CI secret store. Never write a token to a repository, chat, issue body, log, screenshot, test fixture or VSIX artifact.
5. Preserve the current `SanskarCodes.lineloom` registry listing while assessing transfer and migration; no deletion or deactivation should be used as a shortcut.

Official reference material: [Open VSX publishing guide](https://github.com/eclipse-openvsx/openvsx/wiki/Publishing-Extensions), [namespace access](https://github.com/eclipse-openvsx/openvsx/wiki/Namespace-Access), and [Open VSX CLI](https://github.com/eclipse-openvsx/openvsx/blob/main/cli/README.md). Follow the **current** operator documentation rather than copying old token commands uncritically.

## Packaging, privacy and compatibility gates

- [ ] Decide, in writing, whether the target is a new `Sanskar.lineloom` Open VSX identity or an operator-supported transfer. Never assume installs/reviews/downloads follow an ID change.
- [ ] Use the exact authorized, tested release commit; verify `publisher: "Sanskar"`, extension name, version, stable/pre-release channel, SHA-256 and every shipped file. A `SanskarCodes` archive must never be uploaded under `Sanskar`.
- [ ] Compare the separate candidate VSIX publisher builds with the existing independent byte-parity script; permit only documented identity differences.
- [ ] Repeat clean editor installation and explicit legacy-to-new migration in a synthetic profile, with backed-up settings, reset extension-private state and fresh remote-endpoint consent. Do not leave two enabled copies sharing `lineloom.*` commands/settings.
- [ ] Require green security, source/packager checks, extension-host tests, relevant platform checks and owner-approved manual acceptance. Recheck [security tracking #297](https://github.com/sanskarIN/LineLoom/issues/297) against the exact candidate: 19 November audits passed after an advisory withdrawal, but neither that history nor an unreviewed warning is release authorization.
- [ ] Confirm the destination uses the right publisher permission. Treat a GitHub release as evidence of source assets only, not proof of registry publication.
- [ ] Obtain explicit owner approval for **Open VSX** version, release channel and exact package, separately from Microsoft and GitHub authorizations.

## Authorized Open VSX publishing sequence (future)

1. Record the verified namespace owner and a suitable protected CI publishing identity (or approved manual account). Store credentials privately.
2. Choose the exact **already reviewed** publisher-specific stable VSIX and verify its checksum. Do not publish a preview as stable or silently reuse a Marketplace package with the wrong ID.
3. Publish through the official Open VSX publisher flow **only after owner authorization** and after resolving any namespace or identity conflict.
4. Independently inspect the public Open VSX listing, its API metadata and actual download/install behavior. Capture the public version, `preRelease`, `verified` and `downloadable` status as observed—do not fabricate URLs or statuses for the unpublished new ID.
5. Only then update README/docs/website badges and install instructions to point to the confirmed new Open VSX listing. Keep the legacy listing and tested rollback directions while users migrate.
6. Clearly announce that extension identities differing by publisher do **not** automatically preserve user installations, settings sync state, ratings or private extension storage. Document the actual result, not an assumed migration capability.

## Decision log / evidence template

| Gate | Current state | Acceptance evidence |
| --- | --- | --- |
| `Sanskar` Open VSX namespace owner | Unverified | Namespace page and verified membership |
| Publisher Agreement and permissions | Unverified | Account-side confirmation, no secret material |
| Operator-supported transfer behavior | Unknown | Written registry guidance if required |
| `Sanskar.lineloom` public listing | Not verified | Exact listing/API version and downloadable verified asset |
| Release authorization | Not granted for Open VSX | Explicit owner instruction for exact version and target |
| Public installation & rollback | Not run on new ID | Dated sanitized physical-editor QA |
| Old listing cleanup/deprecation | Not authorized | Later owner decision, only after safe user migration |

**Stop conditions:** unknown namespace ownership, publishing collision, unverified extension identity, unavailable credentials, failing release security checks, untested migration or absent owner permission. In any stop condition, continue serving the previously verified listing; do not invent a transfer or remove an existing extension.

See [v1.4.5 migration preparation](releases/v1.4.5-plan.md), [v1.5.0 Stable gate](releases/v1.5.0-plan.md), [publisher migration instructions](publisher-migration.md), and [release evidence rules](qa/release-evidence.md).

## Exact actions for the maintainer (no publication yet)

1. Sign in to Open VSX with the intended GitHub identity; connect the correct Eclipse account and sign the Publisher Agreement in the user profile, if unsigned.
2. Open the namespace settings page and determine whether `Sanskar` already exists, its ownership state, and whether your account is an OWNER or CONTRIBUTOR. A `Sanskar` Microsoft Marketplace publisher does not automatically grant Open VSX access.
3. If ownership is needed, [open a namespace ownership issue](https://github.com/EclipseFdn/open-vsx.org/issues/new/choose) using the official template. The namespace guide explains the GitHub-account history requirement and the need to demonstrate access to the matching Microsoft Marketplace publisher, often with a public repository commit.
4. Ask Open VSX administrators for their supported **whole-namespace rename** implications versus **separate new namespace/listing** before any destructive or irreversible action. Do not confuse renaming the entire `SanskarCodes` namespace with moving only LineLoom.
5. Leave both registries and public links unchanged while the choice is pending. Complete real-editor migration and rollback QA before approving any new listing and, only then, store first-release PAT secrets privately or configure trusted publishing later.

This page describes prerequisites and review gates, not approval to create/publish `Sanskar.lineloom` or to delete `SanskarCodes.lineloom`.
