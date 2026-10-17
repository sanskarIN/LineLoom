import { describe, expect, it } from "vitest";
import { validateEndpoint } from "../../src/settings/endpoint";
describe("endpoint policy", () => {
  it("accepts loopback HTTP", () => {
    expect(validateEndpoint("http://127.0.0.1:11434").remote).toBe(false);
    expect(validateEndpoint("http://[::1]:11434").remote).toBe(false);
  });
  it("accepts remote HTTPS but labels it as remote", () => {
    expect(validateEndpoint("https://example.org").remote).toBe(true);
  });
  it("rejects remote HTTP, paths and embedded credentials", () => {
    expect(() => validateEndpoint("http://example.org")).toThrow(/HTTPS/);
    expect(() => validateEndpoint("http://localhost:11434/api")).toThrow(/plain origin/);
    expect(() => validateEndpoint("https://user:secret@example.org")).toThrow(/plain origin/);
    expect(() => validateEndpoint("file:///tmp/socket")).toThrow();
  });
});
