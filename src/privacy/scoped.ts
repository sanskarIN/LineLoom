import type { Ignore } from "ignore";

/** A scope represents one workspace directory and the path relative to it. */
export interface IgnoreScope {
  directory: string;
  childPath: string;
}

/**
 * Walk from workspace root to the file's containing directory.
 * The caller must already have verified that the path is within the workspace.
 */
export function ignoreScopes(relativePath: string): IgnoreScope[] {
  const pieces = relativePath.replace(/\\/g, "/").split("/").filter(Boolean);
  if (pieces.length === 0 || pieces.some((part) => part === "." || part === "..")) return [];
  const result: IgnoreScope[] = [];
  for (let index = 0; index < pieces.length; index++) {
    result.push({
      directory: pieces.slice(0, index).join("/"),
      childPath: pieces.slice(index).join("/")
    });
  }
  return result;
}

export interface ScopedIgnoreRule {
  directory: string;
  source: ".gitignore" | ".lineloomignore" | "user";
  matcher: Ignore;
}

/**
 * Ignore sources are independent: a nested negation must not override an
 * exclusion from the root, a different ignore file, or explicit user rules.
 * This is intentionally more conservative than git's normal precedence.
 */
export function ignoredByScopedRules(relativePath: string, rules: readonly ScopedIgnoreRule[]): boolean {
  const scopes = ignoreScopes(relativePath);
  return rules.some(({ directory, matcher }) => {
    const scope = scopes.find((candidate) => candidate.directory === directory);
    return scope ? matcher.ignores(scope.childPath) : false;
  });
}
