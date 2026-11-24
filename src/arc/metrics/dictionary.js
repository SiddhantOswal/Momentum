import { readFileSync } from "node:fs";
import { z } from "zod";

export const METRIC_BYTE_CAP = 50 * 1024 * 1024;

const PROVENANCE = ["catalog", "operator_entry", "public_weather_record", "synthetic", "simulated_sensor", "model_estimate"];
const name = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,40}$/);
const text = z.string().min(1).max(400);

const ParamSchema = z.discriminatedUnion("type", [
  z.strictObject({
    name, type: z.literal("enum"), values: z.array(z.string().min(1)).min(1), required: z.boolean(),
    bind: name.optional(), bigqueryType: z.literal("STRING").optional(),
  }),
  z.strictObject({
    name, type: z.literal("number"), min: z.number().finite(), max: z.number().finite(), required: z.boolean(),
    default: z.number().finite().optional(), bind: name.optional(), bigqueryType: z.literal("FLOAT64").optional(),
  }),
  z.strictObject({
    name, type: z.literal("integer"), min: z.number().int(), max: z.number().int(), required: z.boolean(),
    default: z.number().int().optional(), bind: name.optional(), bigqueryType: z.literal("INT64").optional(),
  }),
  z.strictObject({
    name, type: z.literal("string"), pattern: z.string().min(1).max(120), required: z.boolean(),
    bind: name.optional(), bigqueryType: z.literal("STRING").optional(),
  }),
]);

const ColumnSchema = z.strictObject({
  name,
  type: z.enum(["string", "integer", "number"]),
  unit: text.optional(),
  nullable: z.boolean().optional(),
});

const MetricSchema = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9_]{2,48}$/),
  version: z.number().int().positive(),
  enabled: z.boolean(),
  questions: z.array(z.number().int().min(1).max(19)).min(1),
  description: text,
  kind: z.enum(["bigquery", "config"]),
  sqlFile: z.string().regex(/^sql\/arc\/[a-z0-9_]+\.sql$/).optional(),
  reader: z.enum(["modelHoldout"]).optional(),
  params: z.array(ParamSchema),
  constants: z.array(z.strictObject({
    bind: name, bigqueryType: z.enum(["INT64", "FLOAT64", "STRING"]), ref: z.enum(["humidityBandPoints"]),
  })).optional(),
  columns: z.array(ColumnSchema).min(1),
  unit: text,
  provenance: z.enum(PROVENANCE),
  label: text,
  labelFallback: text.optional(),
  basis: text,
  source: z.strictObject({ kind: z.enum(["table", "view", "config"]), ref: text }),
  insufficient: z.strictObject({
    when: z.string().regex(/^(no_rows|zero:[a-z_]+)$/),
    missing: z.string().min(20).max(400),
  }),
  writerFields: z.array(name).min(1),
});

const DictionarySchema = z.strictObject({
  version: z.literal(1),
  maximumBytesBilled: z.number().int().positive().max(METRIC_BYTE_CAP),
  note: text,
  metrics: z.array(MetricSchema).min(1),
});

function sqlParameters(sql) {
  const withoutComments = sql.replace(/--[^\n\r]*/g, " ");
  return [...new Set([...withoutComments.matchAll(/@([A-Za-z_]\w*)/g)].map((m) => m[1]))].sort();
}

function checkMetric(metric, readSql) {
  const bound = [...metric.params.map((p) => p.bind), ...(metric.constants ?? []).map((c) => c.bind)].filter(Boolean).sort();
  if (new Set(metric.params.map((p) => p.name)).size !== metric.params.length) {
    throw new TypeError(`Metric ${metric.id} repeats a parameter name.`);
  }
  for (const param of metric.params) {
    if ((param.type === "number" || param.type === "integer") && param.min > param.max) {
      throw new TypeError(`Metric ${metric.id} parameter ${param.name} has min above max.`);
    }
    if (param.type === "string") new RegExp(param.pattern);
    if (metric.kind === "bigquery" && (!param.bind || !param.bigqueryType)) {
      throw new TypeError(`Metric ${metric.id} parameter ${param.name} needs bind and bigqueryType.`);
    }
    if (param.default !== undefined && (param.default < param.min || param.default > param.max)) {
      throw new TypeError(`Metric ${metric.id} parameter ${param.name} default is out of range.`);
    }
  }
  if (/\{\w+\}/.test(metric.label) && !metric.labelFallback) {
    throw new TypeError(`Metric ${metric.id} has a label placeholder and no labelFallback.`);
  }
  if (metric.kind === "config") {
    if (!metric.reader || metric.sqlFile || bound.length > 0) {
      throw new TypeError(`Config metric ${metric.id} needs a reader and no SQL.`);
    }
    return { ...metric };
  }
  if (!metric.sqlFile || metric.reader) throw new TypeError(`BigQuery metric ${metric.id} needs a SQL file and no reader.`);
  const sql = readSql(metric.sqlFile);
  if (/\$\{|\{\{|%s|\|\|/.test(sql)) throw new TypeError(`Metric ${metric.id} SQL must not template values.`);
  const used = sqlParameters(sql);
  if (used.length !== bound.length || used.some((value, index) => value !== bound[index])) {
    throw new TypeError(`Metric ${metric.id} SQL parameters do not match its declared parameters.`);
  }
  return { ...metric, sql };
}

export function parseMetricDictionary(raw, readSql) {
  const parsed = DictionarySchema.parse(raw);
  const ids = new Set();
  const metrics = parsed.metrics.map((metric) => {
    if (ids.has(metric.id)) throw new TypeError(`Metric ${metric.id} is defined twice.`);
    ids.add(metric.id);
    return checkMetric(metric, readSql);
  });
  return Object.freeze({ maximumBytesBilled: parsed.maximumBytesBilled, metrics: Object.freeze(metrics) });
}

export function loadMetricDictionary() {
  const root = new URL("../../../", import.meta.url);
  const read = (file) => readFileSync(new URL(file, root), "utf8");
  return parseMetricDictionary(JSON.parse(read("config/arc-metrics.json")), read);
}
