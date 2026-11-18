# LineLoom Open VSX — independent Sanskar namespace migration plan

**Status: PLAN ONLY / NOT AUTHORIZED TO PUBLISH (2026-11-18).** The existing [`SanskarCodes.lineloom` listing](https://open-vsx.org/extension/SanskarCodes/lineloom) was independently verified at v1.3.0 Stable on 2026-10-25. Its current version must be rechecked before making a fresh claim. **No `Sanskar.lineloom` Open VSX listing or ownership is verified by this document.** Microsoft Marketplace publisher rights do not grant Eclipse Open VSX namespace access.

This is the **next registry workstream** after planning the v1.4.5 GitHub preview and the Microsoft-gated v1.5.0 Stable release. Work on namespace discovery/ownership can be prepared in parallel, but no public cutover occurs without separate Open VSX authorization.

## Identity and ownership prerequisites

1. Sign in to [Open VSX](https://open-vsx.org/) through the intended permanent Eclipse account, review its Publisher Agreement, and identify the namespace administration state.
2. Search for the exact `Sanskar` namespace. **Do not assume it is unclaimed, verified, transferable or available.** If eligible, create or claim it using the supported Open VSX procedure and verify actual member/owner permissions; a namespace may exist without being verified.
3. Confirm the extension's supported name and the old/new namespace policy with Open VSX administrators if there is an ownership or collision conflict. An Open VSX migration is **not** the same action as Microsoft's publisher transfer.
4. Keep any Open VSX access token or trusted-publishing credentials restricted to the correct account and CI secret store. Never write a token to a repository, chat, issue body, log, screenshot, test fixture or VSIX artifact.
5. Preserve the current `SanskarCodes.lineloom` registry listing while assessing transfer and migration; no deletion or deactivation should be used as a shortcut.

Official reference material: [Open VSX publishing guide](https://github.com/eclipse-openvsx/openvsx/wiki/Publishing-Extensions), [namespace access](https://github.com/eclipse-openvsx/openvsx/wiki/Namespace-Access), and [Open VSX CLI](https://github.com/eclipse-openvsx/openvsx/blob/main/cli/README.md). Follow the **current** operator documentation rather than copying old token commands uncritically.

## Packaging, privacy and compatibility gates

- [ ] Decide, in writing, whether the target is a new `Sanskar.lineloom` Open VSX identity or an operator-supported transfer. Never assume installs/reviews/downloads follow an ID change.
- [ ] Use the exact authorized, tested release commit; verify `publisher: "Sanskar"`, extension name, version, stable/pre-release channel, SHA-256 and every shipped file. A `SanskarCodes` archive must never be uploaded under `Sanskar`.
- [ ] Compare the separate candidate VSIX publisher builds with the existing independent byte-parity script; permit only documented identity differences.
- [ ] Repeat clean editor installation and explicit legacy-to-new migration in a synthetic profile, with backed-up settings, reset extension-private state and fresh remote-endpoint consent. Do not leave two enabled copies sharing `lineloom.*` commands/settings.
- [ ] Require green security, source/packager checks, extension-host tests, relevant platform checks and owner-approved manual acceptance. The active [audit blocker #297](https://github.com/sanskarIN/LineLoom/issues/297) cannot be ignored as a release pass.
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
