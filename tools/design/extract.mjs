// Prints one approved design screen with only the CSS its markup uses.
//
//   node tools/design/extract.mjs <ScreenId> [--theme dark|light] [--part all|markup|css|assets]
//
// Screen ids are the file names under docs/arc/design/source/html/<theme>/ (for example Plant-Explorer).
// The source files are read, never changed. Rules that cannot be matched to the markup are kept, so the
// output may be larger than strictly necessary but never drops a style the screen needs.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const [screen, ...rest] = process.argv.slice(2);
const option = (name, fallback) => { const i = rest.indexOf(`--${name}`); return i >= 0 ? rest[i + 1] : fallback; };
if (!screen || screen.startsWith("--")) { console.error("Usage: extract.mjs <ScreenId> [--theme dark|light] [--part all|markup|css|assets]"); process.exit(2); }
const theme = option("theme", "dark");
const part = option("part", "all");
if (!["dark", "light"].includes(theme) || !/^[A-Za-z0-9-]+$/.test(screen)) { console.error("Invalid screen or theme"); process.exit(2); }

const source = await readFile(resolve("docs/arc/design/source/html", theme, `${screen}.html`), "utf8");
const css = [...source.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((match) => match[1]).join("\n").replace(/\/\*[\s\S]*?\*\//g, "");
const markup = source.slice(source.indexOf("<body>") + 6, source.lastIndexOf("</body>")).trim();

const classes = new Set([...markup.matchAll(/class="([^"]*)"/g)].flatMap((match) => match[1].split(/\s+/)).filter(Boolean));
const ids = new Set([...markup.matchAll(/id="([^"]*)"/g)].map((match) => match[1]));
const tags = new Set([...markup.matchAll(/<([a-z][a-z0-9]*)/g)].map((match) => match[1]));

// Splits a stylesheet into top-level blocks, respecting nested braces (@media, @keyframes).
function blocks(text) {
  const result = [];
  let depth = 0, start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") depth++;
    if (text[i] === "}" && --depth === 0) { result.push(text.slice(start, i + 1).trim()); start = i + 1; }
  }
  const tail = text.slice(start).trim();
  if (tail) result.push(tail);
  return result.filter(Boolean);
}

function selectorUsed(selector) {
  const needed = [...selector.matchAll(/\.([\w-]+)/g)].map((match) => match[1]);
  const neededIds = [...selector.matchAll(/#([\w-]+)/g)].map((match) => match[1]);
  if (!needed.every((name) => classes.has(name)) || !neededIds.every((name) => ids.has(name))) return false;
  const bare = selector.replace(/\[[^\]]*\]|::?[\w-]+(\([^)]*\))?/g, "");
  const tagNames = [...bare.matchAll(/(?:^|[\s>+~])([a-z][a-z0-9]*)/g)].map((match) => match[1]);
  return tagNames.every((name) => tags.has(name) || name === "body" || name === "html");
}

function prune(text) {
  const kept = [];
  for (const block of blocks(text)) {
    if (block.startsWith("@keyframes") || block.startsWith("@font-face")) { kept.push(block); continue; }
    if (block.startsWith("@media")) {
      const head = block.slice(0, block.indexOf("{") + 1);
      const inner = prune(block.slice(head.length, block.lastIndexOf("}")));
      if (inner) kept.push(`${head}\n${inner}\n}`);
      continue;
    }
    const brace = block.indexOf("{");
    if (brace < 0) { kept.push(block); continue; }
    const selectors = block.slice(0, brace).split(",").map((selector) => selector.trim());
    if (selectors.some(selectorUsed)) kept.push(block);
  }
  // Keyframes stay only when a kept rule animates with them.
  return kept.filter((block) => {
    const name = block.match(/^@keyframes\s+([\w-]+)/)?.[1];
    return !name || kept.some((other) => other !== block && new RegExp(`animation[^;}]*\\b${name}\\b`).test(other));
  }).join("\n");
}

const assets = [...new Set([...markup.matchAll(/(?:src|href)="([^"#]+)"/g)].map((match) => match[1]).filter((value) => !value.startsWith("http")))];
const out = [];
if (part === "all" || part === "assets") out.push(`/* assets (relative to docs/arc/design/source/html/${theme}) */`, ...assets.map((asset) => `- ${asset}`));
if (part === "all" || part === "css") out.push(`/* css: ${theme}, ${screen} */`, prune(css));
if (part === "all" || part === "markup") out.push(`<!-- markup: ${theme}, ${screen} -->`, markup);
console.log(out.join("\n"));
