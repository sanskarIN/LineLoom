import { performance } from "node:perf_hooks";
import { createRequest, normalizeGenerated } from "./model-eval-lib.mjs";
import { consumeOllamaStream } from "./model-eval-stream.mjs";
import { classifyCompletionFormat } from "./model-eval-quality.mjs";
import { classifyGeneratedSyntax } from "./model-eval-syntax.mjs";

/**
 * Developer-only, one-fixture synthetic evaluation.
 *
 * The production CLI always uses the fixed IPv4 loopback Ollama endpoint.
 * In tests, an injected fetch implementation must be an in-memory stub:
 * no actual network, real code, model downloads, workspace reads or logs.
 *
 * This function ONLY returns numeric metrics, source-free enum flags, fixed
 * identifiers from checked-in public fixtures and booleans. It NEVER returns
 * the raw model continuation or HTTP error body.
 */
export async function evaluateSyntheticFixture(fixture, model, mode, {
  fetchImpl = fetch,
  clock = () => performance.now(),
  timeoutMs = 12_000
} = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 12_000) {
    throw new Error("invalid-evaluation-timeout");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const started = clock();
  try {
    const response = await fetchImpl("http://127.0.0.1:11434/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(createRequest(fixture, model, mode)),
      signal: controller.signal,
      redirect: "error"
    });
    if (controller.signal.aborted || response?.status !== 200 || !response.body || response.redirected) {
      throw new Error("invalid-http-response");
    }
    // Strict benchmark parsing observes a clean EOF; the request's abort
    // signal also cancels a server that stalls after its terminal frame.
    const parsed = await consumeOllamaStream(response.body, started, clock, controller.signal);
    // Handle an abort racing the final streamed frame. A timed-out request
    // must never be reported as a successful completion, even if a mock
    // transport or nonstandard runtime ignored cancellation.
    if (controller.signal.aborted) throw new Error("evaluation-aborted");
    const elapsed = clock() - started;
    if (!Number.isFinite(elapsed) || elapsed < 0) throw new Error("invalid-timing");
    const insertion = normalizeGenerated(parsed.output);
    const syntaxOutcome = classifyGeneratedSyntax(fixture, insertion);
    return {
      fixtureId: fixture.id,
      language: fixture.language,
      category: fixture.category,
      ok: true,
      exact: insertion === fixture.expected,
      syntaxOutcome,
      formatSignals: classifyCompletionFormat(parsed.output, fixture),
      firstTokenMs: parsed.firstTokenMs,
      totalMs: elapsed
    };
  } catch {
    // Fixed-field failure with no source, HTTP payload, path, token or errors.
    return {
      fixtureId: fixture.id, language: fixture.language,
      category: fixture.category, ok: false, exact: false
    };
  } finally {
    clearTimeout(timeout);
  }
}
