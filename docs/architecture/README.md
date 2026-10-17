# Architecture and lifecycle

1. VS Code calls `CompletionEngine.provideInlineCompletionItems` for nine registered language IDs (five initial plus four experimental v0.4.0 additions).
2. The engine checks preferences, workspace trust and sensitive-file exclusion. Only the current document is considered.
3. A debounce delays repeated requests. New requests cancel the previous generation; later editor-version checks discard stale results.
4. `extractContextWindow` uses limited text ranges around the cursor (not a whole-file copy) and computes indentation.
5. `buildPrompt` uses Ollama's `suffix` for configured Qwen2.5 Coder model names and a conservative completion prompt for other models.
6. `generateCompletion` calls `/api/generate` and parses streaming NDJSON events, capped in size.
7. `cleanCompletion` removes common response artifacts and exact suffix overlaps. VS Code displays native ghost text and handles acceptance.

Commands use native VS Code status bars, notifications and configuration UI; there are no webviews, third-party analytics, shell invocations or automatic model downloads.

**Intentional limitations:** no full syntax-tree analysis, no cross-file indexing, no guaranteed syntax-correct suggestions, no language-server integration, and no universal model-specific FIM template. Rust performance modules are deliberately deferred pending profiling.

## v0.2.0 completion cache

Identical in-flight request parameters and current-document context are digested into an ephemeral SHA-256 key after privacy checks. A small, bounded, memory-only cache retains successful completion text for up to 15 seconds to reduce duplicate local inference. It is cleared when extension settings change or the provider is disposed. Cache hits still require an active, matching editor and the usual trusted-workspace and sensitive path checks. The extension neither persists these results nor indexes other files.

## v0.3.0 nested ignore rules and auto-trigger threshold

Before context is read or any inference occurs, the provider evaluates the current workspace path and its canonical target. Every applicable root/nested `.gitignore` and `.lineloomignore` is loaded conservatively and evaluated relative to its own directory, with separate sources unable to override each other. Automatically triggered requests require `lineloom.minAutoTriggerChars` meaningful characters on the active line (default 2); explicitly triggered requests bypass that count. Two small windowed reads cover the surrounding context instead of allocating a full copy of large documents.

## v0.4.0 language registration and preferences

The language registry maps nine VS Code language identifiers to language-specific guidance. JavaScript React and TypeScript React share their respective JavaScript/TypeScript preferences. The `lineloom.enabledLanguages` setting is normalized to known IDs only: unknown identifiers cannot inadvertently enable inference, and an intentionally empty list prevents all provider requests. The VS Code **Manage Autocomplete Languages** command updates that same setting, and preference changes invalidate in-progress suggestions and cached results. New Go, Java, C and C++ language support is experimental until live-model quality testing is completed.
