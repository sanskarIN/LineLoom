import { describe, expect, it } from "vitest";
import ignore from "ignore";
import { decodeIgnorePolicy } from "../../src/privacy/policy-text";

describe("fail-closed ignore policy text decoding", () => {
  it("preserves ordinary UTF-8 rules, CRLF and non-ASCII filenames", () => {
    const text = "# internal\r\nprivate/\r\n日本語.ts\r\n";
    const decoded = decodeIgnorePolicy(Buffer.from(text, "utf8"));
    expect(decoded).toBe(text);
    const matcher = ignore().add(decoded);
    expect(matcher.ignores("private/demo.ts")).toBe(true);
    expect(matcher.ignores("日本語.ts")).toBe(true);
    expect(matcher.ignores("public.ts")).toBe(false);
  });

  it("accepts an optional UTF-8 BOM without corrupting the first rule", () => {
    const data = Uint8Array.from([0xef, 0xbb, 0xbf, ...Buffer.from("blocked.ts\n")]);
    expect(decodeIgnorePolicy(data)).toBe("blocked.ts\n");
    expect(ignore().add(decodeIgnorePolicy(data)).ignores("blocked.ts")).toBe(true);
  });

  it("rejects invalid UTF-8 instead of silently replacing policy bytes", () => {
    for (const invalid of [
      [0xff], [0xc0, 0xaf], [0xe2, 0x82], [0xed, 0xa0, 0x80],
      [...Buffer.from("private/\n"), 0xff]
    ]) {
      expect(() => decodeIgnorePolicy(Uint8Array.from(invalid))).toThrow();
    }
  });

  it("rejects NUL-containing binary rules without leaking their content", () => {
    expect(() => decodeIgnorePolicy(Buffer.from("private/\0public.ts\n")))
      .toThrow("Invalid binary ignore policy.");
  });

  it("accepts empty policies without rejecting ordinary workspaces", () => {
    expect(decodeIgnorePolicy(new Uint8Array())).toBe("");
  });
});
