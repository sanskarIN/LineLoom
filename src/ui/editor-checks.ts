import type { ModelReadinessSession } from "./model-readiness";
import type { FilePrivacySession } from "./file-privacy-session";

/**
 * Invalidate all editor-scoped, user-requested status snapshots together.
 * Switching or closing editors invalidates the meaning of both statuses;
 * pending old asynchronous checks cannot restore them after this call.
 */
export function invalidateEditorChecks(
  activeModel: ModelReadinessSession,
  filePrivacy: FilePrivacySession
): void {
  activeModel.clear();
  filePrivacy.clear();
}
