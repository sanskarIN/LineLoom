import { describe, expect, it } from "vitest";
import { isSensitivePath } from "../../src/privacy/rules";
describe("sensitive file exclusions", () => {
  it("rejects credentials and private keys", () => {
    for (const path of [".env", ".env.local", "src/secrets.json", "nested/id_rsa", "cert.pem", "build/out.js", ".git/config", "node_modules/a.js"]) {
      expect(isSensitivePath(path), path).toBe(true);
    }
  });
  it("permits ordinary source paths", () => {
    for (const path of ["src/index.ts", "src/main.rs", "app/Main.kt", "hello.py"]) {
      expect(isSensitivePath(path), path).toBe(false);
    }
  });
});
