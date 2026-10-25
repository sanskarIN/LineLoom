# LineLoom Control Center — native VS Code sidebar

**Available in the published [GitHub v1.3.0 stable release](https://github.com/sanskarIN/LineLoom/releases/tag/v1.3.0).** The sidebar was introduced in the v1.1.x preview series and stabilized in v1.2.0. You can open it using the **LineLoom** icon in VS Code's Activity Bar or the Command Palette's **LineLoom: Open Control Center**. The VS Code Marketplace and Open VSX may serve different versions; verify the installed extension before expecting this view.

This is a **native VS Code Tree View**, not a web app, separate chat service or background Ollama process.

## What the Control Center shows

| Section | Visible information and actions |
| --- | --- |
| **Completion** | Engine state, enable/disable, pause/resume automatic suggestions, manual trigger and **Stop Current Generation** |
| **Models & Languages** | Current default model, count of per-language overrides, enabled-language count, and native selection commands |
| **Active Editor** | Language name, effective model and **provisional settings-level** eligibility; not a proof the file passes privacy checks |
| **Privacy & Connection** | Workspace trust, endpoint *category* (loopback, remote approval state or invalid), manual **Check Active File Privacy**, selected related-file count, clear-selected-files action and explicit **Check Ollama Connection** |
| **Session Activity** | In-memory counts for requests, suggestions, failures, cancellations, cache hits, continuation reuse and empty responses; optional measured latency, diagnostics and privacy-timing reset when enabled |
| **More Actions** | Settings, setup guide, Quick Actions |

**Engine status = Ready does not establish model availability.** The model may be missing or Ollama may be offline. Use the explicit **Check Ollama Connection** action instead of interpreting the sidebar's settings-derived status as a live health check.

**Active Editor status = Allowed by settings is NOT a file privacy clearance.** To evaluate a specific file's current path and ignore-policy status, invoke **Check Active File Privacy**. The command checks local rules without reading source text or requesting a completion; privacy is independently checked again just before inference.

## Explicitly selected related-file context

This feature ships in GitHub stable v1.3.0, but is **OFF by default**.

1. In LineLoom Settings, enable `lineloom.crossFileContext`. The setting itself does **not** read additional files.
2. Open a supported local source file in a trusted workspace.
3. Select **Related-File Context** in the sidebar or run **LineLoom: Select Related Files for Context**.
4. Select one or two **distinct supported source files** from the same workspace folder (not the active file). Each selected file must be nonempty and no larger than **2,048 bytes**.
5. Read and accept the modal disclosure before extra snippets may enter Ollama prompts. If you configured and separately approved a remote HTTPS endpoint, those snippets may leave the device.
6. The sidebar shows the number selected, **not filenames**. Choose **Clear Related Files** or use **LineLoom: Clear Selected Related Files** to revoke selection. Changing LineLoom settings, active editors or ignore rules also clears it.

Selected paths/snippets are kept only in current-session memory; hard exclusions and nested ignore policies are checked before and after use. No repository scan, automatic reference discovery or persistent code index occurs. **The tool cannot detect every secret in an otherwise allowed file**—choose only source you are comfortable sending to the configured Ollama endpoint. See [privacy and resource boundaries](privacy/selected-context.md).

## Privacy of the view

Rendering/refreshing the tree does **not** contact Ollama, issue a prompt, read related file contents, or automatically request remote approval. Its labels omit raw document paths, code, prompts, response bodies and full endpoint URLs. Model discovery or an Ollama connection check is a separate action initiated by the user.

Diagnostics are aggregate and in-memory by default. Optional performance timing collection is controlled by `lineloom.performanceDiagnostics`; disabling it clears collected latency measurements. The reset command erases privacy eligibility timing statistics without changing model or completion settings.

The status and consent interactions are designed for native VS Code accessibility; however **physical keyboard-only, high-contrast and screen-reader acceptance remains unverified** and is tracked in [v1.3.0 manual QA](qa/v1.3.0-manual-acceptance.md).

## Troubleshooting

- **No suggestions:** confirm the extension is enabled; open a supported local file in a trusted workspace; check configured language/model and use the explicit Ollama connection command.
- **Editor says allowed but nothing appears:** settings-only eligibility does not bypass ignore rules, unsupported editors or missing models. Run **Check Active File Privacy** and inspect the non-sensitive diagnostics.
- **Related files count returns to zero:** settings changes, switching active editors or ignore-rule edits intentionally revoke the earlier selection.
- **Remote inference unavailable:** remote HTTPS origins require both the relevant setting and explicit per-origin approval. Opening the sidebar does not grant permission.
- **Suggestion feels stale:** use **Stop Current Generation**; do not assume an already-dispatched prompt can be recalled from a server.

## Developer validation

Run `npm ci`, `npm run check` and (on a supported VS Code test setup) `npm run test:integration`. Verify keyboard interactions and consent with an actual editor; observe that a sidebar refresh does not cause a model request. For release/OS-specific evidence and installed VSIX checks, use the [evidence protocol](qa/release-evidence.md) and [manual acceptance checklist](qa/v1.3.0-manual-acceptance.md). Automated tests are not a substitute for physical platform acceptance.
