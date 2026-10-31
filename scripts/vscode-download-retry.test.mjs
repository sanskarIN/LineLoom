import assert from "node:assert/strict";
import test from "node:test";
import {
  isTransientVSCodeDownloadError, downloadVSCodeWithTransientRetries
} from "./vscode-download-retry.mjs";

const network = code => Object.assign(new Error("UNTRUSTED_DOWNLOAD_URL"), { code });
const noWait = () => Promise.resolve();

test("retries transient VS Code transport failures, but launches no tests", async () => {
  const seen = [];
  const pauses = [];
  const value = await downloadVSCodeWithTransientRetries(async version => {
    seen.push(version);
    if (seen.length < 3) throw network("ETIMEDOUT");
    return "/synthetic/vscode";
  }, { pause: ms => { pauses.push(ms); return noWait(); } });
  assert.equal(value, "/synthetic/vscode");
  assert.deepEqual(seen, ["stable", "stable", "stable"]);
  assert.deepEqual(pauses, [1000, 2000]);
});

test("handles AggregateError with nested transient connections", async () => {
  const nested = new AggregateError([
    network("ENETUNREACH"), network("ETIMEDOUT")
  ], "SENSITIVE_ERROR_BODY");
  assert.equal(isTransientVSCodeDownloadError(nested), true);
  assert.equal(isTransientVSCodeDownloadError({
    cause: { cause: network("EAI_AGAIN") }
  }), true);
  let count = 0;
  const result = await downloadVSCodeWithTransientRetries(async () => {
    count++;
    if (count === 1) throw nested;
    return "/synthetic/vscode";
  }, { pause: noWait });
  assert.equal(result, "/synthetic/vscode");
  assert.equal(count, 2);
});

test("never retries assertion failures, invalid paths or integrity errors", async () => {
  for (const error of [
    new Error("test-assertion-failed-PRIVATE"),
    Object.assign(new Error("download-integrity-failed"), { code: "EINTEGRITY" }),
    Object.assign(new Error("HTTP 404"), { status: 404 })
  ]) {
    let called = 0;
    await assert.rejects(downloadVSCodeWithTransientRetries(async () => {
      called++;
      throw error;
    }, { pause: noWait }), rejected => rejected === error);
    assert.equal(called, 1);
  }
  let count = 0;
  await assert.rejects(downloadVSCodeWithTransientRetries(async () => {
    count++;
    return "";
  }, { pause: noWait }), /invalid-vscode-executable/);
  assert.equal(count, 1);
});

test("never exceeds three attempts or logs sensitive network errors", async () => {
  const error = network("ECONNRESET");
  let attempts = 0;
  let delays = 0;
  await assert.rejects(downloadVSCodeWithTransientRetries(async () => {
    attempts++;
    throw error;
  }, { pause: async () => { delays++; } }), rejected => rejected === error);
  assert.equal(attempts, 3);
  assert.equal(delays, 2);
});

test("rejects invalid controls and cyclic untrusted error shapes", async () => {
  for (const attempts of [0, 4, NaN, 1.2]) {
    await assert.rejects(
      downloadVSCodeWithTransientRetries(async () => "x", { attempts, pause: noWait }),
      /invalid-vscode-download-retry-settings/
    );
  }
  const cyclical = { code: "NOT_NETWORK" };
  cyclical.cause = cyclical;
  assert.equal(isTransientVSCodeDownloadError(cyclical), false);
  assert.equal(isTransientVSCodeDownloadError("ETIMEDOUT"), false);
});
