#!/usr/bin/env node
/**
 * Offline comparison only: reads two user-selected, bounded JSON summaries
 * and the fixed checked-in public synthetic fixture manifest to verify scope.
 * No network, Ollama, private workspace code, or path/model echo in output.
 */
import { open } from "node:fs/promises";
import { compareModelReports } from "./model-eval-compare-lib.mjs";

const MAX_REPORT_BYTES = 32_768;
function parseArgs(argv) {
  if (argv.length !== 4 || argv[0] !== "--baseline" || argv[2] !== "--candidate" ||
      !argv[1] || !argv[3] || argv[1].startsWith("--") || argv[3].startsWith("--")) {
    throw Error("invalid-arguments");
  }
  return { baseline: argv[1], candidate: argv[3] };
}
async function readBoundedReport(path) {
  const handle = await open(path, "r");
  try {
    const buffer = Buffer.alloc(MAX_REPORT_BYTES + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await handle.read(buffer, length, buffer.length - length, length);
      if (bytesRead === 0) break;
      length += bytesRead;
    }
    if (length === 0 || length > MAX_REPORT_BYTES) throw Error("invalid-size");
    const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, length));
    return JSON.parse(text);
  } finally {
    await handle.close();
  }
}
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const baseline = await readBoundedReport(opts.baseline);
  const candidate = await readBoundedReport(opts.candidate);
  console.log(JSON.stringify(compareModelReports(baseline, candidate), null, 2));
}
await main().catch(() => {
  // Do not echo file names, model tags, malformed JSON or secret-like contents.
  console.error("Cannot compare synthetic reports: check identical fixture scope, runs, prompt mode, and report format.");
  process.exitCode = 1;
});
