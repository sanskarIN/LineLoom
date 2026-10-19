# LineLoom GitHub Pages deployment

Website source: `site/` (standalone HTML, CSS, SVG and small JavaScript, with no external runtime dependencies). Intended public URL:

https://sanskarin.github.io/LineLoom/

## First-time GitHub Pages activation

The workflow `.github/workflows/pages.yml` builds from the `main` branch and deploys only the static `site/` directory. **GitHub Pages must be enabled for this repository with _GitHub Actions_ as its publishing source**, otherwise the `configure-pages` / `deploy-pages` action can fail or not create a publicly reachable site.

If the automatic run fails for this reason, a repository owner can:

1. Open **Repository → Settings → Pages** (https://github.com/sanskarIN/LineLoom/settings/pages).
2. Under **Build and deployment**, choose **Source: GitHub Actions**.
3. Return to **Actions → Deploy LineLoom GitHub Pages → Run workflow** on `main` (or re-run the failed job).
4. Wait until the workflow deploy job is green, then open https://sanskarin.github.io/LineLoom/ and check for an HTTP 200 response, styles, favicon, setup links and mobile layout.
5. Never mark the website as live solely because code or a workflow file exists in GitHub.

The workflow requires standard `pages: write` and `id-token: write` permissions on the deploy job and uses the `github-pages` environment to protect deployment.

## Local development and QA

```sh
npm run test:site
# In a static server opened from the repository root, serve site/ as the web root.
```

Use a local server (for example `npx serve site` if you already have that utility) and inspect keyboard tab navigation, contrast, 320px/768px/desktop layout, copy-button behavior and actual outbound links. The editor illustration is explicitly labeled an illustrative mockup, **not** a VS Code screenshot or measured output.

**Versioning:** Website links point to the v0.9.3 **GitHub pre-release**. A Page deployment can finish before the tagged GitHub release exists; the download URL only works after the release workflow succeeds. The site is intentionally independent from the binary packaging and is excluded from VSIX contents.

**Not provided by this deployment:** Marketplace or Open VSX publication, model downloads, hosted Ollama inference, stable v1.0.0 verification, or editor testing with real local models. See [publishing guide](publishing.md) and [stable gate](releases/v1.0.0.md).
