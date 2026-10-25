import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyPackagerDependencyGraph } from "./check-packager-deps.mjs";

function fixture(msal = "2.16.3") {
  return {
    manifest: { devDependencies: { "@vscode/vsce": "3.9.2" },
      overrides: { "@azure/identity": "4.2.1" } },
    lock: { packages: { "": { devDependencies: { "@vscode/vsce": "3.9.2" } },
      "node_modules/@vscode/vsce": { version: "3.9.2" },
      "node_modules/@azure/identity": { version: "4.2.1" },
      "node_modules/@azure/msal-node": { version: msal } } }
  };
}
test("accepts the audited pinned toolchain", () => {
  const {manifest,lock} = fixture();
  assert.equal(verifyPackagerDependencyGraph(manifest,lock).msal,"2.16.3");
});
test("rejects affected MSAL majors and old 7.0 releases", () => {
  for(const version of ["5.1.5","6.0.1","7.0.2"]){
    const {manifest,lock} = fixture(version);
    assert.throws(()=>verifyPackagerDependencyGraph(manifest,lock),/affected/);
  }
});
test("does not reject patched 7.1 releases on advisory grounds", () => {
  const {manifest,lock}=fixture("7.1.0");
  assert.equal(verifyPackagerDependencyGraph(manifest,lock).msal,"7.1.0");
});
test("rejects unreviewed packaging tool or override changes", () => {
  const {manifest,lock}=fixture();
  manifest.devDependencies["@vscode/vsce"]="4.0.0";
  assert.throws(()=>verifyPackagerDependencyGraph(manifest,lock));
  manifest.devDependencies["@vscode/vsce"]="3.9.2";
  delete manifest.overrides["@azure/identity"];
  assert.throws(()=>verifyPackagerDependencyGraph(manifest,lock));
});
