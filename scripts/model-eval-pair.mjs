#!/usr/bin/env node
/**
 * Explicitly invoked paired local Ollama research, with no model downloads,
 * file writes, telemetry or source output. Runs against public fixtures only.
 */
import { readFile } from "node:fs/promises";
import {
  parsePairedOptions, selectedPairedFixtures, pairedDryRun,
  runPairedSyntheticBenchmarks
} from "./model-eval-pair-lib.mjs";
import { validateFixtures } from "./model-eval-lib.mjs";

async function main() {
  const opts = parsePairedOptions(process.argv.slice(2));
  const manifest = JSON.parse(await readFile(
    new URL("../model/fixtures/completion-v1.json", import.meta.url), "utf8"
  ));
  const fixtures = selectedPairedFixtures(validateFixtures(manifest), opts);
  if (opts.dryRun) {
    console.log(JSON.stringify(pairedDryRun(fixtures, opts), null, 2));
    return;
  }
  const result = await runPairedSyntheticBenchmarks(fixtures, opts);
  // Only bounded counts, fixed enum labels and author-written caveats.
  // Does not echo model tags, private code, generated source or Ollama errors.
  console.log(JSON.stringify(result, null, 2));
  if (result.anyRequestFailed) process.exitCode = 1;
}
await main().catch(() => {
  // Path, model tag or transport error messages must never reach stderr.
  console.error("Paired local benchmark could not complete. Check model availability, scope, local Ollama and matching parser coverage.");
  process.exitCode = 1;
});
