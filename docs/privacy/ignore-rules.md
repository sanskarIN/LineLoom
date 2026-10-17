# Ignore patterns and trust model

LineLoom only completes documents inside a trusted local VS Code workspace. It blocks known sensitive filenames and directory segments, including `.env*`, private keys, `credentials*`, `secrets*`, `.git`, `node_modules`, `build` and `dist`. Add your own patterns with `lineloom.excludedPaths`.

At the **workspace root**, add `.lineloomignore` or `.gitignore` to define ignored paths. Their contents use npm's `ignore` library with gitignore-like patterns; e.g.:

```gitignore
private/
*.secret.json
generated/
```

Rules are cached for at most 30 seconds, with changes to ignore files triggering cache invalidation. Each ignore source is evaluated separately, so negative patterns in one source cannot override another source's exclusions. Nested `.gitignore` files are not yet read. Root ignore files and user patterns are applied jointly; sensitive path blocking cannot be overridden. This is **not a secret scanner**: if your source contains credentials in a normal filename, LineLoom cannot guarantee that they will be detected. Exclude sensitive directories explicitly.


## v0.1.1 privacy corrections

Symbolic links are resolved before a completion request. A link that points outside the trusted workspace is ineligible, and both the link path and the target's workspace-relative path must pass sensitive-file and ignore checks. If a path or an existing ignore file cannot be read, completion is conservatively denied. Missing root-level ignore files remain valid. Nested `.gitignore` files and content-based secret scanning are not implemented.
