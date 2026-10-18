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
