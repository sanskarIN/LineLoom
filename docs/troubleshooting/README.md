# Troubleshooting

**Open VSX installation:** [LineLoom v1.0.0 on Open VSX Registry](https://open-vsx.org/extension/SanskarCodes/lineloom) is published under namespace `SanskarCodes` for editors configured to use Open VSX. Verify that your editor uses the matching registry before installing. A public listing does not imply an Open VSX verified-publisher badge.

**Recommended VS Code installation:** [LineLoom v1.0.0 on Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=SanskarCodes.lineloom) or run `code --install-extension SanskarCodes.lineloom` using VS Code's CLI. Check publisher `SanskarCodes` in VS Code Extensions. If you downloaded the GitHub `.vsix` instead, install it through VS Code Extensions → … → Install from VSIX; do not double-click it in Windows Explorer.


**VSIX install fails with “One or more extensions are for Visual Studio Code”:** You launched the **Visual Studio VSIX Installer**, which is not the installer for **Visual Studio Code**. The VSIX was likely downloaded already. Close the installer; open VS Code, press `Ctrl+Shift+X`, choose **Extensions → … → Install from VSIX…** and select the downloaded `LineLoom-1.0.0.vsix` file. On Windows do not double-click the VSIX. Alternatively run `code --install-extension .\\LineLoom-1.0.0.vsix` in PowerShell from the download folder if the `code` CLI is available. See the [visual installation instructions](https://sanskarin.github.io/LineLoom/install.html).

# Troubleshooting

**No ghost text:** confirm you opened a trusted workspace folder, the file is one of the nine supported language IDs (including experimental Go, Java, C and C++), `lineloom.enabled` is true, the model is installed and inline suggestions are enabled in VS Code. Run *LineLoom: Trigger Completion*.

**Ollama unavailable:** install/start Ollama and check `http://127.0.0.1:11434/api/tags`. Run *LineLoom: Check Ollama Connection*. A model is not automatically downloaded.

**Model not found:** run `ollama list` and choose an installed tag with *LineLoom: Select Model*. If none are present, manually run `ollama pull qwen2.5-coder:1.5b`.

**Remote endpoint blocked:** a non-loopback host must use HTTPS, `lineloom.allowRemoteEndpoints` must be enabled, and you must explicitly approve the displayed origin via the connection command. Check whether your remote host stores code snippets.

**Slow completions:** use a smaller coding model, decrease `lineloom.maxContextChars` or `lineloom.maxOutputTokens`, or increase `lineloom.timeoutMs`. Initial model warm-up can be slower.

**Excluded file:** inspect `.lineloomignore`, root or nested `.gitignore`, `lineloom.excludedPaths` and sensitive filename exclusions.

**Diagnostics:** Command Palette > *LineLoom: Open Diagnostics*. It reports only settings and aggregated counts, never source code.

**v0.1.1:** a model-connection check is capped to approximately eight seconds. Suggestions are discarded if you change editors, move the cursor, close a file, or alter exclusions while the local model is working. Inaccessible ignore rules or documents are conservatively excluded.

**v0.2.1:** changing the current cursor, document or active editor cancels obsolete in-flight code generation. Model-list discovery responses are limited to 256 KB, and an interrupted/stalled generation stream is explicitly cancelled. If model discovery exceeds that bound, use a local Ollama server with a smaller installed model list or report the issue with diagnostics that omit code and credentials.

**v0.4.1: no suggestion while text is selected or several cursors are active:** the inline provider intentionally works only with one empty editor selection at the requested cursor position. Finish the selection or return to a single cursor and trigger completion again. Automatic suggestions also defer to an active VS Code IntelliSense selection. A new cursor position or editor focus change invalidates requests pending in debounce or privacy checks.

**v0.5.0: repeated automatic requests seem quiet:** after an Ollama response produces no usable code, LineLoom avoids repeating the exact same automatic request for approximately five seconds. Editing the file, changing the cursor or model, or using **LineLoom: Trigger Completion** allows a new request. Diagnostics expose only aggregate counts of empty responses and suppressed retries, not code or prompts. Model output containing only assistant prose or markup is intentionally rejected rather than inserted into the editor.

**v0.5.1: streamed Ollama output is rejected:** malformed events and responses exceeding the 1 MB transfer limit, 4,096 event limit or 10,000-character generated-text limit are rejected instead of displayed. A model that continually emits status-only events may hit the event cap. Try a different locally installed coding model or reduce `lineloom.maxOutputTokens`; report reproducible failures without including proprietary code, request bodies or secrets.

**v0.6.0: pause vs disable:** click **LineLoom** in the status bar and choose **Pause Automatic Suggestions** to stop background typing-triggered inference while keeping **LineLoom: Trigger Completion** available. The label changes to **LineLoom Manual** when paused. To stop manual suggestions too, choose **Disable Autocomplete**. To resume automatic requests, reopen **Quick Actions → Resume Automatic Suggestions**. These choices are saved in VS Code settings.

**v0.6.1: an endpoint returns HTTP 301/302/307/308:** LineLoom deliberately rejects Ollama HTTP redirects. Configure the **final, intended Ollama origin directly**, then repeat the existing endpoint approval process if it is remote. Do not weaken TLS settings or use redirects to bypass explicit origin approval. Loopback Ollama installations normally expose `/api/tags` and `/api/generate` without redirects.

**v0.7.0: suggestions do not continue after typing:** reuse is deliberately conservative. It only applies when the next automatic request follows a single simple forward edit of 1–32 characters matching the beginning of the previous suggestion, with unchanged model/settings, current-file prefix/suffix and workspace privacy rules. Manual triggers always request normal completion. If a file was edited elsewhere, the cursor moved, or a very long prefix caused the bounded context window to shift, Ollama may need to generate a new completion instead.

**v0.7.1: a suggestion restarts after some edits:** typed continuation is purposely conservative. Only one real forward insertion at the previous cursor can preserve a cached remainder. Replacements, paste operations that insert the whole suggestion, multi-part edits, edits elsewhere or skipped document versions invalidate it. LineLoom will then use the normal Ollama completion path; the behavior protects against outdated ghost text.

**v0.8.0: no automatic suggestion inside an identifier:** automatic Ollama requests are suppressed by default when your cursor is directly before an existing letter, digit, `_` or `$` character, including Unicode identifiers. You can still run **LineLoom: Trigger Completion**. To allow auto-requests inside identifiers, disable `lineloom.suppressMidTokenAuto` in VS Code Settings. Manual completion skips the ordinary typing debounce but continues to require trusted workspace, allowed file, valid cursor and an approved endpoint.

**v0.8.1: completion vanishes after model or language settings change:** the extension deliberately discards a response if the inference model, endpoint, enabled language, completion parameters or remote approval becomes invalid before it returns. Re-trigger in the new configuration. Automatic requests inside Unicode identifiers, including combining marks, are suppressed by default; manual trigger remains available and `lineloom.suppressMidTokenAuto` controls the heuristic.

**v0.9.0: a different model is selected than expected:** open **LineLoom: Quick Actions → Assign Language Model**, select the programming language and check the installed model assignment. Choosing **Use Default Model** removes that override. `lineloom.languageModels` takes precedence over `lineloom.model` only for the assigned language ID; JSX/TSX share JavaScript/TypeScript. Install required model weights independently. For a remote Ollama server, the picker still requires explicit HTTPS-origin approval and uses only that configured endpoint. Model changes cancel old suggestions.

**v0.9.1: completion disappears after changing model, exclusions or endpoint:** this is an intentional privacy safeguard. A queued completion is rejected if the workspace, selected model, current file exclusions, inference settings or approved server no longer match when the request is ready to send. Re-trigger using the new settings and a trusted, allowed source file. In **Assign Language Model**, changing the configured Ollama endpoint or remote approval while the picker is open discards the old selection; reopen it using the intended endpoint.
