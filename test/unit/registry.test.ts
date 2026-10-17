import { describe, expect, it } from "vitest";
import { LANGUAGES, getLanguage } from "../../src/languages/registry";
describe("language registry", () => {
  it("supports the five promised languages", () => {
    expect(LANGUAGES.map((x) => x.id)).toEqual(["python","javascript","typescript","rust","kotlin"]);
  });
  it("rejects unsupported language IDs", () => {
    expect(getLanguage("go")).toBeUndefined();
    expect(getLanguage("rust")?.extensions).toContain(".rs");
  });
});
