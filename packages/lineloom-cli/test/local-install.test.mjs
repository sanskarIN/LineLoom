import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { lstat, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installLocalRelease } from "../lib/local-install.mjs";

const fixture = Buffer.alloc(2048, 42);
const spec = { version: "1.2.0", sha256: createHash("sha256").update(fixture).digest("hex") };

test("offline install verifies a private staged copy and cleans up", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lineloom-local-test-"));
  const input = join(dir, "download.vsix");
  await writeFile(input, fixture);
  let staged;
  try {
    const bytes = await installLocalRelease(spec, input, {
      runner(editor, args, options) {
        assert.equal(editor, "code");
        assert.equal(args[0], "--install-extension");
        assert.equal(options.shell, false);
        staged = args[1];
        assert.notEqual(staged, input);
        assert.deepEqual(readFileSync(staged), fixture);
        return { status: 0 };
      }
    });
    assert.equal(bytes, fixture.length);
    await assert.rejects(lstat(staged), /ENOENT/);
    assert.deepEqual(readFileSync(input), fixture);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("offline install rejects tampered, invalid and oversized files without invoking editor", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lineloom-local-test-"));
  const input = join(dir, "download.vsix");
  let calls = 0;
  const runner = () => { calls++; return { status: 0 }; };
  try {
    await writeFile(input, Buffer.alloc(2048, 41));
    await assert.rejects(installLocalRelease(spec, input, { runner }), /SHA-256/);
    await writeFile(input, Buffer.alloc(30));
    await assert.rejects(installLocalRelease(spec, input, { runner }), /size/);
    await writeFile(input, Buffer.alloc(10 * 1024 * 1024 + 1));
    await assert.rejects(installLocalRelease(spec, input, { runner }), /size/);
    await assert.rejects(installLocalRelease(spec, dir, { runner }), /\.vsix/);
    await assert.rejects(installLocalRelease(spec, input, { editor: "bash", runner }), /editor CLI/);
    // A raw library caller must not be able to influence the staging path
    // with a malformed version, even when the checksum is well formed.
    for (const version of ["../escape", "1.2.0/../escape", "1.2.0\\\\evil", "1.2", ""]) {
      await assert.rejects(installLocalRelease({ ...spec, version }, input, { runner }), /version/);
    }
    assert.equal(calls, 0);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("offline install removes staged package even on editor failure", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lineloom-local-test-"));
  const input = join(dir, "download.vsix");
  await writeFile(input, fixture);
  let staged;
  try {
    await assert.rejects(installLocalRelease(spec, input, {
      runner(_editor, args) { staged = args[1]; return { status: 2 }; }
    }), /exited with code 2/);
    await assert.rejects(lstat(staged), /ENOENT/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});


test("offline Sanskar migration blocks the conflicting legacy extension before installation", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lineloom-collision-test-"));
  const input = join(dir, "preview.vsix");
  const migrating = { ...spec, publisher: "Sanskar" };
  await writeFile(input, fixture);
  let calls = 0;
  try {
    await assert.rejects(installLocalRelease(migrating, input, {
      runner(_editor, args) {
        calls++;
        assert.deepEqual(args, ["--list-extensions"]);
        return { status: 0, stdout: "SanskarCodes.lineloom\n" };
      }
    }), /SanskarCodes\.lineloom is still installed/);
    assert.equal(calls, 1);
    assert.deepEqual(readFileSync(input), fixture);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("offline Sanskar migration installs only after a successful clean extension listing", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lineloom-clean-test-"));
  const input = join(dir, "preview.vsix");
  await writeFile(input, fixture);
  const migrating = { ...spec, publisher: "Sanskar" };
  const calls = [];
  let staged;
  try {
    const bytes = await installLocalRelease(migrating, input, {
      editor: "codium",
      runner(editor, args, options) {
        calls.push([...args]);
        assert.equal(editor, "codium");
        assert.equal(options.shell, false);
        if (args[0] === "--list-extensions") {
          return { status: 0, stdout: "unrelated.extension\n" };
        }
        assert.equal(args[0], "--install-extension");
        staged = args[1];
        assert.deepEqual(readFileSync(staged), fixture);
        return { status: 0 };
      }
    });
    assert.equal(bytes, fixture.length);
    assert.deepEqual(calls.map(args => args[0]), ["--list-extensions", "--list-extensions", "--install-extension"]);
    await assert.rejects(lstat(staged), /ENOENT/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});


test("offline migration refuses a legacy extension that appears after VSIX staging", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lineloom-midflight-test-"));
  const input = join(dir, "preview.vsix");
  await writeFile(input, fixture);
  const migrating = { ...spec, publisher: "Sanskar" };
  const commands = [];
  try {
    await assert.rejects(installLocalRelease(migrating, input, {
      runner(_editor, args) {
        commands.push(args[0]);
        assert.deepEqual(args, ["--list-extensions"]);
        return commands.length === 1
          ? { status: 0, stdout: "some.extension\n" }
          : { status: 0, stdout: "SanskarCodes.lineloom\n" };
      }
    }), /SanskarCodes\.lineloom is still installed/);
    assert.deepEqual(commands, ["--list-extensions", "--list-extensions"]);
    assert.deepEqual(readFileSync(input), fixture);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("offline migration fails closed if the second extension listing becomes unavailable", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lineloom-midflight-error-test-"));
  const input = join(dir, "preview.vsix");
  await writeFile(input, fixture);
  const migrating = { ...spec, publisher: "Sanskar" };
  const commands = [];
  try {
    await assert.rejects(installLocalRelease(migrating, input, {
      runner(_editor, args) {
        commands.push(args[0]);
        assert.deepEqual(args, ["--list-extensions"]);
        return commands.length === 1
          ? { status: 0, stdout: "" }
          : { status: 1, stdout: "" };
      }
    }), /Cannot check installed extensions/);
    assert.deepEqual(commands, ["--list-extensions", "--list-extensions"]);
    assert.deepEqual(readFileSync(input), fixture);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
