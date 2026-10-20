import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dir = resolve(root, "site");
const page = readFileSync(resolve(dir, "index.html"), "utf8");
const css = readFileSync(resolve(dir, "styles.css"), "utf8");
const js = readFileSync(resolve(dir, "site.js"), "utf8");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));

test("static site identity follows the release manifest", () => {
  assert.equal(pkg.publisher, "SanskarCodes");
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
  assert.ok(page.includes("v" + pkg.version + " pre-release"));
  assert.ok(page.includes("v1.0.0 stable"), "Stable registry version must remain visible");
  assert.ok(page.includes("LineLoom-" + pkg.version + ".vsix"));
  assert.ok(page.includes("v" + pkg.version));
  assert.ok(!page.includes("LineLoom-0.9.5.vsix"), "obsolete download link");
  assert.match(page, /github\.com\/sanskarIN\/LineLoom/);
  assert.match(page, /not an actual model benchmark or editor screenshot/);
});

test("site has semantic layout, accessible navigation, honest stable-release privacy copy", () => {
  for (const fragment of [
    '<html lang="en">',
    'name="viewport"',
    'name="description"',
    'name="robots"',
    'rel="canonical"',
    'class="skip-link"',
    '<main id="main">',
    'aria-label="Main navigation"',
    'id="features"',
    'id="install"',
    'id="privacy"',
    'id="faq"',
    'GitHub stable release',
    "does <strong>not</strong> provide comprehensive content-level secret detection",
    "no built-in telemetry",
    "not implemented in this release",
    "Go, Java, C and C++ remain experimental",
  ]) assert.ok(page.includes(fragment), "Missing site requirement: " + fragment);
  assert.match(page, /stable release/i);
  // Both official registries have publicly listed stable v1.0.0.
  assert.ok(page.includes("https://open-vsx.org/extension/SanskarCodes/lineloom"), "Open VSX listing must be linked");
});

test("every local asset and fragment navigation target exists", () => {
  const assetRefs = [...page.matchAll(/(?:href|src)="(\.\/[^"]+)"/g)].map(m => m[1]);
  assert.ok(assetRefs.length >= 4, "expected local CSS, JS and icon assets");
  for (const ref of assetRefs) assert.ok(existsSync(resolve(dir, ref)), "Missing asset: " + ref);
  const ids = new Set([...page.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
  for (const [, id] of page.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.has(id), "Broken fragment link: #" + id);
});

test("site JavaScript uses textContent and safe clipboard API", () => {
  assert.match(js, /navigator\.clipboard/);
  assert.match(js, /textContent/);
  assert.doesNotMatch(js, /innerHTML|eval\s*\(|fetch\s*\(/);
});

test("CSS supports mobile, keyboard focus and reduced motion", () => {
  assert.match(css, /@media\(max-width:720px\)/);
  assert.match(css, /@media\(max-width:500px\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /focus-visible/);
});

test("social preview and brand icon are locally bundled SVG files", () => {
  const logo = readFileSync(resolve(dir, "assets/lineloom.svg"), "utf8");
  const preview = readFileSync(resolve(dir, "assets/social-preview.svg"), "utf8");
  assert.match(logo, /<svg/);
  assert.match(preview, /<svg/);
  assert.match(preview, /LineLoom/);
  assert.ok(existsSync(resolve(dir, ".nojekyll")));
});


test("VS Code installation guide covers Visual Studio VSIX Installer association", () => {
  const guide = readFileSync(resolve(dir, "install.html"), "utf8");
  assert.match(page, /href="\.\/install\.html"/);
  assert.match(guide, /Visual Studio VSIX Installer/);
  assert.match(guide, /One or more extensions are for Visual Studio Code/);
  assert.match(guide, /(?:do not|don\x27t) double-click/i);
  assert.match(guide, /Install from VSIX/);
  assert.match(guide, /code --install-extension/);
  assert.ok(guide.includes("LineLoom-" + pkg.version + ".vsix"));
  assert.match(guide, /v1\.1\.0 pre-release/);
  assert.match(guide, /SanskarCodes/);
  assert.ok(guide.includes("v" + pkg.version));
  for (const [, ref] of guide.matchAll(/(?:href|src)="(\.\/[^"]+)"/g)) {
    assert.ok(existsSync(resolve(dir, ref)), "Missing installation-guide asset: " + ref);
  }
  assert.ok(!guide.includes("Visual Studio Marketplace download"), "Do not claim marketplace publication");
});


test("official Marketplace and Open VSX listings are visible throughout published resources", () => {
  const marketplaceUrl = "https://marketplace.visualstudio.com/items?itemName=SanskarCodes.lineloom";
  const openVsxUrl = "https://open-vsx.org/extension/SanskarCodes/lineloom";
  const guide = readFileSync(resolve(dir, "install.html"), "utf8");
  const readme = readFileSync(resolve(root, "README.md"), "utf8");
  const publisherGuide = readFileSync(resolve(root, "docs/publishing.md"), "utf8");
  const releaseNotes = readFileSync(resolve(root, "docs/releases/v1.0.0.md"), "utf8");
  const roadmap = readFileSync(resolve(root, "docs/roadmap.md"), "utf8");
  const changelog = readFileSync(resolve(root, "CHANGELOG.md"), "utf8");
  const pagesGuide = readFileSync(resolve(root, "docs/github-pages.md"), "utf8");
  const troubleshooting = readFileSync(resolve(root, "docs/troubleshooting/README.md"), "utf8");

  for (const [label, content] of [
    ["homepage", page],
    ["install guide", guide],
    ["README", readme],
    ["publishing guide", publisherGuide],
    ["release notes", releaseNotes],
    ["roadmap", roadmap],
    ["changelog", changelog],
    ["Pages guide", pagesGuide],
    ["troubleshooting", troubleshooting],
  ]) {
    assert.ok(content.includes(marketplaceUrl), label + " should link to the published Microsoft Marketplace listing");
    assert.ok(content.includes(openVsxUrl), label + " should link to the published Open VSX listing");
  }
  assert.ok(page.includes('<a class="button button-primary" href="' + marketplaceUrl + '">'), "Marketplace should be the primary VS Code CTA");
  assert.ok(page.includes('<a class="button button-outline" href="' + openVsxUrl + '">'), "Open VSX should appear as a clear second download action");
  assert.ok(guide.includes('id="marketplace"'), "Installation guide should explain Microsoft Marketplace");
  assert.ok(guide.includes('id="open-vsx"'), "Installation guide should explain Open VSX");
  assert.ok(readme.includes("code --install-extension SanskarCodes.lineloom"), "VS Code CLI install command must be documented");
  assert.ok(readme.includes("LineLoom-1.0.0.vsix"), "GitHub VSIX fallback should remain available");
  assert.ok(page.includes("Open VSX currently shows no publisher verification badge"), "Avoid falsely claiming an Open VSX verified publisher");
  assert.ok(publisherGuide.includes("verified: false"), "Record verified-badge distinction accurately");
  assert.ok(!page.includes("Open VSX publication has not yet been verified"), "Remove old unlaunched registry language");
  assert.ok(!publisherGuide.includes("Open VSX is not published/verified yet"), "Remove old unlaunched registry language");
  assert.ok(!readme.includes("Open VSX publication is still"), "Remove old unlaunched registry language");
});
