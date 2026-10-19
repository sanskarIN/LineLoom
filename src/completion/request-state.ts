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
    initial.endpoint === latest.endpoint &&
    initial.allowRemoteEndpoints === latest.allowRemoteEndpoints &&
    initial.maxContextChars === latest.maxContextChars &&
    initial.maxOutputTokens === latest.maxOutputTokens &&
    initial.maxSuggestionLines === latest.maxSuggestionLines &&
    initial.multiLine === latest.multiLine &&
    initial.contextSize === latest.contextSize &&
    initial.temperature === latest.temperature &&
    initial.keepAlive === latest.keepAlive &&
    initial.suppressMidTokenAuto === latest.suppressMidTokenAuto &&
    initial.minAutoTriggerChars === latest.minAutoTriggerChars;
}
