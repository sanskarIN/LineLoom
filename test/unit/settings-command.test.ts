import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("Settings command publisher route", () => {
  const source = readFileSync("src/extension.ts", "utf8");

  it("filters settings by the installed Marketplace extension identifier", () => {
    expect(source).toContain('const SETTINGS_FILTER = "@ext:SanskarCodes.lineloom";');
    expect(source).not.toContain("@ext:sanskarIN.lineloom");
    expect(source.split('"workbench.action.openSettings", SETTINGS_FILTER').length - 1).toBe(2);
  });
});
