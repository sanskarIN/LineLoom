# Development host

Run `npm ci` with Node.js 22+, then open the repository in VS Code and press **F5**. Select **Run LineLoom Extension**. The `npm: build` task creates the esbuild bundle before the Extension Development Host launches.

Use `npm run watch` during development and `npm run check` for TypeScript, linting, tests and bundling. `npm run test:integration` invokes the official VS Code extension test runner and downloads a VS Code build. Linux CI uses `xvfb-run -a npm run test:integration`.

Mocked integration does not prove real-model completion quality or visible ghost text; install Ollama manually and test in the editor before releasing.
