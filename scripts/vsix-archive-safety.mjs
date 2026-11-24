/**
 * Cheap, offline structural checks for VSIX ZIP entry lists.
 *
 * A ZIP integrity command proves that compressed members can be decoded,
 * but does not by itself establish safe, unambiguous filenames. Treat all
 * archive names as untrusted, even when the archive came from our own CI.
 *
 * This module never extracts files, opens the editor, publishes an extension,
 * uses credentials or reads workspace source.
 */
import assert from "node:assert/strict";

const MAX_ENTRIES = 12_000;
const MAX_NAME_LENGTH = 1_024;
const MAX_LISTING_CHARACTERS = 1_000_000;
const WINDOWS_RESERVED = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i;
const CONTROL = /[\u0000-\u001f\u007f]/;

export function validateVsixEntries(entries) {
  assert.ok(Array.isArray(entries) && entries.length > 0 && entries.length <= MAX_ENTRIES,
    "VSIX entry list missing or exceeds safety limit.");
  const seenExact = new Set();
  const seenPortable = new Set();
  const files = new Set();
  const directories = new Set();
  let totalNameBytes = 0;
  for (const name of entries) {
    assert.ok(typeof name === "string" && name.length > 0 && name.length <= MAX_NAME_LENGTH,
      "VSIX contains an invalid ZIP entry name.");
    totalNameBytes += name.length;
    assert.ok(totalNameBytes <= MAX_LISTING_CHARACTERS,
      "VSIX entry name listing exceeds safety limit.");
    assert.ok(!CONTROL.test(name) && !name.includes("\\") &&
      !name.startsWith("/") && !name.startsWith("//") &&
      !/^[A-Za-z]:/.test(name),
      "VSIX contains a non-portable ZIP entry name.");
    assert.ok(!name.includes("//") && !name.includes(":"),
      "VSIX contains an invalid ZIP entry separator.");
    const isDirectory = name.endsWith("/");
    const parts = name.split("/");
    if (isDirectory) parts.pop();
    // Validate segments separately to avoid making sanitizers guess at the
    // actual extraction destination on Windows, macOS or Linux.
    for (const part of parts) {
      assert.ok(part.length > 0 && part !== "." && part !== "..",
        "VSIX contains a traversal or empty path segment.");
      assert.ok(part === part.trim() && !part.endsWith(".") &&
        !WINDOWS_RESERVED.test(part),
        "VSIX contains a non-portable path segment.");
    }
    const portable = name.normalize("NFC").toLowerCase();
    assert.ok(!seenExact.has(name) && !seenPortable.has(portable),
      "VSIX contains duplicate or case-colliding entry names.");
    seenExact.add(name);
    seenPortable.add(portable);
    (isDirectory ? directories : files).add(name);
  }
  // A file cannot safely also be an ancestor directory in an archive. This
  // is ambiguous on file systems with different separator/case semantics.
  for (const path of files) {
    assert.ok(!directories.has(path + "/"), "VSIX contains a file/directory collision.");
    const prefixes = path.split("/");
    let prefix = "";
    for (let i = 0; i < prefixes.length - 1; i++) {
      prefix += (i ? "/" : "") + prefixes[i];
      assert.ok(!files.has(prefix), "VSIX contains a file ancestor collision.");
    }
  }
  return Object.freeze({ entryCount: entries.length, fileCount: files.size, directoryCount: directories.size });
}
