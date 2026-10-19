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
  assert.ok(page.includes("v" + pkg.version + " stable"));
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
  // The official Microsoft Marketplace listing is now published; Open VSX is not.
  assert.doesNotMatch(page, /https?:\/\/open-vsx\.org\/extension\//, "Do not advertise an unpublished Open VSX listing");
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
  assert.match(guide, /Don't double-click/);
  assert.match(guide, /Install from VSIX/);
  assert.match(guide, /code --install-extension/);
  assert.ok(guide.includes("LineLoom-" + pkg.version + ".vsix"));
  assert.match(guide, /SanskarCodes/);
  assert.ok(guide.includes("v" + pkg.version));
  for (const [, ref] of guide.matchAll(/(?:href|src)="(\.\/[^"]+)"/g)) {
    assert.ok(existsSync(resolve(dir, ref)), "Missing installation-guide asset: " + ref);
  }
  assert.ok(!guide.includes("Visual Studio Marketplace download"), "Do not claim marketplace publication");
});


test("published Marketplace listing is primary and Open VSX remains pending", () => {
  const marketplaceUrl = "https://marketplace.visualstudio.com/items?itemName=SanskarCodes.lineloom";
  const guide = readFileSync(resolve(dir, "install.html"), "utf8");
  const readme = readFileSync(resolve(root, "README.md"), "utf8");
  const publisherGuide = readFileSync(resolve(root, "docs/publishing.md"), "utf8");
  const releaseNotes = readFileSync(resolve(root, "docs/releases/v1.0.0.md"), "utf8");
  const roadmap = readFileSync(resolve(root, "docs/roadmap.md"), "utf8");

  for (const [label, text] of [
    ["homepage", page],
    ["install guide", guide],
    ["README", readme],
    ["publishing guide", publisherGuide],
    ["release notes", releaseNotes],
    ["roadmap", roadmap],
  ]) {
    assert.ok(text.includes(marketplaceUrl), label + " must link to the official published listing");
  }
  assert.ok(page.includes('<a class="button button-primary" href="' + marketplaceUrl + '">'), "Homepage should prioritize Marketplace");
  assert.ok(guide.includes('id="marketplace"'), "Install page should include direct Marketplace instructions");
  assert.ok(guide.includes("code --install-extension SanskarCodes.lineloom"), "Marketplace CLI command should be shown");
  assert.ok(readme.includes("code --install-extension SanskarCodes.lineloom"), "README should include Marketplace CLI command");
  assert.ok(page.includes("Open VSX publication has not yet been verified"));
  assert.ok(publisherGuide.includes("Open VSX is not published/verified yet"));
  assert.ok(readme.includes("Open VSX publication is still"));
  assert.ok(!(page + guide + readme).includes("open-vsx.org/extension/"), "Do not invent an Open VSX listing");
});
