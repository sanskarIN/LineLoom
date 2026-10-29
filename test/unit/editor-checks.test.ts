import { describe, expect, it } from "vitest";
import { invalidateEditorChecks } from "../../src/ui/editor-checks";
import { ModelReadinessSession } from "../../src/ui/model-readiness";
import { FilePrivacySession } from "../../src/ui/file-privacy-session";

describe("active editor switch/close invalidates manual status", () => {
  it("clears completed statuses to avoid showing the prior editor's model or file approval", () => {
    const model = new ModelReadinessSession();
    const privacy = new FilePrivacySession();
    expect(model.finish(model.begin(), "missing")).toBe(true);
    expect(privacy.finish(privacy.begin(), "allowed")).toBe(true);
    invalidateEditorChecks(model, privacy);
    expect(model.state).toBe("not-checked");
    expect(privacy.state).toBe("not-checked");
  });
  it("invalidates pending async check tokens even if their responses arrive late", () => {
    const model = new ModelReadinessSession();
    const privacy = new FilePrivacySession();
    const previousModel = model.begin();
    const previousPrivacy = privacy.begin();
    invalidateEditorChecks(model, privacy);
    expect(model.finish(previousModel, "available")).toBe(false);
    expect(privacy.finish(previousPrivacy, "allowed")).toBe(false);
    const nextModel = model.begin();
    const nextPrivacy = privacy.begin();
    expect(model.finish(nextModel, "available")).toBe(true);
    expect(privacy.finish(nextPrivacy, "blocked")).toBe(true);
  });
});
