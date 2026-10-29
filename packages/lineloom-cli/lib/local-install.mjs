import { createHash, timingSafeEqual } from "node:crypto";
import { spawnSync } from "node:child_process";
import { constants } from "node:fs";
import { lstat, mkdtemp, open, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MIN_BYTES = 1024;
const MAX_BYTES = 10 * 1024 * 1024;
const EDITORS = new Set(["code", "code-insiders", "codium"]);

// Hash the same private staged bytes that will be passed to the editor.
// This operation never downloads a file or contacts an inference provider.
export async function installLocalRelease(spec, sourcePath, { editor = "code", runner = spawnSync } = {}) {
  if (!EDITORS.has(editor)) throw new Error("Unsupported editor CLI");
  if (typeof sourcePath !== "string" || !sourcePath.toLowerCase().endsWith(".vsix")) {
    throw new Error("Choose a local .vsix file");
  }
  if (typeof spec?.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(spec.sha256)) {
    throw new Error("Invalid pinned release SHA-256");
  }
  // The version appears in a private temporary filename. This helper also
  // accepts explicit specifications in tests, so reject path separators and
  // malformed version identifiers rather than relying solely on getRelease().
  if (typeof spec.version !== "string" ||
      !/^[0-9]+[.][0-9]+[.][0-9]+(?:-[A-Za-z0-9][A-Za-z0-9.-]*)?$/.test(spec.version)) {
    throw new Error("Invalid pinned release version");
  }
  const entry = await lstat(sourcePath);
  if (!entry.isFile()) throw new Error("VSIX must be a regular file, not a link");
  if (entry.size < MIN_BYTES || entry.size > MAX_BYTES) {
    throw new Error("VSIX is outside allowed size");
  }
  const dir = await mkdtemp(join(tmpdir(), "lineloom-local-vsix-"));
  const target = join(dir, "LineLoom-" + spec.version + ".vsix");
  try {
    const source = await open(sourcePath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    let bytes = 0;
    const hash = createHash("sha256");
    try {
      const stat = await source.stat();
      if (!stat.isFile() || stat.size < MIN_BYTES || stat.size > MAX_BYTES ||
          stat.dev !== entry.dev || stat.ino !== entry.ino) {
        throw new Error("Local VSIX is invalid or changed before reading");
      }
      const out = await open(target, "wx", 0o600);
      try {
        for await (const chunk of source.createReadStream({ autoClose: false })) {
          bytes += chunk.length;
          if (bytes > MAX_BYTES) throw new Error("VSIX exceeds allowed size");
          hash.update(chunk);
          await out.writeFile(chunk);
        }
        if (bytes !== stat.size || bytes < MIN_BYTES ||
            !timingSafeEqual(hash.digest(), Buffer.from(spec.sha256, "hex"))) {
          throw new Error("VSIX SHA-256 verification failed (or file changed during reading)");
        }
      } finally {
        await out.close();
      }
    } finally {
      await source.close();
    }
    const outcome = runner(editor, ["--install-extension", target], {
      shell: false, stdio: "inherit"
    });
    if (outcome.error) throw new Error("Editor CLI failed: " + (outcome.error.code || "unavailable"));
    if (outcome.status !== 0) throw new Error("Editor CLI exited with code " + (outcome.status ?? "unknown"));
    return bytes;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
