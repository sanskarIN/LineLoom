import test from "node:test";
import assert from "node:assert/strict";
import {
  PUBLIC_REGISTRY, KNOWN_NAMESPACES, checkNamespace, publicApiUrl,
  parsePublicRecord, inspectPublicOpenVsx, describePublicOpenVsx,
  isVerifiedPublicStable
} from "./open-vsx-public.mjs";

const stable = {
  namespace: "SanskarCodes", name: "lineloom", version: "1.3.0",
  preRelease: false, downloadable: true
};

function mockedResponse(payload, { status = 200 } = {}) {
  return new Response(typeof payload === "string" ? payload : JSON.stringify(payload), { status });
}

test("public registry URL is fixed to HTTPS Open VSX and two known publisher IDs", () => {
  assert.equal(PUBLIC_REGISTRY, "https://open-vsx.org");
  assert.deepEqual(KNOWN_NAMESPACES, ["SanskarCodes", "Sanskar"]);
  assert.equal(publicApiUrl("SanskarCodes"), "https://open-vsx.org/api/SanskarCodes/lineloom");
  assert.equal(publicApiUrl("Sanskar", "1.4.4"), "https://open-vsx.org/api/Sanskar/lineloom/1.4.4");
  assert.throws(() => checkNamespace("attacker.invalid"), /Unapproved/);
  assert.throws(() => publicApiUrl("Sanskar/../../api"), /Unapproved/);
  assert.throws(() => publicApiUrl("Sanskar", "1.4.4?token=value"), /Invalid expected version/);
  assert.throws(() => publicApiUrl("Sanskar", "1.4.4/../../secret"), /Invalid expected version/);
});

test("valid published legacy stable metadata is bounded and typed", () => {
  assert.deepEqual(parsePublicRecord(stable, "SanskarCodes"), {
    namespace: "SanskarCodes", extension: "lineloom",
    version: "1.3.0", preRelease: false, downloadable: true, checked: true
  });
  assert.ok(Object.isFrozen(parsePublicRecord(stable, "SanskarCodes")));
});

test("unknown channel and downloadable flags never become a stable-release pass", () => {
  const record = parsePublicRecord({
    namespace: "Sanskar", name: "lineloom", version: "1.4.4"
  }, "Sanskar");
  assert.equal(record.preRelease, null);
  assert.equal(record.downloadable, null);
  assert.equal(isVerifiedPublicStable({ ...record, exists: true }, "Sanskar", "1.4.4"), false);
});

test("correct public stable version is only a metadata gate, not proof of ownership", () => {
  const record = { ...parsePublicRecord(stable, "SanskarCodes"), exists: true };
  assert.equal(isVerifiedPublicStable(record, "SanskarCodes", "1.3.0"), true);
  assert.equal(isVerifiedPublicStable(record, "SanskarCodes", "1.4.4"), false);
  assert.equal(isVerifiedPublicStable(record, "Sanskar", "1.3.0"), false);
  assert.equal(isVerifiedPublicStable({ ...record, downloadable: false }, "SanskarCodes", "1.3.0"), false);
  assert.equal(isVerifiedPublicStable({ ...record, preRelease: true }, "SanskarCodes", "1.3.0"), false);
  assert.equal(isVerifiedPublicStable(null, "SanskarCodes", "1.3.0"), false);
});

test("untrusted identity, invalid version and wrong requested versions fail closed", () => {
  assert.throws(() => parsePublicRecord(null, "Sanskar"), /unexpected/);
  assert.throws(() => parsePublicRecord([], "Sanskar"), /unexpected/);
  assert.throws(() => parsePublicRecord({ ...stable, name: "other" }, "SanskarCodes"), /identity/);
  assert.throws(() => parsePublicRecord({ ...stable, namespace: "Sanskar" }, "SanskarCodes"), /identity/);
  assert.throws(() => parsePublicRecord({ ...stable, version: "../1.3.0" }, "SanskarCodes"), /invalid version/);
  assert.throws(() => parsePublicRecord({ ...stable, version: "1.3.0\nSECRET" }, "SanskarCodes"), /invalid version/);
  assert.throws(() => parsePublicRecord(stable, "SanskarCodes", "1.4.4"), /different version/);
});

test("exact-version check only makes a GET request without credentials", async () => {
  const called = [];
  const result = await inspectPublicOpenVsx("SanskarCodes", {
    version: "1.3.0",
    fetchImpl: async (url, options) => {
      called.push({ url, options });
      return mockedResponse(stable);
    }
  });
  assert.equal(result.exists, true);
  assert.equal(result.version, "1.3.0");
  assert.equal(called.length, 1);
  assert.equal(called[0].url, "https://open-vsx.org/api/SanskarCodes/lineloom/1.3.0");
  assert.equal(called[0].options.method, "GET");
  assert.equal(called[0].options.redirect, "error");
  assert.equal(called[0].options.credentials, "omit");
  assert.equal(called[0].options.cache, "no-store");
  assert.equal("authorization" in called[0].options.headers, false);
  assert.ok(called[0].options.signal instanceof AbortSignal);
});

