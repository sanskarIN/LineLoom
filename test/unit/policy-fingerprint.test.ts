import { describe, expect, it } from "vitest";
import { policyContentDigest } from "../../src/privacy/fingerprint";

describe("ignore policy content fingerprints", () => {
  it("distinguishes same-size policy rewrites that metadata alone cannot detect", () => {
    const oldPolicy = Buffer.from("blocked.ts\n", "utf8");
    const rewrittenPolicy = Buffer.from("allowed.ts\n", "utf8");
    expect(oldPolicy.byteLength).toBe(rewrittenPolicy.byteLength);
    expect(policyContentDigest(oldPolicy)).not.toBe(policyContentDigest(rewrittenPolicy));
  });

  it("matches identical bytes regardless of buffer instance", () => {
    const policy = Buffer.from("src/private/**\n", "utf8");
    expect(policyContentDigest(policy)).toBe(policyContentDigest(Buffer.from(policy)));
    expect(policyContentDigest(policy)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("fingerprints raw bytes without normalizing malformed UTF-8", () => {
    expect(policyContentDigest(Uint8Array.from([0xff])))
      .not.toBe(policyContentDigest(Uint8Array.from([0xfe])));
  });
});
