import esbuild from "esbuild";
const watch = process.argv.includes("--watch");
const ctx = await esbuild.context({ entryPoints: ["src/extension.ts"], outfile: "dist/extension.js", bundle: true, platform: "node", format: "cjs", target: "node20", external: ["vscode"], sourcemap: false, logLevel: "info" });
if (watch) await ctx.watch();
else { await ctx.rebuild(); await ctx.dispose(); }
