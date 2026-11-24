/**
 * Strict, bounded extraction of the three VSIX extension Identity attributes.
 *
 * This is intentionally NOT a generic XML parser. The exact VSIX contract
 * created by vsce contains one Identity element with quoted Id, Version and
 * Publisher. Reject a malformed, duplicate or ambiguous identity rather than
 * guessing which attribute a registry will use during publication.
 */
import assert from "node:assert/strict";

const MAX_MANIFEST_CHARS = 256 * 1024;
const VERSION = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/;

function attribute(tag, name) {
  const expression = new RegExp("(?:^|\\s)" + name + '="([^"]*)"', "g");
  const matches = [...tag.matchAll(expression)];
  assert.equal(matches.length, 1, "Invalid VSIX identity attribute.");
  return matches[0][1];
}

export function inspectVsixIdentity(xml) {
  assert.ok(typeof xml === "string" && xml.length > 0 && xml.length <= MAX_MANIFEST_CHARS,
    "VSIX manifest missing or exceeds safety limit.");
  // XML comments and CDATA cannot be treated as authoritative Identity tags.
  // In particular, a commented-out identity must not satisfy this gate.
  const withoutComments = xml.replace(/<!--[^]*?-->/g, "");
  assert.ok(!withoutComments.includes("<![CDATA["),
    "VSIX manifest contains unsupported CDATA.");
  const tags = [...withoutComments.matchAll(/<Identity\b([^<>]*?)\s*\/?\s*>/g)];
  assert.equal(tags.length, 1, "VSIX must contain exactly one Identity element.");
  const attrs = tags[0][1];
  const id = attribute(attrs, "Id");
  const version = attribute(attrs, "Version");
  const publisher = attribute(attrs, "Publisher");
  assert.equal(id, "lineloom", "VSIX manifest has an unexpected extension ID.");
  assert.match(version, VERSION, "VSIX manifest has an invalid extension version.");
  assert.ok(publisher === "SanskarCodes" || publisher === "Sanskar",
    "VSIX manifest has an unapproved publisher.");
  return Object.freeze({ id, version, publisher });
}

/**
 * The pre-release flag is an actual VSIX Property element, not a magic string
 * found anywhere in a comment or prose description. It is still only a
 * metadata gate; channel availability must be checked after publication.
 */
export function hasVsixPreReleaseProperty(xml) {
  assert.ok(typeof xml === "string" && xml.length <= MAX_MANIFEST_CHARS,
    "Invalid VSIX manifest.");
  const withoutComments = xml.replace(/<!--[^]*?-->/g, "");
  const properties = [...withoutComments.matchAll(/<Property\b([^<>]*?)\s*\/?\s*>/g)];
  return properties.some((match) =>
    /(?:^|\s)Id="Microsoft\.VisualStudio\.Code\.PreRelease"/.test(match[1]));
}

export function assertVsixIdentityMatches(xml, expected) {
  const actual = inspectVsixIdentity(xml);
  assert.ok(expected && typeof expected === "object", "Missing expected VSIX identity.");
  assert.equal(actual.id, expected.name, "VSIX and package extension names differ.");
  assert.equal(actual.publisher, expected.publisher, "VSIX and package publishers differ.");
  assert.equal(actual.version, expected.version, "VSIX and package versions differ.");
  return actual;
}
