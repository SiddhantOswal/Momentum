// Drives New Lot through its six designed states against mocked API responses and screenshots each in
// both themes. The responses are fixtures from test/browser/new-lot-mock.js, so the run shows layout and
// request handling, not the real backend. Start the app first (PORT=4183 node index.mjs with the flags in
// playwright.config.js), then:
//   node tools/visual/new-lot-states.mjs .visual/NewLot [1024x768]
import { chromium } from "playwright";
import { mockNewLot, reachConditions, fillSettings } from "../../test/browser/new-lot-mock.js";
const out = process.argv[2];
const base = "http://127.0.0.1:4183";
const browser = await chromium.launch();
const run = async (theme, [w, h], state, scenario, drive) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.addInitScript((t) => localStorage.setItem("momentum-theme", t), theme);
  await mockNewLot(page, scenario);
  await drive(page);
  await page.waitForTimeout(300);
  const over = await page.evaluate(() => document.scrollingElement.scrollWidth > window.innerWidth);
  console.log(`${state} ${theme} ${w}x${h} overflowX=${over}`);
  await page.screenshot({ path: `${out}/${state}-${theme}-${w}x${h}.png`, fullPage: true });
  await ctx.close();
};
const p = (page) => page.goto(base + "/app/#/new-lot");
const toOrder = async (page) => { await p(page); await page.getByRole("button", { name: "PO1 Single line" }).click(); await page.getByText("Draft, not confirmed").waitFor(); };
const toCond = async (page) => { await toOrder(page); for (const l of ["The source line is the one you want","The quantity matches the order","The catalog item is the right box"]) await page.getByLabel(l).check(); await page.getByRole("button", { name: "Confirm order" }).click(); await page.getByText("Planned machine settings").waitFor(); };
const toPlan = async (page) => { await toCond(page); await page.getByLabel("Roll temperature").fill("162"); await page.getByLabel("Single facer speed").fill("40"); await page.getByLabel("Gum application").selectOption("HIGH"); await page.getByLabel("Gum viscosity").fill("32"); await page.getByLabel("Pasting pressure").selectOption("MED"); await page.getByLabel("Drying time").fill("8"); await page.getByLabel("Print speed").fill("50"); await page.getByRole("button", { name: "Plan this lot" }).click(); await page.waitForTimeout(500); };
const toReview = async (page) => { await toPlan(page); await page.getByRole("button", { name: /Review job card/ }).click(); await page.waitForTimeout(500); };
const sizes = process.argv[3] ? [process.argv[3].split("x").map(Number)] : [[1440, 900], [1280, 800]];
for (const theme of ["dark", "light"]) for (const s of sizes) {
  await run(theme, s, "order", {}, toOrder);
  await run(theme, s, "cond-empty", {}, toCond);
  await run(theme, s, "plan", {}, toPlan);
  await run(theme, s, "review", {}, toReview);
  await run(theme, s, "recovery", { explanation: "" }, toPlan);
  await run(theme, s, "stale", { stale: true }, toReview);
}
await browser.close();
