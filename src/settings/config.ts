import * as vscode from "vscode";
import {
  normalizeModelTag, normalizeEndpointSetting, normalizeKeepAlive,
  normalizeExcludedPaths, normalizePermissionToggle, normalizeNumericSetting
} from "./normalize";
import { normalizeLanguageModels, type LanguageModels } from "./language-models";
import { normalizeEnabledLanguages, type SupportedLanguage } from "../languages/registry";
export interface LineLoomConfig {
  enabled: boolean;
  autoTrigger: boolean;
  enabledLanguages: SupportedLanguage[];
  minAutoTriggerChars: number;
  suppressMidTokenAuto: boolean;
  model: string;
  languageModels: LanguageModels;
  endpoint: string;
  allowRemoteEndpoints: boolean;
  debounceMs: number;
  timeoutMs: number;
  maxContextChars: number;
  maxOutputTokens: number;
  multiLine: boolean;
  maxSuggestionLines: number;
  temperature: number;
  contextSize: number;
  keepAlive: string;
  excludedPaths: string[];
  crossFileContext: boolean;
  performanceDiagnostics: boolean;
}
export function readConfig(): LineLoomConfig {
  const c = vscode.workspace.getConfiguration("lineloom");
  return {
    enabled: normalizePermissionToggle(c.get<unknown>("enabled"), true),
    autoTrigger: normalizePermissionToggle(c.get<unknown>("autoTrigger"), true),
    enabledLanguages: normalizeEnabledLanguages(c.get<unknown>("enabledLanguages")),

    minAutoTriggerChars: normalizeNumericSetting(c.get<unknown>("minAutoTriggerChars"), 2, 0, 32, true),
    suppressMidTokenAuto: c.get<unknown>("suppressMidTokenAuto") !== false,
    model: normalizeModelTag(c.get<unknown>("model", "qwen2.5-coder:1.5b")),
    languageModels: normalizeLanguageModels(c.get<unknown>("languageModels")),
    endpoint: normalizeEndpointSetting(c.get<unknown>("endpoint", "http://127.0.0.1:11434")),
    allowRemoteEndpoints: normalizePermissionToggle(c.get<unknown>("allowRemoteEndpoints")),
    debounceMs: normalizeNumericSetting(c.get<unknown>("debounceMs"), 250, 0, 3000, true),
    timeoutMs: normalizeNumericSetting(c.get<unknown>("timeoutMs"), 12000, 1000, 120000, true),
    maxContextChars: normalizeNumericSetting(c.get<unknown>("maxContextChars"), 8000, 512, 30000, true),
    maxOutputTokens: normalizeNumericSetting(c.get<unknown>("maxOutputTokens"), 128, 16, 512, true),
    multiLine: c.get<unknown>("multiLine") !== false,
    maxSuggestionLines: normalizeNumericSetting(c.get<unknown>("maxSuggestionLines"), 8, 1, 20, true),
    temperature: normalizeNumericSetting(c.get<unknown>("temperature"), 0.1, 0, 1),
    contextSize: normalizeNumericSetting(c.get<unknown>("contextSize"), 4096, 512, 32768, true),
    keepAlive: normalizeKeepAlive(c.get<unknown>("keepAlive", "5m")),
    excludedPaths: normalizeExcludedPaths(c.get<unknown>("excludedPaths", [])),
    crossFileContext: c.get<unknown>("crossFileContext", false) === true,
    performanceDiagnostics: c.get<unknown>("performanceDiagnostics", false) === true
  };
}
export { validateEndpoint } from "./endpoint";
