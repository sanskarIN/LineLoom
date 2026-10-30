#!/usr/bin/env node
/**
 * Audit explicitly supplied training sample records OFFLINE, without network,
 * directories, auto-discovery, report persistence or source text in output.
 */
import { constants } from "node:fs";
import { lstat, open, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { auditTrainingManifest } from "./model-data-audit-lib.mjs";

const sameRegularFile = (before, after) =>
  before.isFile() && after.isFile() &&
  before.dev === after.dev && before.ino === after.ino &&
  before.size === after.size && before.mtimeMs === after.mtimeMs &&
  before.ctimeMs === after.ctimeMs;

async function readBoundedJson(path) {
  // The caller names one reviewed local manifest. Do not follow a final-path
  // symlink or silently audit a changed file during a concurrent overwrite.
  const before = await lstat(path);
  if (!before.isFile() || before.size < 1 || before.size > 1_048_576) {
    throw Error("invalid-manifest-file");
  }
  const flags = constants.O_RDONLY |
    (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0);
  const handle = await open(path, flags);
  try {
    if (!sameRegularFile(before, await handle.stat())) throw Error("changed-before-read");
    const buffer = Buffer.alloc(before.size + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await handle.read(
        buffer, length, buffer.length - length, length
      );
      if (bytesRead === 0) break;
      length += bytesRead;
    }
    if (length !== before.size ||
        !sameRegularFile(before, await handle.stat()) ||
        !sameRegularFile(before, await lstat(path))) {
      throw Error("changed-during-read");
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true })
      .decode(buffer.subarray(0, length)));
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
