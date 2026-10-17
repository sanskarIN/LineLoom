import * as vscode from "vscode";
export interface LineLoomConfig {
  enabled: boolean;
  autoTrigger: boolean;
  model: string;
  endpoint: string;
  allowRemoteEndpoints: boolean;
  debounceMs: number;
  timeoutMs: number;
  maxContextChars: number;
  maxOutputTokens: number;
  multiLine: boolean;
  temperature: number;
  contextSize: number;
  keepAlive: string;
  excludedPaths: string[];
  crossFileContext: boolean;
  performanceDiagnostics: boolean;
}
export function clamp(value: number, lower: number, upper: number): number {
  return Number.isFinite(value) ? Math.min(upper, Math.max(lower, value)) : lower;
}
export function readConfig(): LineLoomConfig {
  const c = vscode.workspace.getConfiguration("lineloom");
  return {
    enabled: c.get("enabled", true),
    autoTrigger: c.get("autoTrigger", true),
    model: c.get("model", "qwen2.5-coder:1.5b").trim(),
    endpoint: c.get("endpoint", "http://127.0.0.1:11434").trim(),
    allowRemoteEndpoints: c.get("allowRemoteEndpoints", false),
    debounceMs: clamp(c.get("debounceMs", 250), 0, 3000),
    timeoutMs: clamp(c.get("timeoutMs", 12000), 1000, 120000),
    maxContextChars: clamp(c.get("maxContextChars", 8000), 512, 30000),
    maxOutputTokens: clamp(c.get("maxOutputTokens", 128), 16, 512),
    multiLine: c.get("multiLine", true),
    temperature: clamp(c.get("temperature", 0.1), 0, 1),
    contextSize: clamp(c.get("contextSize", 4096), 512, 32768),
    keepAlive: c.get("keepAlive", "5m"),
    excludedPaths: c.get("excludedPaths", []),
    crossFileContext: c.get("crossFileContext", false),
    performanceDiagnostics: c.get("performanceDiagnostics", false)
  };
}
export function validateEndpoint(endpoint: string): { origin: string; remote: boolean } {
  let url: URL;
  try { url = new URL(endpoint); } catch { throw new Error("Invalid Ollama endpoint URL."); }
  const localHosts = ["localhost", "127.0.0.1", "[::1]"];
  const local = localHosts.includes(url.hostname.toLowerCase());
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/")
    throw new Error("Ollama endpoint must be a plain origin without credentials, paths or query parameters.");
  if (local && !["http:", "https:"].includes(url.protocol)) throw new Error("Unsupported endpoint protocol.");
  if (!local && url.protocol !== "https:") throw new Error("Remote endpoints must use HTTPS.");
  return { origin: url.origin, remote: !local };
}
