import * as vscode from "vscode";
import { LANGUAGES, getLanguage, isLanguageEnabled } from "./languages/registry";
import { normalizeLanguageModels, resolveLanguageModel } from "./settings/language-models";
import { CompletionEngine, type CompletionState } from "./completion/engine";
import { LineLoomStatus } from "./ui/status";
import { LineLoomSidebar } from "./ui/sidebar";
import { ModelReadinessSession } from "./ui/model-readiness";
import { FilePrivacySession } from "./ui/file-privacy-session";
import { quickActions } from "./ui/actions";
import { clearIgnoreCache, mayReadRelatedFile } from "./privacy/exclusions";
import { isSupportedRelatedCandidate } from "./context/related-editor";
import { hasBoundedRelatedMetadata, validateRelatedSelection } from "./context/related";
import { inspectFilePrivacy } from "./privacy/inspect";
import { getEligibilityTimingSummary, resetEligibilityTimings } from "./privacy/timings";
import { readConfig, validateEndpoint } from "./settings/config";
import { isEndpointSelectionCurrent } from "./settings/selection-state";
import { listModels, showModel } from "./models/ollama";
import { ollamaFailureMessage } from "./models/errors";

const SETTINGS_FILTER = "@ext:SanskarCodes.lineloom";
let engine: CompletionEngine | undefined;

async function approveEndpoint(context: vscode.ExtensionContext, ask: boolean): Promise<string | undefined> {
  const config = readConfig();
  let endpoint: ReturnType<typeof validateEndpoint>;
  try { endpoint = validateEndpoint(config.endpoint); }
  catch (error) {
    if (ask) await vscode.window.showErrorMessage(error instanceof Error ? error.message : "Invalid Ollama endpoint.");
    return;
  }
  if (!endpoint.remote) return endpoint.origin;
  if (!config.allowRemoteEndpoints) {
    if (ask) vscode.window.showWarningMessage("Remote inference is disabled. Enable lineloom.allowRemoteEndpoints before proceeding.");
    return;
  }
  if (context.globalState.get<string>("approvedRemoteOrigin") === endpoint.origin) return endpoint.origin;
  if (!ask) return;
  const action = "Approve this HTTPS endpoint";
  const selected = await vscode.window.showWarningMessage(
    "LineLoom will send code near your cursor to " + endpoint.origin + ". Confirm only if you trust the server.",
    { modal: true }, action
  );
  if (selected !== action) return;
  const latest = readConfig();
  // Never approve an origin from an obsolete prompt if the user changed
  // the configured endpoint or disabled remote inference meanwhile.
  try {
    const current = validateEndpoint(latest.endpoint);
    if (current.origin !== endpoint.origin || !latest.allowRemoteEndpoints) return;
  } catch { return; }
  await context.globalState.update("approvedRemoteOrigin", endpoint.origin);
  return endpoint.origin;
}
function selectionOriginCurrent(context: vscode.ExtensionContext, origin: string): boolean {
  const latest = readConfig();
  return isEndpointSelectionCurrent(origin, latest.endpoint, latest.allowRemoteEndpoints,
    (target) => context.globalState.get<string>("approvedRemoteOrigin") === target);
}
async function checkConnection(
  context: vscode.ExtensionContext,
  readiness: ModelReadinessSession,
  refresh: () => void
): Promise<void> {
  // Only this command and the explicitly clicked Setup Guide action can
  // contact /api/tags. The native sidebar merely renders the session result.
  const token = readiness.begin();
  refresh();
  const origin = await approveEndpoint(context, true);
  if (!readiness.isCurrent(token)) return;
  if (!origin) {
    readiness.finish(token, "not-checked");
    refresh();
    return;
  }
  const selected = readConfig().model;
  const isValid = (): boolean => readiness.isCurrent(token) &&
    selectionOriginCurrent(context, origin) && readConfig().model === selected;
  try {
    const models = await listModels(origin);
    if (!isValid()) {
      if (readiness.isCurrent(token)) { readiness.clear(); refresh(); }
      return;
    }
    const present = models.some((model) => model.name === selected);
    readiness.finish(token, present ? "available" : "missing");
    refresh();
    vscode.window.showInformationMessage(
      "LineLoom: Ollama reachable; " + models.length + " installed model(s). " +
      (present ? "Selected model is available at this check." : "Selected model is not installed. Use LineLoom: Select Model.")
    );
  } catch (error) {
    if (!isValid()) {
      if (readiness.isCurrent(token)) { readiness.clear(); refresh(); }
      return;
    }
    readiness.finish(token, "unreachable");
    refresh();
    vscode.window.showWarningMessage("LineLoom: " + ollamaFailureMessage(error));
  }
}
/**
 * Inspect the actual effective (potentially language-overridden) model,
 * exclusively after the user invokes the command. No source/path is read;
 * /api/tags is called only after the existing endpoint approval boundary.
 */
