import * as vscode from "vscode";
import { LANGUAGES } from "./languages/registry";
import { CompletionEngine } from "./completion/engine";
import { LineLoomStatus } from "./ui/status";
import { clearIgnoreCache } from "./privacy/exclusions";
import { readConfig, validateEndpoint } from "./settings/config";
import { listModels, showModel } from "./models/ollama";

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
  await context.globalState.update("approvedRemoteOrigin", endpoint.origin);
  return endpoint.origin;
}
async function checkConnection(context: vscode.ExtensionContext): Promise<void> {
  const origin = await approveEndpoint(context, true);
  if (!origin) return;
  try {
    const models = await listModels(origin);
    const selected = readConfig().model;
    const present = models.some((model) => model.name === selected);
    vscode.window.showInformationMessage(
      "LineLoom: Ollama reachable; " + models.length + " installed model(s). " +
      (present ? "Selected model is available." : "Selected model is not installed. Use LineLoom: Select Model.")
    );
  } catch {
    vscode.window.showWarningMessage("LineLoom cannot connect to Ollama. Ensure the server is running and the endpoint is correct.");
  }
}
async function selectModel(context: vscode.ExtensionContext): Promise<void> {
  const origin = await approveEndpoint(context, true);
  if (!origin) return;
  try {
    const models = await listModels(origin);
    if (models.length === 0) {
      vscode.window.showInformationMessage("No models installed. Run: ollama pull qwen2.5-coder:1.5b");
      return;
    }
    const picked = await vscode.window.showQuickPick(
      models.map((model) => ({ label: model.name, description: "Installed locally or on configured host" })),
      { placeHolder: "Choose an installed Ollama model" }
    );
    if (!picked) return;
    if (!await showModel(origin, picked.label)) throw new Error("Model no longer installed.");
    await vscode.workspace.getConfiguration("lineloom").update("model", picked.label, vscode.ConfigurationTarget.Global);
    engine?.cancel();
    vscode.window.showInformationMessage("LineLoom model selected: " + picked.label);
  } catch {
    vscode.window.showWarningMessage("Could not retrieve installed Ollama models. Check your inference endpoint.");
  }
}
async function setupGuide(context: vscode.ExtensionContext): Promise<void> {
  const action = await vscode.window.showInformationMessage(
    "Welcome to LineLoom. Install and start Ollama, run 'ollama pull qwen2.5-coder:1.5b', then check your connection.",
    "Check Connection", "Select Model", "Open Settings", "Ollama Website"
  );
  switch (action) {
    case "Check Connection": await checkConnection(context); break;
    case "Select Model": await selectModel(context); break;
    case "Open Settings": await vscode.commands.executeCommand("workbench.action.openSettings", "@ext:sanskarIN.lineloom"); break;
    case "Ollama Website": await vscode.env.openExternal(vscode.Uri.parse("https://ollama.com/download")); break;
  }
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
  output.appendLine("Enabled: " + config.enabled + "; automatic: " + config.autoTrigger);
  output.appendLine("Cross-file context: not implemented (no cross-file reads)");
  output.appendLine("Supported languages: " + LANGUAGES.map((lang) => lang.label).join(", "));
  output.appendLine("Requests: " + (stats?.requests ?? 0) + "; completions: " + (stats?.completions ?? 0) +
    "; cancelled: " + (stats?.cancelled ?? 0) + "; failed: " + (stats?.failed ?? 0));
  if (config.performanceDiagnostics && stats) {
    output.appendLine("Last duration: " + stats.lastLatencyMs.toFixed(0) + "ms");
    output.appendLine("Average duration: " + (stats.measuredRequests ? stats.totalLatencyMs / stats.measuredRequests : 0).toFixed(0) + "ms (completed measured requests only)");
  }
  output.show(true);
}
export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("LineLoom Diagnostics");
  const status = new LineLoomStatus();
  engine = new CompletionEngine(
    (state) => status.set(state),
    (endpoint) => context.globalState.get<string>("approvedRemoteOrigin") === endpoint
  );
  context.subscriptions.push(output, status, engine);
  const selectors: vscode.DocumentSelector = [...LANGUAGES.map((language) => ({ language: language.id, scheme: "file" })), { language: "javascriptreact", scheme: "file" }, { language: "typescriptreact", scheme: "file" }];
  context.subscriptions.push(vscode.languages.registerInlineCompletionItemProvider(selectors, engine));
  function command(id: string, fn: () => unknown): void {
    context.subscriptions.push(vscode.commands.registerCommand(id, fn));
  }
  command("lineloom.enable", async () => {
    await vscode.workspace.getConfiguration("lineloom").update("enabled", true, vscode.ConfigurationTarget.Global);
    status.set("ready");
  });
  command("lineloom.disable", async () => {
    await vscode.workspace.getConfiguration("lineloom").update("enabled", false, vscode.ConfigurationTarget.Global);
    engine?.cancel();
    status.set("disabled");
  });
  command("lineloom.trigger", () => vscode.commands.executeCommand("editor.action.inlineSuggest.trigger"));
  command("lineloom.selectModel", () => selectModel(context));
  command("lineloom.checkConnection", () => checkConnection(context));
  command("lineloom.openSettings", () => vscode.commands.executeCommand("workbench.action.openSettings", "@ext:sanskarIN.lineloom"));
  command("lineloom.diagnostics", () => showDiagnostics(output, context));
  command("lineloom.setup", () => setupGuide(context));
  command("lineloom.performance", () => {
    const stats = engine?.getStats();
    if (!stats) return;
    vscode.window.showInformationMessage("LineLoom: " + stats.requests + " requests, " +
      stats.completions + " nonempty suggestions, " + stats.cancelled + " cancelled, " + stats.failed + " failed.");
  });
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration("lineloom")) {
      engine?.cancel();
      clearIgnoreCache();
      status.set(readConfig().enabled ? "ready" : "disabled");
    }
  }));
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => engine?.cancelIfEditorChanged(editor)),
    vscode.window.onDidChangeTextEditorSelection((event) => {
      if (event.textEditor === vscode.window.activeTextEditor) engine?.cancelIfEditorChanged(event.textEditor);
    }),
    vscode.workspace.onDidChangeTextDocument(() => engine?.cancelIfEditorChanged(vscode.window.activeTextEditor)),
    vscode.workspace.onDidCloseTextDocument(() => engine?.cancelIfEditorChanged(vscode.window.activeTextEditor))
  );
  context.subscriptions.push(vscode.workspace.onDidGrantWorkspaceTrust(() => clearIgnoreCache()));
  for (const pattern of ["**/.gitignore", "**/.lineloomignore"]) {
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    context.subscriptions.push(
      watcher, watcher.onDidChange(clearIgnoreCache),
      watcher.onDidCreate(clearIgnoreCache), watcher.onDidDelete(clearIgnoreCache)
    );
  }
  status.set(readConfig().enabled ? "ready" : "disabled");
  // The first-run message is intentionally user-initiated: no unsolicited onboarding modal.
}
export function deactivate(): void { engine?.cancel(); engine = undefined; }
