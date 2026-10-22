/**
 * Ollama model tags must match the names returned by /api/tags. Reject
 * malformed user settings rather than crashing during .trim() or sending
 * control characters and arbitrarily long model names to a server.
 * Return an empty tag to make an invalid model unavailable (fail closed).
 */
export function normalizeModelTag(input: unknown): string {
  if (typeof input !== "string") return "";
  const tag = input.trim();
  return tag.length <= 128 && /^[A-Za-z0-9][A-Za-z0-9._/:@-]*$/.test(tag) ? tag : "";
}

/** Reject an invalid configured origin; never silently fall back to localhost. */
export function normalizeEndpointSetting(input: unknown): string {
  return typeof input === "string" ? input.trim() : "";
}

/** Ignore unknown Ollama lifetime formats rather than sending broken options. */
export function normalizeKeepAlive(input: unknown): string {
  if (typeof input !== "string") return "5m";
  const value = input.trim();
  return /^-?(?:0|[1-9][0-9]{0,8})(?:ns|us|µs|ms|s|m|h)?$/.test(value)
    ? value : "5m";
}

/**
 * Missing/invalid exclusion settings are never interpreted as 'include all'.
 * Unknown array elements are rejected as a whole: the wildcard fails closed
 * until the developer repairs the user/workspace configuration.
 */
export function normalizeExcludedPaths(input: unknown): string[] {
  if (input === undefined) return [];
  // Downstream ignore-rule loading deliberately omits blank/NUL patterns.
  // Refuse the whole setting here instead: silently omitting one malformed
  // entry could expose files the developer intended to exclude.
  if (!Array.isArray(input) || input.length > 256 ||
      input.some((value) => typeof value !== "string" ||
        !value.trim() || value.length > 4096 || /[\x00-\x1f\x7f]/.test(value)))
    return ["**"];
  return input;
}
