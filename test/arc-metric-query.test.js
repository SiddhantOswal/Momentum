import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import modelAcceptance from "../config/model-acceptance.json" with { type: "json" };
import { loadMetricDictionary } from "../src/arc/metrics/dictionary.js";
import { createMetricQueryService } from "../src/arc/metrics/query.js";

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/arc-metrics/${name}`, import.meta.url), "utf8"));
const dictionary = loadMetricDictionary();
const CAP = 50 * 1024 * 1024;

function service({ responses = [], status = 200, acceptance = modelAcceptance } = {}) {
  const requests = [];
  const queue = [...responses];
  const fetchImpl = async (url, init) => {
    requests.push({ url: String(url), body: JSON.parse(init.body) });
    return { ok: status === 200, status, json: async () => (status === 200 ? queue.shift() : { error: { message: "secret detail" } }) };
  };
  const metrics = createMetricQueryService({
    projectId: "test-project", location: "asia-south1", fetchImpl,
    tokenProvider: async () => "token", modelAcceptance: acceptance, dictionary,
  });
  return { ...metrics, requests };
}

const code = (result) => result.error?.code;

test("model_holdout_r2 reads its values and label from the acceptance config", async () => {
  const { queryMetric, requests } = service();
  const all = await queryMetric({ metricId: "model_holdout_r2", params: {} });
  assert.equal(all.ok, true);
  assert.equal(all.status, "ok");
  assert.equal(all.provenance, "model_estimate");
  assert.equal(all.label, "Modeled, tested on 219 lots");
  assert.deepEqual(all.source, { kind: "config", ref: "config/model-acceptance.json" });
  assert.deepEqual(all.rows.map((r) => [r.defect, r.r2, r.maePp, r.sampleCount]), modelAcceptance.models.map((m) => [m.defect, m.r2, m.maePp, m.sampleCount]));
  assert.equal(requests.length, 0, "a config metric must not query BigQuery");
  const crack = await queryMetric({ metricId: "model_holdout_r2", params: { defect: "CRACK" } });
  assert.deepEqual(crack.rows.map((r) => r.r2), [0.1081]);
  assert.equal(JSON.stringify(all).includes("requiredR2"), false, "no pass or fail threshold is returned");
});

test("model_holdout_r2 follows a changed config instead of a hard-coded value", async () => {
  const changed = structuredClone(modelAcceptance);
  changed.models[0].r2 = 0.9999;
  changed.models.forEach((m) => { m.sampleCount = 300; });
  const result = await service({ acceptance: changed }).queryMetric({ metricId: "model_holdout_r2", params: { defect: "WARP" } });
  assert.equal(result.rows[0].r2, 0.9999);
  assert.equal(result.label, "Modeled, tested on 300 lots");
});

test("model_holdout_r2 reports insufficient data when the evaluation is not accepted", async () => {
  const result = await service({ acceptance: { ...modelAcceptance, status: "pending" } })
    .queryMetric({ metricId: "model_holdout_r2", params: {} });
  assert.equal(result.status, "insufficient_data");
  assert.equal(result.missing, dictionary.metrics[0].insufficient.missing);
  assert.deepEqual(result.rows, []);
  assert.equal(result.label, "Modeled, holdout evaluation not available");
});

test("defect_history_at_humidity binds typed parameters and returns labelled rows", async () => {
  const { queryMetric, requests } = service({ responses: [fixture("defect-history.json")] });
  const result = await queryMetric({ metricId: "defect_history_at_humidity", params: { defect: "WARP", ambientRhPct: 63.5 } });
  assert.equal(result.ok, true);
  assert.equal(result.status, "ok");
  assert.deepEqual(result.rows, [{
    defect: "WARP", lots_in_band: 412, n_cases: 57, avg_rate_when_main: 1.84, cost_when_main: 31250, avg_rate_all_lots: 0.92,
  }]);
  assert.equal(result.provenance, "synthetic");
  assert.equal(result.label, "Modeled records");
  assert.deepEqual(result.source, { kind: "table", ref: "prepagent.lots" });
  assert.equal(result.columns.find((c) => c.name === "cost_when_main").unit, "INR");
  assert.equal(result.bytesProcessed, 1048576);
  const [{ body }] = requests;
  assert.equal(body.query, dictionary.metrics[1].sql);
  assert.equal(body.parameterMode, "NAMED");
  assert.deepEqual(body.queryParameters, [
    { name: "defect", parameterType: { type: "STRING" }, parameterValue: { value: "WARP" } },
    { name: "ambient_rh_pct", parameterType: { type: "FLOAT64" }, parameterValue: { value: "63.5" } },
    { name: "band_pts", parameterType: { type: "INT64" }, parameterValue: { value: "10" } },
  ]);
  assert.equal(body.query.includes("63.5"), false);
});

test("defect_history_at_humidity says exactly what is missing when no lot matches", async () => {
  const result = await service({ responses: [fixture("defect-history-empty.json")] })
    .queryMetric({ metricId: "defect_history_at_humidity", params: { defect: "CRACK", ambientRhPct: 5 } });
  assert.equal(result.ok, true);
  assert.equal(result.status, "insufficient_data");
  assert.equal(result.missing, dictionary.metrics[1].insufficient.missing);
  assert.deepEqual(result.rows, []);
  assert.equal(result.provenance, "synthetic");
});

test("top_scrap_items defaults the limit to 10 and binds it as INT64", async () => {
  const { queryMetric, requests } = service({ responses: [fixture("top-items.json"), fixture("top-items.json")] });
  const result = await queryMetric({ metricId: "top_scrap_items", params: {} });
  assert.equal(result.rows.length, 3);
  assert.deepEqual(result.rows[0], { item_code: "ITEM-A", lots: 41, avg_scrap_pct: 7.12, scrap_cost_12m: 18400, main_defect: "WARP", currency: "INR" });
  assert.deepEqual(requests[0].body.queryParameters, [{ name: "limit", parameterType: { type: "INT64" }, parameterValue: { value: "10" } }]);
  await queryMetric({ metricId: "top_scrap_items", params: { limit: 3 } });
  assert.equal(requests[1].body.queryParameters[0].parameterValue.value, "3");
});

test("catalog_item returns the catalog row labelled From catalog, and says so when the code is absent", async () => {
  const { queryMetric, requests } = service({ responses: [fixture("catalog-item.json"), fixture("catalog-item-empty.json")] });
  const found = await queryMetric({ metricId: "catalog_item", params: { itemCode: "ITEM-A" } });
  assert.equal(found.provenance, "catalog");
  assert.equal(found.label, "From catalog");
  assert.equal(found.rows[0].ply, 5);
  assert.equal(found.rows[0].ink_coverage_pct, 35.5);
  assert.equal(found.columns.find((c) => c.name === "width_mm").unit, "mm");
  assert.deepEqual(requests[0].body.queryParameters, [{ name: "item_code", parameterType: { type: "STRING" }, parameterValue: { value: "ITEM-A" } }]);
  const absent = await queryMetric({ metricId: "catalog_item", params: { itemCode: "NOPE-1" } });
  assert.equal(absent.status, "insufficient_data");
  assert.equal(absent.missing, "No item with this code is in the 117-item catalog.");
});

test("unknown metrics are rejected before any query", async () => {
  const { queryMetric, requests } = service();
  for (const metricId of ["drop_table", "__proto__", "constructor", "", undefined, 7]) {
    const result = await queryMetric({ metricId, params: {} });
    assert.equal(result.ok, false, String(metricId));
    assert.equal(code(result), "METRIC_UNKNOWN", String(metricId));
    assert.equal(result.status, 400);
  }
  assert.equal(requests.length, 0);
});

test("unknown parameters are rejected", async () => {
  const { queryMetric, requests } = service();
  const result = await queryMetric({ metricId: "top_scrap_items", params: { limit: 3, sql: "select 1" } });
  assert.equal(code(result), "METRIC_PARAM_UNKNOWN");
  assert.equal(code(await queryMetric({ metricId: "model_holdout_r2", params: { ambientRhPct: 50 } })), "METRIC_PARAM_UNKNOWN");
  assert.equal(requests.length, 0);
});

test("invalid parameter values are rejected", async () => {
  const { queryMetric, requests } = service();
  const bad = [
    ["defect_history_at_humidity", { defect: "SCRATCH", ambientRhPct: 50 }],
    ["defect_history_at_humidity", { defect: "WARP" }],
    ["defect_history_at_humidity", { defect: "WARP", ambientRhPct: 101 }],
    ["defect_history_at_humidity", { defect: "WARP", ambientRhPct: -1 }],
    ["defect_history_at_humidity", { defect: "WARP", ambientRhPct: "50" }],
    ["defect_history_at_humidity", { defect: "WARP", ambientRhPct: Number.NaN }],
    ["top_scrap_items", { limit: 0 }],
    ["top_scrap_items", { limit: 11 }],
    ["top_scrap_items", { limit: 2.5 }],
    ["catalog_item", { itemCode: "A' OR '1'='1" }],
    ["catalog_item", { itemCode: "A".repeat(33) }],
    ["catalog_item", { itemCode: 12 }],
    ["catalog_item", {}],
    ["model_holdout_r2", { defect: "warp" }],
  ];
  for (const [metricId, params] of bad) {
    assert.equal(code(await queryMetric({ metricId, params })), "METRIC_PARAM_INVALID", JSON.stringify(params));
  }
  for (const params of [null, [], "x", 5]) {
    assert.equal(code(await queryMetric({ metricId: "top_scrap_items", params })), "METRIC_PARAM_INVALID");
  }
  assert.equal(requests.length, 0);
});

test("user input never reaches the SQL text, only the bound parameters", async () => {
  const { queryMetric, requests } = service({ responses: [fixture("catalog-item.json"), fixture("defect-history.json")] });
  await queryMetric({ metricId: "catalog_item", params: { itemCode: "ZZ-4471" } });
  await queryMetric({ metricId: "defect_history_at_humidity", params: { defect: "DELAM", ambientRhPct: 71.25 } });
  for (const { body } of requests) {
    assert.equal(body.query.includes("ZZ-4471") || body.query.includes("71.25"), false);
    assert.ok(body.queryParameters.length > 0);
  }
  assert.ok(dictionary.metrics.filter((m) => m.kind === "bigquery").every((m) => m.sql.includes("@")));
});

test("every query passes the 50 MiB cap and is read-only", async () => {
  const { queryMetric, requests } = service({ responses: [fixture("defect-history.json"), fixture("top-items.json"), fixture("catalog-item.json")] });
  await queryMetric({ metricId: "defect_history_at_humidity", params: { defect: "WARP", ambientRhPct: 60 } });
  await queryMetric({ metricId: "top_scrap_items", params: {} });
  await queryMetric({ metricId: "catalog_item", params: { itemCode: "ITEM-A" } });
  assert.equal(requests.length, 3);
  for (const { body, url } of requests) {
    assert.equal(body.maximumBytesBilled, String(CAP));
    assert.equal(body.useLegacySql, false);
    assert.match(body.query.replace(/--[^\n]*\n/g, "").trim(), /^(SELECT|WITH)\b/);
    assert.match(url, /\/projects\/test-project\/queries$/);
  }
});

test("a result whose columns do not match the dictionary is refused", async () => {
  const wrong = fixture("top-items.json");
  wrong.schema.fields[1].name = "surprise";
  const result = await service({ responses: [wrong] }).queryMetric({ metricId: "top_scrap_items", params: {} });
  assert.equal(code(result), "METRIC_RESULT_INVALID");
  const nonNumeric = fixture("top-items.json");
  nonNumeric.rows[0].f[1].v = "many";
  assert.equal(code(await service({ responses: [nonNumeric] }).queryMetric({ metricId: "top_scrap_items", params: {} })), "METRIC_RESULT_INVALID");
});

test("a BigQuery failure gives a stable code and leaks no detail", async () => {
  const result = await service({ status: 500 }).queryMetric({ metricId: "top_scrap_items", params: {} });
  assert.equal(code(result), "METRIC_QUERY_FAILED");
  assert.equal(result.status, 503);
  assert.equal(JSON.stringify(result).includes("secret detail"), false);
});

test("a disabled metric is refused with METRIC_DISABLED, runs no query and keeps its missing text", async () => {
  const disabled = loadMetricDictionary();
  const raw = JSON.parse(readFileSync(new URL("../config/arc-metrics.json", import.meta.url), "utf8"));
  raw.metrics[2].enabled = false;
  const readSql = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  const { parseMetricDictionary } = await import("../src/arc/metrics/dictionary.js");
  const requests = [];
  const { queryMetric } = createMetricQueryService({
    projectId: "test-project", location: "asia-south1", tokenProvider: async () => "token",
    dictionary: parseMetricDictionary(raw, readSql),
    fetchImpl: async (url, init) => { requests.push(init.body); return { ok: true, status: 200, json: async () => fixture("top-items.json") }; },
  });
  const result = await queryMetric({ metricId: "top_scrap_items", params: {} });
  assert.equal(result.status, "insufficient_data");
  assert.equal(result.code, "METRIC_DISABLED");
  assert.equal(result.missing, disabled.metrics[2].insufficient.missing);
  assert.deepEqual(result.rows, []);
  assert.equal(requests.length, 0);
});
