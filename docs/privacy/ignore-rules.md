# Ignore patterns and trust model

LineLoom only completes documents inside a trusted local VS Code workspace. It blocks known sensitive filenames and directory segments, including `.env*`, private keys, `credentials*`, `secrets*`, `.git`, `node_modules`, `build` and `dist`. Add your own patterns with `lineloom.excludedPaths`.

At the **workspace root**, add `.lineloomignore` or `.gitignore` to define ignored paths. Their contents use npm's `ignore` library with gitignore-like patterns; e.g.:

```gitignore
private/
*.secret.json
generated/
```

Rules are cached for 30 seconds. Nested `.gitignore` files are not yet read. Root ignore files and user patterns are applied jointly; sensitive path blocking cannot be overridden. This is **not a secret scanner**: if your source contains credentials in a normal filename, LineLoom cannot guarantee that they will be detected. Exclude sensitive directories explicitly.
