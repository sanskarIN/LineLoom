import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("package.json", "utf8")) as {
  activationEvents: string[];
  contributes: {
    commands: Array<{ command: string; title: string }>;
    viewsContainers: { activitybar: Array<{ id: string; title: string; icon: string }> };
    views: Record<string, Array<{ id: string; name: string }>>;
    menus: Record<string, Array<{ command: string; when: string }>>;
  };
};

describe("Activity Bar control center registration", () => {
  it("contributes a real native Tree View and a theme-safe icon", () => {
    const container = manifest.contributes.viewsContainers.activitybar.find(item => item.id === "lineloom");
    expect(container?.title).toBe("LineLoom");
    expect(container?.icon).toBe("assets/icons/sidebar.svg");
    const svg = readFileSync(container!.icon, "utf8");
    expect(svg).toContain('stroke="currentColor"');
    expect(manifest.contributes.views.lineloom).toEqual([{ id: "lineloom.dashboard", name: "Control Center" }]);
    expect(manifest.activationEvents).toContain("onView:lineloom.dashboard");
  });

  it("exposes an explicit refresh action in the view title menu", () => {
    expect(manifest.contributes.commands.some(item => item.command === "lineloom.refreshSidebar")).toBe(true);
    expect(manifest.contributes.commands.some(item => item.command === "lineloom.resetSessionActivity")).toBe(true);
    expect(manifest.contributes.commands).toContainEqual(expect.objectContaining({
      command: "lineloom.cancel", title: "Stop Current Generation"
    }));
    expect(manifest.contributes.menus["view/title"]).toContainEqual({
      command: "lineloom.refreshSidebar",
      when: "view == lineloom.dashboard",
      group: "navigation"
    });
  });
});
