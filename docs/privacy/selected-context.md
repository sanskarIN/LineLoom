# Explicit related-file context (v1.3.0 development RFC)

**Status: shipped in GitHub stable v1.3.0 (2026-10-25), off by default.** The design originated in [PR #93](https://github.com/sanskarIN/LineLoom/pull/93) and [issue #66](https://github.com/sanskarIN/LineLoom/issues/66). Manual real-model quality, physical OS/privacy and accessibility acceptance remain NOT RUN; automated integration validation does not establish those results.

## Threat model and exact opt-in

Related files may contain source, private paths, credentials in comments, or instructions attempting to influence the model. Treat their contents as **untrusted code context**, not commands. Additional source may be sent to an explicitly approved **remote HTTPS Ollama host**; a local Ollama host may itself be configured to log prompts. No implementation can retract content after a prompt was already dispatched.

1. `lineloom.crossFileContext` is **false by default**. Disabled mode never performs a related-file content read and uses the existing single-document prompt.
2. In the Command Palette, choose **LineLoom: Select Related Files for Context**. You must choose specific files and confirm a modal explaining both local and remote transmission. Setting the toggle alone never selects files.
3. At most **two distinct selected files**, each at most **2,048 bytes**. The active file and repeated selections are rejected; neither a third file nor a different workspace folder is silently accepted. Choices last only for the extension's running session; no paths or snippets are stored in globalState, logs, analytics, disk caches or background indexes. Changing any LineLoom setting, switching active editors, or editing ignore rules clears the selection.
4. The picker also rejects stale consent dialogs following a settings, ignore-policy or active-editor change. After confirming, a metadata and ignore-policy preflight rejects invalid selections **without reading their source**; the model request independently revalidates every selected file.
5. Use **LineLoom: Clear Selected Related Files** to discard consent instantly. The active request is invalidated; a request already sent to Ollama cannot be unsent.
6. The current candidate accepts only explicitly selected supported source file extensions inside the **same workspace folder**. No recursive listing, parser, dependency tree, auto-discovery, binary, URL-backed or notebook scans.

## Privacy and resource boundaries

- The existing `mayComplete` privacy engine is reused for each extra file: trusted workspace, file scheme, named and canonical workspace-relative paths, sensitive path exclusions, user patterns and nested .gitignore/.lineloomignore. Any unresolved path, symlink escape, changed policy, unreadable/invalid rule or I/O error aborts the entire related-file prompt.
- Files must be regular, nonempty, UTF-8 text; the final component may not be a symlink. Invalid UTF-8, NUL/binary data, oversized and truncated files are refused.
- Eligibility is checked before opening the bounded file, after reading, and again following the Ollama response. Selected text is re-read before suggestions are displayed; content changes discard the response. Requests are invalidated by selection, settings, editor and ignore-policy changes.
- Up to 4 KiB of **extra source text total**, no persistent code cache apart from existing short-lived memory-only completion hashes. Reference labels are anonymous; file paths are not included in model prompts or diagnostics.
- Completion cache keys and continuation snapshots include a hash of selected reference text and selection revision. Disabled mode sends **zero additional context**.
- The initial implementation cannot detect all secrets inside an otherwise allowed source file and does not guarantee perfect concurrency on exotic network filesystems. Exclude confidential files in advance.

## API and output handling

Generic completion prompts contain explicit `Reference N (untrusted)` blocks. For Qwen2.5 Coder, selecting extra files intentionally chooses the generic instruction prompt instead of the regular FIM-prefix/suffix mode. This is an experimental quality/performance tradeoff; benchmark completion quality and latency against the default FIM-only mode before a stable release.

## Rejected alternatives

- Automatic whole-workspace indexing, background repository traversal and always-on cross-file ingestion.
- Persisting selected file names or source snapshots across sessions.
- Permissive handling of ignored, oversized, symlinked or invalidly decoded files.
- Enabling this setting by default in a public release.

## Tests and release acceptance

Pure bounded-file tests cover file size, symlinks, malformed UTF-8, binary and duplicate selections. Real VS Code extension-host tests exercise opt-out, allowed selected files and ignored-file denial with a **mock Ollama server**. Actual Ollama, manually selected UX, accessibility/screen reader, settings/profile changes, physical Windows/macOS/Linux performance and remote consent require explicit **human acceptance**. See [v1.3.0 manual QA](../qa/v1.3.0-manual-acceptance.md). Automated approval alone is not stable-release permission.
