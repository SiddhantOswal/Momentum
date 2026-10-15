import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isImpactSummary } from "../src/impact-ui.js";

const summary = {
  ok: true,
  source: "bigquery",
  kpis: {
    lotsScored: 219,
    lotsChanged: 207,
    netSavingMonth: 7320,
    kgSavedMonth: 138,
    scrapPctBefore: 7.06,
    scrapPctAfter: 6.39,
    scrapCostBefore: 78774,
    scrapCostAfter: 71434,
    currency: "INR",
  },
  monthly: [{
    month: "2026-09",
    lots: 219,
    scrapCost: 78776,
    scrapKg: 1478,
    avgScrapPct: 7.06,
    series: "simulated",
  }],
  seasonal: [{
    season: "Monsoon",
    warp: 2.2,
    delam: 1.4,
    strength: 1.3,
    print: 0.7,
    crack: 0.4,
  }],
  topItems: [{
    itemCode: "PKBX0041",
    description: "B1047",
    lots: 42,
    avgScrapPct: 7.1,
    scrapCost12m: 15000,
    mainDefect: "WARP",
  }],
  counterfactual: {
    month: "2026-09",
    scrapCost: 71454,
    currency: "INR",
    label: "September 2026 with agent settings (counterfactual, not observed production)",
  },
};

test("Impact UI accepts the validated summary and honest cached-source shape", () => {
  assert.equal(isImpactSummary(summary), true);
  assert.equal(isImpactSummary({ ...summary, source: "bigquery-cache" }), true);
});

test("Impact UI accepts empty historical tables without substituting values", () => {
  assert.equal(isImpactSummary({
    ...summary,
    monthly: [],
    seasonal: [],
    topItems: [],
  }), true);
});

test("Impact UI rejects unavailable, malformed, inconsistent and unsafe display data", () => {
  assert.equal(isImpactSummary({ ok: false, error: { code: "SERVICE_UNAVAILABLE" } }), false);
  assert.equal(isImpactSummary({ ...summary, source: "preview" }), false);
  assert.equal(isImpactSummary({ ...summary, monthly: [{ ...summary.monthly[0], month: "2026-13" }] }), false);
  assert.equal(isImpactSummary({ ...summary, monthly: [{ ...summary.monthly[0], scrapCost: Number.NaN }] }), false);
  assert.equal(isImpactSummary({ ...summary, kpis: { ...summary.kpis, lotsChanged: 220 } }), false);
  assert.equal(isImpactSummary({
    ...summary,
    counterfactual: { ...summary.counterfactual, label: "measured production savings" },
  }), false);
});

test("Impact dashboard renders query data as text instead of HTML", () => {
  const html = readFileSync(new URL("../public/impact.html", import.meta.url), "utf8");
  assert.doesNotMatch(html, /\.innerHTML\s*=/);
  assert.doesNotMatch(html, /insertAdjacentHTML\s*\(/);
  assert.match(html, /url=\/#screen-impact/);
  const code = readFileSync(new URL("../src/ui/workflow.js", import.meta.url), "utf8");
  assert.match(code, /payload\.topItems\.map\(\(row\) => \[/);
  assert.match(code, /row\.label, row\.lots/);
  assert.match(code, /isImpactSummary\(payload\)/);
  assert.doesNotMatch(code, /\.innerHTML\s*=/);
});
