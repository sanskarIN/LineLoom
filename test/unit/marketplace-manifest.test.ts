import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("Marketplace release manifest", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
    name: string;
    displayName: string;
    publisher: string;
    version: string;
    private: boolean;
    main: string;
    scripts: Record<string, string>;
    repository: { url: string };
    engines: { vscode: string };
  };
  const lock = JSON.parse(readFileSync("package-lock.json", "utf8")) as {
    version: string;
    packages: Record<string, { name: string; version: string }>;
  };

  it("binds the package to the SanskarCodes publisher rather than the GitHub username", () => {
    expect(pkg.name).toBe("lineloom");
    expect(pkg.displayName).toBe("LineLoom");
    expect(pkg.publisher).toBe("SanskarCodes");
    expect(pkg.private).toBe(false);
    expect(pkg.main).toBe("./dist/extension.js");
    expect(pkg.repository.url).toBe("https://github.com/sanskarIN/LineLoom.git");
    expect(pkg.engines.vscode).toBe("^1.96.0");
  });

  it("keeps lockfile and extension version synchronized", () => {
    expect(pkg.version).toBe("1.2.5");
    expect(pkg.version.split(".")).toHaveLength(3);
    expect(lock.version).toBe(pkg.version);
    expect(lock.packages[""].name).toBe(pkg.name);
    expect(lock.packages[""].version).toBe(pkg.version);
  });

  it("advertises user-initiated privacy timing reset as a native command", () => {
    const manifest = pkg as typeof pkg & {
      contributes: { commands: Array<{ command: string; title: string; category: string }> };
    };
    const command = manifest.contributes.commands.find((item) => item.command === "lineloom.resetPrivacyTimings");
    expect(command).toMatchObject({
      category: "LineLoom",
      title: "Reset Privacy Timing Statistics"
    });
  });

  it("contributes a separate, user-triggered file privacy check", () => {
    const manifest = pkg as typeof pkg & {
      contributes: { commands: Array<{ command: string; title: string; category: string }> };
    };
    expect(manifest.contributes.commands.find(item =>
      item.command === "lineloom.checkActiveFilePrivacy"
    )).toMatchObject({ title: "Check Active File Privacy", category: "LineLoom" });
  });

  it("packages stable by default and keeps preview packaging explicit", () => {
    expect(pkg.scripts.package).toContain("--no-dependencies");
    expect(pkg.scripts.package).not.toContain("--pre-release");
    expect(pkg.scripts["package:preview"]).toContain("vsce package --pre-release");
    expect(pkg.scripts["package:stable"]).toBe("npm run package");
  });
});
