import * as vscode from "vscode";
import { normalizeModelTag, normalizeEndpointSetting, normalizeKeepAlive, normalizeExcludedPaths } from "./normalize";
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
export function clamp(value: number, lower: number, upper: number): number {
  return Number.isFinite(value) ? Math.min(upper, Math.max(lower, value)) : lower;
}
export function readConfig(): LineLoomConfig {
  const c = vscode.workspace.getConfiguration("lineloom");
  return {
    enabled: c.get("enabled", true),
    autoTrigger: c.get("autoTrigger", true),
    enabledLanguages: normalizeEnabledLanguages(c.get<unknown>("enabledLanguages")),

    minAutoTriggerChars: clamp(c.get("minAutoTriggerChars", 2), 0, 32),
    suppressMidTokenAuto: c.get("suppressMidTokenAuto", true),
    model: normalizeModelTag(c.get<unknown>("model", "qwen2.5-coder:1.5b")),
    languageModels: normalizeLanguageModels(c.get<unknown>("languageModels")),
    endpoint: normalizeEndpointSetting(c.get<unknown>("endpoint", "http://127.0.0.1:11434")),
    allowRemoteEndpoints: c.get("allowRemoteEndpoints", false),
    debounceMs: clamp(c.get("debounceMs", 250), 0, 3000),
    timeoutMs: clamp(c.get("timeoutMs", 12000), 1000, 120000),
    maxContextChars: clamp(c.get("maxContextChars", 8000), 512, 30000),
    maxOutputTokens: clamp(c.get("maxOutputTokens", 128), 16, 512),
    multiLine: c.get("multiLine", true),
    maxSuggestionLines: clamp(c.get("maxSuggestionLines", 8), 1, 20),
    temperature: clamp(c.get("temperature", 0.1), 0, 1),
    contextSize: clamp(c.get("contextSize", 4096), 512, 32768),
    keepAlive: normalizeKeepAlive(c.get<unknown>("keepAlive", "5m")),
    excludedPaths: normalizeExcludedPaths(c.get<unknown>("excludedPaths", [])),
    crossFileContext: c.get("crossFileContext", false),
    performanceDiagnostics: c.get<unknown>("performanceDiagnostics", false) === true
  };
}
export { validateEndpoint } from "./endpoint";
