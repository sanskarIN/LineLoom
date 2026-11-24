#!/usr/bin/env node
/**
 * Open VSX PUBLIC listing reconnaissance for LineLoom.
 *
 * Read-only: never publishes, authenticates, changes namespaces, saves tokens,
 * deletes legacy listings, or claims that namespace ownership is verified.
 * This is deliberately separate from release workflows and owner approval.
 */
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const PUBLIC_REGISTRY = "https://open-vsx.org";
export const KNOWN_NAMESPACES = Object.freeze(["SanskarCodes", "Sanskar"]);
const BODY_LIMIT = 128 * 1024;
const DEADLINE_MS = 12_000;

export function checkNamespace(namespace) {
  assert.ok(KNOWN_NAMESPACES.includes(namespace), "Unapproved LineLoom namespace");
  return namespace;
}

export function publicApiUrl(namespace, version) {
  checkNamespace(namespace);
  if (version !== undefined) {
    assert.match(version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, "Invalid expected version");
  }
  // Inputs cannot replace the origin or inject query strings / credentials.
  return PUBLIC_REGISTRY + "/api/" + namespace + "/lineloom" + (version ? "/" + version : "");
}

export function parsePublicRecord(value, namespace, expectedVersion) {
  checkNamespace(namespace);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Open VSX returned unexpected metadata.");
  }
  if (value.namespace !== namespace || value.name !== "lineloom") {
    throw new Error("Open VSX listing identity did not match the query.");
  }
  if (typeof value.version !== "string" ||
      !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value.version)) {
    throw new Error("Open VSX returned an invalid version.");
  }
  if (expectedVersion !== undefined && value.version !== expectedVersion) {
    throw new Error("Open VSX returned a different version.");
  }
  // Absence of flags is unknown, not evidence of stable or downloadable.
  // No version metadata proves namespace ownership, installation, or trust.
  return Object.freeze({
    namespace,
    extension: "lineloom",
    version: value.version,
    preRelease: typeof value.preRelease === "boolean" ? value.preRelease : null,
    downloadable: typeof value.downloadable === "boolean" ? value.downloadable : null,
    checked: true
  });
}

async function boundedText(response) {
  if (!response.body) throw new Error("Open VSX returned an empty response.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const pieces = [];
  let count = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      count += part.value.byteLength;
      if (count > BODY_LIMIT) throw new Error("Open VSX metadata exceeds the size limit.");
      pieces.push(decoder.decode(part.value, { stream: true }));
    }
    pieces.push(decoder.decode());
    return pieces.join("");
  } catch (error) {
    if (error instanceof Error && error.message === "Open VSX metadata exceeds the size limit.") throw error;
    throw new Error("Open VSX returned unreadable metadata.");
  } finally {
    // The server may not cooperate: never await a stalled cancel callback.
    void reader.cancel().catch(() => undefined);
  }
}

function parseUntrustedJson(text) {
  try { return JSON.parse(text); }
  catch { throw new Error("Open VSX returned invalid JSON."); }
}

/**
 * Observe a single exact version or the registry's current default version.
 * A 404 is a verifiable absence at the time of request, not proof of available
 * namespace ownership; all other HTTP errors fail closed.
 *
 * fetchImpl can be injected to test without network access or private data.
 */
export async function inspectPublicOpenVsx(
  namespace, { version, fetchImpl = globalThis.fetch, timeoutMs = DEADLINE_MS } = {}
) {
  const url = publicApiUrl(namespace, version);
  assert.ok(typeof fetchImpl === "function", "Fetch implementation required");
  assert.ok(Number.isSafeInteger(timeoutMs) && timeoutMs >= 1 && timeoutMs <= 60_000,
    "Invalid registry deadline");
  const controller = new AbortController();
  let handle;
  const timedOut = new Promise((_, reject) => {
    handle = setTimeout(() => {
      controller.abort();
      reject(new Error("Open VSX public metadata check timed out."));
    }, timeoutMs);
  });
  try {
    const checked = async () => {
      let response;
      try {
        response = await fetchImpl(url, {
          method: "GET",
          redirect: "error",
          credentials: "omit",
          cache: "no-store",
          signal: controller.signal,
          headers: { Accept: "application/json" }
        });
      } catch {
        throw new Error("Could not read public Open VSX metadata.");
      }
      if (response.status === 404) {
        return Object.freeze({ namespace, extension: "lineloom", exists: false, checked: true });
      }
      if (response.status !== 200) {
        throw new Error("Open VSX public API returned an unexpected status.");
      }
      const text = await boundedText(response);
      const data = parsePublicRecord(parseUntrustedJson(text), namespace, version);
      return Object.freeze({ ...data, exists: true });
    };
    return await Promise.race([checked(), timedOut]);
  } finally {
    clearTimeout(handle);
    controller.abort();
  }
}

/** Only a complete, matching stable metadata record passes this small gate. */
export function isVerifiedPublicStable(record, expectedNamespace, expectedVersion) {
  return record?.checked === true && record.exists === true &&
    record.namespace === expectedNamespace && record.extension === "lineloom" &&
    record.version === expectedVersion && record.preRelease === false &&
    record.downloadable === true;
}

/** Print only bounded trusted fields, never raw response strings or server data. */
export function describePublicOpenVsx(record) {
  const namespace = checkNamespace(record.namespace);
  if (record.exists === false) {
    return "NOT FOUND: " + namespace + ".lineloom (not evidence of namespace availability)";
  }
  const flags = (record.preRelease === null ? "channel unknown" :
    record.preRelease ? "preview" : "stable") + "; " +
    (record.downloadable === true ? "downloadable" :
      record.downloadable === false ? "not downloadable" : "downloadability unknown");
  return "PUBLIC METADATA: " + namespace + ".lineloom@" + record.version +
    " (" + flags + "). Ownership and installation NOT verified.";
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !KNOWN_NAMESPACES.includes(args[0])) {
    console.error("Usage: node scripts/open-vsx-public.mjs SanskarCodes|Sanskar");
    process.exitCode = 2;
  } else {
    try {
      const result = await inspectPublicOpenVsx(args[0]);
      console.log(describePublicOpenVsx(result));
      if (result.exists === false) process.exitCode = 1;
    } catch {
      // The underlying fetch and JSON failures may contain private network
      // strings. Never serialize an arbitrary exception into diagnostics.
      console.error("Open VSX public read-only check failed; no publishing attempted.");
      process.exitCode = 1;
    }
  }
}
