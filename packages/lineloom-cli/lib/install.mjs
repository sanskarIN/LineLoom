import { createHash } from "node:crypto";
import { mkdtemp, open, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const ALLOWED_HOSTS = new Set([
  "github.com", "release-assets.githubusercontent.com", "objects.githubusercontent.com"
]);
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_REDIRECTS = 5;

export function assertTrustedUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.port ||
      !ALLOWED_HOSTS.has(url.hostname)) {
    throw new Error("Refusing an untrusted release redirect");
  }
  return url;
}

// Follow only pinned GitHub asset hosts; never let fetch redirect to an untrusted endpoint.
export async function fetchVerifiedVSIX(spec, targetPath, fetchImpl = fetch) {
  let current = assertTrustedUrl(spec.url);
  let response;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    response = await fetchImpl(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(45_000),
      headers: { accept: "application/octet-stream" }
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    const location = response.headers.get("location");
    if (!location || redirects === MAX_REDIRECTS) throw new Error("Too many or missing release redirects");
    await response.body?.cancel();
    current = assertTrustedUrl(new URL(location, current));
  }
  if (!response || response.status !== 200 || !response.body) {
    await response?.body?.cancel();
    throw new Error("Official release download was unsuccessful");
  }
  const lengthHeader = response.headers.get("content-length");
  if (lengthHeader !== null && (!/^\d+$/.test(lengthHeader) || Number(lengthHeader) > MAX_BYTES)) {
    await response.body.cancel();
    throw new Error("Release package exceeds allowed size");
  }
  const out = await open(targetPath, "wx", 0o600);
  let bytes = 0;
  const hash = createHash("sha256");
  try {
    for await (const chunk of response.body) {
      const part = Buffer.from(chunk);
      bytes += part.length;
      if (bytes > MAX_BYTES) throw new Error("Release package exceeds allowed size");
      hash.update(part);
      await out.writeFile(part);
    }
  } finally {
    await out.close();
  }
  if (bytes < 1024 || hash.digest("hex") !== spec.sha256) {
    throw new Error("Release SHA-256 verification failed (or invalid download)");
  }
  return bytes;
}

export async function installRelease(spec, { editor = "code", fetchImpl = fetch, runner = spawnSync } = {}) {
  // Fixed executable allowlist; arguments are arrays, never interpolated into a shell.
  if (!new Set(["code", "code-insiders", "codium"]).has(editor)) {
    throw new Error("Unsupported editor CLI");
  }
  const dir = await mkdtemp(join(tmpdir(), "lineloom-vsix-"));
  const target = join(dir, "LineLoom-" + spec.version + ".vsix");
  try {
    const bytes = await fetchVerifiedVSIX(spec, target, fetchImpl);
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
