import * as vscode from "vscode";
import { createHash } from "node:crypto";
import { SuggestionCache } from "./cache";
import { EmptySuggestionBackoff } from "./backoff";
import { TransientFailureBackoff, isTransientGenerationFailure } from "./failure-backoff";
import { ContinuationCache, type ContinuationPoint } from "./continuation";
import { AcceptanceTracker } from "./acceptance";
import { LatencyWindow } from "./latency-window";
import { getLanguage, isLanguageEnabled } from "../languages/registry";
import { extractContextWindow } from "../context/extract";
import { collectRelatedText } from "../context/related-editor";
import { RELATED_FILE_LIMIT, validateRelatedSelection } from "../context/related";
import { shouldAutoComplete, shouldRequestAtCursor, hasSingleInsertionCursor } from "./trigger";
import { buildPrompt } from "./prompt";
import { cleanCompletion } from "./filter";
import { mayComplete } from "../privacy/exclusions";
import { readConfig, validateEndpoint } from "../settings/config";
import { generateCompletion } from "../models/ollama";
import { isRequestConfigurationCurrent, isResponseStillEligible } from "./request-state";
import { resolveLanguageModel } from "../settings/language-models";

export type CompletionState = "ready" | "generating" | "disabled" | "unavailable" | "error";
export interface CompletionStats {
  requests: number; completions: number; accepted: number; cancelled: number; failed: number;
  totalLatencyMs: number; lastLatencyMs: number; measuredRequests: number; cacheHits: number;
  emptySuggestions: number; suppressedEmptyRetries: number; suppressedTransientRetries: number; continuationHits: number;
  recentLatencySamples: number; recentLatencyP50Ms?: number; recentLatencyP95Ms?: number;
}
export class CompletionEngine implements vscode.InlineCompletionItemProvider, vscode.Disposable {
  private generation = 0;
  // Epoch prevents old in-flight cancellation results resurrecting reset counters.
  private activityEpoch = 0;
  private relatedRevision = 0;
  private relatedFiles: vscode.Uri[] = [];
  // Increment on opt-out to reject measurements from already-running requests.
  private latencyEpoch = 0;
  private readonly suggestions = new SuggestionCache();
  private readonly emptyBackoff = new EmptySuggestionBackoff();
  private readonly transientFailures = new TransientFailureBackoff();
  private readonly continuations = new ContinuationCache();
  private readonly acceptance = new AcceptanceTracker();
  private readonly latencyWindow = new LatencyWindow();
  private controller: AbortController | undefined;
  private target: { uri: string; version: number; position: vscode.Position } | undefined;
  private readonly metrics: Omit<CompletionStats, "recentLatencySamples" | "recentLatencyP50Ms" | "recentLatencyP95Ms"> = {
    requests: 0, completions: 0, accepted: 0, cancelled: 0, failed: 0,
    totalLatencyMs: 0, lastLatencyMs: 0, measuredRequests: 0, cacheHits: 0,
    emptySuggestions: 0, suppressedEmptyRetries: 0, suppressedTransientRetries: 0, continuationHits: 0
  };
  constructor(
    private readonly onState: (state: CompletionState) => void,
    private readonly remoteApproved: (endpoint: string) => boolean
  ) {}
  getStats(): Readonly<CompletionStats> {
    const recent = this.latencyWindow.summary();
    return {
      ...this.metrics,
      recentLatencySamples: recent.samples,
      recentLatencyP50Ms: recent.p50Ms,
      recentLatencyP95Ms: recent.p95Ms
    };
  }
  /** Only the one-shot VS Code acceptance callback can increase this count. */
  recordAcceptance(token: unknown): boolean {
    if (!this.acceptance.acknowledge(token)) return false;
    this.metrics.accepted++;
    return true;
  }
  private makeInlineItem(value: string, position: vscode.Position): vscode.InlineCompletionItem {
    const item = new vscode.InlineCompletionItem(value, new vscode.Range(position, position));
    item.command = {
      command: "lineloom.recordSuggestionAccepted",
      title: "Record LineLoom Suggestion Acceptance",
      arguments: [this.acceptance.issue()]
    };
    return item;
  }
  getRelatedFileCount(): number { return this.relatedFiles.length; }
  /** Reset only in-memory activity; do not modify settings or related-file consent. */
  resetSessionActivity(): void {
    this.cancel(); // Invalidates queued and in-flight generations first.
    this.activityEpoch++;
    this.acceptance.clear(); // Old inline-item commands cannot restore counts.
    this.clearLatencyMeasurements();
    this.resetTransientFailures();
    for (const key of Object.keys(this.metrics) as Array<keyof typeof this.metrics>) {
      this.metrics[key] = 0;
    }
  }
  /** Configuration and authorization changes revoke old automatic failure cooldowns. */
  resetTransientFailures(): void { this.transientFailures.clear(); }
  /** Explicit selection exists only for the current extension session. */
  setRelatedFiles(files: readonly vscode.Uri[]): void {
    if (files.length > RELATED_FILE_LIMIT ||
        (files.length > 0 && !validateRelatedSelection("", files.map(uri => uri.toString())))) {
      throw new Error("Invalid related-file selection");
    }
    this.relatedFiles = [...files];
    this.relatedRevision++;
    this.cancel();
  }
  /** An opt-out erases only inference durations, retaining non-sensitive counts. */
  clearLatencyMeasurements(): void {
    this.latencyEpoch++;
    this.metrics.totalLatencyMs = 0;
    this.metrics.lastLatencyMs = 0;
    this.metrics.measuredRequests = 0;
    this.latencyWindow.clear();
  }
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
  dispose(): void { this.cancel(); this.acceptance.clear(); }
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
    const model = resolveLanguageModel(config.model, language.id, config.languageModels);
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
    const activityEpoch = this.activityEpoch;
    const requestId = ++this.generation;
    this.controller?.abort();
    this.target = { uri: document.uri.toString(), version: initialVersion, position };
    // An explicit developer request should never wait for the typing debounce.
    if (!await this.debounce(manual ? 0 : config.debounceMs, token) || requestId !== this.generation || !isTargetCurrent()) {
      if (requestId === this.generation) this.onState("ready");
      return;
    }
    if (!await mayComplete(document, config.excludedPaths, config.performanceDiagnostics) || token.isCancellationRequested ||
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
      if (!model) { this.onState("unavailable"); return; }
      // Privacy gate before constructing or sending any prompt. Workspace
      // settings may change during debounce or async ignore-file inspection,
      // before the configuration-change event reaches the engine.
      const mayUseCurrentConfiguration = (): boolean => {
        const latest = readConfig();
        return isRequestConfigurationCurrent(config, latest, language, manual) &&
          vscode.workspace.isTrusted &&
          (!url.remote || (latest.allowRemoteEndpoints && this.remoteApproved(url.origin)));
      };
      if (!mayUseCurrentConfiguration() || token.isCancellationRequested ||
          requestId !== this.generation || !isTargetCurrent()) {
        this.onState("ready");
        return;
      }
      const version = initialVersion;
      const offset = document.offsetAt(position);
      // Read only the bounded prefix/suffix ranges: do not copy large editor buffers.
      const totalLength = document.offsetAt(document.positionAt(Number.MAX_SAFE_INTEGER));
      const extracted = extractContextWindow(
        (start, end) => document.getText(new vscode.Range(document.positionAt(start), document.positionAt(end))),
        offset, totalLength, config.maxContextChars
      );
      if (!extracted.prefix.trim() && !extracted.suffix.trim()) return;
      const relatedRevision = this.relatedRevision;
      const selected = config.crossFileContext ? [...this.relatedFiles] : [];
      const relatedCurrent = (): boolean => requestId === this.generation &&
        relatedRevision === this.relatedRevision && isTargetCurrent() && !token.isCancellationRequested &&
        mayUseCurrentConfiguration();
      const related = await collectRelatedText(document, selected, config.excludedPaths, relatedCurrent);
      if (!related || !relatedCurrent()) return;
      const relatedDigest = createHash("sha256").update(JSON.stringify(related)).digest("hex");
      const profileDigest = createHash("sha256").update(JSON.stringify([
        url.origin, model, config.temperature, config.contextSize,
        config.maxOutputTokens, config.multiLine, config.maxSuggestionLines,
        config.maxContextChars, relatedDigest, relatedRevision
      ])).digest("hex");
      const continuationPoint: ContinuationPoint = {
        documentId: document.uri.toString(), languageId: document.languageId,
        version: document.version, offset, prefix: extracted.prefix,
        suffix: extracted.suffix, profileDigest
      };
      // A typed prefix of the previous suggestion can be offered without
      // another Ollama request only after the privacy and editor checks above.
      const remainder = !manual ? this.continuations.remainder(continuationPoint) : undefined;
      if (remainder && mayUseCurrentConfiguration() && isTargetCurrent() && !token.isCancellationRequested &&
          requestId === this.generation) {
        this.continuations.remember(continuationPoint, remainder);
        this.metrics.continuationHits++;
        this.metrics.completions++;
        this.onState("ready");
        return [this.makeInlineItem(remainder, position)];
      }
      const key = createHash("sha256").update(JSON.stringify([
        document.uri.toString(), document.languageId, document.version, offset, url.origin, model,
        config.temperature, config.contextSize, config.maxOutputTokens, config.multiLine,
        config.maxSuggestionLines, extracted.prefix, extracted.suffix, relatedDigest, relatedRevision
      ])).digest("hex");
      const cached = this.suggestions.get(key);
      const active = vscode.window.activeTextEditor;
      if (cached && active?.document === document && mayUseCurrentConfiguration() &&
          isTargetCurrent() && !token.isCancellationRequested && requestId === this.generation) {
        this.metrics.cacheHits++;
        this.onState("ready");
        this.metrics.completions++;
        this.continuations.remember(continuationPoint, cached);
        return [this.makeInlineItem(cached, position)];
      }
      if (token.isCancellationRequested || requestId !== this.generation ||
          !isTargetCurrent() || !mayUseCurrentConfiguration()) return;
      // An exact empty-result retry is rarely useful while nothing has changed.
      // Explicit completion requests always bypass the short-lived backoff.
      if (!manual && this.emptyBackoff.shouldSkip(key)) {
        this.metrics.suppressedEmptyRetries++;
        this.onState("ready");
        return;
      }
      // A temporary server/transport failure should not cause a request on
      // every keystroke. This profile hash contains no source or path; manual
      // requests bypass the cooldown but retain every normal privacy gate.
      const failureProfile = createHash("sha256").update(JSON.stringify([url.origin, model])).digest("hex");
      if (!manual && this.transientFailures.shouldSkip(failureProfile)) {
        this.metrics.suppressedTransientRetries++;
        this.onState("ready");
        return;
      }
      const prompt = buildPrompt(language, extracted, model, related);
      const controller = new AbortController();
      this.controller = controller;
      const cancelSubscription = token.onCancellationRequested(() => controller.abort());
      let timedOut = false;
      const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, config.timeoutMs);
      const start = performance.now();
      const recordingEpoch = this.latencyEpoch;
      this.metrics.requests++;
      this.onState("generating");
      try {
        const raw = await generateCompletion(url.origin, {
          model, prompt: prompt.prompt, suffix: prompt.suffix,
          numPredict: config.maxOutputTokens, contextSize: config.contextSize,
          temperature: config.temperature, keepAlive: config.keepAlive
        }, controller.signal);
        // Privacy policies are checked again after the model responds. These
        // filesystem reads await I/O; settings, trust or endpoint consent can
        // change while they run, before VS Code dispatches a cancellation event.
        // Revalidate those conditions after the final await as well.
        const stillAllowed = await isResponseStillEligible(
          config, language, manual, readConfig,
          () => isTargetCurrent() && vscode.workspace.isTrusted &&
            (!url.remote || this.remoteApproved(url.origin)),
          (patterns, collectTiming) => mayComplete(document, patterns, collectTiming)
        );
        // Selected sources must still be eligible and byte-identical after inference.
        const relatedAfter = stillAllowed && relatedCurrent()
          ? await collectRelatedText(document, selected, config.excludedPaths, relatedCurrent)
          : undefined;
        if (controller.signal.aborted || token.isCancellationRequested || requestId !== this.generation ||
            document.version !== version || !isTargetCurrent() || !stillAllowed ||
            !relatedAfter || JSON.stringify(relatedAfter) !== JSON.stringify(related) ||
            !relatedCurrent()) {
          if (activityEpoch === this.activityEpoch) this.metrics.cancelled++;
          if (requestId === this.generation) this.onState("ready");
          return;
        }
        this.transientFailures.recordSuccess(failureProfile);
        const suggestion = cleanCompletion(raw, extracted.prefix, extracted.suffix, config.multiLine, config.maxSuggestionLines);
        const latency = performance.now() - start;
        // Diagnostics consent may have been revoked while Ollama responded.
        // Preserve neither a late sample nor an old session's measurements
        // after the user opts out, even if they opted back in meanwhile.
        if (config.performanceDiagnostics && readConfig().performanceDiagnostics &&
            recordingEpoch === this.latencyEpoch &&
            this.latencyWindow.record(latency)) {
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
        return [this.makeInlineItem(suggestion, position)];
      } catch (error: unknown) {
        if (timedOut && requestId === this.generation && !token.isCancellationRequested) {
          if (mayUseCurrentConfiguration()) this.transientFailures.recordFailure(failureProfile);
          if (activityEpoch === this.activityEpoch) this.metrics.failed++;
          this.onState("unavailable");
          return;
        }
        if (controller.signal.aborted || token.isCancellationRequested || requestId !== this.generation) {
          if (activityEpoch === this.activityEpoch) this.metrics.cancelled++;
          if (requestId === this.generation) this.onState("ready");
          return;
        }
        if (isTransientGenerationFailure(error) && mayUseCurrentConfiguration()) {
          this.transientFailures.recordFailure(failureProfile);
        }
        if (activityEpoch === this.activityEpoch) this.metrics.failed++;
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
      if (activityEpoch === this.activityEpoch) this.metrics.failed++;
      this.onState("error");
      return;
    }
  }
}
