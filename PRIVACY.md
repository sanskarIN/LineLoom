# LineLoom privacy policy (candidate v1.0.0)

LineLoom runs as an extension inside the VS Code extension host. It does not require an account. It does not include telemetry, advertising, analytics, or automated uploads to a LineLoom-operated server.

**Context collected for a suggestion:** the language ID, a bounded selection of text preceding and following the editor cursor in the **currently open document**, indentation and document version. Those snippets are transmitted through HTTP to the configured Ollama-compatible inference endpoint. No entire-repository scanning or cross-file context is implemented. Generated suggestions are returned to VS Code ghost text; only accepted suggestions are inserted by VS Code.

**Local by default:** `http://127.0.0.1:11434`. Remote servers may receive snippets and retain data according to their operators' policies. A non-loopback endpoint must use HTTPS and requires both an explicit setting and interactive per-origin approval. A proxy or nonstandard local installation may have additional network behavior beyond LineLoom's control.

**Exclusions:** untrusted workspaces, virtual/non-file editors, files outside opened workspace folders, high-risk filenames, and configured ignore patterns are ineligible. Root-level `.gitignore` and `.lineloomignore` files are read, but nested `.gitignore` handling and comprehensive content-level secret detection are **not** implemented; never place sensitive source code in an allowed file without checking your settings.

**Storage:** the remote origin approval is stored in VS Code global state. User settings and the chosen model are stored by VS Code. Metrics are optional aggregate counters/timing values held in memory, not persisted. The extension does not intentionally persist editor context or completion text.

**Logs:** diagnostics show model name, loopback/remote status and aggregate counters, not source snippets, prompt bodies, inference responses or credentials.

**Retention and deletion:** disable or uninstall LineLoom to stop inference. VS Code may retain configuration and extension state according to its normal behavior; clear user settings and extension state in VS Code as needed.

**Generated code:** developers remain responsible for reviewing correctness, safety, licensing and privacy implications of completions.

Questions and security reports: use GitHub issues for non-sensitive concerns, and GitHub private vulnerability reporting when enabled as described in [SECURITY.md](SECURITY.md).


**v0.1.1 update:** LineLoom verifies canonical document paths before sending context, rejecting symlinks that resolve outside the workspace or to an excluded target. Unreadable root-level ignore files fail closed instead of being interpreted as absent; missing ignore files are allowed. These checks mitigate common accidental leaks but do not provide complete secret detection.
