# LineLoom GitHub Pages deployment

Website source: `site/` (standalone HTML, CSS, SVG and small JavaScript, with no external runtime dependencies). Live public URL:

https://sanskarin.github.io/LineLoom/

**Official install destinations:** [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=SanskarCodes.lineloom) for VS Code and [Open VSX Registry](https://open-vsx.org/extension/SanskarCodes/lineloom) for compatible editors. GitHub [v1.3.0 stable](https://github.com/sanskarIN/LineLoom/releases/tag/v1.3.0) is publicly verified with [v1.3.0 GitHub VSIX](https://github.com/sanskarIN/LineLoom/releases/download/v1.3.0/LineLoom-1.3.0.vsix) and SHA-256 checksum. Open VSX v1.2.0 stable was independently confirmed, while Visual Studio Marketplace remains separately managed. A GitHub release does not publish any extension registry package.

## Verified Pages status (October 31, 2026)

The public site at https://sanskarin.github.io/LineLoom/ is accessible,
and the GitHub Actions workflow **Deploy LineLoom GitHub Pages** has
previously completed 31 runs; its latest listed success was October 27, 2026.
That confirms Pages is already activated for the repository. No settings
toggle is required to permit ordinary `site/**` updates. Changes merged to
`main` under `site/` trigger the existing deployment workflow; manual
`workflow_dispatch` is also supported. For new site changes, verify the
**new** Pages workflow run and the live URL independently rather than
assuming an earlier successful deployment proves the current version is live.

## First-time GitHub Pages activation (if disabled later)

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

**Versioning:** Website download links must target a **verified published GitHub release**, not the in-development version in `package.json`. GitHub v1.3.0 stable is the latest publicly verified GitHub stable download and GitHub [v1.4.2](https://github.com/sanskarIN/LineLoom/releases/tag/v1.4.2) is the latest verified published pre-release (separately from stable). Source v1.2.5 was an unreleased intermediate development version whose changes are included in v1.3.0. `npm run test:site` checks the explicitly labeled stable and preview links. The homepage links to both registries, with Marketplace as the primary VS Code install action, and the installation page retains the stable GitHub VSIX fallback. Publishing a Pages deployment does **not** publish a VSIX or update either registry. The website is excluded from VSIX contents.

**Public registry verification (2026-10-25):** Open VSX v1.3.0 Stable is its public/latest version, and Marketplace v1.3.0 was updated separately by the maintainer. Website deployment itself does not publish extensions. GitHub v1.4.2 remains preview only. Research-only changes in main, including the 40-case v9 model evaluation and paired local CLI, are not automatically part of that released VSIX.

**Not provided by this deployment:** Marketplace or Open VSX publication, model downloads, hosted Ollama inference, or editor testing with real local models. Those require independent publication or manual verification. See the [publishing guide](publishing.md), [v1.3.0 stable notes](releases/v1.3.0.md), and [v1.3.0 manual acceptance](qa/v1.3.0-manual-acceptance.md).
