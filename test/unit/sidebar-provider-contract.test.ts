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
  it("provides icon-free screen-reader status and refreshes after trust grant", () => {
    const status = readFileSync("src/ui/status.ts", "utf8");
    expect(status).toContain("this.item.accessibilityInformation");
    expect(status).toContain("display.accessibilityLabel");
    expect(status).toContain("vscode.workspace.isTrusted");
    expect(status).not.toMatch(/\.getText\s*\(|\bfetch\s*\(/);
    const grantStart = extension.indexOf("vscode.workspace.onDidGrantWorkspaceTrust(");
    expect(grantStart).toBeGreaterThan(-1);
    const grantHandler = extension.slice(grantStart, extension.indexOf("  // Ignore-file edits", grantStart));
    expect(grantHandler).toContain("status.set(currentState, readConfig().autoTrigger)");
    expect(grantHandler).toContain("sidebar.refresh()");
    expect(grantHandler).not.toMatch(/generateCompletion\s*\(|listModels\s*\(|\bfetch\s*\(/);
  });
  it("refreshes after editor switches without starting an inference request", () => {
    expect(extension).toContain('command("lineloom.cancel", () => {');
    expect(extension).toContain("engine?.cancel();");
    expect(extension).toMatch(/onDidChangeActiveTextEditor\(\(editor\) => \{/);
    expect(extension).toMatch(/engine\?\.cancelIfEditorChanged\(editor\);\s*\/\/[^\n]*\n\s*status\.set\(currentState, readConfig\(\)\.autoTrigger\);\s*sidebar\.refresh\(\);/);
  });
});
