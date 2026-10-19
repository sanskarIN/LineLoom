import { DEFAULT_ENABLED_LANGUAGES, type SupportedLanguage } from "../languages/registry";

/** A bounded, editor-only mapping. Unknown keys and malformed model tags are ignored. */
export type LanguageModels = Partial<Record<SupportedLanguage, string>>;

export function normalizeLanguageModels(input: unknown): LanguageModels {
  const result: LanguageModels = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return result;
  const values = input as Record<string, unknown>;
  for (const language of DEFAULT_ENABLED_LANGUAGES) {
    const value = values[language];
    if (typeof value !== "string") continue;
    const model = value.trim();
    if (model && model.length <= 128 && !/[\u0000-\u001f\u007f]/.test(model)) result[language] = model;
  }
  return result;
}

/** JSX/TSX share the existing JavaScript/TypeScript language identifiers. */
export function resolveLanguageModel(
  defaultModel: string, languageId: SupportedLanguage, overrides: LanguageModels
): string {
  return overrides[languageId] || defaultModel;
}
