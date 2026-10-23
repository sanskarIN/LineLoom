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
  // Policy/configuration files may reveal sensitive path layouts and should
  // never become an inference prompt, even if their own rules would allow it.
  ".gitignore", ".lineloomignore", ".dockerignore", ".npmignore",
  ".envrc", ".pgpass", ".my.cnf", ".s3cfg", "known_hosts"
]);
const riskyExtensions = /\.(?:pem|p12|pfx|p8|key|asc|keystore|jks|sqlite|sqlite3|db|db3|lockb|kdbx|mobileprovision|agekey|tfvars(?:\.json)?|tfstate(?:\.backup)?)$/i;

/**
 * Every ancestor is part of the privacy boundary, not just the basename.
 * For example, src/credentials/example.ts must be excluded just as
 * src/credentials.ts is. Do not resolve globs or inspect file contents here:
 * canonical/named paths and user ignores are evaluated by exclusions.ts.
 */
export function isSensitivePath(relativePath: string): boolean {
  const pieces = relativePath.replace(/\\/g, "/").split("/").filter(Boolean);
  return pieces.some((part) => {
    const name = part.toLowerCase();
    return sensitiveSegments.has(name) ||
      /^\.env(?:\.|$)/.test(name) ||
      /^\.dev\.vars(?:\.|$)/.test(name) ||
      /^\.secrets?(?:\.|$)/.test(name) ||
      sensitiveNames.has(name) ||
      /^(?:id_rsa|id_ed25519|id_ecdsa|id_dsa|credentials|secrets?|private_key|service-account)(?:[._-]|$)/.test(name) ||
      riskyExtensions.test(name);
  });
}
