# Benchmark instructions

Run `npm run benchmark -- --model qwen2.5-coder:1.5b --runs 3` against your own **already installed** local Ollama server. The script uses only an innocuous synthetic Python example; it does not open a repository or transmit proprietary code.

The output records model, operating system, CPU model, memory, time to first generated token, full response latency and completion length. The timings are not editor ghost-text timing and must not be advertised as end-to-end responsiveness; there is no GPU auto-detection. Compare CPU-only and GPU-accelerated setups only when the actual hardware and model configuration have been documented.

No benchmark results are yet recorded in the repository. Never publish invented performance claims.

## v0.5.0 local request-efficiency counters

Run **LineLoom: Open Diagnostics** to inspect the in-memory `empty responses` and `suppressed empty retries` counters. These counters are not benchmark measurements; they only describe the current extension session, and they do not contain source code, prompts or model response text. The five-second negative-result backoff is deliberately limited to identical automatic requests; it does not throttle explicit manual completions.

## v0.7.0 typed continuation counter

The diagnostics channel includes **typed continuation reuses**, a local session-only aggregate count of proposals returned from a short-lived suggestion remainder rather than a new model request. This count contains no code, prompt or model-response content. It is not a measured time saved and must not be marketed as a benchmark without independent real-machine testing.

## v0.7.1 conservative continuation invalidation

The typed-continuation reuse counter only increases after the actual VS Code edit shape and surrounding-code fingerprints pass. Editing elsewhere or replacing text will skip reuse and may require fresh model inference. The counter is a session-only diagnostic, not proof of saved wall-clock time or real Ollama performance.

## v0.8.0 timing and request suppression

Explicit/manual inline-completion requests no longer wait for the typing debounce. Automatic requests inside an existing identifier are skipped by default. These changes are verified by code and synthetic editor tests, **not** by measured Ollama time-to-first-token or real-user latency benchmarks. The actual model/hardware configuration remains the dominant latency factor; collect reproducible measurements before claiming a speed-up.
