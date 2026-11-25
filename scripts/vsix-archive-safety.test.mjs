import test from "node:test";
import assert from "node:assert/strict";
import { validateVsixEntries } from "./vsix-archive-safety.mjs";

const baseline = Object.freeze([
  "[Content_Types].xml",
  "_rels/.rels",
  "extension.vsixmanifest",
  "extension/package.json",
  "extension/dist/extension.js",
  "extension/assets/",
  "extension/assets/icons/",
  "extension/assets/icons/lineloom.png"
]);

function rejectsEntry(entry, pattern = /VSIX/) {
  assert.throws(() => validateVsixEntries([...baseline, entry]), pattern);
}

test("standard packaged extension layout passes offline archive validation", () => {
  assert.deepEqual(validateVsixEntries([...baseline]), {
    entryCount: 8, fileCount: 6, directoryCount: 2
  });
  assert.ok(Object.isFrozen(validateVsixEntries([...baseline])));
});

test("a case-sensitive duplicate central directory member is rejected", () => {
  rejectsEntry("extension/package.json", /duplicate/);
  rejectsEntry("extension.vsixmanifest", /duplicate/);
});

test("archive member case collisions are unsafe on Windows and macOS", () => {
  rejectsEntry("EXTENSION/PACKAGE.JSON", /case-colliding/);
  rejectsEntry("extension/dist/EXTENSION.js", /case-colliding/);
});

test("Unicode-normalized lookalike names collide before extraction", () => {
  const base = [...baseline, "extension/café.txt"];
  assert.throws(() => validateVsixEntries([...base, "extension/cafe\u0301.txt"]), /case-colliding/);
});

test("a ZIP member cannot use traversal components", () => {
  for (const name of [
    "../extension/package.json",
    "extension/../outside.txt",
    "extension/./foo.js",
    "extension/a/../../elsewhere.txt",
    "extension/a/..",
    "extension/."
  ]) rejectsEntry(name, /traversal|invalid/);
});

test("ZIP entries cannot be rooted at arbitrary absolute or drive paths", () => {
  for (const name of [
    "/etc/passwd", "//server/share", "C:/Windows/system.ini", "D:secret.txt"
  ]) rejectsEntry(name, /non-portable/);
});

test("backslashes, doubled separators and empty path components are rejected", () => {
  for (const name of [
    "extension//dist/file.js",
    "extension\\dist\\file.js",
    "extension/a//b",
    "extension//",
    "/"
  ]) rejectsEntry(name);
});

test("NUL, CR, LF, and other control characters cannot appear in ZIP filenames", () => {
  for (const control of ["\0", "\r", "\n", "\t", "\x1f", "\x7f"]) {
    rejectsEntry("extension/a" + control + "b", /non-portable/);
  }
});

test("zip members with Windows alternate-stream separators are rejected", () => {
  for (const name of ["extension/a:secret", "extension/x::$DATA", "extension/hi:"]) {
    rejectsEntry(name, /invalid ZIP entry separator/);
  }
});

test("Windows device names are refused even with extensions", () => {
  for (const part of [
    "CON", "con.txt", "PRN", "AUX", "NUL.txt", "COM1", "com9.log", "LPT1", "lpt9.csv"
  ]) rejectsEntry("extension/" + part, /non-portable path segment/);
});

test("ordinary hidden files and safe alphanumeric names remain legal", () => {
  const files = ["extension/.editorconfig", "extension/_preferences.json",
    "extension/case-23.ts", "extension/assets/logo.svg"];
  assert.equal(validateVsixEntries([...baseline, ...files]).fileCount, 10);
});

test("trailing dots and leading or trailing spaces in path segments are refused", () => {
  for (const name of [
    "extension/hello.", "extension/ hi", "extension/hi ",
    " extension/a", "extension/ab /file.js"
  ]) rejectsEntry(name, /non-portable path segment/);
});

test("zip archive must not contain file and directory with the same identity", () => {
  rejectsEntry("extension/package.json/", /file\/directory collision/);
  rejectsEntry("extension/dist/extension.js/", /file\/directory collision/);
});

test("a packaged file must not also be an ancestor of another file", () => {
  rejectsEntry("extension/package.json/inside.txt", /ancestor/);
  rejectsEntry("extension/dist/extension.js/deeper/file.txt", /ancestor/);
});

test("case-variant ancestor collisions are caught on case-insensitive systems", () => {
  rejectsEntry("EXTENSION/PACKAGE.JSON/inner.txt", /ancestor/);
  rejectsEntry("extension/ASSETS/ICONS/LINeloom.PNG/inner.txt", /ancestor/);
});

