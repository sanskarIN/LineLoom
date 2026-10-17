# Benchmark instructions

Run `npm run benchmark -- --model qwen2.5-coder:1.5b --runs 3` against your own **already installed** local Ollama server. The script uses only an innocuous synthetic Python example; it does not open a repository or transmit proprietary code.

The output records model, operating system, CPU model, memory, time to first generated token, full response latency and completion length. The timings are not editor ghost-text timing and must not be advertised as end-to-end responsiveness; there is no GPU auto-detection. Compare CPU-only and GPU-accelerated setups only when the actual hardware and model configuration have been documented.

No benchmark results are yet recorded in the repository. Never publish invented performance claims.
