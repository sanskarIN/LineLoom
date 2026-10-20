/** Actionable, privacy-safe user diagnostics. Never expose server error bodies or URLs. */
export function ollamaFailureMessage(error: unknown): string {
  if (!(error instanceof Error)) return "Ollama request failed. Check the configured server.";
  if (error.name === "AbortError") return "The model request was cancelled.";
  if (error.name === "TimeoutError") return "Ollama timed out. Check server load and retry.";
  // Only examine errors produced by our own bounded HTTP/stream parser.
  if (/^Ollama returned HTTP 404\./.test(error.message)) {
    return "The Ollama API endpoint was not found. Check your server installation.";
  }
  if (/^Ollama returned HTTP (?:401|403)\./.test(error.message)) {
    return "Ollama rejected the request. Check endpoint authorization.";
  }
  if (/^Ollama returned HTTP 5\d\d\./.test(error.message)) {
    return "Ollama reported a server error. Check that the model is available and retry.";
  }
  if (/^Ollama returned HTTP 429\./.test(error.message)) {
    return "Ollama is busy or rate-limiting requests. Retry later.";
  }
  if (/^Ollama returned HTTP \d{3}\./.test(error.message)) {
    return "Ollama rejected the request. Check the configured endpoint and model.";
  }
  if (/^Model no longer installed\./.test(error.message)) {
    return "The selected model is no longer installed. Select an available model.";
  }
  if (/safety limit|oversized|Incomplete Ollama response|Invalid Ollama|Unexpected \/api\/tags/i.test(error.message)) {
    return "Ollama returned an invalid or oversized response. Check server compatibility.";
  }
  return "Cannot reach Ollama. Verify the server is running and the endpoint is correct.";
}