test("nonarray and empty archives do not pass the release gate", () => {
  for (const value of [undefined, null, 7, {}, "extension/package.json", []]) {
    assert.throws(() => validateVsixEntries(value), /missing or exceeds safety limit/);
  }
});

test("archive with more than twelve thousand members is refused", () => {
  const entries = Array.from({ length: 12_001 }, (_, i) => "extension/f" + i);
  assert.throws(() => validateVsixEntries(entries), /missing or exceeds safety limit/);
});

test("malicious extremely long entry names are refused", () => {
  rejectsEntry("extension/" + "a".repeat(1500), /invalid ZIP entry name/);
});

test("non-string and blank entry names are refused", () => {
  for (const value of [undefined, null, 0, {}, [], "", false]) {
    assert.throws(() => validateVsixEntries([...baseline, value]), /invalid ZIP entry name/);
  }
});

test("nonportable characters do not cause sensitive path text to be logged", () => {
  const secret = "private/hidden/SECRET_PATH";
  try {
    validateVsixEntries([...baseline, "extension/../" + secret]);
    assert.fail("Unsafe archive must fail");
  } catch (error) {
    assert.match(error.message, /traversal/);
    assert.doesNotMatch(error.message, /SECRET_PATH|hidden/);
  }
});

test("large but safe deterministic archive index remains bounded and unique", () => {
  const additional = Array.from({ length: 512 }, (_, i) =>
    "extension/assets/generated-asset-" + String(i).padStart(4, "0") + ".json");
  const result = validateVsixEntries([...baseline, ...additional]);
  assert.equal(result.entryCount, 520);
  assert.equal(result.fileCount, 518);
  assert.equal(result.directoryCount, 2);
});

test("rejects Windows-forbidden characters in any path segment", () => {
  for (const character of ['<', '>', '"', '|', '?', '*']) {
    rejectsEntry("extension/a" + character + "b.js", /non-portable path segment/);
    rejectsEntry("extension/a" + character + "b/child.js", /non-portable path segment/);
  }
});

test("rejects Windows reserved superscript-digit device names", () => {
  for (const part of ["COM¹", "com².log", "COM³.txt", "LPT¹", "lpt².txt", "LPT³"]) {
    rejectsEntry("extension/" + part, /non-portable path segment/);
  }
});

test("rejects a file ancestor even if the descendant is an empty directory", () => {
  for (const name of [
    "extension/package.json/subdir/",
    "extension/PACKAGE.JSON/subdir/deeper/",
    "extension/assets/icons/lineloom.png/empty/"
  ]) rejectsEntry(name, /ancestor/);
  assert.throws(() => validateVsixEntries([
    "extension/a/b/", "extension/a"
  ]), /ancestor/);
});

test("allows ordinary explicitly listed parent and child directories", () => {
  const result = validateVsixEntries([
    "extension/", "extension/dist/", "extension/dist/empty/",
    "extension/dist/extension.js"
  ]);
  assert.equal(result.directoryCount, 3);
  assert.equal(result.fileCount, 1);
});

test("portable file and directory conflicts are rejected in both archive orders", () => {
  for (const pair of [
    ["extension/Café", "extension/cafe\u0301/"],
    ["extension/Café", "extension/cafe\u0301/child/"],
    ["extension/file", "EXTENSION/FILE/child.txt"],
    ["extension/file", "EXTENSION/FILE/child/"]
  ]) {
    for (const entries of [pair, [...pair].reverse()]) {
      assert.throws(() => validateVsixEntries(entries), /collision/);
    }
  }
});

test("combined name budget is enforced even when each individual name is short enough", () => {
  const prefix = "extension/" + ("a".repeat(180) + "/").repeat(5);
  const entries = Array.from({ length: 1100 }, (_, index) =>
    prefix + String(index).padStart(4, "0") + ".txt");
  assert.ok(entries.every(name => name.length <= 1024));
  assert.ok(entries.reduce((total, name) => total + name.length, 0) > 1_000_000);
  assert.throws(() => validateVsixEntries(entries), /listing exceeds safety limit/);
});

test("the validator leaves its input unchanged and accepts frozen arrays", () => {
  const entries = Object.freeze([...baseline].reverse());
  const before = [...entries];
  assert.deepEqual(validateVsixEntries(entries), {
    entryCount: 8, fileCount: 6, directoryCount: 2
  });
  assert.deepEqual(entries, before);
});
