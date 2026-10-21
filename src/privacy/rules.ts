/**
 * Hard exclusions are applied before building a model prompt, even when no
 * ignore file exists. Check every named/canonical workspace-relative path.
 * This is intentionally conservative: users can edit these files in VS Code,
 * but LineLoom must not send their contents to an inference endpoint.
 */
const sensitiveSegments = new Set([
  ".git", "node_modules", ".svn", ".hg", "vendor", "dist", "build", "target",
  ".idea", ".vscode-test", ".ssh", ".aws", ".kube", ".docker", ".gnupg", ".azure", "__pycache__",
  ".venv", "venv", ".direnv", ".terraform", ".pulumi", ".serverless", ".aws-sam"
]);
const sensitiveNames = new Set([
  ".npmrc", ".pypirc", ".netrc", ".git-credentials", "authorized_keys",
  ".envrc", ".pgpass", ".my.cnf", ".s3cfg", "known_hosts"
]);
const riskyExtensions = /\.(?:pem|p12|pfx|p8|key|asc|keystore|jks|sqlite|sqlite3|db|db3|lockb|kdbx|mobileprovision|agekey|tfvars(?:\.json)?|tfstate(?:\.backup)?)$/i;

export function isSensitivePath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  const pieces = normalized.split("/").filter(Boolean);
  if (pieces.some((segment) => sensitiveSegments.has(segment.toLowerCase()))) return true;
  const base = pieces.at(-1)?.toLowerCase() ?? "";
  return /^\.env(?:\.|$)/.test(base) ||
    /^\.dev\.vars(?:\.|$)/.test(base) ||
    /^\.secrets?(?:\.|$)/.test(base) ||
    sensitiveNames.has(base) ||
    /^(?:id_rsa|id_ed25519|id_ecdsa|id_dsa|credentials|secrets?|private_key|service-account)(?:[._-]|$)/.test(base) ||
    riskyExtensions.test(base);
}
