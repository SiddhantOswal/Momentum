import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createMetricQueryService } from "../src/arc/metrics/query.js";
import { createSeenBeforeService } from "../src/google-cloud/risk-evidence-service.js";
import { HUMIDITY_BAND_POINTS } from "../src/humidity-band.js";

const sql = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const bandPredicate = (text) => text.match(/WHERE\s+(ABS\(l\.ambient_rh_pct[^\n]*)/)?.[1].trim();

// Synthetic lots, with humidity values placed on both sides of the band edge.
const lots = [
  { rh: 48, primary: "WARP" }, { rh: 47.9, primary: "WARP" }, { rh: 68, primary: "WARP" }, { rh: 68.1, primary: "WARP" },
  { rh: 58, primary: "DELAM" }, { rh: 60, primary: "WARP" }, { rh: 90, primary: "WARP" },
];

// Applies the parameters each service actually sent to the lots, the way the
// shared predicate does. It cannot check BigQuery's own evaluation.
function nCases({ defect, ambient_rh_pct: rh, band_pts: band }) {
  const value = (p) => (p !== null && typeof p === "object" ? p.value : p);
  return lots.filter((l) => Math.abs(l.rh - Number(value(rh))) <= Number(value(band)) && l.primary === value(defect)).length;
}

test("the dashboard seen-before search and the Arc metric use one humidity band", async () => {
  assert.equal(bandPredicate(sql("sql/seen_before.sql")), bandPredicate(sql("sql/arc/defect_history_at_humidity.sql")));
  assert.match(bandPredicate(sql("sql/seen_before.sql")), /<= @band_pts$/);

  const seenSql = createSeenBeforeService({
    bigquery: { query: async ({ parameters }) => ({
      schema: { fields: ["defect", "n_cases", "avg_rate_when_main", "cost_when_main", "good_runs", "bad_runs", "notes"].map((name) => ({ name })) },
      rows: [{ f: [{ v: "WARP" }, { v: String(nCases(parameters)) }, { v: "1" }, { v: "1" }, { v: null }, { v: null }, { v: [] }] }],
    }) },
  });
  const seen = await seenSql({ defect: "WARP", ambientRhPct: 58 });

  const { queryMetric } = createMetricQueryService({
    projectId: "test-project", location: "asia-south1", tokenProvider: async () => "token",
    fetchImpl: async (url, init) => {
      const parameters = Object.fromEntries(JSON.parse(init.body).queryParameters.map((p) => [p.name, p.parameterValue.value]));
      return { ok: true, status: 200, json: async () => ({
        jobComplete: true, totalBytesProcessed: "0", totalRows: "1",
        schema: { fields: ["defect", "lots_in_band", "n_cases", "avg_rate_when_main", "cost_when_main", "avg_rate_all_lots"].map((name) => ({ name })) },
        rows: [{ f: ["WARP", "7", String(nCases(parameters)), "1", "1", "1"].map((v) => ({ v })) }],
      }) };
    },
  });
  const metric = await queryMetric({ metricId: "defect_history_at_humidity", params: { defect: "WARP", ambientRhPct: 58 } });

  assert.equal(HUMIDITY_BAND_POINTS, 10);
  assert.equal(nCases({ defect: "WARP", ambient_rh_pct: 58, band_pts: HUMIDITY_BAND_POINTS }), 3);
  assert.equal(seen.caseCount, 3);
  assert.equal(metric.rows[0].n_cases, seen.caseCount);
});
