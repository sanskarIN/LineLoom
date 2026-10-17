// Run against a deliberately non-sensitive fixture. Never records user source.
import os from "node:os";
import { performance } from "node:perf_hooks";
const args = process.argv.slice(2);
const model = args[args.indexOf("--model") + 1] || "qwen2.5-coder:1.5b";
const runs = Math.min(20, Math.max(1, Number(args[args.indexOf("--runs") + 1]) || 3));
const endpoint = "http://127.0.0.1:11434";
const sample = "def add(a: int, b: int) -> int:\n    return ";
const measurements = [];
for (let index = 0; index < runs; index++) {
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), 90_000);
  const started = performance.now();
  let firstToken;
  try {
    const response = await fetch(endpoint + "/api/generate", {
      method: "POST", signal: abort.signal, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt: sample, stream: true, options: { num_predict: 64, temperature: 0, num_ctx: 2048 } })
    });
    if (!response.ok || !response.body) throw new Error("Ollama HTTP " + response.status);
    const decoder = new TextDecoder();
    let buffer = "", output = "";
    for await (const chunk of response.body) {
      buffer += decoder.decode(chunk, { stream: true });
      let i;
      while ((i = buffer.indexOf("\n")) >= 0) {
        const text = buffer.slice(0, i).trim(); buffer = buffer.slice(i + 1);
        if (!text) continue;
        const item = JSON.parse(text);
        if (item.error) throw new Error(String(item.error));
        if (item.response) { firstToken ??= performance.now() - started; output += item.response; }
      }
    }
    measurements.push({ firstTokenMs: firstToken ?? null, totalMs: performance.now() - started, outputLength: output.length });
  } finally { clearTimeout(timeout); }
}
const average = (key) => measurements.reduce((sum, item) => sum + (item[key] ?? 0), 0) / measurements.length;
console.log(JSON.stringify({
  model, platform: process.platform, arch: process.arch,
  cpu: os.cpus()[0]?.model, memoryGiB: Number((os.totalmem() / 2 ** 30).toFixed(2)),
  sample: "public fixture", runs, averageFirstTokenMs: average("firstTokenMs"),
  averageTotalMs: average("totalMs"), measurements
}, null, 2));
