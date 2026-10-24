import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
const cli = process.env.npm_execpath;
if (!cli) throw new Error("Run this via npm run check:pack");
const result = execFileSync(process.execPath, [cli, "pack", "--json", "--dry-run", "--ignore-scripts"], {
  encoding: "utf8"
});
const [pack] = JSON.parse(result);
const files = pack.files.map(file => file.path);
for (const required of [
  "package.json", "README.md", "LICENSE",
  "bin/lineloom.mjs", "lib/install.mjs", "lib/releases.mjs", "lib/verify.mjs"
]) assert.ok(files.includes(required), "Missing packaged file: " + required);
assert.ok(files.every(path => !/(^|\/)(test|node_modules|src|\.github)\//.test(path)),
  "Package contains test, build or dependency sources");
assert.equal(pack.name, "@sanskarin/lineloom-cli");
assert.equal(pack.version, "0.2.0");
console.log("Package contents verified:", files.join(", "));
