# Architecture and lifecycle

1. VS Code calls `CompletionEngine.provideInlineCompletionItems` for nine registered language IDs (five initial plus four experimental v0.4.0 additions).
2. The engine checks preferences, workspace trust and sensitive-file exclusion. Only the current document is considered.
3. A debounce delays repeated requests. New requests cancel the previous generation; later editor-version checks discard stale results.
4. `extractContextWindow` uses limited text ranges around the cursor (not a whole-file copy) and computes indentation.
5. `buildPrompt` uses Ollama's `suffix` for configured Qwen2.5 Coder model names and a conservative completion prompt for other models.
6. `generateCompletion` calls `/api/generate` and parses streaming NDJSON events, capped in size.
7. `cleanCompletion` removes common response artifacts, leading fenced-code commentary, boundary FIM tokens and exact suffix overlaps. VS Code displays native ghost text and handles acceptance.

Commands use native VS Code status bars, notifications and configuration UI; there are no webviews, third-party analytics, shell invocations or automatic model downloads.

**Intentional limitations:** no full syntax-tree analysis, no cross-file indexing, no guaranteed syntax-correct suggestions, no language-server integration, and no universal model-specific FIM template. Rust performance modules are deliberately deferred pending profiling.

## v0.2.0 completion cache

Identical in-flight request parameters and current-document context are digested into an ephemeral SHA-256 key after privacy checks. A small, bounded, memory-only cache retains successful completion text for up to 15 seconds to reduce duplicate local inference. It is cleared when extension settings change or the provider is disposed. Cache hits still require an active, matching editor and the usual trusted-workspace and sensitive path checks. The extension neither persists these results nor indexes other files.

## v0.3.0 nested ignore rules and auto-trigger threshold

Before context is read or any inference occurs, the provider evaluates the current workspace path and its canonical target. Every applicable root/nested `.gitignore` and `.lineloomignore` is loaded conservatively and evaluated relative to its own directory, with separate sources unable to override each other. Automatically triggered requests require `lineloom.minAutoTriggerChars` meaningful characters on the active line (default 2); explicitly triggered requests bypass that count. Two small windowed reads cover the surrounding context instead of allocating a full copy of large documents.

## v0.4.0 language registration and preferences

The language registry maps nine VS Code language identifiers to language-specific guidance. JavaScript React and TypeScript React share their respective JavaScript/TypeScript preferences. The `lineloom.enabledLanguages` setting is normalized to known IDs only: unknown identifiers cannot inadvertently enable inference, and an intentionally empty list prevents all provider requests. The VS Code **Manage Autocomplete Languages** command updates that same setting, and preference changes invalidate in-progress suggestions and cached results. New Go, Java, C and C++ language support is experimental until live-model quality testing is completed.

## v0.5.0 adaptive empty-result backoff

Successful nonempty completions use the existing short-lived eight-entry result cache. When a model returns empty or unusable output, a separate bounded, in-process 16-entry backoff records the hashed exact request fingerprint for up to five seconds. Subsequent *automatic* requests with an unchanged cursor, code context, language, model and endpoint skip inference. **Manual** invocations always bypass the backoff. No code content, prompts or fingerprints are written to disk, and resetting the provider clears both caches. The explicit privacy checks and foreground-editor gate are still performed before consulting either cache.

## v0.5.1 bounded Ollama streaming

In addition to the generated-output character cap, `parseNdjson` rejects a response after **1,000,000 transferred bytes** or **4,096 decoded NDJSON events**. Transport chunks may contain multiple independent small events; the **50,000-character event-line limit** applies to each event or partial event, not the full transport chunk. Events with invalid `response` or `done` field types are rejected. Parsing stops at the first `done: true`, and the stream reader is cancelled in cleanup. These are defensive resource limits, not language-model correctness guarantees.

## v0.6.0 Quick Actions workflow

The VS Code status-bar item invokes `lineloom.quickActions` instead of immediately opening diagnostics. Its menu entries are built by a pure action mapper and execute known internal commands only when explicitly chosen. Pausing automatic suggestions updates the existing `lineloom.autoTrigger` global setting and thus preserves the manual provider path while preventing automatic inference. The status item shows **LineLoom Manual** while this setting is off. The workflow does not change the server or make an unrequested HTTP call. A manual model selection or connection check still uses the existing endpoint validation and remote-HTTPS approval gate.

## v0.6.1 redirect-safe inference requests

All three Ollama HTTP operations (`/api/tags`, `/api/show`, `/api/generate`) now send `fetch` with `redirect: "error"`. An endpoint may still receive an allowed request, but it cannot direct LineLoom's HTTP client to send the prompt to a new location via HTTP redirects. An attempted redirect rejects that request; it never automatically authorizes the redirected destination. This is an additional layer after endpoint validation and per-origin remote HTTPS approval. Proxies, DNS resolution and the approved server's own data handling remain outside the extension's control.

## v0.7.0 typed-prefix continuation reuse

After a successful Ollama completion or exact-result cache hit, the completion engine stores a **single** candidate's suggestion text and SHA-256 digests of the precise bounded prefix and suffix, scoped to the file URI, editor language, document version, cursor offset and a settings digest. The entry expires after **12 seconds**. On the next *automatic* request, and **only after workspace trust, file-exclusion and active-cursor checks**, it accepts a single consecutive document-version change where **1–32** characters were inserted immediately after the original cursor and match the start of the candidate, while the old prefix and original suffix remain byte-for-byte identical by digest. It can return just the untyped remainder, and replace its own entry for another one-step edit, without sending a new HTTP request. Manual triggers always take the normal path. Nonmatching edits, different settings and windowed-context shifts conservatively miss this optimization. No source prefix/suffix text is retained by this new cache; the existing limited completed-suggestion cache remains unchanged.

## v0.7.1 actual-edit validation for typed continuations

VS Code's `onDidChangeTextDocument` event now forwards the real edit descriptors to the completion engine. A retained typed-completion remainder is invalidated unless the touched file is the original source and the event represents **exactly one zero-length range insertion** at the previous cursor, with 1–32 characters matching the beginning of that candidate, and a consecutive document version. Multi-cursor/multi-change batches, text replacement, deletion, unrelated source edits and out-of-order document updates clear the candidate. The existing SHA-256 prefix/suffix, configuration digest, trust and ignore-file checks remain independent requirements before a remainder can be returned. No edit text is kept after validation.

## v0.8.0 request timing and in-token guard

The completion engine checks a small portion of the active VS Code line before requesting automatic completion: if the character **immediately after the caret** is an identifier-like Unicode letter/number, underscore or dollar sign, automatic completion is skipped by default. The `lineloom.suppressMidTokenAuto` setting can disable the gate. Explicit/manual requests ignore that guard and use zero typing debounce; all other privacy, endpoint authorization, cancellation, version and cursor checks remain active. The guard does not scan another file, inspect an AST or transmit additional context.

The project-owned source license is now MIT; historical Apache-2.0 release tags are preserved. See [licensing history](../licensing.md).

## v0.8.1 response-state guard

The completion engine rechecks the **latest** settings at the end of generation, before showing native inline ghost text. It rejects output from a superseded model, endpoint, network-approval policy, output parameters or language enablement, or if the extension or automatic mode was disabled. A remote origin must also still be explicitly approved. This supplements the existing cancellation notification, current editor/selection/version checks and second sensitive-file exclusion check. These checks cannot retract code already sent to a previously approved server.

Automatic completion's next-character heuristic now includes Unicode combining marks, connector punctuation and zero-width identifier joiners alongside letters and digits. It remains a small heuristic rather than a full Unicode language grammar.
