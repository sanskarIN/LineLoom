import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Exercise the actual .tgz a user would install, not imports from the source
// checkout. A local tarball and --offline guarantee that no registry fetch is
// needed. Installing this CLI never invokes lifecycle hooks or installs VSIXs.
const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const npmCli = process.env.npm_execpath;
assert.ok(npmCli && npmCli.endsWith(".js"), "Run with npm run smoke:consumer");

const sourceManifest = JSON.parse(await readFile(join(packageDir, "package.json"), "utf8"));
assert.equal(sourceManifest.name, "@sanskarin/lineloom-cli");
assert.ok(!sourceManifest.dependencies || Object.keys(sourceManifest.dependencies).length === 0);

const stage = await mkdtemp(join(tmpdir(), "lineloom-packed-consumer-"));
const npmEnvironment = {
  ...process.env,
  npm_config_cache: join(stage, "npm-cache"),
  npm_config_offline: "true",
  npm_config_ignore_scripts: "true",
  npm_config_audit: "false",
  npm_config_fund: "false",
  npm_config_update_notifier: "false",
  npm_config_progress: "false"
};
function npm(args, cwd = packageDir) {
  return execFileSync(process.execPath, [npmCli, ...args], {
    cwd, env: npmEnvironment, encoding: "utf8", timeout: 60_000,
    maxBuffer: 2 * 1024 * 1024
  });
}
function runInstalled(entry, args) {
  return execFileSync(process.execPath, [entry, ...args], {
    cwd: stage, encoding: "utf8", timeout: 10_000,
    maxBuffer: 256 * 1024
  });
}
try {
  const packed = JSON.parse(npm([
    "pack", "--json", "--ignore-scripts", "--pack-destination", stage
  ]));
  assert.equal(packed.length, 1, "Expected exactly one npm tarball");
  const artifact = packed[0];
  assert.equal(artifact.name, sourceManifest.name);
  assert.equal(artifact.version, sourceManifest.version);
  assert.equal(basename(artifact.filename), artifact.filename, "Unsafe tarball filename");
  const tarball = join(stage, artifact.filename);
  assert.ok((await stat(tarball)).size > 0, "Empty npm tarball");

  const consumer = join(stage, "fresh-consumer");
  // The only input is our local .tgz. Nothing is fetched from GitHub
  // Packages or npmjs, even when the developer has a scope registry setting.
  npm([
    "install", "--prefix", consumer, "--offline", "--ignore-scripts",
    "--no-audit", "--no-fund", "--no-save", "--package-lock=false", tarball
  ], stage);

  const installedDir = join(consumer, "node_modules", "@sanskarin", "lineloom-cli");
  const installed = JSON.parse(await readFile(join(installedDir, "package.json"), "utf8"));
  assert.equal(installed.name, sourceManifest.name);
  assert.equal(installed.version, sourceManifest.version);
  assert.equal(installed.bin.lineloom, "./bin/lineloom.mjs");
  assert.ok(!installed.dependencies || Object.keys(installed.dependencies).length === 0);
  const entry = join(installedDir, "bin", "lineloom.mjs");
  assert.ok((await stat(entry)).isFile());

  assert.match(runInstalled(entry, ["--help"]), /LineLoom VS Code installer/);
  assert.match(runInstalled(entry, ["version"]), /stable: LineLoom v/);
  const stable = runInstalled(entry, ["install", "--dry-run"]);
  assert.match(stable, /ID SanskarCodes\.lineloom/);
  assert.match(stable, /Dry run: no download or installation/);
  const preview = runInstalled(entry, ["install", "--preview", "--dry-run"]);
  assert.match(preview, /ID SanskarCodes\.lineloom/);
  assert.match(preview, /LineLoom-1\.4\.4-SanskarCodes\.vsix/);
  const migration = runInstalled(entry, [
    "install", "--preview", "--publisher", "Sanskar", "--dry-run"
  ]);
  assert.match(migration, /ID Sanskar\.lineloom/);
  assert.match(migration, /LineLoom-1\.4\.4-Sanskar\.vsix/);
  assert.match(migration, /Dry run: no download or installation/);
  const invalid = spawnSync(process.execPath, [
    entry, "install", "--publisher", "Sanskar", "--dry-run"
  ], { cwd: stage, encoding: "utf8", timeout: 10_000 });
  assert.equal(invalid.status, 1, "Stable-channel migration must be rejected");
  assert.match(invalid.stderr, /Sanskar publisher requires --preview/);

  console.log(
    "Offline packed npm consumer smoke PASS:",
    installed.name + "@" + installed.version,
    "(help, version, stable/preview dry-runs, explicit publisher guard)"
  );
} finally {
  await rm(stage, { recursive: true, force: true });
}
