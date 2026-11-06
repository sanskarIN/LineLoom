import test from "node:test";
import assert from "node:assert/strict";
import { assertPublisherMigrationReady } from "../lib/publisher-check.mjs";
import { getRelease } from "../lib/releases.mjs";

const migration = getRelease("preview", "Sanskar");
const legacy = getRelease("preview");

test("legacy installs never inspect installed extensions or change existing behavior", () => {
  assert.doesNotThrow(() => assertPublisherMigrationReady(legacy, "code", () => {
    throw Error("Legacy install unexpectedly queried extension list");
  }));
});

test("migration preflight calls only the selected editor with no shell or settings access", () => {
  let calls = 0;
  for (const editor of ["code", "code-insiders", "codium"]) {
    assert.doesNotThrow(() => assertPublisherMigrationReady(migration, editor,
      (command, args, options) => {
        calls++;
        assert.equal(command, editor);
        assert.deepEqual(args, ["--list-extensions"]);
        assert.equal(options.shell, false);
        assert.equal(options.encoding, "utf8");
        assert.ok(options.timeout > 0);
        assert.ok(options.maxBuffer > 0);
        assert.equal(options.windowsHide, true);
        return { status: 0, stdout: "publisher.other\nSanskar.lineloom\n" };
      }
    ));
  }
  assert.equal(calls, 3);
});

test("reject a legacy publisher ID in CRLF output, with exact ID matching", () => {
  for (const stdout of [
    "someone.extension\r\nSanskarCodes.lineloom\r\n",
    "SANsKARCODES.LINELOOM\n",
    "  SanskarCodes.lineloom   \n",
    "SanskarCodes.lineloom\nSanskar.lineloom\n"
  ]) {
    assert.throws(
      () => assertPublisherMigrationReady(migration, "code", () => ({ status: 0, stdout })),
      /SanskarCodes\.lineloom is still installed/
    );
  }
  for (const stdout of [
    "something.SanskarCodes.lineloom\n",
    "SanskarCodes.lineloom.more\n",
    "Sanskar.lineloom\n",
    ""
  ]) {
    assert.doesNotThrow(() => assertPublisherMigrationReady(
      migration, "code", () => ({ status: 0, stdout })
    ));
  }
});

test("incomplete editor list fails closed before a new-publisher install", () => {
  const results = [
    { status: 1, stdout: "" },
    { status: null, stdout: "Sanskar.lineloom\n" },
    { status: 0, stdout: undefined },
    { status: 0, stdout: Buffer.from("") },
    { status: 0, stdout: "", error: new Error("timeout") },
    undefined
  ];
  for (const result of results) {
    assert.throws(
      () => assertPublisherMigrationReady(migration, "code", () => result),
      /Cannot check installed extensions/
    );
  }
  assert.throws(
    () => assertPublisherMigrationReady(migration, "bash", () => ({ status: 0, stdout: "" })),
    /Unsupported editor CLI/
  );
});
