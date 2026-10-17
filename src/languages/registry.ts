/** VS Code identifiers, not filename-only inference. */
export type SupportedLanguage = "python" | "javascript" | "typescript" | "rust" | "kotlin";
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
  { id: "kotlin", label: "Kotlin", extensions: [".kt", ".kts"], guidance: "Respect Kotlin nullability, JVM conventions and coroutine context." }
] as const;
const byId = new Map(LANGUAGES.map((language) => [language.id, language]));
export function getLanguage(id: string): LanguageSpec | undefined {
  const aliases: Record<string, SupportedLanguage> = { javascriptreact: "javascript", typescriptreact: "typescript" };
  return byId.get((aliases[id] ?? id) as SupportedLanguage);
}
