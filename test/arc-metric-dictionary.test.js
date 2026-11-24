import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadMetricDictionary, parseMetricDictionary } from "../src/arc/metrics/dictionary.js";

const raw = JSON.parse(readFileSync(new URL("../config/arc-metrics.json", import.meta.url), "utf8"));
const readSql = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const ANSWERABLE_TODAY = new Set([1, 4, 6, 8, 13, 14, 15, 17]);
const PROVENANCE = ["catalog", "operator_entry", "public_weather_record", "synthetic", "simulated_sensor", "model_estimate"];

function mutated(change) {
  const copy = structuredClone(raw);
  change(copy);
  return copy;
}

test("the dictionary lists the four metrics the data audit supports", () => {
  const dictionary = loadMetricDictionary();
  assert.deepEqual(dictionary.metrics.map((m) => m.id),
    ["model_holdout_r2", "defect_history_at_humidity", "top_scrap_items", "catalog_item"]);
  assert.equal(dictionary.maximumBytesBilled, 50 * 1024 * 1024);
});

test("every metric carries unit, provenance, label, source, params and an insufficient-data rule", () => {
  for (const metric of loadMetricDictionary().metrics) {
    assert.ok(metric.unit.length > 0, metric.id);
    assert.ok(PROVENANCE.includes(metric.provenance), `${metric.id} provenance`);
    assert.ok(metric.label.length > 0 && !/^measured/i.test(metric.label), `${metric.id} label`);
    assert.ok(metric.source.ref.length > 0, `${metric.id} source`);
    assert.ok(metric.insufficient.missing.length > 20, `${metric.id} missing text`);
    assert.ok(Array.isArray(metric.params) && metric.columns.length > 0, metric.id);
    assert.ok(metric.questions.every((q) => ANSWERABLE_TODAY.has(q)), `${metric.id} covers a question the audit marks answerable`);
  }
});

test("each SQL file uses exactly the parameters its entry declares and has no templating", () => {
  for (const metric of loadMetricDictionary().metrics.filter((m) => m.kind === "bigquery")) {
    const sql = readSql(metric.sqlFile);
    const used = [...new Set([...sql.replace(/--[^\n]*/g, "").matchAll(/@([A-Za-z_]\w*)/g)].map((m) => m[1]))].sort();
    assert.deepEqual(used, metric.params.map((p) => p.bind).sort(), metric.id);
    assert.equal(/\$\{|\{\{|%s|\|\|/.test(sql), false, `${metric.id} must not template or concatenate`);
    assert.equal(metric.sql, sql, `${metric.id} loads its SQL file as written`);
  }
});

test("the loader rejects entries that break the contract", () => {
  const rejects = (name, change) =>
    assert.throws(() => parseMetricDictionary(mutated(change), readSql), undefined, name);
  rejects("measured provenance", (d) => { d.metrics[1].provenance = "measured"; });
  rejects("missing insufficient rule", (d) => { delete d.metrics[1].insufficient; });
  rejects("duplicate id", (d) => { d.metrics[2].id = d.metrics[1].id; });
  rejects("undeclared SQL parameter", (d) => { d.metrics[1].params.pop(); });
  rejects("declared parameter missing from SQL", (d) => { d.metrics[2].params.push({ name: "extra", type: "integer", min: 1, max: 2, required: false, bind: "extra", bigqueryType: "INT64" }); });
  rejects("byte cap above 50 MiB", (d) => { d.maximumBytesBilled = 50 * 1024 * 1024 + 1; });
  rejects("unbounded number", (d) => { delete d.metrics[1].params[1].max; });
  rejects("unknown metric key", (d) => { d.metrics[1].rawSql = "select 1"; });
  rejects("missing SQL file", (d) => { d.metrics[1].sqlFile = "sql/arc/nope.sql"; });
  assert.doesNotThrow(() => parseMetricDictionary(structuredClone(raw), readSql));
});

test("the loader rejects SQL that templates or concatenates values", () => {
  const template = (sql) => (file) => (file === "sql/arc/catalog_item.sql" ? sql : readSql(file));
  const clean = readSql("sql/arc/catalog_item.sql");
  for (const injected of ["${itemCode}", "{{itemCode}}", "%s", "' || @item_code || '"]) {
    const sql = `${clean.trimEnd().replace(/;$/, "")} AND box_style = '${injected}';`;
    assert.throws(() => parseMetricDictionary(structuredClone(raw), template(sql)), /must not template/, injected);
  }
  assert.doesNotThrow(() => parseMetricDictionary(structuredClone(raw), template(clean)));
});
