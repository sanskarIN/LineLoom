import * as vscode from "vscode";
import { createHash } from "node:crypto";
import { SuggestionCache } from "./cache";
import { EmptySuggestionBackoff } from "./backoff";
import { ContinuationCache, type ContinuationPoint } from "./continuation";
import { getLanguage, isLanguageEnabled } from "../languages/registry";
import { extractContextWindow } from "../context/extract";
import { shouldAutoComplete, shouldRequestAtCursor, hasSingleInsertionCursor } from "./trigger";
import { buildPrompt } from "./prompt";
import { cleanCompletion } from "./filter";
import { mayComplete } from "../privacy/exclusions";
import { readConfig, validateEndpoint } from "../settings/config";
import { generateCompletion } from "../models/ollama";
import { isRequestConfigurationCurrent } from "./request-state";

export type CompletionState = "ready" | "generating" | "disabled" | "unavailable" | "error";
export interface CompletionStats {
  requests: number; completions: number; cancelled: number; failed: number;
  totalLatencyMs: number; lastLatencyMs: number; measuredRequests: number; cacheHits: number;
  emptySuggestions: number; suppressedEmptyRetries: number; continuationHits: number;
}
export class CompletionEngine implements vscode.InlineCompletionItemProvider, vscode.Disposable {
  private generation = 0;
  private readonly suggestions = new SuggestionCache();
  private readonly emptyBackoff = new EmptySuggestionBackoff();
  private readonly continuations = new ContinuationCache();
  private controller: AbortController | undefined;
  private target: { uri: string; version: number; position: vscode.Position } | undefined;
  private readonly metrics: CompletionStats = {
    requests: 0, completions: 0, cancelled: 0, failed: 0,
    totalLatencyMs: 0, lastLatencyMs: 0, measuredRequests: 0, cacheHits: 0,
    emptySuggestions: 0, suppressedEmptyRetries: 0, continuationHits: 0
  };
  constructor(
    private readonly onState: (state: CompletionState) => void,
    private readonly remoteApproved: (endpoint: string) => boolean
  ) {}
  getStats(): Readonly<CompletionStats> { return { ...this.metrics }; }
  cancel(preserveContinuation = false): void {
    this.generation++;
    this.controller?.abort();
    this.controller = undefined;
    this.target = undefined;
    this.suggestions.clear();
    this.emptyBackoff.clear();
    if (!preserveContinuation) this.continuations.clear();
  }
  /** Cancel only if the active editor no longer matches the request's original cursor. */
  cancelIfEditorChanged(editor: vscode.TextEditor | undefined): void {
    const target = this.target;
    if (!target) return;
    if (!editor ||
        editor.document.uri.toString() !== target.uri ||
        editor.document.version !== target.version ||
        !hasSingleInsertionCursor(editor.selections, target.position.line, target.position.character)) {
      // Preserve only a potential one-step typed continuation in the same file.
      // The cache itself verifies exact hashed context, suffix and settings.
      const preserve = Boolean(editor &&
        editor.document.uri.toString() === target.uri &&
        editor.document.version === target.version + 1);
      this.cancel(preserve);
      this.onState("ready");
    }
  }
  /** Verify the actual VS Code edit before attempting any cached continuation. */
  onDocumentChanged(event: vscode.TextDocumentChangeEvent): void {
    this.continuations.invalidateOnEdit(
      event.document.uri.toString(), event.document.version, event.contentChanges
    );
    this.cancelIfEditorChanged(vscode.window.activeTextEditor);
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
    if (!language || !isLanguageEnabled(language, config.enabledLanguages) || token.isCancellationRequested) return;
    // Do not overwrite an active native IntelliSense entry during automatic triggering.
    if (context.triggerKind === vscode.InlineCompletionTriggerKind.Automatic && context.selectedCompletionInfo) return;
    const initialVersion = document.version;
    const isTargetCurrent = (): boolean => {
      const active = vscode.window.activeTextEditor;
      return Boolean(active && active.document === document &&
        document.version === initialVersion &&
        hasSingleInsertionCursor(active.selections, position.line, position.character));
    };
    if (!isTargetCurrent()) return;
    const manual = context.triggerKind === vscode.InlineCompletionTriggerKind.Invoke;
    const activeLine = document.lineAt(position.line).text;
    if (!shouldAutoComplete(activeLine.slice(0, position.character), config.minAutoTriggerChars, manual)) return;
    if (!shouldRequestAtCursor(activeLine.slice(position.character), manual, config.suppressMidTokenAuto)) return;
    const requestId = ++this.generation;
    this.controller?.abort();
    this.target = { uri: document.uri.toString(), version: initialVersion, position };
    // An explicit developer request should never wait for the typing debounce.
    if (!await this.debounce(manual ? 0 : config.debounceMs, token) || requestId !== this.generation || !isTargetCurrent()) {
      if (requestId === this.generation) this.onState("ready");
      return;
    }
    if (!await mayComplete(document, config.excludedPaths) || token.isCancellationRequested ||
        requestId !== this.generation || !isTargetCurrent()) {
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
      const version = initialVersion;
      const offset = document.offsetAt(position);
      // Read only the bounded prefix/suffix ranges: do not copy large editor buffers.
      const totalLength = document.offsetAt(document.positionAt(Number.MAX_SAFE_INTEGER));
      const extracted = extractContextWindow(
        (start, end) => document.getText(new vscode.Range(document.positionAt(start), document.positionAt(end))),
        offset, totalLength, config.maxContextChars
      );
      if (!extracted.prefix.trim() && !extracted.suffix.trim()) return;
      const profileDigest = createHash("sha256").update(JSON.stringify([
        url.origin, config.model, config.temperature, config.contextSize,
        config.maxOutputTokens, config.multiLine, config.maxSuggestionLines,
        config.maxContextChars
      ])).digest("hex");
      const continuationPoint: ContinuationPoint = {
        documentId: document.uri.toString(), languageId: document.languageId,
        version: document.version, offset, prefix: extracted.prefix,
        suffix: extracted.suffix, profileDigest
      };
      // A typed prefix of the previous suggestion can be offered without
      // another Ollama request only after the privacy and editor checks above.
      const remainder = !manual ? this.continuations.remainder(continuationPoint) : undefined;
      if (remainder && isTargetCurrent() && !token.isCancellationRequested &&
          requestId === this.generation) {
        this.continuations.remember(continuationPoint, remainder);
        this.metrics.continuationHits++;
        this.metrics.completions++;
        this.onState("ready");
        return [new vscode.InlineCompletionItem(remainder, new vscode.Range(position, position))];
      }
      const key = createHash("sha256").update(JSON.stringify([
        document.uri.toString(), document.languageId, document.version, offset, url.origin, config.model,
        config.temperature, config.contextSize, config.maxOutputTokens, config.multiLine,
        config.maxSuggestionLines, extracted.prefix, extracted.suffix
      ])).digest("hex");
      const cached = this.suggestions.get(key);
      const active = vscode.window.activeTextEditor;
      if (cached && active?.document === document && isTargetCurrent() &&
          !token.isCancellationRequested && requestId === this.generation) {
        this.metrics.cacheHits++;
        this.onState("ready");
        this.metrics.completions++;
        this.continuations.remember(continuationPoint, cached);
        return [new vscode.InlineCompletionItem(cached, new vscode.Range(position, position))];
      }
      if (token.isCancellationRequested || requestId !== this.generation || !isTargetCurrent()) return;
      // An exact empty-result retry is rarely useful while nothing has changed.
      // Explicit completion requests always bypass the short-lived backoff.
      if (!manual && this.emptyBackoff.shouldSkip(key)) {
        this.metrics.suppressedEmptyRetries++;
        this.onState("ready");
        return;
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
        const latest = readConfig();
        // Configuration changes can race an HTTP response and the extension's
        // onDidChangeConfiguration callback. Fail closed for superseded settings.
        const settingsCurrent = isRequestConfigurationCurrent(config, latest, language, manual) &&
          (!url.remote || (latest.allowRemoteEndpoints && this.remoteApproved(url.origin)));
        const stillAllowed = settingsCurrent && isTargetCurrent() &&
          await mayComplete(document, latest.excludedPaths);
        if (controller.signal.aborted || token.isCancellationRequested || requestId !== this.generation ||
            document.version !== version || !isTargetCurrent() || !stillAllowed) {
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
        if (!suggestion) {
          this.metrics.emptySuggestions++;
          this.emptyBackoff.rememberEmpty(key);
          return;
        }
        this.metrics.completions++;
        this.continuations.remember(continuationPoint, suggestion);
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
