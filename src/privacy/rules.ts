const sensitiveSegments = new Set([".git", "node_modules", ".svn", ".hg", "vendor", "dist", "build", "target", ".idea", ".vscode-test"]);
const riskyExtensions = /\.(?:pem|p12|pfx|p8|key|asc|keystore|jks|sqlite|db|lockb)$/i;
export function isSensitivePath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  const pieces = normalized.split("/").filter(Boolean);
  if (pieces.some((segment) => sensitiveSegments.has(segment.toLowerCase()))) return true;
  const base = pieces.at(-1)?.toLowerCase() ?? "";
  return /^\.env(?:\.|$)/.test(base) ||
    /^(?:id_rsa|id_ed25519|credentials|secrets?|private_key|service-account)(?:[._-]|$)/.test(base) ||
    riskyExtensions.test(base);
}
