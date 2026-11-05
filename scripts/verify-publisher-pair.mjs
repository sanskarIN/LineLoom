#!/usr/bin/env node
/**
 * Read-only release gate for the two independently installable LineLoom IDs.
 * The publisher may differ; code, manifest contract, and user-facing files
 * must not. Never print packaged source, secrets, paths or file contents.
 *
 * CI uses unzip on Linux. Pure contract tests run on every OS without unzip.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const required = [
  "extension/readme.md", "extension/changelog.md",
  "extension/LICENSE.txt", "extension/PRIVACY.md", "extension/SECURITY.md",
  "extension/dist/extension.js",
  "extension/assets/icons/lineloom.png",
  "extension/assets/icons/sidebar.svg"
];

function fingerprint(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertEntries(entries, label) {
  assert.equal(entries.length, new Set(entries).size, label + ": duplicate archive names");
  for (const item of entries) {
    assert.ok(typeof item === "string" && !item.includes("\0") &&
      !item.includes("\\") && !item.startsWith("/") &&
      !item.split("/").includes(".."), label + ": unsafe entry name");
  }
}

/**
 * Accept an archive reader with {entries: string[], read(name): Buffer}.
 * Comparing injected readers makes negative tests deterministic and offline.
 */
export function verifyPublisherPair(legacy, next) {
  assertEntries(legacy.entries, "Legacy archive");
  assertEntries(next.entries, "Sanskar archive");
  const oldFiles = new Set(legacy.entries);
  const newFiles = new Set(next.entries);
  for (const path of ["extension/package.json", "extension.vsixmanifest", ...required]) {
    assert.ok(oldFiles.has(path) && newFiles.has(path),
      "A publisher package is missing a required file: " + path);
  }
  const oldManifest = JSON.parse(legacy.read("extension/package.json").toString("utf8"));
  const nextManifest = JSON.parse(next.read("extension/package.json").toString("utf8"));
  assert.equal(oldManifest.publisher, "SanskarCodes", "Unexpected legacy publisher");
  assert.equal(nextManifest.publisher, "Sanskar", "Unexpected new publisher");
  for (const manifest of [oldManifest, nextManifest]) {
    assert.equal(manifest.name, "lineloom", "Unexpected extension name");
    assert.match(manifest.version, /^\d+\.\d+\.\d+$/, "Unexpected extension version");
    assert.equal(manifest.main, "./dist/extension.js", "Unexpected extension entrypoint");
  }
  const { publisher: omittedOld, ...oldContract } = oldManifest;
  const { publisher: omittedNext, ...nextContract } = nextManifest;
  // Compare every declared command, setting, activation event, dependency and
  // metadata field, rather than maintaining a fragile allowlist of settings.
  assert.equal(JSON.stringify(oldContract), JSON.stringify(nextContract),
    "Publisher packages differ in package.json beyond the publisher ID");

  // The VSIX identity must match the package identity. Checking package.json
  // alone could miss a stale VSIX metadata file from another publisher.
  for (const [archive, publisher] of [[legacy, "SanskarCodes"], [next, "Sanskar"]]) {
    const xml = archive.read("extension.vsixmanifest").toString("utf8");
    assert.ok(new RegExp('(?:^|\\s)Publisher="' + publisher + '"').test(xml),
      "VSIX identity does not match the intended publisher");
    assert.ok(new RegExp('(?:^|\\s)Id="lineloom"').test(xml),
      "VSIX identity does not match the extension name");
  }

  // Every published payload file must exist under both identities. Comparing
  // only dist/ and icons/ could miss an unexpected script, data file, or
  // modified root metadata shipped with just one publisher package.
  // Zip directory entries contain no bytes; only actual files are compared.
  const filesIn = archive => archive.entries.filter(path => !path.endsWith("/")).sort();
  const oldFilesOrdered = filesIn(legacy);
  const nextFilesOrdered = filesIn(next);
  assert.equal(JSON.stringify(oldFilesOrdered), JSON.stringify(nextFilesOrdered),
    "Publisher VSIX archive file lists differ");
  for (const path of oldFilesOrdered) {
    // Identity metadata is verified independently (the publisher differs);
    // the rest of the package must be byte-for-byte the same.
    if (path === "extension/package.json" || path === "extension.vsixmanifest") continue;
    assert.equal(fingerprint(legacy.read(path)), fingerprint(next.read(path)),
      "Publisher VSIX file content differs: " + path);
  }
  const oldPreview = legacy.read("extension.vsixmanifest").toString("utf8")
    .includes("Microsoft.VisualStudio.Code.PreRelease");
  const newPreview = next.read("extension.vsixmanifest").toString("utf8")
    .includes("Microsoft.VisualStudio.Code.PreRelease");
  assert.equal(oldPreview, newPreview, "Publisher package release channels differ");
  console.log("PASS: publisher identity is the only manifest-contract difference; " +
    "all other shipped files are byte-identical; release channels match.");
}

function fromZip(path) {
  // Bound memory and throw on malformed or exceptionally large entries.
  execFileSync("unzip", ["-t", path], { stdio: "pipe", timeout: 60_000 });
  const listing = execFileSync("unzip", ["-Z", "-1", path], {
    encoding: "utf8", maxBuffer: 1024 * 1024, timeout: 60_000
  }).trim();
  return {
    entries: listing.split(/\r?\n/),
    read(name) {
      return execFileSync("unzip", ["-p", path, name], {
        maxBuffer: 32 * 1024 * 1024, timeout: 60_000
      });
    }
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [oldArg, nextArg] = process.argv.slice(2);
    assert.ok(oldArg?.endsWith(".vsix") && nextArg?.endsWith(".vsix"),
      "Usage: node scripts/verify-publisher-pair.mjs <SanskarCodes.vsix> <Sanskar.vsix>");
    verifyPublisherPair(fromZip(resolve(oldArg)), fromZip(resolve(nextArg)));
  } catch (error) {
    // Report only fixed validation messages; never expose source blobs.
    console.error("Publisher package parity failed:", error.message);
    process.exitCode = 1;
  }
}
