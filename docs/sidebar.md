# LineLoom Control Center — native VS Code sidebar

**Available in the published [GitHub v1.3.0 stable release](https://github.com/sanskarIN/LineLoom/releases/tag/v1.3.0).** The sidebar was introduced in the v1.1.x preview series and stabilized in v1.2.0. You can open it using the **LineLoom** icon in VS Code's Activity Bar or the Command Palette's **LineLoom: Open Control Center**. The VS Code Marketplace and Open VSX may serve different versions; verify the installed extension before expecting this view.

This is a **native VS Code Tree View**, not a web app, separate chat service or background Ollama process.

## On `main` after v1.3.0 — contextual next step (unreleased)

The in-development Control Center adds one **Next:** action near Engine Status. It prioritizes disabled autocomplete, restricted workspace trust, unsupported/non-local editors, disabled languages, invalid or unapproved endpoint settings, and unavailable models before offering actions for generation or diagnostics. When no safe command can perform the required step (for example, opening a supported file or changing Workspace Trust), it displays guidance **without a clickable command**.

Where a native LineLoom command already exists, clicking the recommendation performs that **explicit user action**: Enable Autocomplete, Manage Autocomplete Languages, Select Model, Open Settings, Check Ollama Connection, Stop Current Generation, Open Diagnostics or Trigger Completion. The recommendation itself never sends a prompt, reads file contents or contacts Ollama; it does not claim the configured model is reachable or that the file passed privacy inspection. Engine Status remains independent of model availability and permission checks.

The Related-File Context entry now distinguishes **setting enabled but no files chosen** from session-only selected references. Enabling the setting alone is not consent to read additional files, and selection remains bounded to two user-chosen files.

**Release status:** This sidebar refinement is source work proposed for a future maintenance build, **not part of the published v1.3.0 VSIX or either marketplace version**. Physical keyboard/screen-reader testing and real Ollama acceptance remain open.

## Post-v1.3.0 development: last manual model check (unreleased)

After the user explicitly invokes **LineLoom: Check Ollama Connection**—from the sidebar, Command Palette, or Setup Guide—the model section can show a **Last Manual Model Check** line. Its statuses distinguish **Not checked**, **Checking**, **Default model found**, **Default model missing**, and **Connection failed**.

This is a snapshot of the **configured default model's presence in Ollama's returned model list at the time of that action**, not automatic availability monitoring or proof that the model can generate useful code. Per-language model overrides remain independent; a successful default-model check does not verify a language-specific override. If the last check reports a missing default model, the sidebar suggests selecting an installed one; if a connection failed, it suggests an explicit retry.

- Sidebar rendering, refreshing and navigation **never trigger model discovery**, inference, file access or remote approval.
- A check is initiated only after a deliberate command; remote HTTPS hosts still require the existing separate opt-in and origin approval.
- Only one of five non-sensitive status values is retained **in memory for the active session**. No model names, endpoint URLs, server responses or timestamps are stored by the readiness tracker.
- A second manual check supersedes the first; late results from a previous check cannot overwrite the current status. Changing any LineLoom configuration or workspace trust clears the previous result. A dismissed approval is not treated as a successful check.
- The code is a **future release candidate**, not included in the already published v1.3.0 VSIX, Marketplace or Open VSX packages. Actual physical-device accessibility and real-model quality remain outstanding.

## Post-v1.3.0 development: last manual file privacy check (unreleased)

The sidebar now displays a **Last Manual File Check** row below **Check Active File Privacy** in the Privacy & Connection section. The row starts **Not checked**, changes to **Checking** only after a person invokes the command, and then displays the previous local path-and-ignore inspection outcome (**Passed**, **Blocked**, or **No active editor**). The normal **Next:** hint also explains an explicitly blocked file, without offering an unsafe bypass.

This is **not continuous monitoring**, a file-content scanner, or a guarantee of future completion eligibility. A **Passed** result means only that existing path and ignore checks succeeded *at that instant*; the completion engine independently revalidates privacy before inference. Model readiness, language settings, endpoint approval and eventual prompt safety are separate checks.

- No filename, absolute path, file content, actual ignore-rule pattern or secret enters the sidebar's stored status. The status lives only in extension memory.
- The sidebar's normal refresh, focus and rendering perform **no file reads, prompt construction or Ollama requests**.
- The command runs the pre-existing local inspector only after a deliberate click. A second inspection supersedes any older pending result.
- Active editor changes, active document edits/closures, extension configuration, workspace trust and ignore-file watcher changes clear the previous result. Late asynchronous results cannot restore an old approval after these events.
- The change is **source-only** until a future version is explicitly tested and released; it is not in the published GitHub v1.3.0 VSIX or either extension marketplace.

## What the Control Center shows

| Section | Visible information and actions |
| --- | --- |
| **Completion** | Engine state, enable/disable, pause/resume automatic suggestions, manual trigger and **Stop Current Generation**. The future maintenance candidate adds one contextual **Next:** recommendation |
| **Models & Languages** | Current default model, count of per-language overrides, enabled-language count, and native selection commands; an unreleased enhancement adds the last user-triggered default-model check |
| **Active Editor** | Language name, effective model and **provisional settings-level** eligibility; not a proof the file passes privacy checks |
| **Privacy & Connection** | Workspace trust, endpoint *category*, **Check Active File Privacy**, selected related-file count, and manual **Check Ollama Connection**; a future source candidate adds the last explicit file-inspection status |
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
