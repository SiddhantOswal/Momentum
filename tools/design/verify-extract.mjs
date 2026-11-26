// Proves that extract.mjs keeps every style a screen needs: renders the original file and the
// extracted markup plus CSS in the same browser and compares the screenshots byte for byte.
//
//   MOMENTUM_CHROMIUM=/path/to/chrome node tools/design/verify-extract.mjs [ScreenId ...]
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const root = resolve("docs/arc/design/source");
const screens = process.argv.length > 2
  ? process.argv.slice(2)
  : (await readdir(`${root}/html/dark`)).map((file) => file.replace(/\.html$/, ""));
const browser = await chromium.launch(process.env.MOMENTUM_CHROMIUM ? { executablePath: process.env.MOMENTUM_CHROMIUM } : {});
const extract = (screen, theme, part) => execFileSync("node", ["tools/design/extract.mjs", screen, "--theme", theme, "--part", part], { encoding: "utf8" }).split("\n").slice(1).join("\n");
let different = 0;

for (const theme of ["dark", "light"]) {
  for (const screen of screens) {
    const original = await readFile(`${root}/html/${theme}/${screen}.html`, "utf8");
    const rebuilt = `<!doctype html><html><head><meta charset="utf-8"><style>${extract(screen, theme, "css")}</style></head><body>${extract(screen, theme, "markup")}</body></html>`;
    const hashes = [];
    for (const html of [original, rebuilt]) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
      await page.route(/^https?:/, (route) => route.abort());
      await page.setContent(html.replaceAll("../../assets/", `file://${root}/assets/`), { waitUntil: "load" });
      // The Main illustration animates regardless of reduced motion; freeze it so renders are comparable.
      await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}" });
      hashes.push(createHash("sha256").update(await page.screenshot({ fullPage: true })).digest("hex"));
      await page.close();
    }
    if (hashes[0] !== hashes[1]) { different++; console.log(`DIFFERENT ${theme} ${screen}`); }
  }
}
await browser.close();
console.log(different ? `${different} differ` : `all ${screens.length * 2} identical`);
process.exit(different ? 1 : 0);
