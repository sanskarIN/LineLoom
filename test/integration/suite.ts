import * as vscode from "vscode";
import * as assert from "node:assert/strict";
import * as http from "node:http";
import { utimes } from "node:fs/promises";
import { generateCompletion, listModels, showModel } from "../../src/models/ollama";
import { CompletionEngine } from "../../src/completion/engine";
import { LineLoomSidebar } from "../../src/ui/sidebar";
import { ModelReadinessSession } from "../../src/ui/model-readiness";
import { FilePrivacySession } from "../../src/ui/file-privacy-session";
import { clearIgnoreCache, mayComplete } from "../../src/privacy/exclusions";
import { inspectFilePrivacy } from "../../src/privacy/inspect";
import { collectRelatedText, isSupportedRelatedCandidate } from "../../src/context/related-editor";
import { getEligibilityTimingSummary, resetEligibilityTimings } from "../../src/privacy/timings";


export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension("SanskarCodes.lineloom");
  assert.ok(extension, "VS Code must discover LineLoom");
  await extension.activate();
  const required = [
    "lineloom.enable", "lineloom.disable", "lineloom.trigger",
    "lineloom.selectModel", "lineloom.manageLanguages", "lineloom.checkConnection", "lineloom.checkActiveFilePrivacy", "lineloom.openSettings",
    "lineloom.diagnostics", "lineloom.resetPrivacyTimings", "lineloom.resetInferenceTimings", "lineloom.resetSessionActivity",
    "lineloom.setup", "lineloom.performance",
    "lineloom.quickActions", "lineloom.toggleAutomatic", "lineloom.selectLanguageModel",
    "lineloom.cancel", "lineloom.selectRelatedFiles", "lineloom.clearRelatedFiles",
    "lineloom.refreshSidebar", "lineloom.openSidebar", "lineloom.checkActiveModel"
  ];
  const commands = await vscode.commands.getCommands(true);
  for (const name of required) assert.ok(commands.includes(name), "Missing command: " + name);
  // Refreshing the native sidebar is safe before a model server exists.
  await vscode.commands.executeCommand("lineloom.refreshSidebar");
  // Test the actual extension command even with no Ollama server running.
  await vscode.commands.executeCommand("lineloom.resetPrivacyTimings");
  await vscode.commands.executeCommand("lineloom.resetInferenceTimings");
  await vscode.commands.executeCommand("lineloom.clearRelatedFiles");
  // Inspect the native Tree View API without invoking model discovery or reading
  // editor source, and ensure keyboard/screen-reader names are populated.
  const readiness = new ModelReadinessSession();
  const privacyStatus = new FilePrivacySession();
  const activeReadiness = new ModelReadinessSession();
  const offlineSidebar = new LineLoomSidebar(
    () => undefined, () => false, () => "ready", () => 0,
    () => readiness.state, () => privacyStatus.state, () => activeReadiness.state
  );
  const roots = offlineSidebar.getChildren();
  // The recommendation must be computed locally and exposed through a native
  // accessible TreeItem, without asking Ollama or inspecting code.
  const completionSection = roots.find(node => node.kind === "section" && node.section.id === "status");
  assert.ok(completionSection && completionSection.kind === "section", "Missing completion section");
  const nextSteps = offlineSidebar.getChildren(completionSection).filter(
    node => node.kind === "item" && node.item.id === "next-step"
  );
  assert.equal(nextSteps.length, 1, "Exactly one contextual next step should be visible");
  const nextTreeItem = offlineSidebar.getTreeItem(nextSteps[0]);
  assert.ok(nextTreeItem.accessibilityInformation?.label?.includes("Next:"),
    "Suggested next step must have a screen-reader name");
  assert.ok(nextTreeItem.tooltip, "Suggested next step must explain its behavior");
  const activeSection = roots.find(node => node.kind === "section" && node.section.id === "editor");
  assert.ok(activeSection && activeSection.kind === "section", "Missing active editor section");
  const activeItems = offlineSidebar.getChildren(activeSection);
  assert.ok(activeItems.some(node => node.kind === "item" && node.item.id === "editor-language"));
  const activeReadinessNode = activeItems.find(node => node.kind === "item" &&
    node.item.id === "active-model-readiness");
  assert.ok(activeReadinessNode?.kind === "item" &&
    activeReadinessNode.item.command === "lineloom.checkActiveModel");
  assert.ok(offlineSidebar.getTreeItem(activeReadinessNode).accessibilityInformation?.label);
  for (const node of activeItems) {
    const item = offlineSidebar.getTreeItem(node);
    assert.ok(item.accessibilityInformation?.label, "Tree item needs a screen-reader label");
  }
  let refreshEvents = 0;
  const sidebarSubscription = offlineSidebar.onDidChangeTreeData(() => refreshEvents++);
  offlineSidebar.refresh();
  assert.equal(refreshEvents, 1, "Sidebar refresh should fire one tree change");
  sidebarSubscription.dispose();
  const modelsSection = roots.find(node => node.kind === "section" && node.section.id === "models");
  assert.ok(modelsSection && modelsSection.kind === "section");
  const modelItems = offlineSidebar.getChildren(modelsSection);
  assert.ok(modelItems.some(node => node.kind === "item" &&
    node.item.id === "model-readiness" && node.item.description?.includes("Not checked")));
  // Refresh rebuilds section nodes; a previously fetched section is a
  // snapshot and must not be reused after the underlying readiness changes.
  const readinessEntry = () => {
    const modelSection = offlineSidebar.getChildren().find(
      node => node.kind === "section" && node.section.id === "models"
    );
    assert.ok(modelSection && modelSection.kind === "section");
    return offlineSidebar.getChildren(modelSection).find(
      node => node.kind === "item" && node.item.id === "model-readiness"
    );
  };
  const checkToken = readiness.begin();
  offlineSidebar.refresh();
  const checkingStatus = readinessEntry();
  assert.ok(checkingStatus?.kind === "item" && checkingStatus.item.description?.includes("in progress"));
  assert.equal(readiness.finish(checkToken, "available"), true);
  offlineSidebar.refresh();
  const checkedStatus = readinessEntry();
  assert.ok(checkedStatus?.kind === "item" && checkedStatus.item.description?.includes("last manual check"));
  readiness.clear();
  const privacySection = () => {
    const root = offlineSidebar.getChildren().find(
      node => node.kind === "section" && node.section.id === "privacy"
    );
    assert.ok(root && root.kind === "section");
    return root;
  };
  const privacyEntry = () => offlineSidebar.getChildren(privacySection()).find(
    node => node.kind === "item" && node.item.id === "last-file-privacy"
  );
  const notChecked = privacyEntry();
  assert.ok(notChecked?.kind === "item" && notChecked.item.description?.includes("Not checked"));
  assert.ok(notChecked?.kind === "item" &&
    offlineSidebar.getTreeItem(notChecked).accessibilityInformation?.label);
  const privacyToken = privacyStatus.begin();
  offlineSidebar.refresh();
  const checkingPrivacy = privacyEntry();
  assert.ok(checkingPrivacy?.kind === "item" &&
    checkingPrivacy.item.description?.includes("Checking"));
  assert.equal(privacyStatus.finish(privacyToken, "allowed"), true);
  offlineSidebar.refresh();
  const allowedPrivacy = privacyEntry();
  assert.ok(allowedPrivacy?.kind === "item" &&
    allowedPrivacy.item.description?.includes("rechecked before inference"));
  privacyStatus.clear();
  offlineSidebar.refresh();
  const resetPrivacy = privacyEntry();
  assert.ok(resetPrivacy?.kind === "item" && resetPrivacy.item.description?.includes("Not checked"));
  offlineSidebar.dispose();
  let mockEmptyResponses = false;
  let mockUnsafeOutput = false;
  let mockTransientFailure = false;
  let holdGeneration = false;
  let heldGenerationStarted: (() => void) | undefined;
  let releaseHeldGeneration: (() => void) | undefined;
  let generationCalls = 0;
  let modelListCalls = 0;
  let lastModelSent = "";
  let lastPromptSent = "";
  const server = http.createServer(async (request, response) => {
    response.setHeader("Content-Type", "application/json");
    if (request.url === "/api/tags") {
      modelListCalls++;
      response.end(JSON.stringify({ models: [{ name: "lineloom-test:latest" }] }));
    } else if (request.url === "/api/show") {
      response.end(JSON.stringify({ details: { family: "test" } }));
    } else if (request.url === "/api/generate") {
      const parts: Buffer[] = [];
      for await (const chunk of request) parts.push(Buffer.from(chunk));
      const payload = JSON.parse(Buffer.concat(parts).toString("utf8")) as { model?: string; prompt?: string };
      lastModelSent = payload.model ?? "";
      lastPromptSent = payload.prompt ?? ""; // kept only inside synthetic test server; never logged
      generationCalls++;
      if (mockTransientFailure) {
        response.statusCode = 503;
        response.end(JSON.stringify({ error: "temporary" }));
        return;
      }
      if (holdGeneration) {
        heldGenerationStarted?.();
        await new Promise<void>((resolve) => { releaseHeldGeneration = resolve; });
        if (!response.destroyed) response.end(JSON.stringify({ response: "obsolete", done: true }) + "\n");
        return;
      }
      if (mockUnsafeOutput) {
        response.end(JSON.stringify({ response: "42" + String.fromCharCode(0x202e), done: true }) + "\n");
      } else if (mockEmptyResponses) {
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

    // Privacy rule files are control inputs, never prompt sources—even when
    // no ignore rule excludes their own filename. Exercise the real VS Code
    // filesystem with disposable root/nested policy fixtures.
    for (const policyName of [".gitignore", ".lineloomignore", ".dockerignore", ".npmignore"] as const) {
      const policyUri = vscode.Uri.joinPath(folder.uri, "src", "watch-probe", policyName);
      try {
        await vscode.workspace.fs.writeFile(policyUri, Buffer.from("private-segment/\\n"));
        const policyDocument = await vscode.workspace.openTextDocument(policyUri);
        assert.equal(await mayComplete(policyDocument, []), false,
          "Policy document " + policyName + " must never be eligible for inference");
        assert.equal(await inspectFilePrivacy(policyDocument, [], () => true), "blocked",
          "Active file preflight must also deny " + policyName);
      } finally {
        await vscode.workspace.fs.delete(policyUri);
        clearIgnoreCache();
      }
    }

    // User-initiated privacy inspection must reuse the complete local path
    // gate without contacting Ollama, exposing paths or storing diagnostics.
    const inspectionCallsBefore = generationCalls;
    assert.equal(await inspectFilePrivacy(undefined, [], () => true), "no-editor");
    assert.equal(await inspectFilePrivacy(permitted, [], () => true), "allowed");
    assert.equal(await inspectFilePrivacy(deniedByApp, [], () => true), "blocked");
    assert.equal(await inspectFilePrivacy(deniedByGit, [], () => true), "blocked");
    assert.equal(await inspectFilePrivacy(permitted, [], () => false), "stale",
      "A changed editor or setting must invalidate an older allow result");
    const checkedEditor = await vscode.window.showTextDocument(permitted);
    assert.ok(checkedEditor);
    await vscode.commands.executeCommand("lineloom.checkActiveFilePrivacy");
    assert.equal(generationCalls, inspectionCallsBefore,
      "Inspecting file privacy must not trigger an Ollama generation");

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
      performanceDiagnostics: configuration.get<boolean>("performanceDiagnostics"),
      crossFileContext: configuration.get<boolean>("crossFileContext")
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
      const baselineModelListCalls = modelListCalls;
      await vscode.commands.executeCommand("lineloom.refreshSidebar");
      assert.equal(modelListCalls, baselineModelListCalls, "Sidebar refresh must not probe Ollama");
      await vscode.commands.executeCommand("lineloom.checkConnection");
      assert.equal(modelListCalls, baselineModelListCalls + 1,
        "The explicit Check Ollama Connection command must query the model list once");
      const baselineGenerationCalls = generationCalls;
      await vscode.commands.executeCommand("lineloom.checkActiveFilePrivacy");
      assert.equal(generationCalls, baselineGenerationCalls,
        "An explicit file privacy inspection must not generate model completions");
      await configuration.update("languageModels", {}, vscode.ConfigurationTarget.Global);
      await configuration.update("debounceMs", 0, vscode.ConfigurationTarget.Global);
      await configuration.update("excludedPaths", [], vscode.ConfigurationTarget.Global);
      await configuration.update("autoTrigger", true, vscode.ConfigurationTarget.Global);
      await configuration.update("suppressMidTokenAuto", true, vscode.ConfigurationTarget.Global);
      await configuration.update("enabledLanguages", ["python", "javascript", "typescript", "rust", "kotlin", "go", "java", "c", "cpp"], vscode.ConfigurationTarget.Global);
      await configuration.update("languageModels", { typescript: "uninstalled-active-model:latest" }, vscode.ConfigurationTarget.Global);
      await vscode.window.showTextDocument(permitted);
      const activeCheckCalls = modelListCalls;
      const beforeCheckGenerations = generationCalls;
      await vscode.commands.executeCommand("lineloom.refreshSidebar");
      assert.equal(modelListCalls, activeCheckCalls, "Sidebar rendering must not inspect active model remotely");
      await vscode.commands.executeCommand("lineloom.checkActiveModel");
      assert.equal(modelListCalls, activeCheckCalls + 1,
        "The explicit active-model command must list models once, even with an override");
      assert.equal(generationCalls, beforeCheckGenerations, "Checking the active model must not send source");
      await configuration.update("languageModels", {}, vscode.ConfigurationTarget.Global);
      // Diagnostics must capture only aggregate timings after explicit opt-in.
      resetEligibilityTimings();
      await configuration.update("performanceDiagnostics", true, vscode.ConfigurationTarget.Global);
      await configuration.update("crossFileContext", false, vscode.ConfigurationTarget.Global);
      assert.equal(await mayComplete(permitted, [], true), true);
      const timingReport = getEligibilityTimingSummary();
      assert.equal(timingReport.checks, 1);
      assert.equal(timingReport.allowed, 1);
      assert.equal(timingReport.denied, 0);
      await vscode.commands.executeCommand("lineloom.resetPrivacyTimings");
      assert.equal(vscode.workspace.getConfiguration("lineloom").get<boolean>("performanceDiagnostics"), true,
        "Manual timing reset must preserve diagnostics opt-in");
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
        const callback = first[0].command;
        assert.equal(callback?.command, "lineloom.recordSuggestionAccepted");
        assert.equal(callback?.arguments?.length, 1);
        const oneTimeToken = callback.arguments?.[0];
        assert.equal(typeof oneTimeToken, "string");
        assert.equal(engine.getStats().accepted, 0, "Offering ghost text does not imply acceptance");
        assert.equal(engine.recordAcceptance("invented-token"), false);
        assert.equal(engine.recordAcceptance(oneTimeToken), true);
        assert.equal(engine.recordAcceptance(oneTimeToken), false, "Replay cannot double-count");
        assert.equal(engine.getStats().accepted, 1);
        assert.equal(lastModelSent, "lineloom-typed:latest", "TypeScript must use its assigned Ollama model");
        const second = await engine.provideInlineCompletionItems(document, position, trigger, cancellation.token);
        assert.ok(second?.length, "Expected reuse of the cached inline completion");
        assert.equal(second[0].insertText, "42");
        assert.equal(second[0].command?.command, "lineloom.recordSuggestionAccepted");
        assert.equal(engine.getStats().cacheHits, 1, "Expected an exact suggestion cache hit");

        // Real editor-host privacy regression: no cross-file source enters the
        // request while the preference is disabled, even with a stored selection.
        engine.setRelatedFiles([permitted.uri]);
        const disabledContext = await engine.provideInlineCompletionItems(
          document, position, trigger, cancellation.token
        );
        assert.ok(disabledContext?.length);
        assert.equal(lastPromptSent.includes("Reference 1 (untrusted)"), false,
          "Opted-out completion must not include selected related source");

        // The only additional source is the user's explicit, bounded,
        // same-workspace selection, checked with the real editor privacy gate.
        await configuration.update("crossFileContext", true, vscode.ConfigurationTarget.Global);
        engine.setRelatedFiles([permitted.uri]);
        const selectedContext = await engine.provideInlineCompletionItems(
          document, position, trigger, cancellation.token
        );
        assert.ok(selectedContext?.length, "Allowed user-selected related file should complete");
        assert.equal(lastPromptSent.includes("Reference 1 (untrusted)"), true,
          "Opted-in related file must be passed as untrusted reference text");
        assert.equal((await collectRelatedText(document, [permitted.uri], [], () => true))?.length, 1);
        assert.equal(isSupportedRelatedCandidate(document.uri, permitted.uri), true);
        assert.equal(isSupportedRelatedCandidate(document.uri, document.uri), false);
        assert.equal(await collectRelatedText(document, [document.uri], [], () => true), undefined,
          "Active source must not be duplicated as an extra reference");
        assert.equal(await collectRelatedText(document, [permitted.uri, permitted.uri], [], () => true), undefined,
          "Duplicate selected file must fail closed instead of repeating source");
        assert.equal(await collectRelatedText(document,
          [permitted.uri, deniedByApp.uri, deniedByGit.uri], [], () => true), undefined,
          "Oversized selection must be refused before any selected file read");
        assert.equal(await collectRelatedText(document, [permitted.uri], [], () => false), undefined,
          "Cancelled selection must not read or send source");

        // A related file may be edited while a genuine Ollama request is in
        // flight. Re-read and discard the now-stale response before display.
        const originalRelatedBytes = await vscode.workspace.fs.readFile(permitted.uri);
        engine.setRelatedFiles([permitted.uri]);
        const relatedRequestStarted = new Promise<void>(resolve => { heldGenerationStarted = resolve; });
        holdGeneration = true;
        const obsoleteRelatedRequest = engine.provideInlineCompletionItems(
          document, position, trigger, cancellation.token
        );
        try {
          await Promise.race([
            relatedRequestStarted,
            new Promise<never>((_resolve, reject) =>
              setTimeout(() => reject(new Error("Selected-file mock request did not start")), 8000))
          ]);
          await vscode.workspace.fs.writeFile(permitted.uri, Buffer.from("export const changed = 7;\n"));
          releaseHeldGeneration?.();
          assert.equal(await obsoleteRelatedRequest, undefined,
            "Model output using superseded related-file bytes must not be displayed");
        } finally {
          holdGeneration = false;
          releaseHeldGeneration?.();
          // Retain the callback type: the mock server assigns it asynchronously.
          // Resetting it here narrows later optional calls to 'never' in TypeScript.
          await vscode.workspace.fs.writeFile(permitted.uri, originalRelatedBytes);
          clearIgnoreCache();
          engine.cancel();
        }

        // Clearing consent while inference is still in flight must abort the
        // model response even if both the editor bytes and selected source
        // contents are unchanged. The old response must not fill the cache.
        engine.setRelatedFiles([permitted.uri]);
        const revokedStart = new Promise<void>(resolve => { heldGenerationStarted = resolve; });
        holdGeneration = true;
        const revokedRequest = engine.provideInlineCompletionItems(
          document, position, trigger, cancellation.token
        );
        try {
          await Promise.race([
            revokedStart,
            new Promise<never>((_resolve, reject) =>
              setTimeout(() => reject(new Error("Consent-revocation request did not start")), 8000))
          ]);
          engine.setRelatedFiles([]);
          releaseHeldGeneration?.();
          assert.equal(await revokedRequest, undefined,
            "Revoked related-file consent must discard any in-flight response");
          assert.equal(engine.getRelatedFileCount(), 0,
            "Revoked consent must erase selection immediately");
        } finally {
          holdGeneration = false;
          releaseHeldGeneration?.();
          engine.cancel();
        }

        // An excluded related file must suppress the request, not silently
        // drop only that reference and still send a prompt.
        engine.setRelatedFiles([deniedByApp.uri]);
        const requestsBeforeRelatedDeny = generationCalls;
        const refusedRelated = await engine.provideInlineCompletionItems(
          document, position, trigger, cancellation.token
        );
        assert.equal(refusedRelated, undefined);
        assert.equal(generationCalls, requestsBeforeRelatedDeny,
          "Excluded selected related file must not cause a model request");

        // Clearing selection or opting out restores ordinary cursor-only context.
        engine.setRelatedFiles([]);
        await configuration.update("crossFileContext", false, vscode.ConfigurationTarget.Global);
        const clearedRelated = await engine.provideInlineCompletionItems(
          document, position, trigger, cancellation.token
        );
        assert.ok(clearedRelated?.length);
        assert.equal(lastPromptSent.includes("Reference 1 (untrusted)"), false);

        // Inference duration diagnostics are opt-in, unlike source-free
        // request counters. Opt-out must clear measurements without disabling
        // completion or erasing request / success counts.
        assert.equal(engine.getStats().measuredRequests, 0,
          "No inference duration must be recorded while diagnostics are disabled");
        await configuration.update("performanceDiagnostics", true, vscode.ConfigurationTarget.Global);
        engine.cancel();
        const measured = await engine.provideInlineCompletionItems(document, position, trigger, cancellation.token);
        assert.ok(measured?.length, "Opted-in completion should remain available");
        assert.equal(engine.getStats().measuredRequests, 1);
        assert.equal(engine.getStats().recentLatencySamples, 1);
        assert.ok((engine.getStats().recentLatencyP50Ms ?? -1) >= 0);
        assert.equal(engine.getStats().recentLatencyP95Ms, engine.getStats().recentLatencyP50Ms);
        const requestsBeforeOptOut = engine.getStats().requests;
        const completedBeforeOptOut = engine.getStats().completions;
        await configuration.update("performanceDiagnostics", false, vscode.ConfigurationTarget.Global);
        // This test engine is separate from the activated extension and does
        // not subscribe to configuration changes; simulate the same opt-out.
        engine.clearLatencyMeasurements();
        assert.equal(engine.getStats().measuredRequests, 0);
        assert.equal(engine.getStats().lastLatencyMs, 0);
        assert.equal(engine.getStats().totalLatencyMs, 0);
        assert.equal(engine.getStats().recentLatencySamples, 0);
        assert.equal(engine.getStats().recentLatencyP95Ms, undefined);
        assert.equal(engine.getStats().requests, requestsBeforeOptOut);
        assert.equal(engine.getStats().completions, completedBeforeOptOut);
        engine.cancel();
        const unmeasured = await engine.provideInlineCompletionItems(document, position, trigger, cancellation.token);
        assert.ok(unmeasured?.length, "Opting out must not disable ordinary inference");
        assert.equal(engine.getStats().measuredRequests, 0,
          "Opted-out inference must not restore erased latency samples");
        // Simulate a late response started under an earlier opt-in session.
        await configuration.update("performanceDiagnostics", true, vscode.ConfigurationTarget.Global);
        engine.cancel();
        const lateStarted = new Promise<void>((resolve) => { heldGenerationStarted = resolve; });
        holdGeneration = true;
        const lateSample = engine.provideInlineCompletionItems(document, position, trigger, cancellation.token);
        try {
          await Promise.race([
            lateStarted,
            new Promise<never>((_resolve, reject) => setTimeout(
              () => reject(new Error("Latency sample mock did not begin")), 8_000
            ))
          ]);
          await configuration.update("performanceDiagnostics", false, vscode.ConfigurationTarget.Global);
          engine.clearLatencyMeasurements();
          await configuration.update("performanceDiagnostics", true, vscode.ConfigurationTarget.Global);
          releaseHeldGeneration?.();
          await lateSample;
          assert.equal(engine.getStats().measuredRequests, 0,
            "A response started before opt-out must not repopulate a new opt-in session");
          assert.equal(engine.getStats().recentLatencySamples, 0,
            "Late response must not restore cleared percentile samples");
        } finally {
          holdGeneration = false;
          releaseHeldGeneration?.();
          // The next mock-server request replaces these callbacks before use.
          // Assigning undefined here narrows the later fixture's optional
          // callback to `never` in TypeScript's synchronous control flow.
          await configuration.update("performanceDiagnostics", false, vscode.ConfigurationTarget.Global);
          engine.clearLatencyMeasurements();
        }


        // A mocked Ollama response can contain Unicode bidi controls that
        // visually reorder code. Never offer or cache that ghost text.
        mockUnsafeOutput = true;
        engine.cancel();
        const callsBeforeUnsafe = generationCalls;
        const unsafe = await engine.provideInlineCompletionItems(document, position, trigger, cancellation.token);
        assert.equal(unsafe, undefined, "Unsafe model text must not be inserted as a suggestion");
        assert.equal(generationCalls, callsBeforeUnsafe + 1,
          "The unsafe response should exercise the genuine model request path");
        mockUnsafeOutput = false;
        engine.cancel();
        const recovered = await engine.provideInlineCompletionItems(document, position, trigger, cancellation.token);
        assert.equal(recovered?.[0]?.insertText, "42",
          "A subsequent clean response must still work after rejection");


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
        // A mocked transient 503 should back off automatic *network* attempts,
        // but a manual invocation bypasses the cooldown immediately. Success
        // on that manual retry clears the profile's cooldown.
        await configuration.update("model", "lineloom-transient:latest", vscode.ConfigurationTarget.Global);
        mockTransientFailure = true;
        engine.resetTransientFailures();
        engine.cancel();
        const transientFirst = await engine.provideInlineCompletionItems(
          document, position, automatic, cancellation.token);
        assert.equal(transientFirst, undefined);
        const transientCalls = generationCalls;
        const transientAgain = await engine.provideInlineCompletionItems(
          document, position, automatic, cancellation.token);
        assert.equal(transientAgain, undefined);
        assert.equal(generationCalls, transientCalls, "Automatic retry should defer during transient cooldown");
        assert.ok(engine.getStats().suppressedTransientRetries >= 1);
        mockTransientFailure = false;
        const transientManual = await engine.provideInlineCompletionItems(
          document, position, trigger, cancellation.token);
        assert.ok(transientManual?.length, "Manual completion must bypass and clear transient cooldown");
        assert.equal(generationCalls, transientCalls + 1);
        // Keep other model profiles independent of the failed endpoint/model.
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
        // Session reset erases counters, cooldown and pending acceptance
        // acknowledgements without affecting model/language/privacy settings.
        const oldAcceptedItem = manualMidToken?.[0];
        const oldToken = oldAcceptedItem?.command?.arguments?.[0];
        assert.equal(typeof oldToken, "string");
        assert.ok(engine.getStats().requests > 0);
        const previousEnabled = configuration.get("enabled", true);
        const previousModel = configuration.get("model");
        const previousLanguages = configuration.get("enabledLanguages");
        engine.resetSessionActivity();
        const blank = engine.getStats();
        assert.equal(blank.requests, 0);
        assert.equal(blank.completions, 0);
        assert.equal(blank.accepted, 0);
        assert.equal(blank.failed, 0);
        assert.equal(blank.cancelled, 0);
        assert.equal(blank.suppressedTransientRetries, 0);
        assert.equal(blank.recentLatencySamples, 0);
        assert.equal(engine.recordAcceptance(oldToken), false,
          "Stale suggestion acceptance must not repopulate reset counters");
        assert.equal(configuration.get("enabled", true), previousEnabled);
        assert.equal(configuration.get("model"), previousModel);
        assert.deepEqual(configuration.get("enabledLanguages"), previousLanguages);
        assert.equal(engine.getRelatedFileCount(), 0);

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
      await configuration.update("crossFileContext", oldValues.crossFileContext, vscode.ConfigurationTarget.Global);
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
