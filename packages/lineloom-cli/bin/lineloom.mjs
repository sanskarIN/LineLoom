#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { realpathSync } from "node:fs";
import { getRelease } from "../lib/releases.mjs";
import { installRelease } from "../lib/install.mjs";
import { installLocalRelease } from "../lib/local-install.mjs";
import { verifyLocalVSIX } from "../lib/verify.mjs";

export function parseArgs(args) {
  if (args.length === 0 || args[0] === "help" || args[0] === "--help") return { command: "help" };
  if (args[0] === "version" && args.length === 1) return { command: "version" };
  if (args[0] === "verify") {
    let path, channel = "stable", publisher;
    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      if (arg === "--preview") {
        if (channel === "preview") throw new Error("Duplicate --preview option");
        channel = "preview";
      } else if (arg === "--publisher") {
        if (publisher) throw new Error("Duplicate --publisher option");
        publisher = args[++i];
        if (!["SanskarCodes", "Sanskar"].includes(publisher)) {
          throw new Error("Choose publisher SanskarCodes or Sanskar");
        }
      } else if (arg.startsWith("--") || path !== undefined) {
        throw new Error("Unexpected verify argument: " + arg);
      } else {
        path = arg;
      }
    }
    if (!path) throw new Error("Specify a local .vsix file to verify");
    if (publisher === "Sanskar" && channel !== "preview") {
      throw new Error("Sanskar publisher requires --preview");
    }
    return { command: "verify", channel, path, ...(publisher ? { publisher } : {}) };
  }
  if (args[0] !== "install") throw new Error("Unknown command. Run lineloom --help");
  let channel = "stable", editor = "code", dryRun = false, file, publisher;
  const seen = new Set();
  for (let i = 1; i < args.length; i++) {
    const key = args[i];
    if (seen.has(key)) throw new Error("Duplicate option: " + key);
    seen.add(key);
    if (key === "--preview") channel = "preview";
    else if (key === "--dry-run") dryRun = true;
    else if (key === "--file") {
      file = args[++i];
      if (!file || file.startsWith("--")) throw new Error("Specify a local .vsix file after --file");
    } else if (key === "--publisher") {
      publisher = args[++i];
      if (!["SanskarCodes", "Sanskar"].includes(publisher)) {
        throw new Error("Choose publisher SanskarCodes or Sanskar");
      }
    } else if (key === "--editor") {
      editor = args[++i];
      if (!editor || !["code", "code-insiders", "codium"].includes(editor)) {
        throw new Error("Choose code, code-insiders or codium");
      }
    } else throw new Error("Unknown option: " + key);
  }
  if (file && dryRun) throw new Error("--file and --dry-run cannot be combined");
  if (publisher === "Sanskar" && channel !== "preview") {
    throw new Error("Sanskar publisher requires --preview");
  }
  return { command: "install", channel, editor, dryRun,
    ...(publisher ? { publisher } : {}), ...(file ? { file } : {}) };
}

const help = "LineLoom VS Code installer (only SHA-256-pinned official releases)\n\n" +
  "  lineloom install                     Install stable v1.3.0\n" +
  "  lineloom install --preview           Install pre-release v1.4.3 (SanskarCodes)\n" +
  "  lineloom install --preview --publisher Sanskar   Opt into separate Sanskar.lineloom preview\n" +
  "  lineloom install --editor codium     Use VSCodium CLI (or code-insiders)\n" +
  "  lineloom install --dry-run           Print details without installing\n" +
  "  lineloom install --file ./LineLoom-1.3.0.vsix           Verify and install offline\n" +
  "  lineloom install --file ./LineLoom-1.4.3-SanskarCodes.vsix --preview Offline preview\n" +
  "  lineloom version                     Display pinned versions\n" +
  "  lineloom verify ./LineLoom-1.3.0.vsix           Verify stable VSIX offline\n" +
  "  lineloom verify ./LineLoom-1.4.3-SanskarCodes.vsix --preview Verify preview VSIX offline\n" +
  "  lineloom verify ./LineLoom-1.4.3-Sanskar.vsix --preview --publisher Sanskar\n" +
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
    const spec = getRelease(command.channel, command.publisher);
    if (command.command === "verify") {
      const bytes = await verifyLocalVSIX(command.path, spec.sha256);
      io.log("Verified " + bytes + " bytes against pinned " + spec.channel +
        " LineLoom v" + spec.version + " (" + spec.publisher +
        ".lineloom) SHA-256; no installation performed.");
      return 0;
    }
    io.log("Official " + spec.channel + " release: v" + spec.version);
    io.log("Extension publisher: " + spec.publisher + " (ID " + spec.publisher + ".lineloom)");
    if (spec.publisher === "Sanskar") {
      io.log("Migration preview: uninstall/disable SanskarCodes.lineloom before using the new ID.");
    }
    io.log(command.file ? "Local VSIX: " + command.file : "Source: " + spec.url);
    io.log("Expected SHA-256: " + spec.sha256);
    if (command.dryRun) {
      io.log("Dry run: no download or installation; editor=" + command.editor);
      return 0;
    }
    if (command.file) {
      const bytes = await installLocalRelease(spec, command.file, {
        editor: command.editor, runner: deps.runner
      });
      io.log("Verified " + bytes + " local bytes; installed LineLoom v" + spec.version);
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

// Node may resolve the imported module through a canonical path while argv[1]
// retains an alias (for example macOS /var vs /private/var, or an npm bin symlink).
// Compare the actual files, not stringified file URLs. Imported/tested modules
// still never execute commands as a side effect.
export function isMainModule(entry = process.argv[1], moduleUrl = import.meta.url) {
  if (!entry) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
}

if (isMainModule()) {
  process.exitCode = await run();
}
