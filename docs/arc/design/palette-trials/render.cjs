// Renders Home and Insights in each palette with FIXTURE data. Nothing here is live evidence.
// Usage: node render.cjs <baseUrl> <outDir>   (the app must be served at <baseUrl>/app/)
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const [base = "http://127.0.0.1:4190", out = path.join(__dirname, "out")] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const uri = (f) => "data:image/png;base64," + fs.readFileSync(path.join(__dirname, "assets", f)).toString("base64");
const css = fs.readFileSync(path.join(__dirname, "palettes.css"), "utf8")
  .replace("__LOGO_ON_LIGHT__", uri("logo-on-light.png")).replace("__LOGO_ON_DARK__", uri("logo-on-dark.png"));
const json = (body, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });

// Figures: model scores and impact month from docs/evidence (v3) and data/stale-claims.md; the PKBX0041 job
// from data/PKBX0041-m2-rerun.md (awaiting sign-off). Box style, flute and the two scrap-cost bars are
// placeholders. Cost before is set to 50,000 and cost after is before minus the net figure.
const R2 = [["WARP", 0.468], ["DELAM", 0.519], ["STRENGTH", 0.388], ["PRINT", 0.64], ["CRACK", 0.108]];
const STATUS = { ok: true, modelAcceptance: { status: "accepted", split: "holdout-2026-09: test split", evaluatedAt: "2026-11-20T09:10:00Z",
  models: R2.map(([defect, r2]) => ({ defect, resource: `prepagent.m2_${defect.toLowerCase()}`, r2, modelVersion: "v", sampleCount: 219 })) } };
const IMPACT = { ok: true, source: "bigquery", monthly: [], seasonal: [], topItems: [],
  kpis: { lotsScored: 219, lotsChanged: 218, netSavingMonth: 7927, kgSavedMonth: 149, scrapPctBefore: 7.06, scrapPctAfter: 6.36, scrapCostBefore: 50000, scrapCostAfter: 42073, currency: "INR" },
  counterfactual: { month: "2026-09", scrapCost: 42073, currency: "INR", label: "September 2026, modeled" } };
const JOB_ID = "JOB-FIXTURE-0001";
const base0 = { sfSpeedMpm: 48, rollTempC: 162, gumApplication: "HIGH", gumViscositySec: 32, pastingPressure: "MED", dryingHours: 5, printSpeedSpm: 60 };
const rec0 = { ...base0, rollTempC: 170, gumApplication: "MED", gumViscositySec: 45 };
const LOTS = { ok: true, mode: "memory", events: [
  { type: "lot.planned", lotId: JOB_ID, text: "Lot PKBX0041 planned · 1,300 units", at: new Date(Date.now() - 6 * 60000).toISOString(), actor: "Supervisor session" }],
  lots: [
    { lotId: JOB_ID, jobId: JOB_ID, orderId: "PO-1", itemCode: "PKBX0041", quantity: 1300, status: "planned", totalScrapPct: 5.58, primaryDefect: "WARP", lowConfidence: ["CRACK"], abstain: [], predictedSaving: 421, currency: "INR",
      changes: [{ lever: "rollTempC", from: 162, to: 170 }, { lever: "gumApplication", from: "HIGH", to: "MED" }, { lever: "gumViscositySec", from: 32, to: 45 }], updatedAt: new Date(Date.now() - 6 * 60000).toISOString() },
    { lotId: "JOB-FIXTURE-0000", jobId: "JOB-FIXTURE-0000", orderId: "PO-0", itemCode: "PKBX0017", quantity: 800, status: "approved", changes: [], updatedAt: new Date(Date.now() - 86400000).toISOString() }] };
