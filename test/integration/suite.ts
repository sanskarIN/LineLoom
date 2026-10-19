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
    "lineloom.diagnostics", "lineloom.setup", "lineloom.performance",
    "lineloom.quickActions", "lineloom.toggleAutomatic"
  ];
  const commands = await vscode.commands.getCommands(true);
  for (const name of required) assert.ok(commands.includes(name), "Missing command: " + name);
  let mockEmptyResponses = false;
  let generationCalls = 0;
  const server = http.createServer(async (request, response) => {
    response.setHeader("Content-Type", "application/json");
    if (request.url === "/api/tags") {
      response.end(JSON.stringify({ models: [{ name: "lineloom-test:latest" }] }));
    } else if (request.url === "/api/show") {
      response.end(JSON.stringify({ details: { family: "test" } }));
    } else if (request.url === "/api/generate") {
      generationCalls++;
      if (mockEmptyResponses) {
        response.end(JSON.stringify({ done: true }) + "\n");
      } else {
        response.write(JSON.stringify({ response: "42", done: false }) + "\n");
        response.end(JSON.stringify({ done: true }) + "\n");
      }
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
      autoTrigger: configuration.get<boolean>("autoTrigger"),
      suppressMidTokenAuto: configuration.get<boolean>("suppressMidTokenAuto"),
      enabledLanguages: configuration.get<string[]>("enabledLanguages")
    };
    const engine = new CompletionEngine(() => undefined, () => false);
    // Subscribe to VS Code's genuine change events, matching production wiring.
    // Test-only diagnostics record edit SHAPES, never the source or edit text.
    const observedShapes: Array<{ version: number; changes: Array<{ offset: number; replaced: number; length: number; matching: boolean }> }> = [];
    const editSubscription = vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.path.endsWith("/editor-test.ts")) {
        observedShapes.push({
          version: event.document.version,
          changes: event.contentChanges.map((change) => ({
            offset: change.rangeOffset, replaced: change.rangeLength,
            length: change.text.length, matching: "42".startsWith(change.text)
          }))
        });
      }
      engine.onDocumentChanged(event);
    });
    try {
      await configuration.update("endpoint", endpoint, vscode.ConfigurationTarget.Global);
      await configuration.update("model", "lineloom-test:latest", vscode.ConfigurationTarget.Global);
      await configuration.update("debounceMs", 0, vscode.ConfigurationTarget.Global);
      await configuration.update("autoTrigger", true, vscode.ConfigurationTarget.Global);
      await configuration.update("suppressMidTokenAuto", true, vscode.ConfigurationTarget.Global);
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
        await vscode.commands.executeCommand("lineloom.toggleAutomatic");
        assert.equal(vscode.workspace.getConfiguration("lineloom").get("autoTrigger"), false, "Pause command must disable automatic triggering");
        const requestsWhilePaused = engine.getStats().requests;
        const paused = await engine.provideInlineCompletionItems(document, position, {
          triggerKind: vscode.InlineCompletionTriggerKind.Automatic,
          selectedCompletionInfo: undefined
        }, cancellation.token);
        assert.equal(paused, undefined, "Automatic suggestions should be paused");
        assert.equal(engine.getStats().requests, requestsWhilePaused, "Paused automatic request must not call Ollama");
        const manualWhilePaused = await engine.provideInlineCompletionItems(document, position, trigger, cancellation.token);
        assert.ok(manualWhilePaused?.length, "Manual completion should work while automatic suggestions are paused");
        await vscode.commands.executeCommand("lineloom.toggleAutomatic");
        assert.equal(vscode.workspace.getConfiguration("lineloom").get("autoTrigger"), true, "Resume command must restore automatic triggering");

        // Empty responses should back off only for identical automatic requests.
        // Manual retries must still be permitted without moving the cursor.
        await configuration.update("model", "lineloom-empty:latest", vscode.ConfigurationTarget.Global);
        mockEmptyResponses = true;
        const automatic = {
          triggerKind: vscode.InlineCompletionTriggerKind.Automatic,
          selectedCompletionInfo: undefined
        };
        const firstEmpty = await engine.provideInlineCompletionItems(document, position, automatic, cancellation.token);
        assert.equal(firstEmpty, undefined, "Empty mock output should not insert a suggestion");
        const callsAfterEmpty = generationCalls;
        const repeatedEmpty = await engine.provideInlineCompletionItems(document, position, automatic, cancellation.token);
        assert.equal(repeatedEmpty, undefined);
        assert.equal(generationCalls, callsAfterEmpty, "Repeated identical automatic request must back off");
        const manualRetry = await engine.provideInlineCompletionItems(document, position, trigger, cancellation.token);
        assert.equal(manualRetry, undefined);
        assert.equal(generationCalls, callsAfterEmpty + 1, "Manual invocation must bypass empty-result backoff");
        assert.equal(engine.getStats().suppressedEmptyRetries, 1);
        mockEmptyResponses = false;
        await configuration.update("model", "lineloom-test:latest", vscode.ConfigurationTarget.Global);
        // Exercise preview language providers with actual VS Code file modes.
        for (const [filename, languageId] of [
          ["editor-test.go", "go"], ["editor-test.java", "java"],
          ["editor-test.c", "c"], ["editor-test.cpp", "cpp"]
        ] as const) {
          const previewDoc: vscode.TextDocument = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(folder.uri, filename));
          assert.equal(previewDoc.languageId, languageId, "Incorrect VS Code language mode: " + filename);
          const previewEditor: vscode.TextEditor = await vscode.window.showTextDocument(previewDoc);
          const previewPos: vscode.Position = previewDoc.positionAt(previewDoc.getText().length);
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
        const activeEditor = await vscode.window.showTextDocument(document);
        activeEditor.selection = new vscode.Selection(position, position);
        // Selection replacement and multiple cursors must never send context to Ollama.
        const requestsBeforeGuards = engine.getStats().requests;
        activeEditor.selection = new vscode.Selection(document.positionAt(0), position);
        assert.equal(vscode.window.activeTextEditor?.document.uri.toString(), document.uri.toString());
        assert.equal(vscode.window.activeTextEditor?.selection.isEmpty, false, "Fixture must contain highlighted text");
        const selectedTextResult = await engine.provideInlineCompletionItems(document, position, trigger, cancellation.token);
        assert.equal(selectedTextResult, undefined, "Selection replacement must not request a completion");
        activeEditor.selections = [
          new vscode.Selection(position, position),
          new vscode.Selection(document.positionAt(0), document.positionAt(0))
        ];
        const multiCursorResult = await engine.provideInlineCompletionItems(document, position, trigger, cancellation.token);
        assert.equal(multiCursorResult, undefined, "Multiple cursors must not request inference");
        activeEditor.selection = new vscode.Selection(position, position);
        const nativeSuggestion = await engine.provideInlineCompletionItems(document, position, {
          triggerKind: vscode.InlineCompletionTriggerKind.Automatic,
          selectedCompletionInfo: { text: "answer", range: new vscode.Range(position, position) }
        }, cancellation.token);
        assert.equal(nativeSuggestion, undefined, "Do not override an active native completion");
        assert.equal(engine.getStats().requests, requestsBeforeGuards, "Invalid editor states must not reach Ollama");

        // A cursor change while waiting for debounce must prevent any network request.
        await configuration.update("debounceMs", 75, vscode.ConfigurationTarget.Global);
        activeEditor.selection = new vscode.Selection(position, position);
        const pendingStale = engine.provideInlineCompletionItems(document, position, trigger, cancellation.token);
        activeEditor.selection = new vscode.Selection(document.positionAt(0), document.positionAt(0));
        const stale = await pendingStale;
        assert.equal(stale, undefined, "Moving the cursor during debounce must discard the request");
        assert.equal(engine.getStats().requests, requestsBeforeGuards, "Stale debounce must not send source");
        await configuration.update("debounceMs", 0, vscode.ConfigurationTarget.Global);
        activeEditor.selection = new vscode.Selection(position, position);
        // Repeated same-cursor notifications must not cancel or discard matching completions.
        const hitsBeforeNotification = engine.getStats().cacheHits;
        engine.cancelIfEditorChanged(activeEditor);
        assert.equal(engine.getStats().cacheHits, hitsBeforeNotification);
        const shifted = document.positionAt(document.getText().length - 1);
        activeEditor.selection = new vscode.Selection(shifted, shifted);
        engine.cancelIfEditorChanged(activeEditor);
        // The prior cursor change invalidates the old cached suggestion.
        // A freshly generated inline suggestion can be reused if the developer
        // types its first character in a single ordinary edit.
        const refreshed = document.positionAt(document.getText().length);
        activeEditor.selection = new vscode.Selection(refreshed, refreshed);
        // Drain previously queued editor-selection notifications before starting
        // a new generation. They can otherwise cancel a valid fresh request.
        await new Promise<void>((resolve) => setTimeout(resolve, 125));
        engine.cancel();
        const renewed = await engine.provideInlineCompletionItems(document, refreshed, trigger, cancellation.token);
        assert.equal(renewed?.[0]?.insertText, "42", "Expected a new candidate for typed continuation");
        const callsBeforeTyping = generationCalls;
        observedShapes.length = 0;
        const applied = await activeEditor.edit((edit) => edit.insert(refreshed, "4"));
        assert.equal(applied, true, "Integration editor edit should apply");
        const afterTyping = document.positionAt(document.getText().length);
        activeEditor.selection = new vscode.Selection(afterTyping, afterTyping);
        engine.cancelIfEditorChanged(activeEditor);
        const continued = await engine.provideInlineCompletionItems(document, afterTyping, {
          triggerKind: vscode.InlineCompletionTriggerKind.Automatic,
          selectedCompletionInfo: undefined
        }, cancellation.token);
        assert.equal(continued?.[0]?.insertText, "2",
          "Should offer only the untyped remainder; observed editor change shapes: " + JSON.stringify(observedShapes));
        assert.equal(generationCalls, callsBeforeTyping, "Typed continuation must not call Ollama again");
        assert.equal(engine.getStats().continuationHits, 1, "Expected one re-used typed continuation");

        // Editing a different location invalidates the retained completion:
        // the next suggestion must use a fresh model request.
        const callsBeforeUnrelatedEdit = generationCalls;
        const beginning = document.positionAt(0);
        const unrelatedApplied = await activeEditor.edit((edit) => edit.insert(beginning, "// changed\\n"));
        assert.equal(unrelatedApplied, true);
        const afterUnrelatedEdit = document.positionAt(document.getText().length);
        activeEditor.selection = new vscode.Selection(afterUnrelatedEdit, afterUnrelatedEdit);
        await engine.provideInlineCompletionItems(document, afterUnrelatedEdit, {
          triggerKind: vscode.InlineCompletionTriggerKind.Automatic,
          selectedCompletionInfo: undefined
        }, cancellation.token);
        assert.equal(generationCalls, callsBeforeUnrelatedEdit + 1,
          "Unrelated edit must not reuse an obsolete typed continuation");

        // Automatic completion should not interrupt an existing identifier.
        // Manual completion must still work at the same cursor.
        const identifierIndex = document.getText().indexOf("answer");
        assert.ok(identifierIndex >= 0, "Expected identifier test fixture");
        const midToken = document.positionAt(identifierIndex + 2);
        activeEditor.selection = new vscode.Selection(midToken, midToken);
        const callsBeforeMidToken = generationCalls;
        const automaticMidToken = await engine.provideInlineCompletionItems(document, midToken, {
          triggerKind: vscode.InlineCompletionTriggerKind.Automatic,
          selectedCompletionInfo: undefined
        }, cancellation.token);
        assert.equal(automaticMidToken, undefined, "Automatic request must not interrupt an identifier");
        assert.equal(generationCalls, callsBeforeMidToken, "Mid-token automatic request must not call Ollama");
        const manualMidToken = await engine.provideInlineCompletionItems(document, midToken, trigger, cancellation.token);
        assert.ok(manualMidToken?.length, "Manual invocation must remain available mid-token");
        await configuration.update("suppressMidTokenAuto", false, vscode.ConfigurationTarget.Global);
        const allowAutomaticMidToken = await engine.provideInlineCompletionItems(document, midToken, {
          triggerKind: vscode.InlineCompletionTriggerKind.Automatic,
          selectedCompletionInfo: undefined
        }, cancellation.token);
        assert.ok(allowAutomaticMidToken?.length, "Opting out should allow automatic mid-token completion");
        await configuration.update("suppressMidTokenAuto", true, vscode.ConfigurationTarget.Global);

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
      editSubscription.dispose();
      engine.dispose();
      await configuration.update("endpoint", oldValues.endpoint, vscode.ConfigurationTarget.Global);
      await configuration.update("model", oldValues.model, vscode.ConfigurationTarget.Global);
      await configuration.update("debounceMs", oldValues.debounceMs, vscode.ConfigurationTarget.Global);
      await configuration.update("autoTrigger", oldValues.autoTrigger, vscode.ConfigurationTarget.Global);
      await configuration.update("suppressMidTokenAuto", oldValues.suppressMidTokenAuto, vscode.ConfigurationTarget.Global);
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
