import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("LineLoom root license metadata", () => {
  it("ships MIT terms and consistent npm license fields", () => {
    const license = readFileSync("LICENSE", "utf8");
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { license: string };
    const lock = JSON.parse(readFileSync("package-lock.json", "utf8")) as {
      packages: Record<string, { license: string }>
    };
    expect(license.startsWith("MIT License\n")).toBe(true);
    expect(license).toContain("Copyright (c) 2026 Sanskar");
    expect(license).toContain('THE SOFTWARE IS PROVIDED "AS IS"');
    expect(pkg.license).toBe("MIT");
    expect(lock.packages[""].license).toBe("MIT");
  });
});
