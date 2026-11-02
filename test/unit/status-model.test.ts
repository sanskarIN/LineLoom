import { describe, expect, it } from "vitest";
import { statusPresentation } from "../../src/ui/status-model";

describe("native status bar copy", () => {
  it("does not mistake enabled suggestions for a verified local model", () => {
    const ready = statusPresentation("ready");
    expect(ready.text).toBe("$(sparkle) LineLoom");
    expect(ready.tooltip).toContain("not automatically verified");
    expect(ready.tooltip).toContain("Click for Quick Actions");
    expect(ready.tooltip).not.toContain("Ready for local code completion");
  });

  it("describes paused automation while retaining manual completion", () => {
    const manual = statusPresentation("ready", false);
    expect(manual.text).toContain("LineLoom Manual");
    expect(manual.tooltip).toContain("Automatic suggestions paused");
    expect(manual.tooltip).toContain("manual completion remains available");
  });

  it.each(["disabled", "generating", "unavailable", "error"] as const)(
    "provides safe native status text for %s", (state) => {
      const display = statusPresentation(state);
      expect(display.text).toContain("LineLoom");
      expect(display.tooltip).toContain("Click for Quick Actions");
      expect(display.tooltip).not.toContain("http");
      expect(display.tooltip).not.toContain("/private/");
    }
  );

  it("displays a file-local pause without implying the entire extension is disabled", () => {
    const paused = statusPresentation("ready", true, true);
    expect(paused.text).toBe("$(debug-pause) LineLoom File Paused");
    expect(paused.tooltip).toContain("Manual and automatic completions");
    expect(paused.tooltip).toContain("this file only");
    expect(paused.tooltip).not.toContain("file://");
    expect(statusPresentation("ready", false, true).text).toContain("File Paused");
    expect(statusPresentation("generating", true, true).text).toContain("File Paused");
    expect(statusPresentation("disabled", true, true).text).toContain("LineLoom Off");
    expect(statusPresentation("ready", true, false).text).toBe("$(sparkle) LineLoom");
  });

  it("prevents a restricted workspace from being reported as ready or generating", () => {
    for (const state of ["ready", "generating", "unavailable", "error"] as const) {
      for (const automatic of [true, false]) {
        for (const paused of [true, false]) {
          const display = statusPresentation(state, automatic, paused, false);
          expect(display.text).toBe("$(lock) LineLoom Restricted");
          expect(display.tooltip).toContain("manual and automatic completions are blocked");
          expect(display.tooltip).toContain("Workspace is restricted");
          expect(display.accessibilityLabel).toContain("Workspace is restricted");
          expect(display.accessibilityLabel).not.toMatch(/\\$\\(|file:\/\/|https?:\/\//);
        }
      }
    }
    const disabled = statusPresentation("disabled", true, true, false);
    expect(disabled.text).toBe("$(circle-slash) LineLoom Off");
    expect(disabled.accessibilityLabel).toContain("Autocomplete is disabled");
  });

  it("announces an icon-free meaningful status and discoverable Quick Actions for each state", () => {
    for (const state of ["ready", "generating", "disabled", "unavailable", "error"] as const) {
      const display = statusPresentation(state);
      expect(display.accessibilityLabel).toMatch(/^LineLoom: /);
      expect(display.accessibilityLabel).toContain("Open Quick Actions");
      expect(display.accessibilityLabel).not.toContain("$(");
      expect(display.accessibilityLabel).not.toMatch(/https?:\/\/|file:\/\/|private\/|\.ts\b/);
      expect(display.tooltip).toContain("Click for Quick Actions");
    }
    expect(statusPresentation("ready", false).accessibilityLabel)
      .toContain("manual completion remains available");
    expect(statusPresentation("ready", true, true).accessibilityLabel)
      .toContain("this file only");
  });

  it("offers manual remediation without starting a background check", () => {
    expect(statusPresentation("unavailable").tooltip).toContain("manually check");
    expect(statusPresentation("error").tooltip).toContain("diagnostics");
  });
});