const risk = (kg, cost, pct, r) => ({ ratesPct: r, totalScrapPct: pct, totalScrapKg: kg, scrapCost: cost, currency: "INR", primaryDefect: "WARP" });
const JOB = { ok: true, jobSheet: { jobId: JOB_ID, createdAt: new Date().toISOString(), plantId: "P1", status: "DRAFT", approvedAt: null, cardUri: null,
  order: { orderId: "PO-1", itemCode: "PKBX0041", customerId: "C1", boxStyle: "RSC", lengthMm: 300, widthMm: 200, heightMm: 150, ply: 5, fluteProfile: "BC", topLinerGsm: 150, fluteGsm: 120, innerLinerGsm: 150, linerBf: 18, paperType: "RECYCLED", paperSupplier: "SUP-D", inkColors: 1, inkCoveragePct: 10, quantity: 1300, sourcePoNumber: "PO-1" },
  conditions: { runDate: "2026-11-25", shift: "DAY", ambientRhPct: 42, ambientTempC: 18.5, paperMoisturePct: 7.3, supervisorConfirmed: true, conditionSource: "manual-entry" },
  baseline: { levers: base0, risk: risk(62.9, 3355, 6.38, { WARP: 1.482, DELAM: 1.779, STRENGTH: 0.743, PRINT: 1.754, CRACK: 0.621 }) },
  recommended: { levers: rec0, risk: { ...risk(55.1, 2934, 5.58, { WARP: 1.064, DELAM: 1.74, STRENGTH: 0.738, PRINT: 1.472, CRACK: 0.567 }),
    targetUse: Object.fromEntries(["WARP", "DELAM", "STRENGTH", "PRINT", "CRACK"].map((d) => [d, d === "CRACK" ? { useClass: "advisory", reason: "Little skill on the holdout." } : { useClass: "optimizer", reason: "Counted." }])) } },
  changes: [{ lever: "rollTempC", from: 162, to: 170, reason: "r" }, { lever: "gumApplication", from: "HIGH", to: "MED", reason: "r" }, { lever: "gumViscositySec", from: 32, to: 45, reason: "r" }],
  evidence: [], explanation: "Stored text.", savings: { kg: 7.8, amount: 421, currency: "INR" } } };

async function mock(page) {
  await page.route("**/api/**", (route) => {
    const p = new URL(route.request().url()).pathname;
    if (p === "/api/auth/config") return route.fulfill(json({ enabled: false, provider: "firebase-google" }));
    if (p === "/api/status") return route.fulfill(json(STATUS));
    if (p === "/api/lots") return route.fulfill(json(LOTS));
    if (p === "/api/live") return route.fulfill({ status: 200, contentType: "text/event-stream", body: `event: floor\ndata: ${JSON.stringify({ lots: LOTS.lots, events: LOTS.events })}\n\n` });
    return route.fulfill(json({ ok: false, error: { code: "ARC_NOT_ENABLED", message: "Arc is not enabled on this deployment." } }, 404));
  });
  await page.route("**/impact/summary", (r) => r.fulfill(json(IMPACT)));
  await page.route("**/jobs/*", (r) => r.fulfill(json(JOB)));
  await page.route("**/risk/explanation", (r) => r.fulfill(json({ ok: true, source: "bigquery-ml-and-gemini", explanation: "Text.", evidenceRefs: [], rows: [
    { defect: "WARP", predictedPct: 1.064, typicalPct: 1.4, driverRank: 1, driver: "ambient_rh_pct", attributionPts: 0.512 },
    { defect: "WARP", predictedPct: 1.064, typicalPct: 1.4, driverRank: 2, driver: "drying_hours", attributionPts: 0.033 },
    { defect: "WARP", predictedPct: 1.064, typicalPct: 1.4, driverRank: 3, driver: "gum_application", attributionPts: -0.104 }] })));
}

const VARIANTS = [
  ["yellow", { accent: "yellow" }], ["yellow-grey", { accent: "yellow", emph: "grey" }], ["washed", { accent: "washed" }],
  ["washed-grey", { accent: "washed", emph: "grey" }], ["yellow-butter", { accent: "yellow", emph: "butter" }], ["yellow-butter-light", { accent: "yellow", emph: "butter-light" }], ["yellow-outline", { accent: "yellow", emph: "outline" }], ["yellow-rail", { accent: "yellow", emph: "rail" }], ["yellow-tint", { accent: "yellow", emph: "tint" }],
].filter(([name]) => !process.argv[4] || name === process.argv[4]);

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  for (const [name, attrs] of VARIANTS) {
    for (const theme of ["light", "dark"]) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: theme });
      const page = await ctx.newPage();
      await mock(page);
      await page.addInitScript((t) => { try { localStorage.setItem("momentum-theme", t); } catch {} }, theme);
      for (const screen of ["home", "insights"]) {
        await page.goto(`${base}/app/#/${screen}`, { waitUntil: "networkidle" });
        if (name !== "current") {
          await page.addStyleTag({ content: css });
          await page.evaluate((a) => { if (a.palette) document.documentElement.dataset.palette = a.palette; if (a.accent) document.documentElement.dataset.accent = a.accent; if (a.emph) document.documentElement.dataset.emph = a.emph; }, attrs);
        }
        // Freeze the animations so every sample is the same frame.
        await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}" });
        await page.waitForTimeout(900);
        const file = path.join(out, `${screen}-${name}-${theme}.png`);
        await page.screenshot({ path: file, fullPage: true });
        console.log(file);
      }
      await ctx.close();
    }
  }
  await browser.close();
})();
