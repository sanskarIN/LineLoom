import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { isMainModule, parseArgs, run } from "../bin/lineloom.mjs";
import { getRelease } from "../lib/releases.mjs";
import { assertTrustedUrl, fetchVerifiedVSIX, installRelease } from "../lib/install.mjs";
import { verifyLocalVSIX } from "../lib/verify.mjs";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const fixture = Buffer.alloc(2048, 42);
const digest = createHash("sha256").update(fixture).digest("hex");
const spec = { ...getRelease("stable"), sha256: digest };
const response = (body, status = 200, headers = {}) => new Response(body, { status, headers });
const logger = () => ({
  messages: [],
  log(...args) { this.messages.push(args.join(" ")); },
  error(...args) { this.messages.push(args.join(" ")); }
});

test("CLI entrypoint accepts canonical file aliases without executing on import", async () => {
  const moduleUrl = new URL("../bin/lineloom.mjs", import.meta.url);
  const entry = fileURLToPath(moduleUrl);
  assert.equal(isMainModule(entry, moduleUrl.href), true);
  assert.equal(isMainModule(join(tmpdir(), "missing-cli-entry.mjs"), moduleUrl.href), false);
  assert.equal(isMainModule("", moduleUrl.href), false);
  if (process.platform === "win32") return; // Symlink creation can require privileges.
  const dir = await mkdtemp(join(tmpdir(), "lineloom-entrypoint-alias-"));
  try {
    const alias = join(dir, "cli-alias.mjs");
    await symlink(entry, alias);
    assert.equal(isMainModule(alias, moduleUrl.href), true);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("channels pin public release assets and preserve the legacy extension publisher", () => {
  assert.deepEqual(
    {
      version: getRelease("stable").version, publisher: getRelease("stable").publisher,
      asset: getRelease("stable").asset, sha256: getRelease("stable").sha256
    },
    {
      version: "1.3.0", publisher: "SanskarCodes",
      asset: "LineLoom-1.3.0.vsix",
      sha256: "6af67d3caab5ae7a86dda574870cccb210fc20fbf105e014ce6532c0ff793e25"
    }
  );
  assert.deepEqual(
    {
      version: getRelease("preview").version, publisher: getRelease("preview").publisher,
      asset: getRelease("preview").asset, sha256: getRelease("preview").sha256
    },
    {
      version: "1.4.3", publisher: "SanskarCodes",
      asset: "LineLoom-1.4.3-SanskarCodes.vsix",
      sha256: "d16b38b90c95fc2aa765543ede7213a42da8b11a1cc15edba7dd11b9e3649fb8"
    }
  );
  for (const channel of ["stable", "preview"]) {
    const release = getRelease(channel);
    assert.equal(
      release.url,
      `https://github.com/sanskarIN/LineLoom/releases/download/v${release.version}/${release.asset}`
    );
    assert.match(release.sha256, /^[a-f0-9]{64}$/);
  }
  assert.throws(() => getRelease("latest"));
  assert.throws(() => getRelease("stable", "Sanskar"), /--preview/);
  assert.throws(() => getRelease("preview", "OtherPublisher"), /publisher/);
});

test("explicit new publisher maps only to the separately verified v1.4.3 VSIX", () => {
  const release = getRelease("preview", "Sanskar");
  assert.deepEqual(
    {
      version: release.version, publisher: release.publisher, asset: release.asset,
      sha256: release.sha256, url: release.url
    },
    {
      version: "1.4.3", publisher: "Sanskar", asset: "LineLoom-1.4.3-Sanskar.vsix",
      sha256: "5dbf98d0edcf99ce4cb0ebb30a82efd2b092698ad5a74594c7115d33959acb6b",
      url: "https://github.com/sanskarIN/LineLoom/releases/download/v1.4.3/LineLoom-1.4.3-Sanskar.vsix"
    }
  );
  assert.notEqual(release.sha256, getRelease("preview").sha256);
  assert.notEqual(release.url, getRelease("preview").url);
});

test("accept only supported commands and editor names", () => {
  assert.deepEqual(parseArgs(["install", "--preview", "--editor", "codium", "--dry-run"]), {
    command: "install", channel: "preview", editor: "codium", dryRun: true
  });
  for (const invalid of [
    ["install", "--editor", "bash"], ["install", "--editor"],
    ["install", "--preview", "--preview"], ["install", "--unknown"], ["wipe"]
  ]) assert.throws(() => parseArgs(invalid));
});

test("publisher choices require explicit preview and reject malformed flags", () => {
  assert.deepEqual(parseArgs(["install", "--preview", "--publisher", "Sanskar", "--dry-run"]), {
    command: "install", channel: "preview", editor: "code", dryRun: true, publisher: "Sanskar"
  });
  assert.deepEqual(parseArgs(["verify", "--publisher", "Sanskar", "local.vsix", "--preview"]), {
    command: "verify", channel: "preview", path: "local.vsix", publisher: "Sanskar"
  });
  assert.deepEqual(parseArgs(["install", "--publisher", "SanskarCodes"]), {
    command: "install", channel: "stable", editor: "code", dryRun: false, publisher: "SanskarCodes"
  });
  for (const args of [
    ["install", "--publisher", "Sanskar"],
    ["verify", "local.vsix", "--publisher", "Sanskar"],
    ["install", "--preview", "--publisher"],
    ["verify", "--preview", "--publisher", "unknown", "local.vsix"],
    ["install", "--publisher", "Sanskar", "--publisher", "SanskarCodes", "--preview"],
    ["verify", "--preview", "--publisher", "Sanskar", "--publisher", "Sanskar", "local.vsix"],
    ["install", "--preview", "--publisher", "Sanskar", "--publisher", "Sanskar"],
    ["install", "--preview", "--publisher", "--dry-run"],
    ["install", "--preview", "--publisher", "sanskar"]
  ]) assert.throws(() => parseArgs(args), JSON.stringify(args));
});

test("reject insecure and untrusted redirect destinations", () => {
  for (const url of [
    "http://github.com/a", "https://github.com.evil.test/a",
    "https://attacker.test/a", "https://user:pw@github.com/a",
    "https://github.com:444/a"
  ]) assert.throws(() => assertTrustedUrl(url));
  assert.equal(assertTrustedUrl("https://release-assets.githubusercontent.com/a").hostname,
    "release-assets.githubusercontent.com");
});

test("dry-run does not download or run an editor", async () => {
  const io = logger();
  assert.equal(await run(["install", "--dry-run"], io, {
    fetchImpl: () => { throw Error("Download invoked"); },
    runner: () => { throw Error("Editor invoked"); }
  }), 0);
  assert.match(io.messages.join("\n"), /Dry run/);
  assert.match(io.messages.join("\n"), /SanskarCodes\.lineloom/);
  const previewIo = logger();
  assert.equal(await run(["install", "--preview", "--dry-run"], previewIo, {
    fetchImpl: () => { throw Error("Download invoked"); },
    runner: () => { throw Error("Editor invoked"); }
  }), 0);
  assert.match(previewIo.messages.join("\n"), /LineLoom-1\.4\.3-SanskarCodes\.vsix/);
  assert.match(previewIo.messages.join("\n"), /SanskarCodes\.lineloom/);
  assert.doesNotMatch(previewIo.messages.join("\n"), /LineLoom-1\.4\.3-Sanskar\.vsix/);
  const migrationIo = logger();
  assert.equal(await run(["install", "--preview", "--publisher", "Sanskar", "--dry-run"], migrationIo, {
    fetchImpl: () => { throw Error("Download invoked"); },
    runner: () => { throw Error("Editor invoked"); }
  }), 0);
  assert.match(migrationIo.messages.join("\n"), /LineLoom-1\.4\.3-Sanskar\.vsix/);
  assert.match(migrationIo.messages.join("\n"), /ID Sanskar\.lineloom/);
  assert.match(migrationIo.messages.join("\n"), /uninstall\/disable SanskarCodes\.lineloom/);
  assert.doesNotMatch(migrationIo.messages.join("\n"), /LineLoom-1\.4\.3-SanskarCodes\.vsix/);
});

test("pinned fixture installs with a shell-free executable and array arguments", async () => {
  let requests = 0;
  const editorCalls = [];
  const bytes = await installRelease(spec, {
    fetchImpl: async () => { requests++; return response(fixture); },
    runner: (command, args, options) => {
      editorCalls.push({ command, args, options });
      return { status: 0 };
    }
  });
  assert.equal(bytes, fixture.length);
  assert.equal(requests, 1);
  assert.equal(editorCalls.length, 1);
  assert.equal(editorCalls[0].command, "code");
  assert.equal(editorCalls[0].args[0], "--install-extension");
  assert.equal(editorCalls[0].options.shell, false);
});

test("reject checksum mismatch, invalid size, missing and hostile redirects", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lineloom-test-"));
  try {
    await assert.rejects(fetchVerifiedVSIX(spec, join(dir, "bad.vsix"), async () =>
      response(Buffer.alloc(2048, 41))), /SHA-256/);
    await assert.rejects(fetchVerifiedVSIX(spec, join(dir, "short.vsix"), async () =>
      response(Buffer.from("x"))), /SHA-256/);
    await assert.rejects(fetchVerifiedVSIX(spec, join(dir, "large.vsix"), async () =>
      response(fixture, 200, { "content-length": String(11 * 1024 * 1024) })), /size/);
    await assert.rejects(fetchVerifiedVSIX(spec, join(dir, "missing.vsix"), async () =>
      response("missing", 404)), /unsuccessful/);
    await assert.rejects(fetchVerifiedVSIX(spec, join(dir, "untrusted.vsix"), async () =>
      response(null, 302, { location: "https://attacker.test/code" })), /untrusted/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("follow an allowed redirect to a matching fixture", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lineloom-test-"));
  try {
    let calls = 0;
    const path = join(dir, "ok.vsix");
    const bytes = await fetchVerifiedVSIX(spec, path, async () => {
      calls++;
      return calls === 1
        ? response(null, 302, { location: "https://release-assets.githubusercontent.com/asset" })
        : response(fixture);
    });
    assert.equal(bytes, 2048);
    assert.equal(calls, 2);
    assert.deepEqual(await readFile(path), fixture);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("offline verify reads a bounded local file and enforces a pinned digest", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lineloom-verify-"));
  const path = join(dir, "candidate.vsix");
  try {
    await writeFile(path, fixture);
    assert.equal(await verifyLocalVSIX(path, digest), fixture.length);
    await assert.rejects(verifyLocalVSIX(path, "0".repeat(64)), /SHA-256/);
    await assert.rejects(verifyLocalVSIX(path, "bad-digest"), /pinned SHA-256/);
    await assert.rejects(verifyLocalVSIX(join(dir, "missing.vsix"), digest));
    await assert.rejects(verifyLocalVSIX(join(dir, "wrong.zip"), digest), /\.vsix/);
    await writeFile(path, Buffer.alloc(20));
    await assert.rejects(verifyLocalVSIX(path, digest), /size/);
    await writeFile(path, Buffer.alloc(10 * 1024 * 1024 + 1));
    await assert.rejects(verifyLocalVSIX(path, digest), /size/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("verify command parses stable and preview and does not install on failure", async () => {
  assert.deepEqual(parseArgs(["verify", "download.vsix", "--preview"]), {
    command: "verify", channel: "preview", path: "download.vsix"
  });
  assert.deepEqual(parseArgs(["verify", "--preview", "download.vsix"]), {
    command: "verify", channel: "preview", path: "download.vsix"
  });
  for (const args of [
    ["verify"], ["verify", "--preview"], ["verify", "a.vsix", "b.vsix"],
    ["verify", "a.vsix", "--preview", "--preview"], ["verify", "--unknown", "a.vsix"]
  ]) assert.throws(() => parseArgs(args));
  const io = logger();
  assert.equal(await run(["verify", "missing.vsix"], io, {
    fetchImpl: () => { throw Error("Download invoked"); },
    runner: () => { throw Error("Editor invoked"); }
  }), 1);
  assert.match(io.messages.join("\n"), /LineLoom installer:/);
});

test("offline install CLI parses local VSIX and rejects conflicting options", () => {
  assert.deepEqual(parseArgs(["install", "--preview", "--file", "preview.vsix", "--editor", "codium"]), {
    command: "install", channel: "preview", editor: "codium", dryRun: false, file: "preview.vsix"
  });
  for (const args of [
    ["install", "--file"], ["install", "--file", "--preview"],
    ["install", "--file", "a.vsix", "--file", "b.vsix"],
    ["install", "--file", "a.vsix", "--dry-run"]
  ]) assert.throws(() => parseArgs(args));
});

test("offline CLI never downloads or installs a mismatching artifact", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lineloom-cli-offline-"));
  const file = join(dir, "download.vsix");
  const io = logger();
  try {
    await writeFile(file, fixture);
    assert.equal(await run(["install", "--file", file], io, {
      fetchImpl: () => { throw Error("Network invoked"); },
      runner: () => { throw Error("Editor invoked"); }
    }), 1);
    assert.match(io.messages.join("\n"), /SHA-256/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});


test("online Sanskar preview refuses a conflicting installed publisher before network access", async () => {
  const io = logger();
  let queries = 0;
  assert.equal(await run(["install", "--preview", "--publisher", "Sanskar"], io, {
    fetchImpl: () => { throw Error("Network must not be used before migration check"); },
    runner(command, args, options) {
      queries++;
      assert.equal(command, "code");
      assert.deepEqual(args, ["--list-extensions"]);
      assert.equal(options.shell, false);
      return { status: 0, stdout: "other.extension\nSanskarCodes.lineloom\n" };
    }
  }), 1);
  assert.equal(queries, 1);
  assert.match(io.messages.join("\n"), /SanskarCodes\.lineloom is still installed/);
});

test("online Sanskar preview refuses unavailable extension inventory before network access", async () => {
  const io = logger();
  assert.equal(await run(["install", "--preview", "--publisher", "Sanskar"], io, {
    fetchImpl: () => { throw Error("Network must not be used before migration check"); },
    runner: () => ({ status: 1, stdout: "" })
  }), 1);
  assert.match(io.messages.join("\n"), /Cannot check installed extensions/);
});


test("online migration rechecks the editor after downloading, before installing", async () => {
  const migrating = { ...getRelease("preview", "Sanskar"), sha256: digest };
  const commands = [];
  let downloads = 0;
  const bytes = await installRelease(migrating, {
    fetchImpl: async () => {
      downloads++;
      return response(fixture);
    },
    runner(_editor, args, options) {
      commands.push(args[0]);
      if (args[0] === "--list-extensions") {
        assert.equal(options.shell, false);
        return { status: 0, stdout: "other.extension\n" };
      }
      assert.equal(args[0], "--install-extension");
      assert.equal(options.shell, false);
      return { status: 0 };
    }
  });
  assert.equal(bytes, fixture.length);
  assert.equal(downloads, 1);
  assert.deepEqual(commands, ["--list-extensions", "--list-extensions", "--install-extension"]);
});

test("online migration rejects a conflicting publisher added while downloading", async () => {
  const migrating = { ...getRelease("preview", "Sanskar"), sha256: digest };
  const commands = [];
  let downloads = 0;
  await assert.rejects(installRelease(migrating, {
    fetchImpl: async () => {
      downloads++;
      return response(fixture);
    },
    runner(_editor, args) {
      commands.push(args[0]);
      assert.deepEqual(args, ["--list-extensions"]);
      return commands.length === 1
        ? { status: 0, stdout: "other.extension\n" }
        : { status: 0, stdout: "SanskarCodes.lineloom\n" };
    }
  }), /SanskarCodes\.lineloom is still installed/);
  assert.equal(downloads, 1);
  assert.deepEqual(commands, ["--list-extensions", "--list-extensions"]);
});

test("online migration fails closed if the second editor query fails", async () => {
  const migrating = { ...getRelease("preview", "Sanskar"), sha256: digest };
  const commands = [];
  await assert.rejects(installRelease(migrating, {
    fetchImpl: async () => response(fixture),
    runner(_editor, args) {
      commands.push(args[0]);
      assert.deepEqual(args, ["--list-extensions"]);
      return commands.length === 1
        ? { status: 0, stdout: "" }
        : { status: 1, stdout: "" };
    }
  }), /Cannot check installed extensions/);
  assert.deepEqual(commands, ["--list-extensions", "--list-extensions"]);
});
