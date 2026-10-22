import { describe, expect, it } from "vitest";
import ignore from "ignore";
import { ignoredByScopedRules, ignoreScopes, type ScopedIgnoreRule } from "../../src/privacy/scoped";
import { normalizeExcludedPaths } from "../../src/settings/normalize";

function rule(directory: string, source: ScopedIgnoreRule["source"], patterns: string[]): ScopedIgnoreRule {
  return { directory, source, matcher: ignore().add(patterns) };
}

describe("nested privacy ignore files", () => {
  it("keeps independent root ignore sources from negating each other", () => {
    expect(ignoredByScopedRules("private/token.ts", [
      rule("", ".gitignore", ["private/"]),
      rule("", ".lineloomignore", ["!private/token.ts"])
    ])).toBe(true);
    expect(ignoredByScopedRules("x.secret", [
      rule("", ".gitignore", ["*.secret"]),
      rule("", ".lineloomignore", ["!*.secret"])
    ])).toBe(true);
  });

  it("allows explicit negation within the same root rule group", () => {
    expect(ignoredByScopedRules("main.ts", [
      rule("", ".gitignore", ["*.ts", "!main.ts"])
    ])).toBe(false);
    expect(ignoredByScopedRules("other.ts", [
      rule("", ".gitignore", ["*.ts", "!main.ts"])
    ])).toBe(true);
  });

  it("enforces deny-all for malformed custom exclusion arrays", () => {
    const malformed = normalizeExcludedPaths(["src/protected/**", null]);
    expect(ignoredByScopedRules("src/ordinary.ts", [
      rule("", "user", malformed)
    ])).toBe(true);
    expect(ignoredByScopedRules("src/another.rs", [
      rule("", "user", normalizeExcludedPaths("invalid-patterns"))
    ])).toBe(true);
    expect(ignoredByScopedRules("src/not-private.ts", [
      rule("", "user", normalizeExcludedPaths(["src/private/**", String.fromCharCode(0)]))
    ])).toBe(true);
  });

  it("uses paths relative to each matching directory", () => {
    expect(ignoreScopes("src/components/widget.ts")).toEqual([
      { directory: "", childPath: "src/components/widget.ts" },
      { directory: "src", childPath: "components/widget.ts" },
      { directory: "src/components", childPath: "widget.ts" }
    ]);
    expect(ignoreScopes("../escape.ts")).toEqual([]);
  });
  it("honors nested .gitignore and .lineloomignore", () => {
    expect(ignoredByScopedRules("src/internal/private.ts", [
      rule("src", ".gitignore", ["internal/"])
    ])).toBe(true);
    expect(ignoredByScopedRules("src/feature/secret.ts", [
      rule("src/feature", ".lineloomignore", ["secret.ts"])
    ])).toBe(true);
    expect(ignoredByScopedRules("src/feature/public.ts", [
      rule("src/feature", ".lineloomignore", ["secret.ts"])
    ])).toBe(false);
  });
  it("rejects a nested negation overriding a parent denial", () => {
    expect(ignoredByScopedRules("src/protected/value.ts", [
      rule("", ".gitignore", ["src/protected/"]),
      rule("src", ".lineloomignore", ["!protected/value.ts"])
    ])).toBe(true);
  });
  it("does not apply sibling ignore files", () => {
    expect(ignoredByScopedRules("src/a/file.ts", [
      rule("src/b", ".gitignore", ["*.ts"])
    ])).toBe(false);
  });
  it("supports allowed negations within the same source", () => {
    expect(ignoredByScopedRules("src/public.ts", [
      rule("src", ".gitignore", ["*.ts", "!public.ts"])
    ])).toBe(false);
  });
  it("keeps explicit user-denied files excluded despite nested unignore", () => {
    expect(ignoredByScopedRules("src/key.ts", [
      rule("", "user", ["src/*.ts"]),
      rule("src", ".gitignore", ["!key.ts"])
    ])).toBe(true);
  });
});