test("404 does not imply the namespace is claimable", async () => {
  const absent = await inspectPublicOpenVsx("Sanskar", {
    fetchImpl: async () => mockedResponse("", { status: 404 })
  });
  assert.deepEqual(absent, { namespace: "Sanskar", extension: "lineloom", exists: false, checked: true });
  assert.match(describePublicOpenVsx(absent), /NOT FOUND/);
  assert.match(describePublicOpenVsx(absent), /not evidence of namespace availability/);
});

test("public stable metadata explicitly warns that ownership and installation remain unchecked", () => {
  const record = { ...parsePublicRecord(stable, "SanskarCodes"), exists: true };
  const message = describePublicOpenVsx(record);
  assert.match(message, /SanskarCodes\.lineloom@1\.3\.0/);
  assert.match(message, /stable; downloadable/);
  assert.match(message, /Ownership and installation NOT verified/);
});

test("preview flag is never silently promoted to stable", async () => {
  const output = await inspectPublicOpenVsx("Sanskar", {
    fetchImpl: async () => mockedResponse({
      namespace: "Sanskar", name: "lineloom", version: "1.4.4",
      preRelease: true, downloadable: true
    })
  });
  assert.equal(isVerifiedPublicStable(output, "Sanskar", "1.4.4"), false);
  assert.match(describePublicOpenVsx(output), /preview/);
});

test("HTTP 401, 403, 429, 500 and 503 fail without processing server responses", async () => {
  for (const status of [401, 403, 429, 500, 503]) {
    const secret = "PRIVATE_SERVER_ERROR_" + status;
    await assert.rejects(() => inspectPublicOpenVsx("Sanskar", {
      fetchImpl: async () => mockedResponse(secret, { status })
    }), error => {
      assert.equal(error.message, "Open VSX public API returned an unexpected status.");
      assert.equal(error.message.includes(secret), false);
      return true;
    });
  }
});

test("malformed untrusted JSON does not get copied into errors", async () => {
  const secret = "SECRET_TOKEN_NEVER_COPY";
  await assert.rejects(() => inspectPublicOpenVsx("Sanskar", {
    fetchImpl: async () => mockedResponse('{"namespace":"' + secret)
  }), error => {
    assert.equal(error.message, "Open VSX returned invalid JSON.");
    assert.equal(error.message.includes(secret), false);
    return true;
  });
});

test("non-object and mismatched JSON are refused", async () => {
  for (const payload of ["[]", "null", '"string"', "42",
    '{"namespace":"OTHER","name":"lineloom","version":"1.3.0"}']) {
    await assert.rejects(() => inspectPublicOpenVsx("Sanskar", {
      fetchImpl: async () => mockedResponse(payload)
    }));
  }
});

test("invalid UTF-8 metadata fails closed without source bytes", async () => {
  const bytes = new Uint8Array([0xff, 0xfe, 0xfd]);
  await assert.rejects(() => inspectPublicOpenVsx("Sanskar", {
    fetchImpl: async () => new Response(bytes, { status: 200 })
  }), /unreadable metadata/);
});

test("oversized JSON is rejected before parsing", async () => {
  const large = "X".repeat(150_000);
  await assert.rejects(() => inspectPublicOpenVsx("Sanskar", {
    fetchImpl: async () => mockedResponse(large)
  }), /exceeds the size limit/);
});

test("invalid deadline config is rejected immediately", async () => {
  for (const ms of [0, -1, 60_001, NaN, Infinity, "1000"]) {
    await assert.rejects(() => inspectPublicOpenVsx("Sanskar", {
      timeoutMs: ms, fetchImpl: async () => mockedResponse(stable)
    }), /Invalid registry deadline/);
  }
});

test("non-cooperative fetch cannot stall the explicit metadata check", async () => {
  const t0 = Date.now();
  await assert.rejects(() => inspectPublicOpenVsx("Sanskar", {
    timeoutMs: 25, fetchImpl: async () => new Promise(() => {})
  }), /timed out/);
  assert.ok(Date.now() - t0 < 5000);
});

test("registry network exceptions are redacted", async () => {
  const privateError = "https://private.example.org/host/path?secret=1";
  await assert.rejects(() => inspectPublicOpenVsx("Sanskar", {
    fetchImpl: async () => { throw new Error(privateError); }
  }), error => {
    assert.equal(error.message, "Could not read public Open VSX metadata.");
    assert.equal(error.message.includes(privateError), false);
    return true;
  });
});

test("the scanner does not accept arbitrary host, namespace or publish operation", async () => {
  const calls = [];
  await inspectPublicOpenVsx("SanskarCodes", {
    fetchImpl: async (...args) => {
      calls.push(args);
      return mockedResponse(stable);
    }
  });
  assert.equal(calls.length, 1);
  assert.ok(calls[0][0].startsWith("https://open-vsx.org/api/"));
  assert.equal(calls[0][1].method, "GET");
});
