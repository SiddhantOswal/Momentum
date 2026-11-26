// Checks the held and partial states of Preparation Flow in the development preview, where fixtures
// drive them (no stored record exists yet, DR-006). Exits non-zero on the first failed check.
//   node tools/visual/prep-flow-states.mjs [http://127.0.0.1:5173/app/]
import { chromium } from "playwright";
const base = process.argv[2] ?? "http://127.0.0.1:5173/app/";
const browser = await chromium.launch();
let failed = 0;
const check = (name, ok) => { console.log(`${ok ? "pass" : "FAIL"} ${name}`); if (!ok) failed += 1; };
for (const [state, title, current] of [["held", "Order is unclear", "Catalog match"], ["partial", "Explanation did not finish", "Risk evidence"]]) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${base}#/_prep-flow?state=${state}`);
  await page.waitForSelector(".pf-page");
  check(`${state}: toast shows`, await page.getByRole("alert").filter({ hasText: title }).isVisible());
  check(`${state}: current step is ${current}`, (await page.locator('.pf-node[aria-current="step"]').innerText()).includes(current));
  await page.getByRole("button", { name: "Dismiss" }).click();
  check(`${state}: toast dismisses`, (await page.getByRole("alert").count()) === 0);
  const box = page.getByRole("checkbox").first();
  await box.focus(); await page.keyboard.press("Space");
  check(`${state}: first way out ticks from the keyboard`, await box.isChecked());
  for (const name of ["Open New Lot", /New Lot/]) {
    await page.goto(`${base}#/_prep-flow?state=${state}`);
    await page.waitForSelector(".pf-page");
    await page.getByRole("button", { name }).first().click();
    check(`${state}: ${name} opens New Lot`, page.url().endsWith("#/new-lot"));
  }
  check(`${state}: no horizontal overflow`, !(await page.evaluate(() => document.scrollingElement.scrollWidth > window.innerWidth)));
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
