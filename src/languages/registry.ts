/** VS Code language IDs, not filename-only inference. */
export type SupportedLanguage = "python" | "javascript" | "typescript" | "rust" | "kotlin" | "go" | "java" | "c" | "cpp";
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
  { id: "cpp", label: "C++", extensions: [".cc", ".cpp", ".cxx", ".hpp", ".hxx", ".hh"], guidance: "Respect C++ standard, RAII, headers, templates and visible namespaces." }
] as const;
const byId = new Map(LANGUAGES.map((language) => [language.id, language]));
const aliases: Record<string, SupportedLanguage> = { javascriptreact: "javascript", typescriptreact: "typescript" };
export function getLanguage(id: string): LanguageSpec | undefined {
  return byId.get((aliases[id] ?? id) as SupportedLanguage);
}
export const DEFAULT_ENABLED_LANGUAGES: readonly SupportedLanguage[] = LANGUAGES.map((language) => language.id);

/** Reject unknown configuration IDs rather than accidentally enabling a new language. */
export function normalizeEnabledLanguages(configured: unknown): SupportedLanguage[] {
  if (configured === undefined) return [...DEFAULT_ENABLED_LANGUAGES];
  if (!Array.isArray(configured)) return [];
  const allowed = new Set(DEFAULT_ENABLED_LANGUAGES);
  return [...new Set(configured.filter((id): id is SupportedLanguage => typeof id === "string" && allowed.has(id as SupportedLanguage)))];
}
export function isLanguageEnabled(language: LanguageSpec, enabled: readonly SupportedLanguage[]): boolean {
  return enabled.includes(language.id);
}
