import { describe, expect, it } from "vitest";
import ignore from "ignore";
import { ignoredByAny } from "../../src/privacy/matching";
describe("independent ignore groups", () => {
  it("protects gitignored files from overrides in lineloomignore", () => {
    const gitRules = ignore().add(["private/", "*.secret"]);
    const lineLoomRules = ignore().add(["!private/token.ts", "!*.secret"]);
    expect(ignoredByAny("private/token.ts", [gitRules, lineLoomRules])).toBe(true);
    expect(ignoredByAny("x.secret", [gitRules, lineLoomRules])).toBe(true);
  });
  it("allows an explicitly unignored file within the same group", () => {
    const ownRules = ignore().add(["*.ts", "!main.ts"]);
    expect(ignoredByAny("main.ts", [ownRules])).toBe(false);
    expect(ignoredByAny("other.ts", [ownRules])).toBe(true);
  });
});
