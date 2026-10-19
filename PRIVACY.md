# LineLoom privacy policy (v0.9.1 preview)

LineLoom runs as an extension inside the VS Code extension host. It does not require an account. It does not include telemetry, advertising, analytics, or automated uploads to a LineLoom-operated server.

**Context collected for a suggestion:** the language ID, a bounded selection of text preceding and following the editor cursor in the **currently open document**, indentation and document version. Those snippets are transmitted through HTTP to the configured Ollama-compatible inference endpoint. No entire-repository scanning or cross-file context is implemented. Generated suggestions are returned to VS Code ghost text; only accepted suggestions are inserted by VS Code.

**Local by default:** `http://127.0.0.1:11434`. Remote servers may receive snippets and retain data according to their operators' policies. A non-loopback endpoint must use HTTPS and requires both an explicit setting and interactive per-origin approval. LineLoom explicitly rejects HTTP redirects for model discovery, model lookup and generation to prevent a configured server from forwarding requests (including editor snippets) to a different destination without fresh approval. This blocks HTTP redirect forwarding but cannot control proxies, DNS configuration or how an approved server itself handles received snippets.

**Exclusions:** untrusted workspaces, virtual/non-file editors, files outside opened workspace folders, high-risk filenames, and configured ignore patterns are ineligible. Both root and nested `.gitignore` and `.lineloomignore` files on the document's directory path are checked (up to 24 scopes); unreadable policy files or excessively deep paths are denied. Negation rules cannot override exclusions from other sources. Canonical symlink targets within a workspace are checked independently. Comprehensive content-level secret detection is **not** implemented; never place sensitive source code in an allowed file without checking your settings.

**Storage:** the remote origin approval is stored in VS Code global state. User settings and the chosen model are stored by VS Code. Metrics are optional aggregate counters/timing values held in memory, not persisted. The extension keeps a bounded, short-lived in-process cache of completion text (up to eight entries for roughly 15 seconds) and hashed cache keys, but does not intentionally write editor context or suggestions to disk. Version 0.7.0 adds a single-entry, 12-second **typed continuation cache** containing the already-generated suggestion, the current file identity and version, cursor offset, settings digest and SHA-256 hashes of preceding and following code. It does not retain unencrypted prefix or suffix strings in this cache. Matching a typed continuation occurs only after the usual trusted-workspace and path-exclusion checks.

**Logs:** diagnostics show model name, loopback/remote status and aggregate counters, not source snippets, prompt bodies, inference responses or credentials.

**Retention and deletion:** disable or uninstall LineLoom to stop inference. VS Code may retain configuration and extension state according to its normal behavior; clear user settings and extension state in VS Code as needed.

**Generated code:** developers remain responsible for reviewing correctness, safety, licensing and privacy implications of completions.

Questions and security reports: use GitHub issues for non-sensitive concerns, and GitHub private vulnerability reporting when enabled as described in [SECURITY.md](SECURITY.md).


**v0.3.0 update:** LineLoom verifies canonical document paths, checks nested policy files in addition to root policy files, and copies at most the configured context window via editor ranges. These safeguards reduce accidental disclosure risk but are not a guarantee against secrets typed in ordinary source files.

**v0.9.0 per-language model selection:** user-configured language model tags are local VS Code settings. The selected model is included in the normal Ollama request to the same validated endpoint; the feature does not introduce a new service, hidden model downloads or cross-file context. Opening the model picker alone does not send editor snippets; installed-model discovery occurs only after user action and the existing explicit remote-HTTPS approval gate. A model override does not change the privacy guarantees or data handling of an independently chosen Ollama server.

**v0.9.1 dispatch-time protections:** pending inference now revalidates workspace trust, enabled languages, current model and settings, custom path exclusions, and remote endpoint approval immediately before sending editor context. Configuration/consent can change while an ignore-file scan or typing debounce is in progress. Existing completion responses still undergo a second check before insertion. The model-selection pickers also discard a result obtained from a no-longer-current endpoint. These checks do **not** retract source that an already-approved endpoint has previously received, nor control an external server's logging or data retention.
