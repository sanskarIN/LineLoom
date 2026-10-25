import type { LineLoomConfig } from "../settings/config";
import { isLanguageEnabled, type LanguageSpec } from "../languages/registry";

/**
 * Last-moment guard: a configuration event may be queued while the model
 * response is already arriving. Do not offer a suggestion under superseded
 * inference settings, even if the extension's cancellation handler is late.
 */
export function isRequestConfigurationCurrent(
  initial: LineLoomConfig,
  latest: LineLoomConfig,
  language: LanguageSpec,
  manual: boolean
): boolean {
  if (!latest.enabled || (!manual && !latest.autoTrigger) ||
      !isLanguageEnabled(language, latest.enabledLanguages)) return false;
  return initial.model === latest.model &&
    JSON.stringify(initial.languageModels) === JSON.stringify(latest.languageModels) &&
    initial.endpoint === latest.endpoint &&
    initial.allowRemoteEndpoints === latest.allowRemoteEndpoints &&
    initial.crossFileContext === latest.crossFileContext &&
    initial.maxContextChars === latest.maxContextChars &&
    initial.maxOutputTokens === latest.maxOutputTokens &&
    initial.maxSuggestionLines === latest.maxSuggestionLines &&
    initial.multiLine === latest.multiLine &&
    initial.contextSize === latest.contextSize &&
    initial.temperature === latest.temperature &&
    initial.keepAlive === latest.keepAlive &&
    initial.timeoutMs === latest.timeoutMs &&
    JSON.stringify(initial.excludedPaths) === JSON.stringify(latest.excludedPaths) &&
    initial.suppressMidTokenAuto === latest.suppressMidTokenAuto &&
    initial.minAutoTriggerChars === latest.minAutoTriggerChars;
}

/**
 * Asynchronous filesystem inspection is not atomic with a VS Code settings
 * update. Recheck settings, editor/trust state and remote consent both before
 * and AFTER the policy read: a queued settings-change handler may not yet have
 * cancelled the request. Never return approval from a stale policy snapshot.
 */
export async function isResponseStillEligible(
  initial: LineLoomConfig,
  language: LanguageSpec,
  manual: boolean,
  readLatest: () => LineLoomConfig,
  environmentCurrent: () => boolean,
  checkFile: (patterns: readonly string[], collectTiming: boolean) => Promise<boolean>
): Promise<boolean> {
  const before = readLatest();
  if (!isRequestConfigurationCurrent(initial, before, language, manual) ||
      !environmentCurrent()) return false;
  if (!await checkFile(before.excludedPaths, before.performanceDiagnostics)) return false;
  return environmentCurrent() &&
    isRequestConfigurationCurrent(initial, readLatest(), language, manual);
}
