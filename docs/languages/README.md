# LineLoom language controls — v0.4.0

LineLoom registers the VS Code inline-completion provider for nine language IDs:

| VS Code ID | Language | Typical extensions | Preview status |
| --- | --- | --- | --- |
| `python` | Python | `.py`, `.pyi` | Initial |
| `javascript` | JavaScript (including JSX) | `.js`, `.jsx`, `.mjs`, `.cjs` | Initial |
| `typescript` | TypeScript (including TSX) | `.ts`, `.tsx`, `.mts`, `.cts` | Initial |
| `rust` | Rust | `.rs` | Initial |
| `kotlin` | Kotlin | `.kt`, `.kts` | Initial |
| `go` | Go | `.go` | Experimental in v0.4.0 |
| `java` | Java | `.java` | Experimental in v0.4.0 |
| `c` | C | `.c`, some `.h` | Experimental in v0.4.0 |
| `cpp` | C++ | `.cpp`, `.cc`, `.cxx`, `.hpp` | Experimental in v0.4.0 |

Actual support uses the **language mode reported by VS Code**, not the filename alone. For example, `.h` files may be recognized as either C or C++ depending on the selected editor mode. If needed, use **Change Language Mode** in VS Code.

## Choose active languages

Open **Command Palette → LineLoom: Manage Autocomplete Languages**, check the languages you want, and confirm. This updates the global `lineloom.enabledLanguages` setting. You can alternatively edit the setting as an array of known IDs:

```json
"lineloom.enabledLanguages": ["python", "typescript", "rust", "go"]
```

Removing an ID turns off LineLoom's model requests for that language. Choosing **no languages** disables all model-backed inline completions, including manual ones. To restore the defaults, reset the setting in VS Code Settings. JSX uses the `javascript` selection and TSX uses the `typescript` selection.

## Model compatibility and security

Language registration is not a guarantee that any particular installed Ollama model can generate useful completions. Choose an appropriately licensed coding model and review all generated code. LineLoom still checks workspace trust, file exclusions and nested ignore rules **before** sending context to the configured endpoint. Remote endpoints require separate HTTPS approval. No AI model weights are included or installed automatically.
