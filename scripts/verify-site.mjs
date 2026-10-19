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

test("static site identity follows the preview manifest", () => {
  assert.equal(pkg.publisher, "SanskarCodes");
  assert.equal(pkg.version, "0.9.3");
  assert.match(page, /v0\.9\.3 preview/);
  assert.match(page, /LineLoom-0\.9\.3\.vsix/);
  assert.match(page, /v0\.9\.3/);
  assert.ok(!page.includes("LineLoom-0.9.2.vsix"), "obsolete download link");
  assert.match(page, /github\.com\/sanskarIN\/LineLoom/);
  assert.match(page, /not an actual model benchmark or editor screenshot/);
});

test("site has semantic layout, accessible navigation, honest preview privacy copy", () => {
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
    'GitHub pre-release',
    "does <strong>not</strong> provide comprehensive content-level secret detection",
    "no built-in telemetry",
    "not implemented in this preview",
    "Go, Java, C and C++ are experimental",
  ]) assert.ok(page.includes(fragment), "Missing site requirement: " + fragment);
  assert.match(page, /pre-release/i);
  assert.doesNotMatch(page, /https?:\/\/(marketplace\.visualstudio\.com\/items\?|open-vsx\.org\/extension\/)/, "Do not invent marketplace listing URLs");
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
