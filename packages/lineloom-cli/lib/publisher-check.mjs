import { spawnSync } from "node:child_process";

// Publisher IDs are separate VS Code extensions but share LineLoom command IDs.
// Before explicitly installing the new publisher, confirm the old extension is
// not installed in the target editor. Never uninstall or modify it automatically.
const EDITORS = new Set(["code", "code-insiders", "codium"]);
const LEGACY_ID = "sanskarcodes.lineloom";

export function assertPublisherMigrationReady(spec, editor = "code", runner = spawnSync) {
  if (spec?.publisher !== "Sanskar") return;
  if (!EDITORS.has(editor)) throw new Error("Unsupported editor CLI");

  // Only query extension IDs; do not inspect project files, settings or private state.
  // A failed/incomplete listing cannot safely establish absence of the old ID.
  const outcome = runner(editor, ["--list-extensions"], {
    shell: false,
    encoding: "utf8",
    timeout: 20_000,
    maxBuffer: 1024 * 1024,
    windowsHide: true
  });
  if (outcome?.error || outcome?.status !== 0 || typeof outcome?.stdout !== "string") {
    throw new Error(
      "Cannot check installed extensions in the chosen editor; " +
      "confirm its CLI works before migrating to Sanskar.lineloom"
    );
  }

  const installed = outcome.stdout
    .split(/\r?\n/u)
    .map(line => line.trim().toLowerCase());
  if (installed.includes(LEGACY_ID)) {
    throw new Error(
      "SanskarCodes.lineloom is still installed in this editor; " +
      "back up your settings, uninstall it and reload VS Code before installing Sanskar.lineloom"
    );
  }
}
