import * as vscode from "vscode";
import * as assert from "node:assert/strict";
import * as http from "node:http";
import { utimes } from "node:fs/promises";
import { generateCompletion, listModels, showModel } from "../../src/models/ollama";
import { CompletionEngine } from "../../src/completion/engine";
import { LineLoomSidebar } from "../../src/ui/sidebar";
import { clearIgnoreCache, mayComplete } from "../../src/privacy/exclusions";
import { getEligibilityTimingSummary, resetEligibilityTimings } from "../../src/privacy/timings";


export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension("SanskarCodes.lineloom");
  assert.ok(extension, "VS Code must discover LineLoom");
  await extension.activate();
  const required = [
    "lineloom.enable", "lineloom.disable", "lineloom.trigger",
    "lineloom.selectModel", "lineloom.manageLanguages", "lineloom.checkConnection", "lineloom.openSettings",
    "lineloom.diagnostics", "lineloom.setup", "lineloom.performance",
    "lineloom.quickActions", "lineloom.toggleAutomatic", "lineloom.selectLanguageModel",
    "lineloom.cancel",
    "lineloom.refreshSidebar", "lineloom.openSidebar"
  ];
  const commands = await vscode.commands.getCommands(true);
  for (const name of required) assert.ok(commands.includes(name), "Missing command: " + name);
  // Refreshing the native sidebar is safe before a model server exists.
  await vscode.commands.executeCommand("lineloom.refreshSidebar");
  // Inspect the native Tree View API without invoking model discovery or reading
  // editor source, and ensure keyboard/screen-reader names are populated.
  const offlineSidebar = new LineLoomSidebar(() => undefined, () => false);
  const roots = offlineSidebar.getChildren();
  const activeSection = roots.find(node => node.kind === "section" && node.section.id === "editor");
  assert.ok(activeSection && activeSection.kind === "section", "Missing active editor section");
  const activeItems = offlineSidebar.getChildren(activeSection);
  assert.ok(activeItems.some(node => node.kind === "item" && node.item.id === "editor-language"));
  for (const node of activeItems) {
    const item = offlineSidebar.getTreeItem(node);
    assert.ok(item.accessibilityInformation?.label, "Tree item needs a screen-reader label");
  }
  let refreshEvents = 0;
  const sidebarSubscription = offlineSidebar.onDidChangeTreeData(() => refreshEvents++);
  offlineSidebar.refresh();
  assert.equal(refreshEvents, 1, "Sidebar refresh should fire one tree change");
  sidebarSubscription.dispose();
  offlineSidebar.dispose();
  let mockEmptyResponses = false;
  let holdGeneration = false;
  let heldGenerationStarted: (() => void) | undefined;
  let releaseHeldGeneration: (() => void) | undefined;
  let generationCalls = 0;
  let lastModelSent = "";
  const server = http.createServer(async (request, response) => {
    response.setHeader("Content-Type", "application/json");
    if (request.url === "/api/tags") {
      response.end(JSON.stringify({ models: [{ name: "lineloom-test:latest" }] }));
    } else if (request.url === "/api/show") {
      response.end(JSON.stringify({ details: { family: "test" } }));
    } else if (request.url === "/api/generate") {
      const parts: Buffer[] = [];
      for await (const chunk of request) parts.push(Buffer.from(chunk));
      const payload = JSON.parse(Buffer.concat(parts).toString("utf8")) as { model?: string };
      lastModelSent = payload.model ?? "";
      generationCalls++;
      if (holdGeneration) {
        heldGenerationStarted?.();
        await new Promise<void>((resolve) => { releaseHeldGeneration = resolve; });
        if (!response.destroyed) response.end(JSON.stringify({ response: "obsolete", done: true }) + "\n");
        return;
      }
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
    // Exercise the *real* extension-registered VS Code filesystem watchers,
    // without calling clearIgnoreCache manually. Cache invalidation must
    // take effect before the 20-second privacy-rule TTL expires.
    const watchTarget = await vscode.workspace.openTextDocument(
      vscode.Uri.joinPath(folder.uri, "src", "watch-probe", "sample.ts")
    );
    const watchPolicy = vscode.Uri.joinPath(folder.uri, "src", "watch-probe", ".lineloomignore");
    assert.equal(await mayComplete(watchTarget, []), true, "Watcher fixture starts permitted");
    const assertWatcherEligibility = async (expected: boolean, phase: string): Promise<void> => {
      const deadline = Date.now() + 8_000;
      while (Date.now() < deadline) {
        if (await mayComplete(watchTarget, []) === expected) return;
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
      }
      assert.equal(await mayComplete(watchTarget, []), expected,
        "Live policy watcher did not apply " + phase + " before timeout");
    };
    await vscode.workspace.fs.writeFile(watchPolicy, Buffer.from("sample.ts\n"));
    await assertWatcherEligibility(false, "created .lineloomignore");
    await vscode.workspace.fs.writeFile(watchPolicy, Buffer.from("other.ts\n"));
    await assertWatcherEligibility(true, "changed .lineloomignore");
    await vscode.workspace.fs.writeFile(watchPolicy, Buffer.from("sample.ts\n"));
    await assertWatcherEligibility(false, "restored exclusion");
    await vscode.workspace.fs.delete(watchPolicy);
    await assertWatcherEligibility(true, "deleted .lineloomignore");

    // Malformed policy bytes must NEVER become permissive replacement-text
    // patterns. Exercise the production VS Code filesystem/privacy gate.
    await vscode.workspace.fs.writeFile(watchPolicy, Uint8Array.from([0xff]));
    assert.equal(await mayComplete(watchTarget, []), false,
      "Invalid UTF-8 ignore policy must fail closed in the editor host");
    await vscode.workspace.fs.writeFile(watchPolicy, Buffer.from("other.ts\n"));
    await assertWatcherEligibility(true, "repaired UTF-8 ignore source");
    await vscode.workspace.fs.writeFile(watchPolicy, Buffer.from("sample.ts\0other.ts\n"));
    assert.equal(await mayComplete(watchTarget, []), false,
      "NUL-containing ignore policy must fail closed in the editor host");
    await vscode.workspace.fs.delete(watchPolicy);
    await assertWatcherEligibility(true, "deleted malformed ignore source");


    // Deeply nested policies must preserve the same fail-closed semantics
    // when many ancestor files are scanned concurrently in bounded batches.
    const deepSegments = Array.from({ length: 12 }, (_unused, index) => "level" + index);
    const deepDocument = await vscode.workspace.openTextDocument(
      vscode.Uri.joinPath(folder.uri, "src", "deep-probe", ...deepSegments, "sample.ts")
    );
    assert.equal(await mayComplete(deepDocument, []), true,
      "A deeply nested source without matching policies should remain eligible");
    for (const file of [".gitignore", ".lineloomignore"] as const) {
      const deepPolicy = vscode.Uri.joinPath(folder.uri, "src", "deep-probe", "level0", file);
      try {
        await vscode.workspace.fs.writeFile(deepPolicy, Buffer.from("**/sample.ts\n", "utf8"));
        assert.equal(await mayComplete(deepDocument, []), false,
          "New ancestor " + file + " must deny a deep source before inference");
      } finally {
        await vscode.workspace.fs.delete(deepPolicy);
        clearIgnoreCache();
      }
      assert.equal(await mayComplete(deepDocument, []), true,
        "Removing nested " + file + " must restore the allowed source");
    }

    // Hard exclusions must hold in the actual editor host, not just unit
    // tests of filenames. These files contain public synthetic fixture text.
    const sensitiveDocuments = await Promise.all([
      ["src", "credentials.ts"], ["src", ".terraform", "state.ts"],
      ["src", ".direnv", "cached.ts"], ["src", ".dev.vars"],
      ["src", "production.tfvars.json"],
      ["src", "credentials", "example.ts"], ["src", ".env.local", "example.ts"],
      ["src", "secrets", "example.ts"], ["src", ".dev.vars.preview", "example.ts"]
    ].map((parts) => vscode.workspace.openTextDocument(vscode.Uri.joinPath(folder.uri, ...parts))));
    for (const sensitive of sensitiveDocuments) {
      assert.equal(await mayComplete(sensitive, []), false,
        "Hard-excluded fixture must fail closed in the VS Code editor host");
    }
    const configuration = vscode.workspace.getConfiguration("lineloom");
    const oldValues = {
      endpoint: configuration.get<string>("endpoint"),
      model: configuration.get<string>("model"),
      languageModels: configuration.get<Record<string, string>>("languageModels"),
      debounceMs: configuration.get<number>("debounceMs"),
      excludedPaths: configuration.get<string[]>("excludedPaths"),
      autoTrigger: configuration.get<boolean>("autoTrigger"),
      suppressMidTokenAuto: configuration.get<boolean>("suppressMidTokenAuto"),
      enabledLanguages: configuration.get<string[]>("enabledLanguages"),
      performanceDiagnostics: configuration.get<boolean>("performanceDiagnostics")
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
      await configuration.update("languageModels", {}, vscode.ConfigurationTarget.Global);
      await configuration.update("debounceMs", 0, vscode.ConfigurationTarget.Global);
      await configuration.update("excludedPaths", [], vscode.ConfigurationTarget.Global);
      await configuration.update("autoTrigger", true, vscode.ConfigurationTarget.Global);
      await configuration.update("suppressMidTokenAuto", true, vscode.ConfigurationTarget.Global);
      await configuration.update("enabledLanguages", ["python", "javascript", "typescript", "rust", "kotlin", "go", "java", "c", "cpp"], vscode.ConfigurationTarget.Global);
      // Diagnostics must capture only aggregate timings after explicit opt-in.
      resetEligibilityTimings();
      await configuration.update("performanceDiagnostics", true, vscode.ConfigurationTarget.Global);
      assert.equal(await mayComplete(permitted, [], true), true);
      const timingReport = getEligibilityTimingSummary();
      assert.equal(timingReport.checks, 1);
      assert.equal(timingReport.allowed, 1);
      assert.equal(timingReport.denied, 0);
      await configuration.update("performanceDiagnostics", false, vscode.ConfigurationTarget.Global);
      // This test bundle has its own timings module; the activated extension
      // has a separate module instance and clears its own counters on opt-out.
      // Verify the test's own accumulator cannot grow after opt-out.
      assert.equal(await mayComplete(permitted, [], true), true);
      assert.equal(getEligibilityTimingSummary().checks, 1,
        "Disabled diagnostics must prevent new policy timing samples");
      resetEligibilityTimings();
      assert.equal(getEligibilityTimingSummary().checks, 0,
        "Explicit reset must clear isolated test metrics");
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
        await configuration.update("languageModels", { typescript: "lineloom-typed:latest" }, vscode.ConfigurationTarget.Global);
        const first = await engine.provideInlineCompletionItems(document, position, trigger, cancellation.token);
        assert.ok(first?.length, "Expected inline completion from the mocked model");
        assert.equal(first[0].insertText, "42");
        assert.equal(lastModelSent, "lineloom-typed:latest", "TypeScript must use its assigned Ollama model");
        const second = await engine.provideInlineCompletionItems(document, position, trigger, cancellation.token);
        assert.ok(second?.length, "Expected reuse of the cached inline completion");
        assert.equal(second[0].insertText, "42");
        assert.equal(engine.getStats().cacheHits, 1, "Expected an exact suggestion cache hit");

        // Exercise the real inline provider with supported-language sensitive
        // fixtures. Merely checking the standalone privacy matcher is not
        // sufficient: no Ollama HTTP generation may start for any such file.
        const beforeProtectedRequests = generationCalls;
        const protectedSourceFiles = [
          deniedByApp, deniedByGit,
          sensitiveDocuments[0], // credentials.ts (known risky basename)
          sensitiveDocuments[1], // .terraform/state.ts
          sensitiveDocuments[2], // .direnv/cached.ts
          sensitiveDocuments[5], // credentials/example.ts — sensitive parent
          sensitiveDocuments[6], // .env.local/example.ts — sensitive parent
          sensitiveDocuments[7], // secrets/example.ts — sensitive parent
          sensitiveDocuments[8]  // .dev.vars.preview/example.ts — sensitive parent
        ];
        for (const protectedDoc of protectedSourceFiles) {
          assert.equal(protectedDoc.languageId, "typescript",
            "Protected completion fixture must use a registered language");
          const protectedEditor = await vscode.window.showTextDocument(protectedDoc);
          const protectedPosition = protectedDoc.positionAt(protectedDoc.getText().length);
          protectedEditor.selection = new vscode.Selection(protectedPosition, protectedPosition);
          const refused = await engine.provideInlineCompletionItems(
            protectedDoc, protectedPosition, trigger, cancellation.token
          );
          assert.equal(refused, undefined, "Provider must refuse protected files before inference");
          assert.equal(generationCalls, beforeProtectedRequests,
            "Protected file caused an unexpected /api/generate request");
        }
        // An invalidated ignore scan must never approve a file based on a
        // filesystem snapshot that started before the policy changed.
        const obsoleteEligibility = mayComplete(permitted, []);
        clearIgnoreCache();
        assert.equal(await obsoleteEligibility, false,
          "An in-progress ignore scan must fail closed after invalidation");
        assert.equal(await mayComplete(permitted, []), true,
          "A fresh scan should still allow the originally permitted fixture");

        // Rewrite the real .lineloomignore fixture while using the actual
        // inline provider. A newly excluded file must neither receive a
        // previously cached suggestion nor contact Ollama.
        const ignoreUri = vscode.Uri.joinPath(folder.uri, "src", ".lineloomignore");
        const originalIgnore = Buffer.from("blocked.ts\n", "utf8");
        try {
          const allowedEditor = await vscode.window.showTextDocument(permitted);
          const allowedCursor = permitted.positionAt(permitted.getText().length);
          allowedEditor.selection = new vscode.Selection(allowedCursor, allowedCursor);
          engine.cancel();
          const allowedBeforePolicyEdit = await engine.provideInlineCompletionItems(
            permitted, allowedCursor, trigger, cancellation.token
          );
          assert.ok(allowedBeforePolicyEdit?.length,
            "Ordinary source file should receive an inline suggestion before it is excluded");
          const callsBeforeIgnoreEdit = generationCalls;
          await vscode.workspace.fs.writeFile(ignoreUri,
            Buffer.from("blocked.ts\nallowed.ts\n", "utf8"));
          // Same invalidation order used by the production ignore watcher.
          clearIgnoreCache();
          engine.cancel();
          assert.equal(await mayComplete(permitted, []), false,
            "Edited .lineloomignore must deny a previously permitted source");
          const refusedAfterPolicyEdit = await engine.provideInlineCompletionItems(
            permitted, allowedCursor, trigger, cancellation.token
          );
          assert.equal(refusedAfterPolicyEdit, undefined,
            "A newly excluded source must not receive stale cached model output");
          assert.equal(generationCalls, callsBeforeIgnoreEdit,
            "Newly excluded source must not dispatch an Ollama generation");
        } finally {
          await vscode.workspace.fs.writeFile(ignoreUri, originalIgnore);
          clearIgnoreCache();
          engine.cancel();
        }
        assert.equal(await mayComplete(permitted, []), true,
          "Restoring the ignore rules must restore source eligibility");

        // Equal-size/equal-mtime rewrites must not inherit a cached allow result
        // if a filesystem watcher is delayed or never delivered. Use a real
        // local file so both the content hash and editor privacy gate are tested.
        const oldPolicyStat = await vscode.workspace.fs.stat(ignoreUri);
        try {
          await vscode.workspace.fs.writeFile(ignoreUri, Buffer.from("allowed.ts\n", "utf8"));
          await utimes(ignoreUri.fsPath, new Date(oldPolicyStat.mtime), new Date(oldPolicyStat.mtime));
          const rewrittenStat = await vscode.workspace.fs.stat(ignoreUri);
          assert.equal(rewrittenStat.size, oldPolicyStat.size,
            "Fingerprint fixture must retain the policy file size");
          assert.equal(rewrittenStat.mtime, oldPolicyStat.mtime,
            "Fingerprint fixture must retain the policy modification time");
          assert.equal(await mayComplete(permitted, []), false,
            "Policy content changes must invalidate a metadata-identical cached permission");
          const beforeHashGuardRequest = generationCalls;
          const fingerprintEditor = await vscode.window.showTextDocument(permitted);
          const fingerprintCursor = permitted.positionAt(permitted.getText().length);
          fingerprintEditor.selection = new vscode.Selection(fingerprintCursor, fingerprintCursor);
          engine.cancel();
          const fingerprintDenied = await engine.provideInlineCompletionItems(
            permitted, fingerprintCursor, trigger, cancellation.token
          );
          assert.equal(fingerprintDenied, undefined,
            "Fingerprint-changed ignore rules must block native inline suggestions");
          assert.equal(generationCalls, beforeHashGuardRequest,
            "Fingerprint-changed ignore rules must not send workspace text to Ollama");
        } finally {
          await vscode.workspace.fs.writeFile(ignoreUri, originalIgnore);
          clearIgnoreCache();
          engine.cancel();
        }
        assert.equal(await mayComplete(permitted, []), true,
          "Restored file content must allow a new privacy decision");

        const restoredEditor = await vscode.window.showTextDocument(document);
        restoredEditor.selection = new vscode.Selection(position, position);

        // Stopping during automatic debounce must prevent the Ollama
        // request from being sent at all. Explicit stopping does not
        // change the user's persistent automatic suggestion preference.
        engine.cancel();
        await configuration.update("debounceMs", 100, vscode.ConfigurationTarget.Global);
        const callsBeforeQueuedCancel = generationCalls;
        const queuedBeforeNetwork = engine.provideInlineCompletionItems(document, position, {
          triggerKind: vscode.InlineCompletionTriggerKind.Automatic,
          selectedCompletionInfo: undefined
        }, cancellation.token);
        engine.cancel();
        assert.equal(await queuedBeforeNetwork, undefined, "Queued generation must stop before HTTP");
        assert.equal(generationCalls, callsBeforeQueuedCancel, "Stop during debounce must not contact Ollama");
        await configuration.update("debounceMs", 0, vscode.ConfigurationTarget.Global);

        // Explicit cancellation must abort an in-flight model request, reject
        // its late completion and retain the enabled/auto-trigger preferences.
        engine.cancel(); // Flush exact-key cache so the next invocation hits Ollama.
        const cancelStart = new Promise<void>((resolve) => { heldGenerationStarted = resolve; });
        holdGeneration = true;
        const cancelledRequest = engine.provideInlineCompletionItems(
          document, position, trigger, cancellation.token
        );
        try {
          await Promise.race([
            cancelStart,
            new Promise<never>((_resolve, reject) => setTimeout(
              () => reject(new Error("Mock generation did not begin")), 8_000
            ))
          ]);
          engine.cancel();
          releaseHeldGeneration?.();
          assert.equal(await cancelledRequest, undefined, "Explicitly stopped model output must never be offered");
          assert.ok(engine.getStats().cancelled >= 1, "Stopped request must count as cancelled");
        } finally {
          holdGeneration = false;
          releaseHeldGeneration?.();
          heldGenerationStarted = undefined;
          releaseHeldGeneration = undefined;
        }
        assert.equal(configuration.get("enabled", true), true, "Cancel must not disable autocomplete");
        assert.equal(configuration.get("autoTrigger", true), true, "Cancel must not pause future suggestions");
        // Cancellation must not prevent a subsequent independent request.
        const resumed = await engine.provideInlineCompletionItems(
          document, position, trigger, cancellation.token
        );
        assert.equal(resumed?.[0]?.insertText, "42", "Manual completion must recover after cancellation");
        await configuration.update("languageModels", {}, vscode.ConfigurationTarget.Global);
        const fallback = await engine.provideInlineCompletionItems(document, position, trigger, cancellation.token);
        assert.ok(fallback?.length, "Expected fallback to global Ollama model");
        assert.equal(lastModelSent, "lineloom-test:latest", "Removing the language override must restore the default model");
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
        // Use AUTOMATIC invocation: explicit manual requests deliberately bypass debounce.
        const pendingStale = engine.provideInlineCompletionItems(document, position, {
          triggerKind: vscode.InlineCompletionTriggerKind.Automatic,
          selectedCompletionInfo: undefined
        }, cancellation.token);
        activeEditor.selection = new vscode.Selection(document.positionAt(0), document.positionAt(0));
        const stale = await pendingStale;
        assert.equal(stale, undefined, "Moving the cursor during debounce must discard the request");
        assert.equal(engine.getStats().requests, requestsBeforeGuards, "Stale debounce must not send source");
        await configuration.update("debounceMs", 0, vscode.ConfigurationTarget.Global);
        activeEditor.selection = new vscode.Selection(position, position);

        // Give real CI editor settings writes enough time to commit before
        // the queued debounce expires. A short 275ms window raced the VS Code
        // configuration service on loaded runners and occasionally let a
        // legitimate completion finish before the setting was changed.
        // This tests the superseded-request guard, not settings IO speed.
        await configuration.update("debounceMs", 2000, vscode.ConfigurationTarget.Global);
        const beforeConfigChange = generationCalls;
        const pendingOldModel = engine.provideInlineCompletionItems(
          document, position, automatic, cancellation.token
        );
        await configuration.update("model", "lineloom-other:latest", vscode.ConfigurationTarget.Global);
        assert.equal(await pendingOldModel, undefined, "Superseded model request must be discarded");
        assert.equal(generationCalls, beforeConfigChange, "Changed model must not send code to Ollama");
        await configuration.update("model", "lineloom-test:latest", vscode.ConfigurationTarget.Global);
        const pendingNewIgnore = engine.provideInlineCompletionItems(
          document, position, automatic, cancellation.token
        );
        await configuration.update("excludedPaths", ["editor-test.ts"], vscode.ConfigurationTarget.Global);
        assert.equal(await pendingNewIgnore, undefined, "Changed file exclusions must reject queued completion");
        assert.equal(generationCalls, beforeConfigChange, "Changed ignore rule must prevent Ollama dispatch");
        await configuration.update("excludedPaths", [], vscode.ConfigurationTarget.Global);
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
      await configuration.update("languageModels", oldValues.languageModels, vscode.ConfigurationTarget.Global);
      await configuration.update("debounceMs", oldValues.debounceMs, vscode.ConfigurationTarget.Global);
      await configuration.update("excludedPaths", oldValues.excludedPaths, vscode.ConfigurationTarget.Global);
      await configuration.update("autoTrigger", oldValues.autoTrigger, vscode.ConfigurationTarget.Global);
      await configuration.update("suppressMidTokenAuto", oldValues.suppressMidTokenAuto, vscode.ConfigurationTarget.Global);
      await configuration.update("enabledLanguages", oldValues.enabledLanguages, vscode.ConfigurationTarget.Global);
      await configuration.update("performanceDiagnostics", oldValues.performanceDiagnostics, vscode.ConfigurationTarget.Global);
    }
    await vscode.commands.executeCommand("lineloom.disable");
    assert.equal(vscode.workspace.getConfiguration("lineloom").get("enabled"), false);
    await vscode.commands.executeCommand("lineloom.enable");
    assert.equal(vscode.workspace.getConfiguration("lineloom").get("enabled"), true);
    await vscode.commands.executeCommand("lineloom.cancel");
    assert.equal(vscode.workspace.getConfiguration("lineloom").get("enabled"), true,
      "Stop command must not disable future suggestions");
    assert.equal(vscode.workspace.getConfiguration("lineloom").get("autoTrigger"), true,
      "Stop command must not change persistent automatic inference mode");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
