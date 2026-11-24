import assert from "node:assert/strict";
import test from "node:test";
import { createHackathonDemoAuthenticator } from "../src/hackathon-demo-auth.js";
import { createToolRegistry } from "../src/arc/tools/index.js";
import { loadMetricDictionary } from "../src/arc/metrics/dictionary.js";
import { createServicePorts } from "../src/service-ports.js";

const auth = createHackathonDemoAuthenticator({
  mode: "HACKATHON_DEMO", syntheticOnly: true, auditEnabled: true, signingKey: "a".repeat(64),
});
const principal = auth.authenticate(auth.issue()).principal;
const session = { sessionId: principal.sessionId, activeLotIds: [], jobIds: [] };
const ids = loadMetricDictionary().metrics.map((m) => m.id);

function registry(queryMetric) {
  const servicePorts = createServicePorts(queryMetric ? { queryMetric } : {});
  return createToolRegistry({ principal, ipKey: "a".repeat(16), session, deps: { servicePorts } });
}

test("the query_metric schema allows exactly the dictionary IDs and nothing else", () => {
  const { schema } = registry().tools.query_metric;
  for (const metric of ids) assert.equal(schema().safeParse({ metric, filters: {} }).success, true, metric);
  assert.equal(schema().safeParse({ metric: "sql", filters: {} }).success, false);
  assert.equal(schema().safeParse({ metric: ids[0], filters: { query: "select 1" } }).success, false);
  assert.equal(schema().safeParse({ metric: ids[0], filters: {}, sql: "select 1" }).success, false);
  assert.equal(schema().safeParse({ metric: ids[0] }).success, false);
});

test("query_metric fails closed until the metric query service is configured", async () => {
  const arc = registry();
  assert.equal(arc.tools.query_metric.precondition().error.code, "SERVICE_UNAVAILABLE");
  assert.ok(!arc.allowedFunctionNames().includes("query_metric"));
  assert.equal((await arc.execute("query_metric", { metric: ids[0], filters: {} })).error.code, "SERVICE_UNAVAILABLE");
});

test("query_metric passes the validated metric and filters to the service and returns its answer", async () => {
  const calls = [];
  const answer = { ok: true, status: "ok", metric: "catalog_item", provenance: "catalog", label: "From catalog", rows: [] };
  const arc = registry(async (call) => { calls.push(call); return answer; });
  assert.ok(arc.allowedFunctionNames().includes("query_metric"));
  const result = await arc.execute("query_metric", { metric: "catalog_item", filters: { itemCode: "ITEM-A" } });
  assert.deepEqual(result, answer);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].metricId, "catalog_item");
  assert.deepEqual(calls[0].params, { itemCode: "ITEM-A" });
});

test("query_metric rejects a model-supplied unknown metric or filter before the service runs", async () => {
  let called = false;
  const arc = registry(async () => { called = true; return { ok: true }; });
  for (const args of [
    { metric: "sql", filters: { query: "arbitrary" } },
    { metric: "catalog_item", filters: { itemCode: "A", table: "lots" } },
    { metric: "catalog_item" },
  ]) {
    assert.equal((await arc.execute("query_metric", args)).error.code, "VALIDATION_ERROR", JSON.stringify(args));
  }
  assert.equal(called, false);
});

test("the Vertex declaration lists the metric enum and the filter names", () => {
  const declaration = registry(async () => ({ ok: true })).declarations()[0].functionDeclarations
    .find((fn) => fn.name === "query_metric");
  assert.ok(declaration, "query_metric is declared");
  assert.deepEqual(declaration.parameters.properties.metric.enum, ids);
  assert.deepEqual(Object.keys(declaration.parameters.properties.filters.properties).sort(),
    ["ambientRhPct", "defect", "itemCode", "limit"]);
});

test("the configured service ports enable metrics only on the flag and cap the query at 50 MiB", async () => {
  const { createConfiguredServicePorts } = await import("../src/service-ports.js");
  const requests = [];
  const fetchImpl = async (url, init) => {
    requests.push(JSON.parse(init.body));
    return { ok: true, status: 200, json: async () => ({
      jobComplete: true, totalBytesProcessed: "0", totalRows: "0", rows: [],
      schema: { fields: ["item_code", "box_style", "length_mm", "width_mm", "height_mm", "ply", "flute_profile", "top_liner_gsm", "flute_gsm", "inner_liner_gsm", "liner_bf", "ink_colors", "ink_coverage_pct"].map((name) => ({ name })) },
    }) };
  };
  const base = { fetchImpl, tokenProvider: async () => "token" };
  const off = createConfiguredServicePorts({ ...base, env: { PROJECT_ID: "test-project" } });
  assert.equal(off.availability.queryMetric, false);
  const on = createConfiguredServicePorts({ ...base, env: { PROJECT_ID: "test-project", USTAAD_ENABLE_ARC_METRICS: "true" } });
  assert.equal(on.availability.queryMetric, true);
  const result = await on.queryMetric({ metricId: "catalog_item", params: { itemCode: "ITEM-A" } });
  assert.equal(result.status, "insufficient_data");
  assert.equal(requests[0].maximumBytesBilled, String(50 * 1024 * 1024));
});

test("a disabled metric is left out of the tool enum and its declaration", async () => {
  const { queryMetricToolFor } = await import("../src/arc/tools/query-metric.js");
  const { parseMetricDictionary } = await import("../src/arc/metrics/dictionary.js");
  const { readFileSync } = await import("node:fs");
  const raw = JSON.parse(readFileSync(new URL("../config/arc-metrics.json", import.meta.url), "utf8"));
  raw.metrics[2].enabled = false;
  const tool = queryMetricToolFor(parseMetricDictionary(raw, (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8")));
  assert.equal(tool.schema().safeParse({ metric: "top_scrap_items", filters: {} }).success, false);
  assert.equal(tool.schema().safeParse({ metric: "catalog_item", filters: {} }).success, true);
  assert.deepEqual(tool.schema().shape.metric.options, ["model_holdout_r2", "defect_history_at_humidity", "catalog_item"]);
});
