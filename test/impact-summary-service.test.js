import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createImpactSummaryService } from "../src/google-cloud/impact-summary-service.js";
import { createConfiguredServicePorts } from "../src/service-ports.js";

const sql = (name) => readFileSync(new URL(`../sql/${name}`, import.meta.url), "utf8");
const fixture = {
  kpis: {
    lots_scored: "219", lots_changed: "207", net_saving_month: "7320",
    kg_saved_month: "138", scrap_pct_before: "7.06", scrap_pct_after: "6.39",
    scrap_cost_before: "78774", scrap_cost_after: "71434", currency: "INR",
  },
  monthly: {
    month: "2026-09", lots: "219", scrap_cost: "78776", scrap_kg: "1478", avg_scrap_pct: "7.06",
  },
  seasonal: { season: "Monsoon", warp: "2.2", delam: "1.4", strength: "1.3", print: "0.7", crack: "0.4" },
  topItems: {
    item_code: "PKBX0041", description: "B1047", lots: "42", avg_scrap_pct: "7.1",
    scrap_cost_12m: "15000", main_defect: "WARP",
  },
};
const columns = {
  kpis: ["lots_scored", "lots_changed", "net_saving_month", "kg_saved_month", "scrap_pct_before", "scrap_pct_after", "scrap_cost_before", "scrap_cost_after", "currency"],
  monthly: ["month", "lots", "scrap_cost", "scrap_kg", "avg_scrap_pct"],
  seasonal: ["season", "warp", "delam", "strength", "print", "crack"],
  topItems: ["item_code", "lots", "avg_scrap_pct", "scrap_cost_12m", "main_defect"],
};

function response(name, row) {
  return {
    schema: { fields: columns[name].map((field) => ({ name: field })) },
    rows: [{ f: columns[name].map((field) => ({ v: row[field] })) }],
  };
}

function createService({ now = () => 10_000, fail = false } = {}) {
  let calls = 0;
  const service = createImpactSummaryService({
    now,
    bigquery: {
      query: async ({ sql: queryText }) => {
        calls += 1;
        if (typeof fail === "function" ? fail() : fail) throw new Error("offline");
        if (queryText.includes("dash_kpis.sql")) return response("kpis", fixture.kpis);
        if (queryText.includes("dash_monthly.sql")) return response("monthly", fixture.monthly);
        if (queryText.includes("dash_seasonal.sql")) return response("seasonal", fixture.seasonal);
        return response("topItems", fixture.topItems);
      },
    },
  });
  return { service, calls: () => calls };
}

test("Impact summary runs the supplied queries and labels September's counterfactual", async () => {
  const { service, calls } = createService();
  const result = await service();

  assert.equal(result.ok, true);
  assert.equal(result.source, "bigquery");
  assert.equal(calls(), 4);
  assert.deepEqual(result.kpis, {
    lotsScored: 219,
    lotsChanged: 207,
    netSavingMonth: 7320,
    kgSavedMonth: 138,
    scrapPctBefore: 7.06,
    scrapPctAfter: 6.39,
    scrapCostBefore: 78774,
    scrapCostAfter: 71434,
    currency: "INR",
  });
  assert.deepEqual(result.monthly[0], {
    month: "2026-09", lots: 219, scrapCost: 78776, scrapKg: 1478,
    avgScrapPct: 7.06, series: "simulated",
  });
  assert.equal(result.counterfactual.scrapCost, 71454);
  assert.match(result.counterfactual.label, /counterfactual, not observed production/);
  assert.deepEqual(result.topItems, [{
    label: "Item 1", lots: 42, avgScrapPct: 7.1, scrapCost12m: 15000, mainDefect: "WARP",
  }]);
  assert.doesNotMatch(JSON.stringify(result), /PKBX0041|B1047/);
});

test("Impact summary anonymizes hostile item identifiers and never returns item descriptions", async () => {
  const hostile = {
    ...fixture.topItems,
    item_code: "<img src=x onerror=alert(1)>",
    description: "Acme Customer Secret Carton",
  };
  const service = createImpactSummaryService({
    bigquery: { query: async ({ sql: queryText }) =>
      queryText.includes("dash_kpis.sql") ? response("kpis", fixture.kpis)
        : queryText.includes("dash_monthly.sql") ? response("monthly", fixture.monthly)
          : queryText.includes("dash_seasonal.sql") ? response("seasonal", fixture.seasonal)
            : response("topItems", hostile) },
  });
  const result = await service();
  assert.equal(result.ok, true);
  assert.doesNotMatch(JSON.stringify(result), /<img|onerror|Acme Customer Secret|PKBX0041|B1047/);
  assert.match(JSON.stringify(result.topItems), /Item 1/);
});

test("Impact summary caches successful live data for one hour", async () => {
  let clock = 10_000;
  const { service, calls } = createService({ now: () => clock });
  assert.equal((await service()).source, "bigquery");
  assert.equal((await service()).source, "bigquery-cache");
  assert.equal(calls(), 4);
  clock += 60 * 60 * 1000 + 1;
  assert.equal((await service()).source, "bigquery");
  assert.equal(calls(), 8);
});

test("expired Impact cache is not served as stale data when refresh fails", async () => {
  let clock = 10_000;
  const { service, calls } = createService({
    now: () => clock,
    fail: () => calls() > 4,
  });
  assert.equal((await service()).source, "bigquery");
  clock += 60 * 60 * 1000 + 1;
  assert.deepEqual(await service(), {
    ok: false,
    error: {
      code: "SERVICE_UNAVAILABLE",
      message: "Live Impact data is temporarily unavailable; preview values were not substituted.",
    },
  });
  assert.equal(calls(), 8);
});

test("Impact summary fails explicitly and never returns preview data after query failure", async () => {
  const { service } = createService({ fail: true });
  assert.deepEqual(await service(), {
    ok: false,
    error: {
      code: "SERVICE_UNAVAILABLE",
      message: "Live Impact data is temporarily unavailable; preview values were not substituted.",
    },
  });
});

test("Cloud runtime requires explicit opt-in for the Impact queries", () => {
  const disabled = createConfiguredServicePorts({
    env: { PROJECT_ID: "prepagent-hack" },
    modelConfig: { modelCallsEnabled: false },
    bucketConfig: {},
    tokenProvider: async () => "test-token",
  });
  assert.equal(disabled.availability.getImpactSummary, false);
  const enabled = createConfiguredServicePorts({
    env: { PROJECT_ID: "prepagent-hack", USTAAD_ENABLE_IMPACT_SUMMARY: "true" },
    modelConfig: { modelCallsEnabled: false },
    bucketConfig: {},
    tokenProvider: async () => "test-token",
  });
  assert.equal(enabled.availability.getImpactSummary, true);
});

test("the Impact adapter loads all four supplied SQL assets from the app SQL directory", () => {
  for (const name of ["dash_kpis.sql", "dash_monthly.sql", "dash_seasonal.sql", "dash_top_items.sql"]) {
    assert.match(sql(name), new RegExp(`^-- ${name.replace(".", "\\.")}`, "m"));
  }
  assert.doesNotMatch(sql("dash_top_items.sql"), /description|JOIN\s+prepagent\.items/i);
});
