import { describe, expect, it } from "vitest";
import { isRequestConfigurationCurrent } from "../../src/completion/request-state";
import { getLanguage } from "../../src/languages/registry";
import type { LineLoomConfig } from "../../src/settings/config";

const base: LineLoomConfig = {
  enabled: true,
  autoTrigger: true,
  enabledLanguages: ["typescript", "python"],
  minAutoTriggerChars: 2,
  suppressMidTokenAuto: true,
  model: "example",
  languageModels: {},
  endpoint: "http://127.0.0.1:11434",
  allowRemoteEndpoints: false,
  debounceMs: 250,
  timeoutMs: 12000,
  maxContextChars: 8000,
  maxOutputTokens: 128,
  multiLine: true,
  maxSuggestionLines: 8,
  temperature: 0.1,
  contextSize: 4096,
  keepAlive: "5m",
  excludedPaths: [],
  crossFileContext: false,
  performanceDiagnostics: false
};
const language = getLanguage("typescript");
if (!language) throw new Error("Test language unavailable");

describe("post-inference configuration revalidation", () => {
  it("allows unchanged active configuration", () => {
    expect(isRequestConfigurationCurrent(base, { ...base }, language, false)).toBe(true);
  });
  it("rejects disabling the extension or automatic inference while a response is pending", () => {
    expect(isRequestConfigurationCurrent(base, { ...base, enabled: false }, language, true)).toBe(false);
    expect(isRequestConfigurationCurrent(base, { ...base, autoTrigger: false }, language, false)).toBe(false);
    expect(isRequestConfigurationCurrent(base, { ...base, autoTrigger: false }, language, true)).toBe(true);
  });
  it("rejects superseded model, origin, remote policy or language eligibility", () => {
    expect(isRequestConfigurationCurrent(base, { ...base, model: "another" }, language, true)).toBe(false);
    expect(isRequestConfigurationCurrent(base, { ...base, languageModels: { typescript: "new-model" } }, language, true)).toBe(false);
    expect(isRequestConfigurationCurrent(base, { ...base, endpoint: "http://127.0.0.1:21212" }, language, true)).toBe(false);
    expect(isRequestConfigurationCurrent(base, { ...base, allowRemoteEndpoints: true }, language, false)).toBe(false);
    expect(isRequestConfigurationCurrent(base, { ...base, enabledLanguages: ["python"] }, language, false)).toBe(false);
  });
  it("rejects output-affecting model and editor preferences", () => {
    expect(isRequestConfigurationCurrent(base, { ...base, temperature: 0.5 }, language, false)).toBe(false);
    expect(isRequestConfigurationCurrent(base, { ...base, maxOutputTokens: 64 }, language, false)).toBe(false);
    expect(isRequestConfigurationCurrent(base, { ...base, multiLine: false }, language, false)).toBe(false);
    expect(isRequestConfigurationCurrent(base, { ...base, suppressMidTokenAuto: false }, language, false)).toBe(false);
  });
  it("rejects privacy exclusions and timeout changes before network dispatch", () => {
    expect(isRequestConfigurationCurrent(base, {
      ...base, excludedPaths: ["**/secrets.ts"]
    }, language, true)).toBe(false);
    expect(isRequestConfigurationCurrent(base, {
      ...base, timeoutMs: 2500
    }, language, false)).toBe(false);
    expect(isRequestConfigurationCurrent(base, {
      ...base, excludedPaths: []
    }, language, true)).toBe(true);
  });

});
