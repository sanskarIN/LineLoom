import test from "node:test";
import assert from "node:assert/strict";
import { verifyPublisherPair } from "./verify-publisher-pair.mjs";

const files = {
  "extension/README.md": "Public README",
  "extension/CHANGELOG.md": "Release notes",
  "extension/LICENSE": "MIT",
  "extension/PRIVACY.md": "Privacy policy",
  "extension/dist/extension.js": "exports.activate = () => {};",
  "extension/dist/helper.js": "export const helper = true;",
  "extension/assets/icons/lineloom.png": "PNG placeholder",
  "extension/assets/icons/sidebar.svg": "<svg></svg>"
};
const manifest = {
  name: "lineloom", version: "1.4.3", publisher: "SanskarCodes",
  main: "./dist/extension.js", engines: { vscode: "^1.96.0" },
  contributes: {
    commands: [{ command: "lineloom.enable", title: "Enable Autocomplete" }],
    configuration: { properties: { "lineloom.enabled": { default: true } } }
  }
};

function archive(publisher, overrides = {}) {
  const pkg = { ...manifest, publisher, ...overrides.manifest };
  const entries = {
    ...files,
    "extension/package.json": JSON.stringify(pkg),
    "extension.vsixmanifest": '<Identity Id="lineloom" Publisher="' + publisher +
      '" Version="1.4.3" /><Property Id="Microsoft.VisualStudio.Code.PreRelease" />',
    ...overrides.files
  };
  for (const path of overrides.omit ?? []) delete entries[path];
  return {
    entries: overrides.entries ?? Object.keys(entries),
    read: path => Buffer.from(entries[path] ?? "")
  };
}

test("two publisher packages may differ only by extension identity", () => {
  const logs = [];
  const old = console.log;
  try {
    console.log = line => logs.push(line);
    verifyPublisherPair(archive("SanskarCodes"), archive("Sanskar"));
  } finally {
    console.log = old;
  }
  assert.equal(logs.length, 1);
  assert.match(logs[0], /PASS: publisher identity/);
});

test("rejects publisher, extension settings, version and code mismatches", () => {
  const legacy = archive("SanskarCodes");
  assert.throws(() => verifyPublisherPair(legacy, archive("WrongPublisher")), /new publisher/);
  assert.throws(() => verifyPublisherPair(legacy,
    archive("Sanskar", { manifest: { version: "1.4.4" } })), /manifest-contract|package.json/);
  assert.throws(() => verifyPublisherPair(legacy,
    archive("Sanskar", { manifest: { contributes: {} } })), /package.json/);
  assert.throws(() => verifyPublisherPair(legacy,
    archive("Sanskar", { files: { "extension/dist/helper.js": "changed code" } })), /file content/);
  assert.throws(() => verifyPublisherPair(legacy,
    archive("Sanskar", { files: { "extension/PRIVACY.md": "changed privacy promise" } })), /file content/);
});

test("rejects missing assets, added runtime content, and duplicate or unsafe zip entries", () => {
  const legacy = archive("SanskarCodes");
  assert.throws(() => verifyPublisherPair(legacy,
    archive("Sanskar", { omit: ["extension/PRIVACY.md"] })), /missing a required file/);
  assert.throws(() => verifyPublisherPair(legacy,
    archive("Sanskar", { files: { "extension/dist/extra.js": "code" } })), /runtime\/icon file lists/);
  const duplicated = archive("Sanskar");
  duplicated.entries.push("extension/README.md");
  assert.throws(() => verifyPublisherPair(legacy, duplicated), /duplicate archive names/);
  const unsafe = archive("Sanskar");
  unsafe.entries.push("extension/../secrets.txt");
  assert.throws(() => verifyPublisherPair(legacy, unsafe), /unsafe entry name/);
});

test("rejects spoofed VSIX identity and channel drift", () => {
  const legacy = archive("SanskarCodes");
  assert.throws(() => verifyPublisherPair(legacy, archive("Sanskar", {
    files: { "extension.vsixmanifest": '<Identity Id="lineloom" Publisher="Other" />' }
  })), /VSIX identity/);
  assert.throws(() => verifyPublisherPair(legacy, archive("Sanskar", {
    files: { "extension.vsixmanifest": '<Identity Id="lineloom" Publisher="Sanskar" />' }
  })), /release channels differ/);
});
