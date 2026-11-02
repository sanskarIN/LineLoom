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

## C and C++ completion context (instruction-mode models)

Generic local Ollama models now receive **fixed, bounded** C and C++
syntax guidance inferred from the already-approved editor prefix.
For C this covers allocations/pointers, struct/union/enum declarations,
function pointers and preprocessor directives. For C++ it covers templates
and constraints, RAII/move semantics, lambdas, constexpr/noexcept and
coroutines. The two language modes remain distinct: C-only guidance does
not suggest C++ features, and C++ guidance does not assume a specific
language-standard version.

The lexical scanner masks comments, character/string literals and C++
raw-string payloads, and interprets backslash-newline continuations before
comment detection. It returns **only allowlisted instruction text**, never
filenames, identifiers or source snippets. It scans a bounded prefix and
is not a parser, type checker or guarantee of code correctness; a source
window beginning inside an earlier multiline comment/literal can be
misclassified. The model must still respect existing visible code.

As with Rust, native FIM-capable Ollama tags receive their **original
prefix and suffix without additional instructions**, including for C and
C++. No weights, model downloads, editor source collection, new endpoint
permissions or release are added by this change.

## Untrusted source framing (generic instruction-mode models)

Source content and explicitly user-selected related files are **data**, not
instructions. In generic Ollama instruction prompts, LineLoom now prefixes
every source line with `| ` and explains that this marker is not code.
This prevents raw source lines such as `</before>`, `</reference>`, or
`Completion:` from being formatted as new top-level prompt sections.
CRLF/CR line endings are normalized for display; additional visual line
separator characters are shown as escaped Unicode code points so they
cannot create unquoted prompt lines. The source is not rewritten in the
editor, and only the already-approved bounded source is included.

This is **structural prompt-framing hardening, not a prompt-injection
guarantee**: an instruction-following model can still misunderstand or act
on malicious comments. Outputs remain untrusted and require developer
review. Native FIM model requests without selected references still send
the exact original prefix/suffix, without any line prefixes or rewriting.

The separate developer synthetic evaluation harness uses its own versioned
instruction protocol; its synthetic scores are **not** evidence that this
editor-specific framing improves real model completion quality. Re-run
controlled local/editor tests before making quality claims.

## Model compatibility and security

Language registration is not a guarantee that any particular installed Ollama model can generate useful completions. Choose an appropriately licensed coding model and review all generated code. LineLoom still checks workspace trust, file exclusions and nested ignore rules **before** sending context to the configured endpoint. Remote endpoints require separate HTTPS approval. No AI model weights are included or installed automatically.

## Python, JavaScript and TypeScript lexical context hints (unreleased)

Generic local **instruction-mode** models receive up to four fixed, language-specific
hints inferred from the already-approved bounded prefix. Python guidance covers
async, typing, exceptions, context managers, match/case and decorators.
JavaScript covers modules, Promise/async, functions and exceptions; TypeScript
also covers interfaces and types. The scanner masks comments, ordinary and
triple-quoted strings, JavaScript templates, and common regexp literals.

Hints use **only fixed text**: no identifiers, filenames, paths or snippets are
copied into the hints themselves. No workspace scan, new source reads, model
downloads, network calls, training or persistent index is introduced. This is a
30,000-character **best-effort lexical heuristic**, not a parser or a proof of
syntax correctness. If the bounded window starts inside a previously opened
literal, its inferred state can be wrong. Native FIM models still receive the
byte-exact approved prefix and suffix when no related file has been selected.
Real local-model quality and physical editor QA remain unverified. Publisher
migration and any additional release are postponed.

## JavaScript/TypeScript regexp expression boundaries (development source)

The local instruction-mode lexical scanner now recognizes regex literals at
expression starts immediately after arrow-function (\`=>\`) and logical
(\`||\`, \`&&\`) operators. Their contents are masked before choosing
allowlisted autocomplete hints, so text resembling \`async function\` or
\`interface\` inside regex patterns does not become fabricated syntax
context. Escaped slashes inside a regex remain literal content; ordinary
division after these operators is still scanned as source.

This is bounded best-effort lexical recognition, not a JavaScript/TypeScript
parser or proof of generated-code correctness. It does not alter the native
FIM prefix/suffix, read files, change Ollama endpoints, publish weights or
imply improved real-model results. Physical editor and model QA remain needed.

## Completion fence language matching (unreleased)

Generic local models sometimes return a Markdown code block tagged for a
different programming language. LineLoom now checks the **explicit fence
label** against VS Code's active language mode. Known mismatches, including
other language-family fences, are rejected before they become ghost text.
Common aliases are supported. JavaScript snippets may be used in TypeScript
editors, and ordinary C snippets in C++ editors, but not conversely.

Plain source, unlabeled code fences, and unknown/custom labels retain the
previous behavior. This is a conservative formatting quality gate, **not**
a syntax or compiler check. The feature adds no new endpoint calls, file reads,
persistent telemetry or source indexing; native FIM prompts and user privacy
controls are unchanged. Publisher migration and new releases remain paused.
