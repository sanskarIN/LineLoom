import { getLanguage, isLanguageEnabled, type SupportedLanguage } from "../languages/registry";
import { resolveLanguageModel, type LanguageModels } from "../settings/language-models";
import type { SidebarEndpointState } from "./sidebar-model";

/**
 * Describe only the active editor's VS Code language ID and URI scheme.
 * Never receive the document, full URI, filename, contents, or a network client.
 */
export interface EditorContextInput {
  languageId?: string;
  scheme?: string;
  enabled: boolean;
  workspaceTrusted: boolean;
  enabledLanguages: readonly SupportedLanguage[];
  defaultModel: string;
  languageModels: LanguageModels;
  endpointState: SidebarEndpointState;
}

export interface EditorContextSummary {
  language: string;
  model: string;
  modelSource: string;
  eligibility: string;
}

/**
 * This is a settings-level diagnostic, NOT the engine's per-file privacy
 * decision. Sensitive-file and ignore rules are evaluated before inference.
 */
export function summarizeActiveEditor(input: EditorContextInput): EditorContextSummary {
  if (!input.languageId) {
    return { language: "No active editor", model: "Not applicable", modelSource: "",
      eligibility: "Open a supported code file" };
  }
  const language = getLanguage(input.languageId);
  if (!language) {
    return { language: "Unsupported language", model: "Not applicable", modelSource: "",
      eligibility: "No inline provider for this language" };
  }
  const selected = resolveLanguageModel(input.defaultModel, language.id, input.languageModels);
  const modelSource = input.languageModels[language.id] ? "Language override" : "Default model";
  let eligibility: string;
  if (!input.enabled) eligibility = "Autocomplete disabled";
  else if (!input.workspaceTrusted) eligibility = "Workspace restricted";
  else if (input.scheme !== "file") eligibility = "Only local file editors support completion";
  else if (!isLanguageEnabled(language, input.enabledLanguages)) eligibility = "Language disabled in settings";
  else if (!selected.trim()) eligibility = "No model configured";
  else if (input.endpointState === "invalid") eligibility = "Invalid inference endpoint";
  else if (input.endpointState === "remote-blocked") eligibility = "Remote endpoint disabled";
  else if (input.endpointState === "remote-needs-approval") eligibility = "Remote endpoint approval required";
  else eligibility = "Allowed by settings; file rules checked on request";
  return { language: language.label, model: selected, modelSource, eligibility };
}
