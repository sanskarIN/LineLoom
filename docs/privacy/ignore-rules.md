# Ignore patterns and trust model

LineLoom only completes local files within a **trusted VS Code workspace**. Files outside the workspace, symlinks escaping the workspace, and known sensitive filename/directory patterns (e.g., `.env`, `.ssh`, `.git`, `node_modules`, `build`) are excluded unconditionally. Configure additional workspace-relative patterns using `lineloom.excludedPaths`.

## Root and nested ignore files (v0.3.0)

Create a `.gitignore` or `.lineloomignore` at the workspace root **or within any ancestor directory of a source file**. For example:

```text
workspace/
  .gitignore
  src/
    .lineloomignore
    public.ts
    private.ts
```

If `src/.lineloomignore` contains `private.ts`, LineLoom refuses completion in `src/private.ts`, even if a parent/root file does not exclude it. A rule in `src/.gitignore` is interpreted relative to `src/`; root files are interpreted relative to the workspace root. Sibling directories' rules do not apply.

Each ignore source is checked independently. **A negation in any other file or directory cannot undo an exclusion already established by another source**. This is intentionally stricter than ordinary Git ignore override precedence to prevent accidental transmission of excluded code. Within the same source, normal `ignore` syntax (including same-file negation) applies.

The named path and canonical target of an in-workspace symlink must both pass exclusion rules. A symlink pointing outside the trusted workspace is denied.

**Safety limits:** ignore files must be smaller than 128 KB each; directory traversal is capped at 24 scopes and fails closed for deeper paths. Ignored rules are cached up to 20 seconds and cleared when VS Code notices ignore file changes. Missing optional ignore files are allowed; unreadable existing files and invalid patterns prevent completion for the affected path.

## What the exclusion system does not do

It does **not** inspect source text to detect embedded credentials, does not read ignore sources outside the workspace, and is not a substitute for a secret scanner. Exclude directories and files containing sensitive content. Ollama receives code snippets only after the workspace/path/ignore checks pass. Remote HTTPS inference, when explicitly approved, may transmit snippets off-device; see [PRIVACY.md](../../PRIVACY.md).
