#!/usr/bin/env node
/**
 * Audit explicitly supplied training sample records OFFLINE, without network,
 * directories, auto-discovery, report persistence or source text in output.
 */
import { open, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { auditTrainingManifest } from "./model-data-audit-lib.mjs";

async function readBoundedJson(path) {
  const handle = await open(path, "r");
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size < 1 || stat.size > 1_048_576) throw Error("oversized");
    const buffer = Buffer.alloc(stat.size + 1);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead !== stat.size) throw Error("changed");
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, bytesRead)));
  } finally {
    await handle.close();
  }
}
async function main() {
  if (process.argv.length !== 4 || process.argv[2] !== "--manifest" ||
      !process.argv[3] || process.argv[3].startsWith("--")) throw Error("arguments");
  const fixtures = JSON.parse(await readFile(fileURLToPath(
    new URL("../model/fixtures/completion-v1.json", import.meta.url)), "utf8"));
  const userManifest = await readBoundedJson(process.argv[3]);
  const summary = auditTrainingManifest(userManifest, fixtures);
  console.log(JSON.stringify(summary, null, 2));
}
await main().catch(() => {
  // No path, raw sample, repository ID, secret, error body or snippet emitted.
  console.error("LineLoom Code dataset audit failed; review manifest, rights and data-quality gates locally.");
  process.exitCode = 1;
});
