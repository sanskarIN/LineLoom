import * as vscode from "vscode";
import { mayComplete } from "./exclusions";

/** One-time, local-only check. Never reads source text or contacts Ollama. */
export type FilePrivacyResult = "allowed" | "blocked" | "stale" | "no-editor";

export async function inspectFilePrivacy(
  document: vscode.TextDocument | undefined,
  patterns: readonly string[],
  isCurrent: () => boolean
): Promise<FilePrivacyResult> {
  if (!document) return "no-editor";
  // These are the same initial workspace and scheme restrictions used by the
  // real completion gate. Do not imply settings/model/connection readiness.
  if (document.isClosed || document.uri.scheme !== "file" || !vscode.workspace.isTrusted)
    return "blocked";
  const permitted = await mayComplete(document, patterns, false);
  // File, active editor, trust or exclusion settings may have changed while
  // asynchronous filesystem checks were running: never show a stale approval.
  if (!isCurrent()) return "stale";
  return permitted ? "allowed" : "blocked";
}
