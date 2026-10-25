#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

export function verifyPackagerDependencyGraph(manifest, lock) {
  const modules = lock?.packages;
  assert.ok(modules && typeof modules === "object", "Expected an npm v3 lockfile");
  const vsce = modules["node_modules/@vscode/vsce"]?.version;
  const identity = modules["node_modules/@azure/identity"]?.version;
  const msal = modules["node_modules/@azure/msal-node"]?.version;
  assert.equal(vsce, "3.9.2", "Unreviewed VSIX tool upgrade: repeat security/publishing QA");
  assert.equal(manifest.devDependencies?.["@vscode/vsce"], "3.9.2",
    "VSIX tool must remain pinned until a supported upstream fix");
  assert.equal(manifest.overrides?.["@azure/identity"], "4.2.1",
    "Do not silently remove the audited Azure Identity compatibility pin");
  assert.equal(identity, "4.2.1", "Lockfile does not match the audited Azure Identity");
  assert.equal(lock.packages[""]?.devDependencies?.["@vscode/vsce"], "3.9.2");
  assert.ok(/^\\d+\\.\\d+\\.\\d+$/.test(msal ?? ""), "Expected pinned MSAL Node version");
  const [major,minor] = msal.split(".").map(Number);
  assert.ok(!(major >= 5 && (major < 7 || (major === 7 && minor < 1))),
    "Locked MSAL Node is affected by GHSA-xcx6-jx8p-x3h5");
  return { vsce, identity, msal };
}

if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) {
  const manifest = JSON.parse(readFileSync("package.json", "utf8"));
  const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
  const selected = verifyPackagerDependencyGraph(manifest, lock);
  console.log("Audited VSIX tooling manifest/lock compatibility: " +
    selected.vsce + " / Azure " + selected.identity + " / MSAL " + selected.msal);
}
