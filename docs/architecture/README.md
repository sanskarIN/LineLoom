# Architecture and lifecycle

1. VS Code calls `CompletionEngine.provideInlineCompletionItems` for five registered language IDs.
2. The engine checks preferences, workspace trust and sensitive-file exclusion. Only the current document is considered.
3. A debounce delays repeated requests. New requests cancel the previous generation; later editor-version checks discard stale results.
4. `extractContext` takes bounded prefix and suffix snippets and computes indentation.
5. `buildPrompt` uses Ollama's `suffix` for configured Qwen2.5 Coder model names and a conservative completion prompt for other models.
6. `generateCompletion` calls `/api/generate` and parses streaming NDJSON events, capped in size.
7. `cleanCompletion` removes common response artifacts and exact suffix overlaps. VS Code displays native ghost text and handles acceptance.

Commands use native VS Code status bars, notifications and configuration UI; there are no webviews, third-party analytics, shell invocations or automatic model downloads.

**Intentional limitations:** no full syntax-tree analysis, no cross-file indexing, no guaranteed syntax-correct suggestions, no language-server integration, and no universal model-specific FIM template. Rust performance modules are deliberately deferred pending profiling.

## v0.2.0 completion cache

Identical in-flight request parameters and current-document context are digested into an ephemeral SHA-256 key after privacy checks. A small, bounded, memory-only cache retains successful completion text for up to 15 seconds to reduce duplicate local inference. It is cleared when extension settings change or the provider is disposed. Cache hits still require an active, matching editor and the usual trusted-workspace and sensitive path checks. The extension neither persists these results nor indexes other files.
