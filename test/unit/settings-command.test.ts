import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("Settings command publisher route", () => {
  const source = readFileSync("src/extension.ts", "utf8");

  it("filters settings by the actual installed extension ID for both publisher identities", () => {
    expect(source).toContain("function settingsFilter(context: vscode.ExtensionContext): string");
    expect(source).toContain('return "@ext:" + context.extension.id;');
    expect(source).not.toContain("@ext:sanskarIN.lineloom");
    expect(source).not.toContain('const SETTINGS_FILTER = "@ext:SanskarCodes.lineloom"');
    expect(source.split('"workbench.action.openSettings", settingsFilter(context)').length - 1).toBe(2);
  });
});
