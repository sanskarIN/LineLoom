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
  // The development manifest may be newer than publicly published builds.
  // Verify public stable and preview links separately from this source version.
  assert.match(pkg.version, /^1\.(?:2\.[1-9]\d*|3\.\d+|4\.\d+)$/);
  assert.ok(page.includes("Latest GitHub testing preview: v1.4.2"),
    "Current published GitHub preview must be discoverable alongside stable.");
  assert.ok(page.includes("LineLoom-1.4.2.vsix"), "Published preview VSIX must be linked");
  assert.ok(page.includes("LineLoom-1.4.2.sha256"), "Published preview checksum must be linked");
  assert.ok(!page.includes("v1.4.0 development (not released)"),
    "Do not describe a published preview as unreleased.");
  assert.ok(page.includes("v1.1.1 pre-release"));
  assert.ok(page.includes("v1.3.0 GitHub stable"), "Latest GitHub stable version must be visible");
  assert.ok(page.includes("v1.0.0"), "Historical v1.0.0 milestone should remain visible");
  assert.ok(page.includes("LineLoom-1.3.0.vsix"));
  assert.ok(page.includes("LineLoom-1.3.0.sha256"));
  assert.ok(page.includes("LineLoom-1.2.0.vsix") || page.includes("v1.2.0"), "Historical stable version must remain discoverable");
  assert.ok(page.includes("https://github.com/sanskarIN/LineLoom/releases/download/v1.3.0/LineLoom-1.3.0.vsix"));
  assert.ok(page.includes("v1.2.0"));
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
    "lineloom.crossFileContext",
    "Go, Java, C and C++ remain experimental",
  ]) assert.ok(page.includes(fragment), "Missing site requirement: " + fragment);
  assert.match(page, /stable release/i);
  // Both official registries have public listings, but publish versions independently.
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
  assert.ok(guide.includes("LineLoom-1.3.0.vsix"), "Install guide must offer the latest GitHub stable VSIX");
  assert.ok(guide.includes("Latest GitHub testing preview: v1.4.2"),
    "Current GitHub preview must appear in the install guide");
  assert.ok(guide.includes("LineLoom-1.4.2.vsix"),
    "Install guide must link the current preview VSIX");
  assert.ok(guide.includes("LineLoom-1.4.2.sha256"),
    "Install guide must link the current preview checksum");
  assert.match(guide, /v1\.1\.1 pre-release/);
  assert.match(guide, /SanskarCodes/);
  assert.ok(guide.includes("v1.2.0"));
  for (const [, ref] of guide.matchAll(/(?:href|src)="(\.\/[^"]+)"/g)) {
    assert.ok(existsSync(resolve(dir, ref)), "Missing installation-guide asset: " + ref);
  }
  assert.ok(!guide.includes("Visual Studio Marketplace download"), "Do not claim marketplace publication");
});


test("public maintainer links use the website without X or LinkedIn", () => {
  const readme = readFileSync(resolve(root, "README.md"), "utf8");
  const install = readFileSync(resolve(dir, "install.html"), "utf8");
  const pagesGuide = readFileSync(resolve(root, "docs/github-pages.md"), "utf8");

  for (const [label, contents] of [
    ["README", readme],
    ["homepage", page],
    ["installation guide", install],
    ["Pages guide", pagesGuide],
  ]) {
    assert.doesNotMatch(contents, /https?:\/\/(?:www\.)?(?:x\.com|twitter\.com|linkedin\.com)(?:\/|[?#]|$)/i,
      label + " should not advertise personal X, Twitter or LinkedIn links");
  }

  assert.match(readme, /Website: \[sanskarin\.github\.io\]\(https:\/\/sanskarin\.github\.io\/\)/);
  assert.ok(page.includes('<a href="https://sanskarin.github.io/">Maintainer website</a>'));
  assert.equal(pkg.homepage, "https://sanskarin.github.io/LineLoom/");
  assert.match(pagesGuide, /GitHub v1\.3\.0 stable is the latest publicly verified GitHub stable download/);
  assert.match(pagesGuide, /GitHub .*v1\.3\.1.*latest published pre-release/);
  assert.doesNotMatch(pagesGuide, /current stable version is v1\.0\.0/i);
});

test("published GitHub Packages CLI is correctly distinguished from editor registry and npmjs", () => {
  const readme = readFileSync(resolve(root, "README.md"), "utf8");
  const guide = readFileSync(resolve(dir, "install.html"), "utf8");
  const packagesDoc = readFileSync(resolve(root, "docs/packages.md"), "utf8");
  assert.match(readme, /Published on GitHub Packages \(2026-10-24\)/);
  assert.match(packagesDoc, /npm publish/);
  assert.match(packagesDoc, /not.*published on npmjs\.com/i);
  assert.match(guide, /id="package-manager"/);
  assert.match(guide, /@sanskarin\/lineloom-cli@0\.1\.0/);
  assert.match(guide, /authenticated read access/);
  assert.match(guide, /not.*published to npmjs\.com/i);
  assert.ok(page.includes("GitHub Packages"));
});

test("public registry evidence and stable versus preview stay distinct", () => {
  const pub = readFileSync(resolve(root, "docs/publishing.md"), "utf8");
  const guide = readFileSync(resolve(dir, "install.html"), "utf8");
  const readme = readFileSync(resolve(root, "README.md"), "utf8");
  assert.match(pub, /40201081119/);
  assert.match(pub, /preRelease: false/);
  assert.ok(page.includes("Open VSX v1.3.0 Stable"));
  assert.ok(guide.includes("Open VSX v1.3.0 Stable"));
  assert.ok(readme.includes("latest GitHub") || readme.includes("v1.3.1"));
  assert.ok(!page.includes("Open VSX v1.2.0 Stable"));
  assert.ok(!guide.includes("Open VSX v1.2.0 Stable"));
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
  assert.ok(readme.includes("LineLoom-1.2.0.vsix"), "GitHub stable VSIX fallback should remain available");
  assert.ok(page.includes("Open VSX v1.3.0 Stable"), "Homepage must state the verified Open VSX stable version");
  assert.ok(guide.includes("Open VSX v1.3.0 Stable"), "Installation guide must show the current Open VSX stable version");
  assert.ok(publisherGuide.includes("verified: true"), "Publishing guide must reflect the verified Open VSX registry response");
  assert.ok(!page.includes("Open VSX currently shows no publisher verification badge"), "Do not preserve obsolete publisher status");
  assert.ok(!page.includes("Open VSX publication has not yet been verified"), "Remove old unlaunched registry language");
  assert.ok(!publisherGuide.includes("Open VSX is not published/verified yet"), "Remove old unlaunched registry language");
  assert.ok(!readme.includes("Open VSX publication is still"), "Remove old unlaunched registry language");
});
