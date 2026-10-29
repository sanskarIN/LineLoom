# CLI v0.3.0 offline VSIX installer — manual acceptance

**Status: NOT RUN (physical-editor, offline-network and package-consumer QA).**
This is a development-source checklist for the merged [offline installer PR #92](https://github.com/sanskarIN/LineLoom/pull/92).
The root extension remains `1.4.2` development / GitHub `v1.3.0` stable, while the independently published GitHub Packages installer remains **`@sanskarin/lineloom-cli@0.1.0`**.
The `0.3.0` source is **not** a published npm command. No package release or extension publication is authorized by this checklist.

## Automated evidence versus manual evidence

- [x] PR #92 completed root cross-platform CI, Linux mocked extension-host integration, dependency security, and independent npm CLI tests on Windows/macOS/Linux before merging.
- [x] The PR checks package contents, pinned release hashes, invalid CLI options, size bounds, checksum mismatches, no-shell editor invocation and private temporary file cleanup using synthetic files and mocked runners.
- [ ] Record independent successful post-merge `main` checks by **exact commit SHA**.
- [ ] Perform actual physical-editor tests. Automated CLI mocks and VSIX upgrade smoke tests **do not** establish successful interactive installation with real editor binaries.
- [ ] Confirm GitHub Packages scope ownership, visibility, install authentication and end-user permissions before authorizing a new version-specific publisher.

## Exact local build

Use a fresh checkout of a reviewed commit. Node.js 22+ is required. In the CLI package directory:

```sh
cd packages/lineloom-cli
npm ci
npm test
npm run check:pack
node bin/lineloom.mjs version
```

The source pins **LineLoom v1.2.0 stable** and **v1.2.4 preview**; it does not download or install v1.3.0/v1.4.2 automatically.
Obtain a VSIX separately from the matching official GitHub Release, verify its release checksum independently and keep it on the local machine.
The CLI's pinned SHA-256 is authoritative for the subsequent offline invocation, not a newly downloaded or user-supplied replacement hash.

```sh
node bin/lineloom.mjs verify ./LineLoom-1.2.0.vsix
node bin/lineloom.mjs install --file ./LineLoom-1.2.0.vsix
node bin/lineloom.mjs verify ./LineLoom-1.2.4.vsix --preview
node bin/lineloom.mjs install --file ./LineLoom-1.2.4.vsix --preview
```

These commands are **examples for local manual QA with files you already have**, not instructions to run the published v0.1.0 package.

## Human acceptance matrix

| Scenario | Expected result | Evidence |
| --- | --- | --- |
| Windows + native VS Code CLI | Approved, pinned VSIX installs and appears under the existing `SanskarCodes.lineloom` ID | NOT RUN |
| macOS + native VS Code CLI | Offline invocation, permission handling and cleanup behave correctly | NOT RUN |
| Linux + native VS Code CLI | Offline invocation installs from staged copy without a network fetch | NOT RUN |
| VS Code Insiders / VSCodium | Explicit `--editor code-insiders` or `--editor codium` routes only to that editor CLI | NOT RUN |
| Network disconnected | A previously downloaded valid VSIX installs with no fallback download | NOT RUN |
| Wrong channel or tampered file | Reject before starting the editor, preserve original file and remove staging data | NOT RUN |
| Symlink, directory, missing, truncated or oversized path | Reject before executing an editor CLI | NOT RUN |
| Malformed version / unsupported editor | Fail closed; do not create an unsafe staging path or invoke a shell | Automated unit tests PASS; physical test NOT RUN |
| Editor binary unavailable or exits nonzero | Report failure with a nonzero CLI exit and remove private staged copy | Automated unit tests PASS; physical test NOT RUN |
| Real package consumer | Authenticated GitHub Packages install of a **separately authorized** v0.3.0 release succeeds | NOT RUN — NOT PUBLISHED |

Do not record private file paths, username, source code, access tokens or network traffic with credentials in public acceptance notes.
Record the date, OS/editor/Node versions, reviewed commit SHA, selected pinned extension channel, sanitized PASS/FAIL/DEFERRED result and reason.

## Publication gate

A passing unit test or this checklist does **not** release `0.3.0`.
Before any package publish, review whether the old fixed VSIX pinset should be updated, verify the exact published release digests, repeat package/security/physical-editor checks, confirm registry identity and require a **new** owner-authorized, version-locked GitHub Packages workflow.
The existing `package-publish-v0.1.0` flag is not authorization for another package version.
GitHub extension VSIX, Visual Studio Marketplace, Open VSX, npmjs.com and first-party model weights remain independent channels.

See [package distribution](../packages.md), [release evidence](release-evidence.md) and [LineLoom Code evaluation](../../model/EVALUATION_PROTOCOL.md).
