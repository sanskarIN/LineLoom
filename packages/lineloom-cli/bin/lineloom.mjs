#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { getRelease } from "../lib/releases.mjs";
import { installRelease } from "../lib/install.mjs";

export function parseArgs(args) {
  if (args.length === 0 || args[0] === "help" || args[0] === "--help") return { command: "help" };
  if (args[0] === "version" && args.length === 1) return { command: "version" };
  if (args[0] !== "install") throw new Error("Unknown command. Run lineloom --help");
  let channel = "stable", editor = "code", dryRun = false;
  const seen = new Set();
  for (let i = 1; i < args.length; i++) {
    const key = args[i];
    if (seen.has(key)) throw new Error("Duplicate option: " + key);
    seen.add(key);
    if (key === "--preview") channel = "preview";
    else if (key === "--dry-run") dryRun = true;
    else if (key === "--editor") {
      editor = args[++i];
      if (!editor || !["code", "code-insiders", "codium"].includes(editor)) {
        throw new Error("Choose code, code-insiders or codium");
      }
    } else throw new Error("Unknown option: " + key);
  }
  return { command: "install", channel, editor, dryRun };
}

const help = "LineLoom VS Code installer (only SHA-256-pinned official releases)\n\n" +
  "  lineloom install                     Install stable v1.2.0\n" +
  "  lineloom install --preview           Install pre-release v1.2.4\n" +
  "  lineloom install --editor codium     Use VSCodium CLI (or code-insiders)\n" +
  "  lineloom install --dry-run           Print details without installing\n" +
  "  lineloom version                     Display pinned versions\n" +
  "  lineloom --help                       Show help\n\n" +
  "Requires Node 22+ and a supported editor CLI on PATH. No npm install hooks.\n";

export async function run(args = process.argv.slice(2), io = console, deps = {}) {
  try {
    const command = parseArgs(args);
    if (command.command === "help") { io.log(help); return 0; }
    if (command.command === "version") {
      for (const channel of ["stable", "preview"]) {
        const spec = getRelease(channel);
        io.log(channel + ": LineLoom v" + spec.version + " (" + spec.sha256 + ")");
      }
      return 0;
    }
    const spec = getRelease(command.channel);
    io.log("Official " + spec.channel + " release: v" + spec.version);
    io.log("Source: " + spec.url);
    io.log("Expected SHA-256: " + spec.sha256);
    if (command.dryRun) {
      io.log("Dry run: no download or installation; editor=" + command.editor);
      return 0;
    }
    const bytes = await installRelease(spec, { editor: command.editor, ...deps });
    io.log("Verified " + bytes + " bytes; installed LineLoom v" + spec.version);
    return 0;
  } catch (error) {
    io.error("LineLoom installer: " + error.message);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await run();
}
