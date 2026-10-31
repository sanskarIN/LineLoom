/**
 * Retry only transient VS Code test binary download transport errors.
 * Never repeat extension-host tests or mask assertion/integrity failures.
 * A bounded retry only reduces CI flakiness; it does not make offline
 * integration tests possible or attest to any model quality.
 */
import { setTimeout as delay } from "node:timers/promises";

const NETWORK_CODES = new Set([
  "ETIMEDOUT", "ENETUNREACH", "EHOSTUNREACH", "ECONNRESET",
  "ECONNREFUSED", "EAI_AGAIN", "EPIPE"
]);

/** An AggregateError can include multiple connection attempts from Node. */
export function isTransientVSCodeDownloadError(error) {
  const queue = [{ error, depth: 0 }];
  const visited = new Set();
  while (queue.length) {
    const { error: item, depth } = queue.shift();
    if (!item || typeof item !== "object" || visited.has(item) || depth > 4) continue;
    visited.add(item);
    if (NETWORK_CODES.has(item.code)) return true;
    if (item.cause) queue.push({ error: item.cause, depth: depth + 1 });
    if (Array.isArray(item.errors)) {
      for (const nested of item.errors.slice(0, 8)) {
        queue.push({ error: nested, depth: depth + 1 });
      }
    }
  }
  return false;
}

/**
 * The injected downloader is @vscode/test-electron's downloadAndUnzipVSCode.
 * Test doubles allow verification without a network or installed editor.
 * Do not echo errors, downloaded URLs or machine paths into logs.
 */
export async function downloadVSCodeWithTransientRetries(download, {
  attempts = 3, pause = delay
} = {}) {
  if (typeof download !== "function" || typeof pause !== "function" ||
      !Number.isSafeInteger(attempts) || attempts < 1 || attempts > 3) {
    throw new Error("invalid-vscode-download-retry-settings");
  }
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const executable = await download("stable");
      if (typeof executable !== "string" || !executable) {
        throw new Error("invalid-vscode-executable");
      }
      return executable;
    } catch (error) {
      if (attempt === attempts || !isTransientVSCodeDownloadError(error)) {
        throw error;
      }
      // Bounded delays, no retry after a test process starts.
      await pause(attempt * 1_000);
    }
  }
  throw new Error("vscode-download-unavailable");
}
