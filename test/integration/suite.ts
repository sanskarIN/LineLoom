import * as vscode from "vscode";
import * as assert from "node:assert/strict";
import * as http from "node:http";
import { generateCompletion, listModels, showModel } from "../../src/models/ollama";

export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension("sanskarIN.lineloom");
  assert.ok(extension, "VS Code must discover LineLoom");
  await extension.activate();
  const required = [
    "lineloom.enable", "lineloom.disable", "lineloom.trigger",
    "lineloom.selectModel", "lineloom.checkConnection", "lineloom.openSettings",
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
    await vscode.commands.executeCommand("lineloom.disable");
    assert.equal(vscode.workspace.getConfiguration("lineloom").get("enabled"), false);
    await vscode.commands.executeCommand("lineloom.enable");
    assert.equal(vscode.workspace.getConfiguration("lineloom").get("enabled"), true);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
