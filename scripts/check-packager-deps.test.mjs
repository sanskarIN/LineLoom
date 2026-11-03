import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyPackagerDependencyGraph } from "./check-packager-deps.mjs";

function fixture(msal = "2.16.3") {
  return {
    manifest: {
      devDependencies: { "@vscode/vsce": "3.9.2" },
      overrides: { "@azure/identity": "4.2.1" }
    },
    lock: {
      lockfileVersion: 3,
      packages: {
        "": { devDependencies: { "@vscode/vsce": "3.9.2" } },
        "node_modules/@vscode/vsce": {
          version: "3.9.2", dev: true,
          dependencies: { "@azure/identity": "^4.1.0" }
        },
        "node_modules/@azure/identity": {
          version: "4.2.1", dev: true,
          dependencies: { "@azure/msal-node": "^2.9.2" }
        },
        "node_modules/@azure/msal-node": { version: msal, dev: true }
      }
    }
  };
}

test("accepts the exact reviewed dev-only dependency relationship", () => {
  const { manifest, lock } = fixture();
  assert.deepEqual(verifyPackagerDependencyGraph(manifest, lock), {
    vsce: "3.9.2", identity: "4.2.1", msal: "2.16.3"
  });
});

test("rejects all alternate MSAL major versions, even patched but incompatible 7.1+", () => {
  for (const version of ["1.9.0", "3.0.0", "5.1.5", "6.0.1", "7.0.2", "7.1.0", "7.1.2"]) {
    const { manifest, lock } = fixture(version);
    assert.throws(() => verifyPackagerDependencyGraph(manifest, lock),
      /does not satisfy reviewed/);
  }
});

test("rejects MSAL versions outside the explicitly declared ^2.9.2 range", () => {
  for (const version of ["2.9.0", "2.9.1", "2.8.99"]) {
    const { manifest, lock } = fixture(version);
    assert.throws(() => verifyPackagerDependencyGraph(manifest, lock));
  }
  for (const version of ["2.9.2", "2.16.3", "2.99.99"]) {
    const { manifest, lock } = fixture(version);
    assert.equal(verifyPackagerDependencyGraph(manifest, lock).msal, version);
  }
});

test("rejects prerelease, malformed, noncanonical and unversioned MSAL entries", () => {
  for (const version of [
    "", "7.1.0-rc.1", "6.0.1-beta.0", "2.16.3-rc.1", "2.016.3",
    "02.16.3", "2.16.03", "unlocked", "7.x", "1.2", "99999999999999999999.1.0"
  ]) {
    const { manifest, lock } = fixture(version);
    assert.throws(() => verifyPackagerDependencyGraph(manifest, lock));
  }
});

test("rejects any nested MSAL Node copy even when the reviewed root remains intact", () => {
  for (const name of [
    "node_modules/@vscode/vsce/node_modules/@azure/msal-node",
    "node_modules/transitive/node_modules/@azure/msal-node"
  ]) {
    const { manifest, lock } = fixture();
    lock.packages[name] = { version: "6.0.1", dev: true };
    assert.throws(() => verifyPackagerDependencyGraph(manifest, lock), /nested or missing MSAL/);
  }
});

test("rejects silently added extra Azure Identity or packaging-tool copies", () => {
  for (const [name, version, label] of [
    ["node_modules/other/node_modules/@azure/identity", "4.14.1", /Azure Identity/],
    ["node_modules/other/node_modules/@vscode/vsce", "4.1.0", /VSIX publishing tool/]
  ]) {
    const { manifest, lock } = fixture();
    lock.packages[name] = { version, dev: true };
    assert.throws(() => verifyPackagerDependencyGraph(manifest, lock), label);
  }
});

test("rejects unrelated or corrupted dependency edges in a supposedly reviewed tree", () => {
  for (const [name, key, value] of [
    ["node_modules/@vscode/vsce", "@azure/identity", "^4.14.0"],
    ["node_modules/@azure/identity", "@azure/msal-node", "^7.1.0"],
    ["node_modules/@azure/identity", "@azure/msal-node", null]
  ]) {
    const { manifest, lock } = fixture();
    lock.packages[name].dependencies[key] = value;
    assert.throws(() => verifyPackagerDependencyGraph(manifest, lock), /dependency relationship/);
  }
});

test("rejects release dependencies masquerading as development-only tooling", () => {
  for (const name of [
    "node_modules/@vscode/vsce", "node_modules/@azure/identity",
    "node_modules/@azure/msal-node"
  ]) {
    for (const value of [false, undefined]) {
      const { manifest, lock } = fixture();
      lock.packages[name].dev = value;
      assert.throws(() => verifyPackagerDependencyGraph(manifest, lock), /dev-only/);
    }
  }
});

test("rejects malformed lock formats and unreviewed direct package changes", () => {
  {
    const { manifest, lock } = fixture();
    lock.lockfileVersion = 2;
    assert.throws(() => verifyPackagerDependencyGraph(manifest, lock), /npm v3/);
  }
  {
    const { manifest, lock } = fixture();
    lock.packages = [];
    assert.throws(() => verifyPackagerDependencyGraph(manifest, lock), /lockfile/);
  }
  {
    const { manifest, lock } = fixture();
    manifest.devDependencies["@vscode/vsce"] = "4.1.0";
    assert.throws(() => verifyPackagerDependencyGraph(manifest, lock));
  }
  {
    const { manifest, lock } = fixture();
    delete manifest.overrides["@azure/identity"];
    assert.throws(() => verifyPackagerDependencyGraph(manifest, lock));
  }
});
