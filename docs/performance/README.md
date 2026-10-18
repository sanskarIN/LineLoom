# Benchmark instructions

Run `npm run benchmark -- --model qwen2.5-coder:1.5b --runs 3` against your own **already installed** local Ollama server. The script uses only an innocuous synthetic Python example; it does not open a repository or transmit proprietary code.

The output records model, operating system, CPU model, memory, time to first generated token, full response latency and completion length. The timings are not editor ghost-text timing and must not be advertised as end-to-end responsiveness; there is no GPU auto-detection. Compare CPU-only and GPU-accelerated setups only when the actual hardware and model configuration have been documented.

No benchmark results are yet recorded in the repository. Never publish invented performance claims.

## v0.5.0 local request-efficiency counters

Run **LineLoom: Open Diagnostics** to inspect the in-memory `empty responses` and `suppressed empty retries` counters. These counters are not benchmark measurements; they only describe the current extension session, and they do not contain source code, prompts or model response text. The five-second negative-result backoff is deliberately limited to identical automatic requests; it does not throttle explicit manual completions.
