import { describe, expect, it } from "vitest";
import { summarizeActiveEditor, type EditorContextInput } from "../../src/ui/editor-context";

const initial: EditorContextInput = {
  languageId: "rust", scheme: "file", enabled: true, workspaceTrusted: true,
  enabledLanguages: ["python", "typescript", "rust"],
  defaultModel: "global-model", languageModels: { rust: "rust-model", typescript: "ts-model" },
  endpointState: "loopback"
};

describe("privacy-preserving active editor summary", () => {
  it("resolves the active language override and JSX/TSX aliases without files", () => {
    expect(summarizeActiveEditor(initial)).toEqual({
      language: "Rust", model: "rust-model", modelSource: "Language override",
      eligibility: "Allowed by settings; file rules checked on request"
    });
    expect(summarizeActiveEditor({ ...initial, languageId: "typescriptreact" })).toMatchObject({
      language: "TypeScript", model: "ts-model", modelSource: "Language override"
    });
    expect(summarizeActiveEditor({ ...initial, languageId: "python" })).toMatchObject({
      language: "Python", model: "global-model", modelSource: "Default model"
    });
  });
  it("does not represent missing or unsupported editors as eligible", () => {
    expect(summarizeActiveEditor({ ...initial, languageId: undefined })).toEqual({
      language: "No active editor", model: "Not applicable", modelSource: "",
      eligibility: "Open a supported code file"
    });
    expect(summarizeActiveEditor({ ...initial, languageId: "plaintext" }).eligibility)
      .toBe("No inline provider for this language");
  });
  it.each([
    [{ enabled: false }, "Autocomplete disabled"],
    [{ workspaceTrusted: false }, "Workspace restricted"],
    [{ enabledLanguages: ["python"] as EditorContextInput["enabledLanguages"] }, "Language disabled in settings"],
    [{ scheme: "untitled" }, "Only local file editors support completion"],
    [{ scheme: "git" }, "Only local file editors support completion"],
    [{ languageModels: {}, defaultModel: "" }, "No model configured"],
    [{ endpointState: "invalid" as const }, "Invalid inference endpoint"],
    [{ endpointState: "remote-blocked" as const }, "Remote endpoint disabled"],
    [{ endpointState: "remote-needs-approval" as const }, "Remote endpoint approval required"]
  ])("shows a precise settings-level block reason for %o", (override, expected) => {
    expect(summarizeActiveEditor({ ...initial, ...override }).eligibility).toBe(expected);
  });
  it("does not claim ignored/secret files are eligible without privacy inspection", () => {
    expect(summarizeActiveEditor(initial).eligibility).toMatch(/file rules checked on request/);
    const snapshot = JSON.stringify(summarizeActiveEditor(initial));
    expect(snapshot).not.toMatch(/\.env|\/home\/|https?:\/\//);
  });
});
