import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/** Static privacy contract complements extension-host behavior tests. */
describe("native sidebar privacy and accessibility contract", () => {
  const provider = readFileSync("src/ui/sidebar.ts", "utf8");
  const extension = readFileSync("src/extension.ts", "utf8");

  it("uses only languageId and URI scheme, never source text or file names", () => {
    expect(provider).toContain("activeTextEditor?.document.languageId");
    expect(provider).toContain("activeTextEditor?.document.uri.scheme");
    expect(provider).not.toMatch(/\.getText\s*\(|\.fileName\b|\.fsPath\b|\.uri\.path\b|\.uri\.toString\s*\(/);
    expect(provider).not.toMatch(/\bfetch\s*\(|\bhttps?\.request\s*\(/);
  });
  it("provides accessibility descriptions for both sections and actions", () => {
    expect(provider).toContain("item.accessibilityInformation");
    expect(provider).toContain('role: data.command ? "button" : undefined');
  });
  it("refreshes after editor switches without starting an inference request", () => {
    expect(extension).toContain('command("lineloom.cancel", () => {');
    expect(extension).toContain("engine?.cancel();");
    expect(extension).toMatch(/onDidChangeActiveTextEditor\(\(editor\) => \{/);
    expect(extension).toMatch(/engine\?\.cancelIfEditorChanged\(editor\);\s*sidebar\.refresh\(\);/);
  });
});
