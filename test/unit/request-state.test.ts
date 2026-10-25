import { describe, expect, it } from "vitest";
import { isRequestConfigurationCurrent, isResponseStillEligible } from "../../src/completion/request-state";
import { getLanguage } from "../../src/languages/registry";
import type { LineLoomConfig } from "../../src/settings/config";

const base: LineLoomConfig = {
  enabled: true,
  autoTrigger: true,
  enabledLanguages: ["typescript", "python"],
  minAutoTriggerChars: 2,
  suppressMidTokenAuto: true,
  model: "example",
  languageModels: {},
  endpoint: "http://127.0.0.1:11434",
  allowRemoteEndpoints: false,
  debounceMs: 250,
  timeoutMs: 12000,
  maxContextChars: 8000,
  maxOutputTokens: 128,
  multiLine: true,
  maxSuggestionLines: 8,
  temperature: 0.1,
  contextSize: 4096,
  keepAlive: "5m",
  excludedPaths: [],
  crossFileContext: false,
  performanceDiagnostics: false
};
const language = getLanguage("typescript");
if (!language) throw new Error("Test language unavailable");

describe("post-inference configuration revalidation", () => {
  it("allows unchanged active configuration", () => {
    expect(isRequestConfigurationCurrent(base, { ...base }, language, false)).toBe(true);
  });
  it("rejects disabling the extension or automatic inference while a response is pending", () => {
    expect(isRequestConfigurationCurrent(base, { ...base, enabled: false }, language, true)).toBe(false);
    expect(isRequestConfigurationCurrent(base, { ...base, autoTrigger: false }, language, false)).toBe(false);
    expect(isRequestConfigurationCurrent(base, { ...base, autoTrigger: false }, language, true)).toBe(true);
  });
  it("rejects superseded model, origin, remote policy or language eligibility", () => {
    expect(isRequestConfigurationCurrent(base, { ...base, model: "another" }, language, true)).toBe(false);
    expect(isRequestConfigurationCurrent(base, { ...base, languageModels: { typescript: "new-model" } }, language, true)).toBe(false);
    expect(isRequestConfigurationCurrent(base, { ...base, endpoint: "http://127.0.0.1:21212" }, language, true)).toBe(false);
    expect(isRequestConfigurationCurrent(base, { ...base, allowRemoteEndpoints: true }, language, false)).toBe(false);
    expect(isRequestConfigurationCurrent(base, { ...base, enabledLanguages: ["python"] }, language, false)).toBe(false);
  });
  it("rejects output-affecting model and editor preferences", () => {
    expect(isRequestConfigurationCurrent(base, { ...base, temperature: 0.5 }, language, false)).toBe(false);
    expect(isRequestConfigurationCurrent(base, { ...base, maxOutputTokens: 64 }, language, false)).toBe(false);
    expect(isRequestConfigurationCurrent(base, { ...base, crossFileContext: true }, language, false)).toBe(false);
    expect(isRequestConfigurationCurrent(base, { ...base, multiLine: false }, language, false)).toBe(false);
    expect(isRequestConfigurationCurrent(base, { ...base, suppressMidTokenAuto: false }, language, false)).toBe(false);
  });
  it("rejects privacy exclusions and timeout changes before network dispatch", () => {
    expect(isRequestConfigurationCurrent(base, {
      ...base, excludedPaths: ["**/secrets.ts"]
    }, language, true)).toBe(false);
    expect(isRequestConfigurationCurrent(base, {
      ...base, timeoutMs: 2500
    }, language, false)).toBe(false);
    expect(isRequestConfigurationCurrent(base, {
      ...base, excludedPaths: []
    }, language, true)).toBe(true);
  });

});

describe("postresponse async privacy revalidation", () => {
  function delayedEligibility(): { pending: Promise<boolean>; finish: (allowed: boolean) => void } {
    let finish!: (allowed: boolean) => void;
    const pending = new Promise<boolean>((resolve) => { finish = resolve; });
    return { pending, finish };
  }

  it("allows a stable trusted and approved request", async () => {
    let checks = 0;
    const allowed = await isResponseStillEligible(
      base, language, false, () => ({ ...base }), () => true,
      async (patterns, timing) => {
        checks++;
        expect(patterns).toEqual([]);
        expect(timing).toBe(false);
        return true;
      }
    );
    expect(allowed).toBe(true);
    expect(checks).toBe(1);
  });

  it("does not begin policy I/O for a request already superseded", async () => {
    let fileChecks = 0;
    const ok = await isResponseStillEligible(
      base, language, true,
      () => ({ ...base, excludedPaths: ["private.ts"] }),
      () => true,
      async () => { fileChecks++; return true; }
    );
    expect(ok).toBe(false);
    expect(fileChecks).toBe(0);
  });

  it("rejects a new privacy exclusion introduced while final policy I/O is pending", async () => {
    let latest = { ...base };
    const { pending, finish } = delayedEligibility();
    const result = isResponseStillEligible(
      base, language, true, () => latest, () => true, () => pending
    );
    latest = { ...base, excludedPaths: ["editor-test.ts"] };
    finish(true);
    expect(await result).toBe(false);
  });

  it("rejects model, remote-consent or workspace-trust changes during a pending policy read", async () => {
    for (const update of ["model", "remote", "trust"] as const) {
      let latest: LineLoomConfig = { ...base };
      let valid = true;
      const { pending, finish } = delayedEligibility();
      const result = isResponseStillEligible(
        base, language, true, () => latest, () => valid, () => pending
      );
      if (update === "model") latest = { ...base, model: "new-model" };
      else valid = false; // Model remote approval or trust was revoked.
      finish(true);
      expect(await result, update).toBe(false);
    }
  });

  it("rejects a policy check that itself denies the file", async () => {
    const result = await isResponseStillEligible(
      base, language, true, () => base, () => true, async () => false
    );
    expect(result).toBe(false);
  });

  it("skips filesystem checks if workspace trust is already revoked", async () => {
    let checks = 0;
    const result = await isResponseStillEligible(
      base, language, true, () => base, () => false,
      async () => { checks++; return true; }
    );
    expect(result).toBe(false);
    expect(checks).toBe(0);
  });
});
