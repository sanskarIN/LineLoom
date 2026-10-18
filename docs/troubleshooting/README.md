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
