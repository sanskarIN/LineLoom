import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { parseArgs, run } from "../bin/lineloom.mjs";
import { getRelease } from "../lib/releases.mjs";
import { assertTrustedUrl, fetchVerifiedVSIX, installRelease } from "../lib/install.mjs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const fixture = Buffer.alloc(2048, 42);
const digest = createHash("sha256").update(fixture).digest("hex");
const spec = { ...getRelease("stable"), sha256: digest };
const response = (body, status = 200, headers = {}) => new Response(body, { status, headers });
const logger = () => ({
  messages: [],
  log(...args) { this.messages.push(args.join(" ")); },
  error(...args) { this.messages.push(args.join(" ")); }
});

test("channels pin published versions and SHA-256 hashes", () => {
  assert.equal(getRelease("stable").version, "1.2.0");
  assert.equal(getRelease("preview").version, "1.2.4");
  assert.match(getRelease("stable").sha256, /^[a-f0-9]{64}$/);
  assert.throws(() => getRelease("latest"));
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
