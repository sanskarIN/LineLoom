import { describe, expect, it } from "vitest";
import { isSensitivePath } from "../../src/privacy/rules";

describe("sensitive file exclusions", () => {
  it("rejects existing credentials and private keys", () => {
    for (const path of [
      ".env", ".env.local", "src/secrets.json", "nested/id_rsa", "cert.pem",
      "build/out.js", ".git/config", "node_modules/a.js", ".ssh/config",
      ".npmrc", ".aws/credentials"
    ]) expect(isSensitivePath(path), path).toBe(true);
  });

  it("blocks common cloud, database, environment and deployment secrets before inference", () => {
    for (const path of [
      ".envrc", ".dev.vars", ".dev.vars.production", ".secrets", ".secrets.local",
      ".pgpass", ".my.cnf", ".s3cfg", "terraform.tfstate", "terraform.tfstate.backup",
      "production.tfvars", "secrets.auto.tfvars.json", "vault.kdbx",
      "local.sqlite3", "cache.db3", "certificate.mobileprovision", "identity.agekey",
      ".terraform/plugins/cache.json", ".direnv/allow", ".pulumi/credentials.json",
      ".serverless/config.json", ".aws-sam/build/template.json",
      ".venv/lib/site-packages/source.py", "venv/Scripts/activate", "nested/id_ecdsa",
      "nested/id_dsa"
    ]) expect(isSensitivePath(path), path).toBe(true);
  });

  it("blocks files nested under sensitive directories at any depth", () => {
    for (const path of [
      "credentials/example.ts", "src/credentials/config.ts", "config/CREDENTIALS/helper.rs",
      ".env.local/ordinary.ts", "src/.env/notes.py", "src/.dev.vars.preview/index.js",
      "src/.secrets/example.go", "src/secrets/internal.ts", "src/service-account/test.java",
      "src/private_key/helper.kt", "src/.pgpass/utility.c", "src/staging.tfvars/helper.ts",
      "nested/CACHE.SQLITE3/utils.cpp"
    ]) expect(isSensitivePath(path), path).toBe(true);
  });

  it("rejects protected ancestors using Windows separators and casing", () => {
    for (const path of [
      "src\\\\CREDENTIALS\\\\extra.ts", "src\\\\.ENV.production\\\\safe-looking.py",
      "nested\\\\SECRETS\\\\go.rs", "src\\\\.Dev.Vars.local\\\\index.ts"
    ]) expect(isSensitivePath(path), path).toBe(true);
  });

  it("applies exclusions on Windows paths and mixed-case extensions", () => {
    for (const path of [
      "src\\.DEV.VARS", "config\\PROD.TFVARS.JSON",
      "Infra\\TERRAFORM.TFSTATE.BACKUP", "backend\\DB.SQLITE3"
    ]) expect(isSensitivePath(path), path).toBe(true);
  });

  it("permits ordinary source paths and similarly named non-secret files", () => {
    for (const path of [
      "src/index.ts", "src/main.rs", "app/Main.kt", "hello.py",
      "src/environment.ts", "src/key_parser.ts",
      "terraform/main.tf", "docs/terraform-guide.md",
      "src/directory.ts", "src/database.ts"
    ]) expect(isSensitivePath(path), path).toBe(false);
  });
});
