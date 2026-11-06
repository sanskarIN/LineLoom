/** VS Code language IDs, not filename-only inference. */
export type SupportedLanguage = "python" | "javascript" | "typescript" | "rust" | "kotlin" | "go" | "java" | "c" | "cpp" | "html" | "css" | "lua" | "cuda-cpp" | "csharp" | "swift" | "dart" | "ruby" | "php";
export interface LanguageSpec {
  id: SupportedLanguage;
  label: string;
  extensions: readonly string[];
  guidance: string;
}
export const LANGUAGES: readonly LanguageSpec[] = [
  { id: "python", label: "Python", extensions: [".py", ".pyi"], guidance: "Maintain Python indentation and existing annotations." },
  { id: "javascript", label: "JavaScript", extensions: [".js", ".mjs", ".cjs", ".jsx"], guidance: "Use surrounding ES modules or CommonJS style consistently." },
  { id: "typescript", label: "TypeScript", extensions: [".ts", ".tsx", ".mts", ".cts"], guidance: "Respect visible types, generics and imports; do not invent symbols." },
  { id: "rust", label: "Rust", extensions: [".rs"], guidance: "Prefer idiomatic Rust and conservative ownership patterns." },
  { id: "kotlin", label: "Kotlin", extensions: [".kt", ".kts"], guidance: "Respect Kotlin nullability, JVM conventions and coroutine context." },
  { id: "go", label: "Go", extensions: [".go"], guidance: "Preserve idiomatic Go error handling, packages and formatting." },
  { id: "java", label: "Java", extensions: [".java"], guidance: "Respect Java class scope, imports, types and checked exceptions." },
  { id: "c", label: "C", extensions: [".c", ".h"], guidance: "Respect C syntax, pointer safety, allocation and error conventions." },
  { id: "cpp", label: "C++", extensions: [".cc", ".cpp", ".cxx", ".hpp", ".hxx", ".hh"], guidance: "Respect C++ standard, RAII, headers, templates and visible namespaces." },
  { id: "html", label: "HTML", extensions: [".html", ".htm"], guidance: "Respect document structure, matching tags, attribute quoting and accessible markup." },
  { id: "css", label: "CSS", extensions: [".css"], guidance: "Respect existing selectors, cascade conventions, property syntax and brace matching." },
  { id: "lua", label: "Lua", extensions: [".lua"], guidance: "Respect Lua local scope, tables, block endings and the existing runtime version." },
  { id: "cuda-cpp", label: "CUDA C++", extensions: [".cu", ".cuh"], guidance: "Respect CUDA host/device qualifiers, kernel launch syntax, thread indexing, bounds checks, memory spaces and synchronization; preserve existing C++ types and architecture constraints." },
  { id: "csharp", label: "C#", extensions: [".cs", ".csx"], guidance: "Respect C# nullable reference types, namespaces, using directives, generics, async/await, exception handling and existing .NET API contracts; do not invent types or members." },
  { id: "swift", label: "Swift", extensions: [".swift"], guidance: "Respect Swift optionals, value semantics, actors, async/await, access control and visible module APIs; do not invent declarations." },
  { id: "dart", label: "Dart", extensions: [".dart"], guidance: "Respect Dart null safety, Future and Stream contracts, class members, imports and existing Flutter widget structure when present." },
  { id: "ruby", label: "Ruby", extensions: [".rb", ".rake", ".gemspec"], guidance: "Respect Ruby blocks, end delimiters, method visibility, module lookup and the existing project conventions." },
  { id: "php", label: "PHP", extensions: [".php", ".phtml"], guidance: "Respect PHP opening tags, namespace imports, types, nullability, array syntax and existing framework conventions." }
] as const;
const byId = new Map(LANGUAGES.map((language) => [language.id, language]));
const aliases: Record<string, SupportedLanguage> = {
  javascriptreact: "javascript", typescriptreact: "typescript",
  // Official VS Code mode is cuda-cpp; some optional CUDA extensions use cuda.
  cuda: "cuda-cpp"
};
export function getLanguage(id: string): LanguageSpec | undefined {
  return byId.get((aliases[id] ?? id) as SupportedLanguage);
}
/** Preserve the nine previously enabled languages; experimental additions require an explicit opt-in. */
export const DEFAULT_ENABLED_LANGUAGES: readonly SupportedLanguage[] = [
  "python", "javascript", "typescript", "rust", "kotlin", "go", "java", "c", "cpp"
];

/** Reject unknown configuration IDs rather than accidentally enabling a new language. */
export function normalizeEnabledLanguages(configured: unknown): SupportedLanguage[] {
  if (configured === undefined) return [...DEFAULT_ENABLED_LANGUAGES];
  if (!Array.isArray(configured)) return [];
  const allowed = new Set(LANGUAGES.map((language) => language.id));
  return [...new Set(configured.filter((id): id is SupportedLanguage => typeof id === "string" && allowed.has(id as SupportedLanguage)))];
}
export function isLanguageEnabled(language: LanguageSpec, enabled: readonly SupportedLanguage[]): boolean {
  return enabled.includes(language.id);
}
