import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
const cli = process.env.npm_execpath;
if (!cli) throw new Error("Run this via npm run check:pack");
const result = execFileSync(process.execPath, [cli, "pack", "--json", "--dry-run", "--ignore-scripts"], {
  encoding: "utf8"
});
const [pack] = JSON.parse(result);
const files = pack.files.map(file => file.path);
for (const required of [
  "package.json", "README.md", "LICENSE",
  "bin/lineloom.mjs", "lib/install.mjs", "lib/local-install.mjs", "lib/releases.mjs",
  "lib/publisher-check.mjs", "lib/verify.mjs"
]) assert.ok(files.includes(required), "Missing packaged file: " + required);
assert.ok(files.every(path => !/(^|\/)(test|node_modules|src|\.github)\//.test(path)),
  "Package contains test, build or dependency sources");
assert.equal(pack.name, "@sanskarin/lineloom-cli");
const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
assert.equal(pack.version, manifest.version);
console.log("Package contents verified:", files.join(", "));
