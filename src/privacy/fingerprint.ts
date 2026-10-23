import { createHash } from "node:crypto";

/** Only a digest is retained with each cached policy snapshot; no rule bytes are logged. */
export function policyContentDigest(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
