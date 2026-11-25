import test from "node:test";
import assert from "node:assert/strict";
import {
  inspectVsixIdentity, hasVsixPreReleaseProperty, assertVsixIdentityMatches
} from "./vsix-manifest-identity.mjs";

const stableXml = `<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0">
  <Metadata>
    <Identity Id="lineloom" Publisher="SanskarCodes" Version="1.4.4" Language="en-US" />
    <DisplayName>LineLoom</DisplayName>
  </Metadata>
</PackageManifest>`;

const previewXml = stableXml.replace("SanskarCodes", "Sanskar").replace(
  "</Metadata>", '  <Property Id="Microsoft.VisualStudio.Code.PreRelease" Value="true" />\n  </Metadata>'
);

test("extracts a single approved VSIX identity without external XML dependencies", () => {
  assert.deepEqual(inspectVsixIdentity(stableXml),
    { id: "lineloom", publisher: "SanskarCodes", version: "1.4.4" });
  assert.deepEqual(inspectVsixIdentity(previewXml),
    { id: "lineloom", publisher: "Sanskar", version: "1.4.4" });
  assert.ok(Object.isFrozen(inspectVsixIdentity(stableXml)));
});

test("allows safe attribute reordering and unrelated manifest metadata", () => {
  const xml = '<PackageManifest><Identity Version="2.0.0" Language="en" ' +
    'Publisher="Sanskar" Id="lineloom" /></PackageManifest>';
  assert.equal(inspectVsixIdentity(xml).version, "2.0.0");
});

test("matches source identity and rejects source/manifest drift", () => {
  assert.doesNotThrow(() => assertVsixIdentityMatches(stableXml, {
    name: "lineloom", publisher: "SanskarCodes", version: "1.4.4"
  }));
  for (const expected of [
    { name: "other", publisher: "SanskarCodes", version: "1.4.4" },
    { name: "lineloom", publisher: "Sanskar", version: "1.4.4" },
    { name: "lineloom", publisher: "SanskarCodes", version: "1.4.5" }
  ]) assert.throws(() => assertVsixIdentityMatches(stableXml, expected), /differ/);
});

test("rejects duplicate identity elements rather than guessing the first", () => {
  const xml = '<PackageManifest><Identity Id="lineloom" Version="1.4.4" Publisher="Sanskar" />' +
    '<Identity Id="other" Version="1.4.4" Publisher="Sanskar" /></PackageManifest>';
  assert.throws(() => inspectVsixIdentity(xml), /exactly one Identity/);
});

test("rejects missing or duplicated identity attributes", () => {
  for (const tag of [
    '<Identity Id="lineloom" Publisher="Sanskar" />',
    '<Identity Id="lineloom" Version="1.4.4" />',
    '<Identity Publisher="Sanskar" Version="1.4.4" />',
    '<Identity Id="lineloom" Id="spoof" Publisher="Sanskar" Version="1.4.4" />'
  ]) assert.throws(() => inspectVsixIdentity(tag), /Invalid VSIX identity attribute/);
});

test("refuses unapproved publishers and extension IDs", () => {
  assert.throws(() => inspectVsixIdentity(stableXml.replace("SanskarCodes", "Spoof")),
    /unapproved publisher/);
  assert.throws(() => inspectVsixIdentity(stableXml.replace('Id="lineloom"', 'Id="another"')),
    /unexpected extension ID/);
});

test("rejects malformed, incomplete, hostile or excessively long versions", () => {
  for (const version of ["1.4", "v1.4.4", "1.4.4.0", "../1.4.4",
    "1.4.4?token=private", "1.4.4/other", "1.4.4\nSECRET"]) {
    assert.throws(() => inspectVsixIdentity(stableXml.replace('Version="1.4.4" Language', 'Version="' + version + '" Language')),
      /invalid extension version|exactly one Identity/);
  }
});

test("XML comments containing a forged Identity are ignored", () => {
  const xml = '<!-- <Identity Id="lineloom" Version="1.4.4" Publisher="Sanskar" /> -->' +
    '<Identity Id="lineloom" Version="1.4.4" Publisher="SanskarCodes" />';
  assert.equal(inspectVsixIdentity(xml).publisher, "SanskarCodes");
  assert.throws(() => inspectVsixIdentity('<!-- <Identity Id="lineloom" Version="1.4.4" Publisher="Sanskar" /> -->'),
    /exactly one Identity/);
});

test("the pre-release flag must be a real Property element rather than prose", () => {
  assert.equal(hasVsixPreReleaseProperty(stableXml), false);
  assert.equal(hasVsixPreReleaseProperty(previewXml), true);
  assert.equal(hasVsixPreReleaseProperty(
    '<!-- <Property Id="Microsoft.VisualStudio.Code.PreRelease" Value="true" /> -->'), false);
  assert.equal(hasVsixPreReleaseProperty(
    "<Description>Microsoft.VisualStudio.Code.PreRelease</Description>"), false);
});

test("pre-release property must have exact identity, not a similar name", () => {
  for (const xml of [
    '<Property Id="Microsoft.VisualStudio.Code.PreRelease.fake" Value="true" />',
    '<Property Id="Other.Microsoft.VisualStudio.Code.PreRelease" Value="true" />',
    '<Property Name="Microsoft.VisualStudio.Code.PreRelease" Value="true" />'
  ]) assert.equal(hasVsixPreReleaseProperty(xml), false);
});

test("malformed oversized and nonstring XML fail closed", () => {
  for (const value of [undefined, null, 1, [], {}, "", "a".repeat(300_000)]) {
    assert.throws(() => inspectVsixIdentity(value), /missing or exceeds safety limit/);
  }
  for (const value of [undefined, null, [], 1, "a".repeat(300_000)]) {
    assert.throws(() => hasVsixPreReleaseProperty(value), /Invalid VSIX manifest/);
  }
});

test("truncated or unmatched XML comments cannot smuggle identity or channel markers", () => {
  const malformed = '<!-- <Identity Id="lineloom" Version="1.4.4" Publisher="Sanskar" />';
  assert.throws(() => inspectVsixIdentity(malformed), /malformed comments/);
  assert.throws(() => hasVsixPreReleaseProperty(
    '<!-- <Property Id="Microsoft.VisualStudio.Code.PreRelease" />'), /malformed comments/);
  assert.throws(() => inspectVsixIdentity(stableXml + '-->'), /malformed comments/);
});

test("explicitly reject CDATA identity spoofing", () => {
  const xml = stableXml + '<![CDATA[<Identity Id="lineloom" Version="1.4.4" Publisher="Sanskar" />]]>';
  assert.throws(() => inspectVsixIdentity(xml), /unsupported CDATA/);
});

test("refuses unverified expected identity instead of falling back to a constant", () => {
  assert.throws(() => assertVsixIdentityMatches(stableXml, null), /Missing expected/);
  assert.throws(() => assertVsixIdentityMatches(stableXml, "SanskarCodes.lineloom"), /Missing expected/);
});

test("parser failure messages never echo private hostile identity text", () => {
  const privateText = "VERY_PRIVATE_SOURCE_OR_TOKEN";
  try {
    inspectVsixIdentity(stableXml.replace('Publisher="SanskarCodes"', 'Publisher="' + privateText + '"'));
    assert.fail("Malformed publisher should be rejected");
  } catch (error) {
    assert.match(error.message, /unapproved publisher/);
    assert.ok(!error.message.includes(privateText));
  }
});