async function checkActiveModel(
  context: vscode.ExtensionContext, readiness: ModelReadinessSession, refresh: () => void
): Promise<void> {
  const token = readiness.begin();
  refresh();
  const editor = vscode.window.activeTextEditor;
  const document = editor?.document;
  const language = document && getLanguage(document.languageId);
  const config = readConfig();
  if (!document || !language || document.uri.scheme !== "file" ||
      !vscode.workspace.isTrusted || !config.enabled ||
      !isLanguageEnabled(language, config.enabledLanguages)) {
    readiness.finish(token, "not-checked");
    refresh();
    void vscode.window.showInformationMessage(
      "LineLoom: Open a supported, enabled local code file in a trusted workspace first."
    );
    return;
  }
  const selected = resolveLanguageModel(config.model, language.id, config.languageModels);
  if (!selected) {
    readiness.finish(token, "not-checked");
    refresh();
    void vscode.window.showInformationMessage("LineLoom: Configure a model before checking.");
    return;
  }
  const origin = await approveEndpoint(context, true);
  if (!readiness.isCurrent(token)) return;
  if (!origin) { readiness.finish(token, "not-checked"); refresh(); return; }
  const isCurrent = (): boolean => readiness.isCurrent(token) &&
    vscode.window.activeTextEditor?.document === document &&
    !document.isClosed && vscode.workspace.isTrusted &&
    selectionOriginCurrent(context, origin) &&
    (() => {
      const latest = readConfig();
      const currentLanguage = getLanguage(document.languageId);
      return latest.enabled && currentLanguage?.id === language.id &&
        isLanguageEnabled(language, latest.enabledLanguages) &&
        resolveLanguageModel(latest.model, language.id, latest.languageModels) === selected;
    })();
  try {
    const models = await listModels(origin);
    if (!isCurrent()) {
      if (readiness.isCurrent(token)) { readiness.clear(); refresh(); }
      return;
    }
    const present = models.some(model => model.name === selected);
    readiness.finish(token, present ? "available" : "missing");
    refresh();
    void vscode.window.showInformationMessage(present
      ? "LineLoom: Active editor model found at this manual check (not a generation test)."
      : "LineLoom: Active editor model not installed on the approved Ollama endpoint.");
  } catch (error) {
    if (!isCurrent()) {
      if (readiness.isCurrent(token)) { readiness.clear(); refresh(); }
      return;
    }
    readiness.finish(token, "unreachable");
    refresh();
    void vscode.window.showWarningMessage("LineLoom: " + ollamaFailureMessage(error));
  }
}

