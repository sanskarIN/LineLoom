import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stageNewPublisher } from "./package-publisher.mjs";

test("new publisher staging is curated, preserves source and settings identity", () => {
  const dir = mkdtempSync(join(tmpdir(), "lineloom-publisher-test-"));
  try {
    const src = join(dir, "source");
    const stage = join(dir, "stage");
    mkdirSync(join(src, "dist"), { recursive: true });
    mkdirSync(join(src, "assets", "icons"), { recursive: true });
    mkdirSync(join(src, "model"), { recursive: true });
    mkdirSync(stage);
    const manifest = { name: "lineloom", publisher: "SanskarCodes", version: "1.4.3",
      main: "./dist/extension.js", contributes: { configuration: { properties: { "lineloom.enabled": { default: true } } } } };
    const before = JSON.stringify(manifest, null, 2) + "\n";
    writeFileSync(join(src, "package.json"), before);
    for (const file of ["README.md", "CHANGELOG.md", "LICENSE", "PRIVACY.md"]) writeFileSync(join(src, file), "test");
    writeFileSync(join(src, ".vscodeignore"), "**/model/**\n");
    writeFileSync(join(src, "dist", "extension.js"), "module.exports = {}");
    writeFileSync(join(src, "assets", "icons", "lineloom.png"), "icon");
    writeFileSync(join(src, "model", "private-data.txt"), "MUST NOT COPY");
    const result = stageNewPublisher(src, stage);
    assert.equal(result.publisher, "Sanskar");
    assert.equal(result.version, manifest.version);
    assert.deepEqual(result.contributes, manifest.contributes);
    assert.equal(readFileSync(join(src, "package.json"), "utf8"), before);
    assert.ok(existsSync(join(stage, "dist", "extension.js")));
    assert.equal(readFileSync(join(stage, "PRIVACY.md"), "utf8"), "test");
    assert.equal(readFileSync(join(stage, ".vscodeignore"), "utf8"), "**/model/**\n");
    assert.ok(!existsSync(join(stage, "model")));
    assert.ok(!existsSync(join(stage, "node_modules")));
    assert.ok(!existsSync(join(stage, ".github")));
    assert.equal(JSON.parse(readFileSync(join(stage, "package.json"), "utf8")).publisher, "Sanskar");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
