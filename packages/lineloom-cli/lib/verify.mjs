import { createHash, timingSafeEqual } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";

const MIN_BYTES = 1024;
const MAX_BYTES = 10 * 1024 * 1024;

// Verification never contacts a server or starts the user's editor.
export async function verifyLocalVSIX(path, expectedSha256) {
  if (typeof path !== "string" || !path.toLowerCase().endsWith(".vsix")) {
    throw new Error("Choose a local .vsix file");
  }
  if (typeof expectedSha256 !== "string" || !/^[a-f0-9]{64}$/.test(expectedSha256)) {
    throw new Error("Invalid pinned SHA-256");
  }
  const entry = await lstat(path);
  if (!entry.isFile()) throw new Error("VSIX must be a regular file, not a link");
  if (entry.size < MIN_BYTES || entry.size > MAX_BYTES) {
    throw new Error("VSIX is outside allowed size");
  }
  const file = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size < MIN_BYTES || stat.size > MAX_BYTES) {
      throw new Error("VSIX is outside allowed size");
    }
    const hasher = createHash("sha256");
    let bytes = 0;
    for await (const chunk of file.createReadStream({ autoClose: false })) {
      bytes += chunk.length;
      if (bytes > MAX_BYTES) throw new Error("VSIX exceeds allowed size");
      hasher.update(chunk);
    }
    if (bytes < MIN_BYTES || bytes !== stat.size ||
        !timingSafeEqual(hasher.digest(), Buffer.from(expectedSha256, "hex"))) {
      throw new Error("VSIX SHA-256 verification failed (or file changed during reading)");
    }
    return bytes;
  } finally {
    await file.close();
  }
}
