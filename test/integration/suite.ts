import * as vscode from "vscode";
import * as assert from "node:assert/strict";
import * as http from "node:http";
import { generateCompletion, listModels, showModel } from "../../src/models/ollama";
import { CompletionEngine } from "../../src/completion/engine";
import { mayComplete } from "../../src/privacy/exclusions";


export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension("sanskarIN.lineloom");
  assert.ok(extension, "VS Code must discover LineLoom");
  await extension.activate();
  const required = [
    "lineloom.enable", "lineloom.disable", "lineloom.trigger",
    "lineloom.selectModel", "lineloom.manageLanguages", "lineloom.checkConnection", "lineloom.openSettings",
    "lineloom.diagnostics", "lineloom.setup", "lineloom.performance"
  ];
  const commands = await vscode.commands.getCommands(true);
  for (const name of required) assert.ok(commands.includes(name), "Missing command: " + name);
  const server = http.createServer(async (request, response) => {
    response.setHeader("Content-Type", "application/json");
    if (request.url === "/api/tags") {
      response.end(JSON.stringify({ models: [{ name: "lineloom-test:latest" }] }));
    } else if (request.url === "/api/show") {
      response.end(JSON.stringify({ details: { family: "test" } }));
    } else if (request.url === "/api/generate") {
      response.write(JSON.stringify({ response: "42", done: false }) + "\n");
      response.end(JSON.stringify({ done: true }) + "\n");
    } else {
      response.statusCode = 404;
      response.end("{}");
    }
  });
  try {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const info = server.address();
    assert.ok(info && typeof info !== "string");
    const endpoint = "http://127.0.0.1:" + info.port;
    assert.deepEqual((await listModels(endpoint)).map((m) => m.name), ["lineloom-test:latest"]);
    assert.equal(await showModel(endpoint, "lineloom-test:latest"), true);
    assert.equal(await generateCompletion(endpoint, {
      model: "lineloom-test:latest", prompt: "const answer = ",
      numPredict: 32, contextSize: 1024, temperature: 0, keepAlive: "1m"
    }, new AbortController().signal), "42");
    // Verify the actual inline provider in a real VS Code editor with a fake local Ollama server.
    const folder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(folder, "Expected a trusted test workspace");
    assert.ok(vscode.workspace.isTrusted, "Workspace trust is required for a completion test");
    // Nested ignore sources deny targets independently of their parent files.
    const deniedByApp = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(folder.uri, "src", "blocked.ts"));
    const deniedByGit = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(folder.uri, "src", "blocked-by-git.ts"));
    const permitted = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(folder.uri, "src", "allowed.ts"));
    assert.equal(await mayComplete(deniedByApp, []), false, "Nested .lineloomignore must deny blocked.ts");
    assert.equal(await mayComplete(deniedByGit, []), false, "Nested .gitignore must deny blocked-by-git.ts");
    assert.equal(await mayComplete(permitted, []), true, "Sibling source file should remain eligible");
    const configuration = vscode.workspace.getConfiguration("lineloom");
    const oldValues = {
      endpoint: configuration.get<string>("endpoint"),
      model: configuration.get<string>("model"),
      debounceMs: configuration.get<number>("debounceMs"),
      enabledLanguages: configuration.get<string[]>("enabledLanguages")
    };
    const engine = new CompletionEngine(() => undefined, () => false);
    try {
      await configuration.update("endpoint", endpoint, vscode.ConfigurationTarget.Global);
      await configuration.update("model", "lineloom-test:latest", vscode.ConfigurationTarget.Global);
      await configuration.update("debounceMs", 0, vscode.ConfigurationTarget.Global);
      await configuration.update("enabledLanguages", ["python", "javascript", "typescript", "rust", "kotlin", "go", "java", "c", "cpp"], vscode.ConfigurationTarget.Global);
      const file = vscode.Uri.joinPath(folder.uri, "editor-test.ts");
      const document = await vscode.workspace.openTextDocument(file);
      const editor = await vscode.window.showTextDocument(document);
      const position = document.positionAt(document.getText().length);
      editor.selection = new vscode.Selection(position, position);
      const cancellation = new vscode.CancellationTokenSource();
      try {
        const trigger = {
          triggerKind: vscode.InlineCompletionTriggerKind.Invoke,
          selectedCompletionInfo: undefined
        };
        const first = await engine.provideInlineCompletionItems(document, position, trigger, cancellation.token);
        assert.ok(first?.length, "Expected inline completion from the mocked model");
        assert.equal(first[0].insertText, "42");
        const second = await engine.provideInlineCompletionItems(document, position, trigger, cancellation.token);
        assert.ok(second?.length, "Expected reuse of the cached inline completion");
        assert.equal(second[0].insertText, "42");
        assert.equal(engine.getStats().cacheHits, 1, "Expected an exact suggestion cache hit");
        // Exercise preview language providers with actual VS Code file modes.
        for (const [filename, languageId] of [
          ["editor-test.go", "go"], ["editor-test.java", "java"],
          ["editor-test.c", "c"], ["editor-test.cpp", "cpp"]
        ] as const) {
          const previewDoc = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(folder.uri, filename));
          assert.equal(previewDoc.languageId, languageId, "Incorrect VS Code language mode: " + filename);
          const previewEditor = await vscode.window.showTextDocument(previewDoc);
          const previewPos = previewDoc.positionAt(previewDoc.getText().length);
          previewEditor.selection = new vscode.Selection(previewPos, previewPos);
          const suggested = await engine.provideInlineCompletionItems(previewDoc, previewPos, trigger, cancellation.token);
          assert.ok(suggested?.length, "Expected mocked provider suggestion in " + languageId);
        }
        const goDoc = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(folder.uri, "editor-test.go"));
        const goEditor = await vscode.window.showTextDocument(goDoc);
        const goPosition = goDoc.positionAt(goDoc.getText().length);
        goEditor.selection = new vscode.Selection(goPosition, goPosition);
        await configuration.update("enabledLanguages", ["typescript"], vscode.ConfigurationTarget.Global);
        const goDenied = await engine.provideInlineCompletionItems(goDoc, goPosition, trigger, cancellation.token);
        assert.equal(goDenied, undefined, "Disabled Go language must not request inference");
        await configuration.update("enabledLanguages", ["python", "javascript", "typescript", "rust", "kotlin", "go", "java", "c", "cpp"], vscode.ConfigurationTarget.Global);
        await vscode.window.showTextDocument(document);
        editor.selection = new vscode.Selection(position, position);
        // Repeated same-cursor notifications must not cancel or discard matching completions.
        engine.cancelIfEditorChanged(editor);
        assert.equal(engine.getStats().cacheHits, 1);
        const shifted = document.positionAt(document.getText().length - 1);
        editor.selection = new vscode.Selection(shifted, shifted);
        engine.cancelIfEditorChanged(editor);
        // Do not race the workbench's asynchronous selection notifications with a
        // second mocked completion. The cursor-change check above must invalidate
        // the request immediately; the .env test below still exercises new requests.
        const privateUri = vscode.Uri.joinPath(folder.uri, ".env");
        const privateDoc = await vscode.workspace.openTextDocument(privateUri);
        const privateEditor = await vscode.window.showTextDocument(privateDoc);
        const privateCursor = privateDoc.positionAt(privateDoc.getText().length);
        privateEditor.selection = new vscode.Selection(privateCursor, privateCursor);
        const blocked = await engine.provideInlineCompletionItems(privateDoc, privateCursor, trigger, cancellation.token);
        assert.equal(blocked, undefined, "Never provide inline completions from .env");
      } finally {
        cancellation.dispose();
      }
    } finally {
      engine.dispose();
      await configuration.update("endpoint", oldValues.endpoint, vscode.ConfigurationTarget.Global);
      await configuration.update("model", oldValues.model, vscode.ConfigurationTarget.Global);
      await configuration.update("debounceMs", oldValues.debounceMs, vscode.ConfigurationTarget.Global);
      await configuration.update("enabledLanguages", oldValues.enabledLanguages, vscode.ConfigurationTarget.Global);
    }
    await vscode.commands.executeCommand("lineloom.disable");
    assert.equal(vscode.workspace.getConfiguration("lineloom").get("enabled"), false);
    await vscode.commands.executeCommand("lineloom.enable");
    assert.equal(vscode.workspace.getConfiguration("lineloom").get("enabled"), true);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