async function selectModel(context: vscode.ExtensionContext): Promise<void> {
  const origin = await approveEndpoint(context, true);
  if (!origin) return;
  try {
    const models = await listModels(origin);
    if (!selectionOriginCurrent(context, origin)) return;
    if (models.length === 0) {
      vscode.window.showInformationMessage("No models installed. Run: ollama pull qwen2.5-coder:1.5b");
      return;
    }
    const picked = await vscode.window.showQuickPick(
      models.map((model) => ({ label: model.name, description: "Installed locally or on configured host" })),
      { placeHolder: "Choose an installed Ollama model" }
    );
    if (!picked) return;
    if (!selectionOriginCurrent(context, origin)) return;
    if (!await showModel(origin, picked.label)) throw new Error("Model no longer installed.");
    if (!selectionOriginCurrent(context, origin)) return;
    await vscode.workspace.getConfiguration("lineloom").update("model", picked.label, vscode.ConfigurationTarget.Global);
    engine?.cancel();
    vscode.window.showInformationMessage("LineLoom model selected: " + picked.label);
  } catch (error) {
    vscode.window.showWarningMessage("LineLoom: " + ollamaFailureMessage(error));
  }
}
async function selectLanguageModel(context: vscode.ExtensionContext): Promise<void> {
  // This is user initiated; remote model discovery keeps the same explicit
  // HTTPS-origin approval boundary as the ordinary Select Model command.
  const origin = await approveEndpoint(context, true);
  if (!origin) return;
  try {
    const models = await listModels(origin);
    if (!selectionOriginCurrent(context, origin)) return;
    if (!models.length) {
      vscode.window.showInformationMessage("No Ollama models installed on the configured endpoint.");
      return;
    }
    const configuration = readConfig();
    const language = await vscode.window.showQuickPick(
      LANGUAGES.map((item) => ({
        label: item.label, description: item.id,
        detail: "Current: " + (configuration.languageModels[item.id] || "Default (" + configuration.model + ")"),
        languageId: item.id
      })),
      { placeHolder: "Choose the language to assign an Ollama model" }
    );
    if (!language) return;
    const choices = [
      { label: "$(discard) Use Default Model", description: configuration.model, model: "" },
      ...models.map((model) => ({ label: model.name, description: "Installed on the approved endpoint", model: model.name }))
    ];
    const selected = await vscode.window.showQuickPick(choices, {
      placeHolder: "Assign an installed model for " + language.label + " or use the default"
    });
    if (!selected || !selectionOriginCurrent(context, origin)) return;
    if (selected.model && !await showModel(origin, selected.model)) {
      throw new Error("Selected model is no longer available.");
    }
    if (!selectionOriginCurrent(context, origin)) return;
    // Keep the global default intact; only the selected language is changed.
    const updated = normalizeLanguageModels(
      vscode.workspace.getConfiguration("lineloom").get<unknown>("languageModels")
    );
    if (selected.model) updated[language.languageId] = selected.model;
    else delete updated[language.languageId];
    await vscode.workspace.getConfiguration("lineloom").update(
      "languageModels", updated, vscode.ConfigurationTarget.Global
    );
    engine?.cancel();
    vscode.window.showInformationMessage(
      "LineLoom " + language.label + ": " + (selected.model || "default model") + "."
    );
  } catch (error) {
    vscode.window.showWarningMessage("LineLoom: " + ollamaFailureMessage(error));
  }
}

/**
 * Inspect the current editor's existing path and ignore policies on demand.
 * This never constructs prompts, sends requests, logs files or changes settings.
 */
async function checkActiveFilePrivacy(
  privacy: FilePrivacySession, refresh: () => void
): Promise<void> {
  // Called only from an explicit command; the sidebar itself never touches
  // active-document paths or invokes the filesystem privacy checker.
  const token = privacy.begin();
  refresh();
  const document = vscode.window.activeTextEditor?.document;
  const version = document?.version;
  const config = readConfig();
  const patternSnapshot = JSON.stringify(config.excludedPaths);
  const trustSnapshot = vscode.workspace.isTrusted;
  const isCurrent = (): boolean =>
    Boolean(privacy.isCurrent(token) && document && !document.isClosed &&
      vscode.workspace.isTrusted === trustSnapshot &&
      vscode.window.activeTextEditor?.document === document &&
      document.version === version &&
      JSON.stringify(readConfig().excludedPaths) === patternSnapshot);
  try {
    const result = await inspectFilePrivacy(document, config.excludedPaths, isCurrent);
    // An older check can never restore a success badge after an editor,
    // document, trust or policy change (or after a newer check has begun).
    if (!privacy.isCurrent(token)) return;
    if (result === "stale" || (result !== "no-editor" && !isCurrent())) {
      privacy.clear();
      refresh();
      void vscode.window.showWarningMessage(
        "LineLoom: Editor or privacy settings changed during the check. Run it again."
      );
      return;
    }
    if (!privacy.finish(token, result)) return;
    refresh();
    switch (result) {
      case "no-editor":
        void vscode.window.showInformationMessage(
          "LineLoom: Open a local file to check its privacy exclusions."
        );
        return;
      case "blocked":
        void vscode.window.showWarningMessage(
          "LineLoom: This file is excluded or inaccessible under current path and ignore policies. No inference request was made."
        );
        return;
      case "allowed":
        void vscode.window.showInformationMessage(
          "LineLoom: File passes current path and ignore checks. Model, language and endpoint readiness are checked separately. No inference request was made."
        );
        return;
    }
  } catch {
    // A failed inspection must not leave a reassuring "allowed" status or
    // include underlying filesystem paths in user-visible diagnostics.
    if (!privacy.isCurrent(token)) return;
    privacy.clear();
    refresh();
    void vscode.window.showWarningMessage(
      "LineLoom: File privacy inspection could not finish. No inference request was made."
    );
  }
}

