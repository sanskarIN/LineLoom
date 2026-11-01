# LineLoom language controls

LineLoom registers the VS Code inline-completion provider for twelve language IDs (nine enabled by default):

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
| `html` | HTML | `.html`, `.htm` | New experimental, opt-in only |
| `css` | CSS | `.css` | New experimental, opt-in only |
| `lua` | Lua | `.lua` | New experimental, opt-in only; editor language mode may require an extension |

Actual support uses the **language mode reported by VS Code**, not the filename alone. For example, `.h` files may be recognized as either C or C++ depending on the selected editor mode. If needed, use **Change Language Mode** in VS Code.

## Choose active languages

Open **Command Palette → LineLoom: Manage Autocomplete Languages**, check the languages you want, and confirm. This updates the global `lineloom.enabledLanguages` setting. You can alternatively edit the setting as an array of known IDs:

```json
"lineloom.enabledLanguages": ["python", "typescript", "rust", "go"]
```

The existing nine defaults are unchanged. To try HTML, CSS or Lua, explicitly select them in Manage Autocomplete Languages or add `"html"`, `"css"` or `"lua"` to the setting. In an editor without a Lua language extension, first install a trusted language-mode provider or set the correct VS Code language mode. This is **development source only** until reviewed and released; real-model quality and physical editor accessibility have not yet been tested. The first-party LineLoom Code model track still targets only Rust, C, C++, Python and TypeScript.

Removing an ID turns off LineLoom's model requests for that language. Choosing **no languages** disables all model-backed inline completions, including manual ones. To restore the defaults, reset the setting in VS Code Settings. JSX uses the `javascript` selection and TSX uses the `typescript` selection.

## Rust completion context (instruction-mode models)

For generic local Ollama models, the Rust prompt builder recognizes common
constructs such as match arms, borrowing, async closures, generic capture
bounds, conditional `let`-chains, explicit `unsafe extern` blocks, and
Rust 2024 `#[unsafe(no_mangle)]`, `#[unsafe(export_name = "...")]`, and
`#[unsafe(link_section = "...")]` attributes. It adds only fixed,
bounded guidance after masking comments and string contents; it does **not**
compile, type-check or rewrite source code.

Explicitly selected native-FIM models still receive the original
prefix/suffix without these added instructions. This is a heuristic
completion aid, not a claim of Rust edition compatibility, verified
generated-code correctness or a trained LineLoom Code model.

## Model compatibility and security

Language registration is not a guarantee that any particular installed Ollama model can generate useful completions. Choose an appropriately licensed coding model and review all generated code. LineLoom still checks workspace trust, file exclusions and nested ignore rules **before** sending context to the configured endpoint. Remote endpoints require separate HTTPS approval. No AI model weights are included or installed automatically.
