// Renders one approved design screen and the matching app route in the same browser, theme and
// viewport, writes both screenshots, and runs structural checks on the app page.
//
//   node tools/visual/capture.mjs --ref Plant-Explorer --route plant-explorer \
//        [--wait <selector>] [--viewports 1440x900,1280x800] [--themes dark,light] [--app http://127.0.0.1:5173/app/] [--out .visual]
//
// The reference HTML is served from docs/arc/design/source by a local read-only server. Requests to
// external hosts are answered locally, so the reference never touches the network.
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, token, index, all) => {
  if (token.startsWith("--")) pairs.push([token.slice(2), all[index + 1]]);
  return pairs;
}, []));
const required = ["ref", "route"];
for (const name of required) if (!args[name]) { console.error(`Missing --${name}`); process.exit(2); }

const viewports = (args.viewports ?? "1440x900,1280x800").split(",").map((v) => v.split("x").map(Number));
const themes = (args.themes ?? "dark,light").split(",");
const appBase = args.app ?? "http://127.0.0.1:5173/app/";
const outDir = resolve(args.out ?? ".visual");
const sourceRoot = resolve("docs/arc/design/source");
const fontFile = resolve("web/public/fonts/inter-latin.woff2");
const types = { ".html": "text/html", ".jpg": "image/jpeg", ".png": "image/png", ".woff2": "font/woff2" };

const server = createServer(async (request, response) => {
  const path = normalize(decodeURIComponent(new URL(request.url, "http://x").pathname));
  const file = path === "/_inter.woff2" ? fontFile : join(sourceRoot, path);
  if (path !== "/_inter.woff2" && !file.startsWith(sourceRoot)) { response.writeHead(403).end(); return; }
  try {
    response.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream" }).end(await readFile(file));
  } catch { response.writeHead(404).end(); }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const refBase = `http://127.0.0.1:${server.address().port}`;

// The design links its fonts from Google Fonts. Serve the app's own Inter instead so reference and
// app use identical glyphs; Inter Tight is mapped to Inter, matching the approved PNG renders.
const fontCss = `@font-face{font-family:'Inter';font-weight:100 900;src:url(${refBase}/_inter.woff2) format('woff2')}
@font-face{font-family:'Inter Tight';font-weight:100 900;src:url(${refBase}/_inter.woff2) format('woff2')}`;

const browser = await chromium.launch(process.env.MOMENTUM_CHROMIUM ? { executablePath: process.env.MOMENTUM_CHROMIUM } : {});
const report = [];

for (const [width, height] of viewports) {
  for (const theme of themes) {
    const dir = join(outDir, args.ref, `${width}x${height}`);
    await mkdir(dir, { recursive: true });
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: "reduce" });
    await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => {
      const url = route.request().url();
      return url.includes("fonts.googleapis.com")
        ? route.fulfill({ contentType: "text/css", body: fontCss })
        : route.abort();
    });

    const reference = await context.newPage();
    await reference.goto(`${refBase}/html/${theme}/${args.ref}.html`);
    await reference.evaluate(() => document.fonts.ready);
    await reference.screenshot({ path: join(dir, `${theme}-reference.png`), fullPage: true });

    const app = await context.newPage();
    await app.addInitScript((value) => { try { localStorage.setItem("momentum-theme", value); } catch { /* storage unavailable */ } }, theme);
    await app.goto(`${appBase}#/${args.route}`);
    await app.waitForSelector(".nav-item");
    if (args.wait) await app.waitForSelector(args.wait);
    await app.evaluate(() => document.fonts.ready);
    await app.screenshot({ path: join(dir, `${theme}-app.png`), fullPage: true });

    const checks = await app.evaluate(() => {
      const items = [...document.querySelectorAll(".sidebar .nav-item")];
      const labels = items.map((item) => item.textContent.trim());
      return {
        sidebarWidth: document.querySelector(".sidebar")?.getBoundingClientRect().width,
        navLabels: labels,
        duplicateNavLabels: labels.filter((label, i) => labels.indexOf(label) !== i),
        wrappedNavLabels: items.filter((item) => item.getBoundingClientRect().height > 44.5 || item.scrollWidth > item.clientWidth).map((item) => item.textContent.trim()),
        horizontalOverflow: document.scrollingElement.scrollWidth > window.innerWidth,
        theme: document.documentElement.dataset.theme,
      };
    });
    report.push({ viewport: `${width}x${height}`, theme, ...checks });
    await context.close();
  }
}

await browser.close();
server.close();
await writeFile(join(outDir, args.ref, "checks.json"), JSON.stringify(report, null, 2));
const failed = report.filter((r) => r.duplicateNavLabels.length || r.wrappedNavLabels.length || r.horizontalOverflow);
console.log(JSON.stringify({ screenshots: join(outDir, args.ref), runs: report.length, structuralFailures: failed.length }, null, 2));
process.exit(failed.length ? 1 : 0);