async function setupGuide(
  context: vscode.ExtensionContext, readiness: ModelReadinessSession, refresh: () => void
): Promise<void> {
  const action = await vscode.window.showInformationMessage(
    "Welcome to LineLoom. Install and start Ollama, run 'ollama pull qwen2.5-coder:1.5b', then check your connection.",
    "Check Connection", "Select Model", "Open Settings", "Ollama Website"
  );
  switch (action) {
    case "Check Connection": await checkConnection(context, readiness, refresh); break;
    case "Select Model": await selectModel(context); break;
    case "Open Settings": await vscode.commands.executeCommand("workbench.action.openSettings", SETTINGS_FILTER); break;
    case "Ollama Website": await vscode.env.openExternal(vscode.Uri.parse("https://ollama.com/download")); break;
  }
}
async function openQuickActions(): Promise<void> {
  const config = readConfig();
  const choice = await vscode.window.showQuickPick(
    quickActions(config.enabled, config.autoTrigger, config.performanceDiagnostics,
      config.crossFileContext, engine?.getRelatedFileCount() ?? 0).map((action) => ({
      label: action.label, description: action.description, command: action.command
    })),
    { placeHolder: "LineLoom Quick Actions — choose an action" }
  );
  if (!choice) return;
  // The action is always chosen from a fixed internal allowlist of commands.
  await vscode.commands.executeCommand(choice.command);
}

async function manageLanguages(): Promise<void> {
  const allowed = new Set(readConfig().enabledLanguages);
  const selected = await vscode.window.showQuickPick(
    LANGUAGES.map((language) => ({
      label: language.label,
      description: language.id,
      picked: allowed.has(language.id)
    })),
    { canPickMany: true, placeHolder: "Select languages for LineLoom autocomplete (none disables all)" }
  );
  if (!selected) return;
  const chosen = selected.map((item) => item.description);
  await vscode.workspace.getConfiguration("lineloom").update("enabledLanguages", chosen, vscode.ConfigurationTarget.Global);
  vscode.window.showInformationMessage("LineLoom autocomplete enabled for " +
    (chosen.length ? chosen.length + " language(s)." : "no languages."));
}

