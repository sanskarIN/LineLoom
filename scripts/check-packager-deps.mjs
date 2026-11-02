#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

/**
 * Validate the *whole* committed npm dependency graph, not only the
 * top-level MSAL Node entry. npm can place additional copies under nested
 * node_modules paths, including a vulnerable version that the old check
 * would miss. This is independent of the live npm audit: both must pass.
 */
function lockedInstances(modules, packageName) {
  return Object.entries(modules).filter(([path]) =>
    path === "node_modules/" + packageName ||
    path.endsWith("/node_modules/" + packageName)
  );
}

function reviewedMsal2Version(version) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version ?? "");
  if (!match) return false;
  const [, majorText, minorText, patchText] = match;
  const [major, minor, patch] = [majorText, minorText, patchText].map(Number);
  return Number.isSafeInteger(major) && Number.isSafeInteger(minor) &&
    Number.isSafeInteger(patch) && major === 2 &&
    (minor > 9 || (minor === 9 && patch >= 2));
}

export function verifyPackagerDependencyGraph(manifest, lock) {
  const modules = lock?.packages;
  assert.equal(lock?.lockfileVersion, 3, "Expected npm v3 lockfile");
  assert.ok(modules && typeof modules === "object" && !Array.isArray(modules),
    "Expected an npm v3 lockfile");
  assert.equal(manifest.devDependencies?.["@vscode/vsce"], "3.9.2",
    "VSIX tool must remain pinned until a supported upstream fix");
  assert.equal(manifest.overrides?.["@azure/identity"], "4.2.1",
    "Do not silently remove the audited Azure Identity compatibility pin");
  assert.equal(modules[""]?.devDependencies?.["@vscode/vsce"], "3.9.2");

  const tools = lockedInstances(modules, "@vscode/vsce");
  const identities = lockedInstances(modules, "@azure/identity");
  const msalEntries = lockedInstances(modules, "@azure/msal-node");
  assert.equal(tools.length, 1, "Unreviewed nested or missing VSIX publishing tool");
  assert.equal(identities.length, 1, "Unreviewed nested or missing Azure Identity");
  assert.equal(msalEntries.length, 1, "Unreviewed nested or missing MSAL Node");
  assert.equal(tools[0][0], "node_modules/@vscode/vsce");
  assert.equal(identities[0][0], "node_modules/@azure/identity");
  assert.equal(msalEntries[0][0], "node_modules/@azure/msal-node");

  const vsceNode = tools[0][1];
  const identityNode = identities[0][1];
  const msalNode = msalEntries[0][1];
  const vsce = vsceNode?.version;
  const identity = identityNode?.version;
  const msal = msalNode?.version;
  assert.equal(vsce, "3.9.2", "Unreviewed VSIX tool upgrade: repeat security/publishing QA");
  assert.equal(identity, "4.2.1", "Lockfile does not match audited Azure Identity");
  assert.equal(vsceNode?.dependencies?.["@azure/identity"], "^4.1.0",
    "Unreviewed VSIX-to-Azure Identity dependency relationship");
  assert.equal(identityNode?.dependencies?.["@azure/msal-node"], "^2.9.2",
    "Unreviewed Azure Identity-to-MSAL Node dependency relationship");
  assert.ok(reviewedMsal2Version(msal),
    "Locked MSAL Node does not satisfy reviewed ^2.9.2 compatibility range");
  assert.equal(vsceNode?.dev, true, "Publishing tool must remain dev-only");
  assert.equal(identityNode?.dev, true, "Azure Identity must remain dev-only");
  assert.equal(msalNode?.dev, true, "MSAL Node must remain dev-only");
  return { vsce, identity, msal };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = JSON.parse(readFileSync("package.json", "utf8"));
  const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
  const selected = verifyPackagerDependencyGraph(manifest, lock);
  console.log("Audited VSIX tooling manifest/lock compatibility: " +
    selected.vsce + " / Azure " + selected.identity + " / MSAL " + selected.msal);
}
