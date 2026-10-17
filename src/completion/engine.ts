import * as vscode from "vscode";
import { createHash } from "node:crypto";
import { SuggestionCache } from "./cache";
import { getLanguage } from "../languages/registry";
import { extractContext } from "../context/extract";
import { buildPrompt } from "./prompt";
import { cleanCompletion } from "./filter";
import { mayComplete } from "../privacy/exclusions";
import { readConfig, validateEndpoint } from "../settings/config";
import { generateCompletion } from "../models/ollama";

export type CompletionState = "ready" | "generating" | "disabled" | "unavailable" | "error";
export interface CompletionStats {
  requests: number; completions: number; cancelled: number; failed: number;
  totalLatencyMs: number; lastLatencyMs: number; measuredRequests: number; cacheHits: number;
}
export class CompletionEngine implements vscode.InlineCompletionItemProvider, vscode.Disposable {
  private generation = 0;
  private readonly suggestions = new SuggestionCache();
  private controller: AbortController | undefined;
  private readonly metrics: CompletionStats = {
    requests: 0, completions: 0, cancelled: 0, failed: 0,
    totalLatencyMs: 0, lastLatencyMs: 0, measuredRequests: 0, cacheHits: 0
  };
  constructor(
    private readonly onState: (state: CompletionState) => void,
    private readonly remoteApproved: (endpoint: string) => boolean
  ) {}
  getStats(): Readonly<CompletionStats> { return { ...this.metrics }; }
  cancel(): void {
    this.generation++;
    this.controller?.abort();
    this.controller = undefined;
    this.suggestions.clear();
  }
  dispose(): void { this.cancel(); }
  private async debounce(ms: number, token: vscode.CancellationToken): Promise<boolean> {
    if (ms === 0) return !token.isCancellationRequested;
    return new Promise((resolve) => {
      const timeout = setTimeout(() => { subscription.dispose(); resolve(!token.isCancellationRequested); }, ms);
      const subscription = token.onCancellationRequested(() => {
        clearTimeout(timeout);
        subscription.dispose();
        resolve(false);
      });
    });
  }
  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionItem[] | undefined> {
    const config = readConfig();
    if (!config.enabled) { this.onState("disabled"); return; }
    if (!config.autoTrigger && context.triggerKind === vscode.InlineCompletionTriggerKind.Automatic) return;
    const language = getLanguage(document.languageId);
    if (!language || token.isCancellationRequested) return;
    const requestId = ++this.generation;
    this.controller?.abort();
    if (!await this.debounce(config.debounceMs, token) || requestId !== this.generation) {
      if (requestId === this.generation) this.onState("ready");
      return;
    }
    if (!await mayComplete(document, config.excludedPaths) || token.isCancellationRequested || requestId !== this.generation) {
      if (requestId === this.generation) this.onState("ready");
      return;
    }
    try {
      const url = validateEndpoint(config.endpoint);
      if (url.remote && (!config.allowRemoteEndpoints || !this.remoteApproved(url.origin))) {
        this.onState("unavailable");
        return;
      }
      if (!config.model) { this.onState("unavailable"); return; }
      const version = document.version;
      const offset = document.offsetAt(position);
      const extracted = extractContext(document.getText(), offset, config.maxContextChars);
      if (!extracted.prefix.trim() && !extracted.suffix.trim()) return;
      const key = createHash("sha256").update(JSON.stringify([
        document.uri.toString(), document.version, offset, url.origin, config.model,
        config.temperature, config.contextSize, config.maxOutputTokens, config.multiLine,
        config.maxSuggestionLines, extracted.prefix, extracted.suffix
      ])).digest("hex");
      const cached = this.suggestions.get(key);
      const active = vscode.window.activeTextEditor;
      if (cached && active?.document === document && active.selection.active.isEqual(position)) {
        this.metrics.cacheHits++;
        this.onState("ready");
        this.metrics.completions++;
        return [new vscode.InlineCompletionItem(cached, new vscode.Range(position, position))];
      }
      const prompt = buildPrompt(language, extracted, config.model);
      const controller = new AbortController();
      this.controller = controller;
      const cancelSubscription = token.onCancellationRequested(() => controller.abort());
      let timedOut = false;
      const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, config.timeoutMs);
      const start = performance.now();
      this.metrics.requests++;
      this.onState("generating");
      try {
        const raw = await generateCompletion(url.origin, {
          model: config.model, prompt: prompt.prompt, suffix: prompt.suffix,
          numPredict: config.maxOutputTokens, contextSize: config.contextSize,
          temperature: config.temperature, keepAlive: config.keepAlive
        }, controller.signal);
        // Privacy and cursor state may have changed while the model was responding.
        const currentEditor = vscode.window.activeTextEditor;
        const currentTarget = Boolean(
          currentEditor && currentEditor.document === document &&
          currentEditor.selection.active.isEqual(position)
        );
        const stillAllowed = currentTarget && await mayComplete(document, readConfig().excludedPaths);
        if (controller.signal.aborted || token.isCancellationRequested || requestId !== this.generation ||
            document.version !== version || !currentTarget || !stillAllowed) {
          this.metrics.cancelled++;
          if (requestId === this.generation) this.onState("ready");
          return;
        }
        const suggestion = cleanCompletion(raw, extracted.prefix, extracted.suffix, config.multiLine, config.maxSuggestionLines);
        const latency = performance.now() - start;
        if (config.performanceDiagnostics) {
          this.metrics.totalLatencyMs += latency;
          this.metrics.lastLatencyMs = latency;
          this.metrics.measuredRequests++;
        }
        this.onState("ready");
        if (!suggestion) return;
        this.metrics.completions++;
        this.suggestions.put(key, suggestion);
        const insertion = new vscode.Range(position, position);
        return [new vscode.InlineCompletionItem(suggestion, insertion)];
      } catch (error: unknown) {
        if (timedOut && requestId === this.generation) {
          this.metrics.failed++;
          this.onState("unavailable");
          return;
        }
        if (controller.signal.aborted || token.isCancellationRequested || requestId !== this.generation) {
          this.metrics.cancelled++;
          if (requestId === this.generation) this.onState("ready");
          return;
        }
        this.metrics.failed++;
        this.onState("unavailable");
        // No source code, prompts, generated response or token-bearing URLs are logged.
        if (error instanceof Error && /Invalid Ollama|Incomplete Ollama|safety limit/.test(error.message)) {
          this.onState("error");
        }
        return;
      } finally {
        clearTimeout(timeout);
        cancelSubscription.dispose();
        if (this.controller === controller) this.controller = undefined;
      }
    } catch {
      this.metrics.failed++;
      this.onState("error");
      return;
    }
  }
}