function showDiagnostics(output: vscode.OutputChannel, context: vscode.ExtensionContext): void {
  output.clear();
  const config = readConfig();
  let location = "invalid endpoint";
  try { const u = validateEndpoint(config.endpoint); location = u.remote ? "remote HTTPS (approved: " + String(context.globalState.get("approvedRemoteOrigin") === u.origin) + ")" : "loopback"; } catch { /* no sensitive URL written */ }
  const stats = engine?.getStats();
  output.appendLine("LineLoom diagnostics — no source code, prompts, response bodies or secrets recorded");
  output.appendLine("VS Code: " + vscode.version);
  output.appendLine("Workspace trusted: " + vscode.workspace.isTrusted);
  output.appendLine("Inference location: " + location);
  output.appendLine("Model: " + config.model);
  output.appendLine("Language model overrides: " + Object.keys(config.languageModels).length + " configured (inspect VS Code settings to review model tags)");
  output.appendLine("Enabled: " + config.enabled + "; automatic: " + config.autoTrigger);
  output.appendLine("Cross-file context: " + (config.crossFileContext ? "opt-in enabled" : "off") +
    "; explicitly selected related files: " + (engine?.getRelatedFileCount() ?? 0) + " (session only)");
  output.appendLine("Registered languages: " + LANGUAGES.map((lang) => lang.label).join(", "));
  output.appendLine("Enabled language IDs: " + config.enabledLanguages.join(", "));
  output.appendLine("Requests: " + (stats?.requests ?? 0) + "; completions: " + (stats?.completions ?? 0) +
    "; cancelled: " + (stats?.cancelled ?? 0) + "; failed: " + (stats?.failed ?? 0) +
    "; empty responses: " + (stats?.emptySuggestions ?? 0) +
    "; suppressed empty retries: " + (stats?.suppressedEmptyRetries ?? 0) +
    "; typed continuation reuses: " + (stats?.continuationHits ?? 0));
  if (config.performanceDiagnostics && stats) {
    output.appendLine("Last duration: " + stats.lastLatencyMs.toFixed(0) + "ms");
    output.appendLine("Average duration: " + (stats.measuredRequests ? stats.totalLatencyMs / stats.measuredRequests : 0).toFixed(0) + "ms (completed measured requests only)");
    const eligibility = getEligibilityTimingSummary();
    output.appendLine("Privacy eligibility checks: " + eligibility.checks +
      "; allowed: " + eligibility.allowed + "; denied: " + eligibility.denied);
    output.appendLine("Privacy check latency (ms): last " + eligibility.lastMs.toFixed(1) +
      "; average " + eligibility.averageMs.toFixed(1) +
      "; recent p95 " + eligibility.p95Ms.toFixed(1) +
      " (" + eligibility.samples + " recent samples); session max " + eligibility.maxMs.toFixed(1));
  }
  output.show(true);
}
export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("LineLoom Diagnostics");
  const status = new LineLoomStatus();
  let currentState: CompletionState = "ready";
  // Invalidate overlapping pickers when privacy, settings or editor state changes.
  let relatedPickerRevision = 0;
  const modelReadiness = new ModelReadinessSession();
  const activeModelReadiness = new ModelReadinessSession();
  const filePrivacy = new FilePrivacySession();
  const sidebar = new LineLoomSidebar(
    () => engine?.getStats(),
    (endpoint) => context.globalState.get<string>("approvedRemoteOrigin") === endpoint,
    () => currentState,
    () => engine?.getRelatedFileCount() ?? 0,
    () => modelReadiness.state,
    () => filePrivacy.state,
    () => activeModelReadiness.state
  );
  engine = new CompletionEngine(
    (state) => {
      currentState = state;
      status.set(state, readConfig().autoTrigger);
      sidebar.refresh();
    },
    (endpoint) => context.globalState.get<string>("approvedRemoteOrigin") === endpoint
  );
  context.subscriptions.push(output, status, sidebar, engine);
  context.subscriptions.push(vscode.window.registerTreeDataProvider("lineloom.dashboard", sidebar));
  const selectors: vscode.DocumentSelector = [...LANGUAGES.map((language) => ({ language: language.id, scheme: "file" })), { language: "javascriptreact", scheme: "file" }, { language: "typescriptreact", scheme: "file" }];
  context.subscriptions.push(vscode.languages.registerInlineCompletionItemProvider(selectors, engine));
  function command(id: string, fn: () => unknown): void {
    context.subscriptions.push(vscode.commands.registerCommand(id, fn));
  }
  command("lineloom.enable", async () => {
    await vscode.workspace.getConfiguration("lineloom").update("enabled", true, vscode.ConfigurationTarget.Global);
    status.set("ready", readConfig().autoTrigger);
  });
  command("lineloom.disable", async () => {
    await vscode.workspace.getConfiguration("lineloom").update("enabled", false, vscode.ConfigurationTarget.Global);
    engine?.cancel();
    status.set("disabled");
  });
  command("lineloom.trigger", () => vscode.commands.executeCommand("editor.action.inlineSuggest.trigger"));
  // Invalidate the current generation ID and abort any pending HTTP stream.
  // This also cancels a queued/debounced request before it can send source.
  // Unlike Disable or Pause, subsequent completions are still permitted.
  command("lineloom.cancel", () => {
    engine?.cancel();
    currentState = readConfig().enabled ? "ready" : "disabled";
    status.set(currentState, readConfig().autoTrigger);
    sidebar.refresh();
  });
  command("lineloom.quickActions", () => openQuickActions());
  command("lineloom.refreshSidebar", () => sidebar.refresh());
  command("lineloom.openSidebar", () => vscode.commands.executeCommand("workbench.view.extension.lineloom"));
  command("lineloom.toggleAutomatic", async () => {
    const config = readConfig();
    await vscode.workspace.getConfiguration("lineloom").update(
      "autoTrigger", !config.autoTrigger, vscode.ConfigurationTarget.Global
    );
  });
  command("lineloom.selectModel", () => selectModel(context));
  command("lineloom.selectLanguageModel", () => selectLanguageModel(context));
  command("lineloom.manageLanguages", () => manageLanguages());
  command("lineloom.checkConnection", () => checkConnection(context, modelReadiness, () => sidebar.refresh()));
  command("lineloom.checkActiveModel", () => checkActiveModel(context, activeModelReadiness, () => sidebar.refresh()));
  command("lineloom.checkActiveFilePrivacy", () => checkActiveFilePrivacy(filePrivacy, () => sidebar.refresh()));
  command("lineloom.clearRelatedFiles", () => {
    relatedPickerRevision++;
    engine?.setRelatedFiles([]);
    sidebar.refresh();
    vscode.window.showInformationMessage("LineLoom: session-only related file selection cleared.");
  });
  command("lineloom.selectRelatedFiles", async () => {
    const revision = ++relatedPickerRevision;
    const config = readConfig();
    const configurationSnapshot = JSON.stringify(config);
    const editor = vscode.window.activeTextEditor;
    if (!config.crossFileContext) {
      vscode.window.showWarningMessage("Enable lineloom.crossFileContext in Settings before choosing related files.");
      return;
    }
    if (!editor || editor.document.uri.scheme !== "file" || !vscode.workspace.isTrusted) return;
    const document = editor.document;
    const version = document.version;
    const folder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!folder) return;
    const isCurrent = (): boolean => revision === relatedPickerRevision &&
      vscode.workspace.isTrusted && !document.isClosed && document.version === version &&
      vscode.window.activeTextEditor?.document === document &&
      JSON.stringify(readConfig()) === configurationSnapshot;
    const chosen = await vscode.window.showOpenDialog({
      canSelectMany: true, canSelectFiles: true, canSelectFolders: false, defaultUri: folder.uri,
      openLabel: "Select related source files"
    });
    if (!chosen || !isCurrent()) return;
    if (!validateRelatedSelection(document.uri.toString(), chosen.map(uri => uri.toString())) ||
        !chosen.every(uri => isSupportedRelatedCandidate(document.uri, uri))) {
      vscode.window.showWarningMessage(
        "Choose one or two distinct supported source files inside the active workspace folder, not the active file.");
      return;
    }
    // No related-file content is read until the user accepts this disclosure.
    const agreed = await vscode.window.showWarningMessage(
      "LineLoom may include up to 2 KiB from each chosen file in completion prompts. " +
      "A separately approved remote Ollama endpoint could receive these snippets. " +
      "Selections stay in memory only for this editor session.",
      { modal: true }, "Use Selected Files"
    );
    if (agreed !== "Use Selected Files" || !isCurrent()) return;
    // Preflight metadata/ignore checks without reading any chosen source.
    // The engine rechecks all permissions before inference and after response.
    for (const uri of chosen) {
      if (!isCurrent()) return;
      if (!await mayReadRelatedFile(uri, config.excludedPaths) ||
          !await hasBoundedRelatedMetadata(uri.fsPath)) {
        if (isCurrent()) vscode.window.showWarningMessage(
          "LineLoom refused a selected file: it is excluded, unreadable, linked or outside the 2 KiB limit.");
        return;
      }
    }
    if (!isCurrent()) return;
    engine?.setRelatedFiles(chosen);
    sidebar.refresh();
    vscode.window.showInformationMessage("LineLoom: selected " + chosen.length +
      " related file(s). Privacy rules are rechecked before every model request.");
  });
  command("lineloom.openSettings", () => vscode.commands.executeCommand("workbench.action.openSettings", SETTINGS_FILTER));
  command("lineloom.diagnostics", () => showDiagnostics(output, context));
  // Privacy eligibility measurements are in memory only. Permit an immediate
  // user-initiated reset without changing the diagnostics opt-in preference.
  command("lineloom.resetPrivacyTimings", () => {
    resetEligibilityTimings();
    sidebar.refresh();
    vscode.window.showInformationMessage("LineLoom privacy eligibility timing counters cleared for this session.");
  });
  command("lineloom.setup", () => setupGuide(context, modelReadiness, () => sidebar.refresh()));
  command("lineloom.performance", () => {
    const stats = engine?.getStats();
    if (!stats) return;
    vscode.window.showInformationMessage("LineLoom: " + stats.requests + " requests, " +
      stats.completions + " nonempty suggestions, " + stats.cancelled + " cancelled, " + stats.failed + " failed.");
  });
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration("lineloom")) {
      modelReadiness.clear();
      activeModelReadiness.clear();
      filePrivacy.clear();
      activeModelReadiness.clear();
      relatedPickerRevision++;
      // Requiring a fresh selection after any configuration change prevents
      // old consent being reused with new endpoint or exclusion settings.
      engine?.setRelatedFiles([]);
      clearIgnoreCache();
      const config = readConfig();
      if (!config.performanceDiagnostics) {
        resetEligibilityTimings();
        engine?.clearLatencyMeasurements();
      }
      currentState = config.enabled ? "ready" : "disabled";
      status.set(currentState, config.autoTrigger);
      sidebar.refresh();
    }
  }));
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      filePrivacy.clear();
      relatedPickerRevision++;
      engine?.setRelatedFiles([]);
      engine?.cancelIfEditorChanged(editor);
      sidebar.refresh();
    }),
    vscode.window.onDidChangeTextEditorSelection((event) => {
      if (event.textEditor === vscode.window.activeTextEditor) engine?.cancelIfEditorChanged(event.textEditor);
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document === vscode.window.activeTextEditor?.document) {
        filePrivacy.clear();
        activeModelReadiness.clear();
        sidebar.refresh();
      }
      engine?.onDocumentChanged(event);
    }),
    vscode.workspace.onDidCloseTextDocument(() => {
      filePrivacy.clear();
      engine?.cancelIfEditorChanged(vscode.window.activeTextEditor);
      sidebar.refresh();
    })
  );
  context.subscriptions.push(vscode.workspace.onDidGrantWorkspaceTrust(() => {
    modelReadiness.clear();
    activeModelReadiness.clear();
    filePrivacy.clear();
    relatedPickerRevision++;
    clearIgnoreCache();
    sidebar.refresh();
  }));
  // Ignore-file edits are a live privacy policy change. Invalidate both
  // async rule scans and any queued/in-flight generation, so suggestions
  // authorized under the old policy cannot be surfaced after the change.
  const onIgnoreRulesChanged = (): void => {
    filePrivacy.clear();
    relatedPickerRevision++;
    clearIgnoreCache();
    engine?.setRelatedFiles([]);
    const latest = readConfig();
    currentState = latest.enabled ? "ready" : "disabled";
    status.set(currentState, latest.autoTrigger);
    sidebar.refresh();
  };
  for (const pattern of ["**/.gitignore", "**/.lineloomignore"]) {
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    context.subscriptions.push(
      watcher, watcher.onDidChange(onIgnoreRulesChanged),
      watcher.onDidCreate(onIgnoreRulesChanged), watcher.onDidDelete(onIgnoreRulesChanged)
    );
  }
  const current = readConfig();
  currentState = current.enabled ? "ready" : "disabled";
  status.set(currentState, current.autoTrigger);
  // The first-run message is intentionally user-initiated: no unsolicited onboarding modal.
}
export function deactivate(): void { engine?.cancel(); engine = undefined; }
