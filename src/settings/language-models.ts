import { LANGUAGES, type SupportedLanguage } from "../languages/registry";
import { normalizeModelTag } from "./normalize";

/** A bounded, editor-only mapping. Unknown keys and malformed model tags are ignored. */
export type LanguageModels = Partial<Record<SupportedLanguage, string>>;

export function normalizeLanguageModels(input: unknown): LanguageModels {
  const result: LanguageModels = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return result;
  const values = input as Record<string, unknown>;
  for (const { id: language } of LANGUAGES) {
    const value = values[language];
    const model = normalizeModelTag(value);
    if (model) result[language] = model;
  }
  return result;
}

/** JSX/TSX share the existing JavaScript/TypeScript language identifiers. */
export function resolveLanguageModel(
  defaultModel: string, languageId: SupportedLanguage, overrides: LanguageModels
): string {
  return overrides[languageId] || defaultModel;
}
