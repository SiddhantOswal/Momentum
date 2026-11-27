import { BigQueryReadError, createBigQueryReadClient } from "../../google-cloud/bigquery-read-client.js";
import { HUMIDITY_BAND_POINTS } from "../../humidity-band.js";
import { METRIC_BYTE_CAP, loadMetricDictionary } from "./dictionary.js";

const fail = (status, code, message) => ({ ok: false, status, error: { code, message } });

function readParams(metric, params) {
  if (params === undefined) params = {};
  if (params === null || typeof params !== "object" || Array.isArray(params)) {
    return fail(400, "METRIC_PARAM_INVALID", "Metric filters must be an object.");
  }
  const declared = new Map(metric.params.map((p) => [p.name, p]));
  for (const key of Object.keys(params)) {
    if (!declared.has(key)) return fail(400, "METRIC_PARAM_UNKNOWN", `Metric ${metric.id} has no filter named ${key}.`);
  }
  const values = {};
  for (const param of metric.params) {
    const value = Object.hasOwn(params, param.name) ? params[param.name] : param.default;
    if (value === undefined) {
      if (param.required) return fail(400, "METRIC_PARAM_INVALID", `Metric ${metric.id} needs the filter ${param.name}.`);
      continue;
    }
    const valid =
      (param.type === "enum" && param.values.includes(value)) ||
      (param.type === "number" && typeof value === "number" && Number.isFinite(value) && value >= param.min && value <= param.max) ||
      (param.type === "integer" && Number.isSafeInteger(value) && value >= param.min && value <= param.max) ||
      (param.type === "string" && typeof value === "string" && new RegExp(param.pattern).test(value));
    if (!valid) return fail(400, "METRIC_PARAM_INVALID", `The filter ${param.name} is outside the allowed values for ${metric.id}.`);
    values[param.name] = value;
  }
  return { values };
}

function convert(value, column) {
  if (value === null || value === undefined) return column.nullable ? null : undefined;
  if (column.type === "string") return typeof value === "string" ? value : undefined;
  const parsed = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isFinite(parsed)) return undefined;
  return column.type === "integer" && !Number.isSafeInteger(parsed) ? undefined : parsed;
}

function decodeRows(metric, result) {
  const fields = result?.schema?.fields;
  if (!Array.isArray(fields) || fields.length !== metric.columns.length ||
      fields.some((field, index) => field.name !== metric.columns[index].name)) return undefined;
  const rows = [];
  for (const row of result.rows ?? []) {
    if (!Array.isArray(row?.f) || row.f.length !== metric.columns.length) return undefined;
    const entries = metric.columns.map((column, index) => [column.name, convert(row.f[index]?.v, column)]);
    if (entries.some(([, value]) => value === undefined)) return undefined;
    rows.push(Object.fromEntries(entries));
  }
  return rows;
}

const constantValues = { humidityBandPoints: HUMIDITY_BAND_POINTS };

const readers = {
  modelHoldout(values, { modelAcceptance }) {
    if (modelAcceptance?.status !== "accepted" || !Array.isArray(modelAcceptance.models)) return { rows: [] };
    const rows = modelAcceptance.models
      .filter((model) => values.defect === undefined || model.defect === values.defect)
      .map((model) => ({
        defect: model.defect, r2: model.r2, maePp: model.maePp,
        sampleCount: model.sampleCount, evaluationId: modelAcceptance.evaluationId,
      }));
    return { rows, labelValues: { sampleCount: rows[0]?.sampleCount } };
  },
};

function isInsufficient(metric, rows) {
  if (rows.length === 0) return true;
  const [kind, column] = metric.insufficient.when.split(":");
  return kind === "zero" && rows.every((row) => row[column] === 0);
}

/** The entry's chip text with its placeholders filled, or its fallback when a value is missing. */
export function metricLabel(metric, labelValues = {}) {
  const resolved = metric.label.replace(/\{(\w+)\}/g, (_, key) => String(labelValues[key] ?? "\u0000"));
  return resolved.includes("\u0000") ? metric.labelFallback : resolved;
}

function describe(metric, values, labelValues = {}) {
  return {
    metric: metric.id,
    unit: metric.unit,
    provenance: metric.provenance,
    label: metricLabel(metric, labelValues),
    basis: metric.basis,
    source: { kind: metric.source.kind, ref: metric.source.ref },
    columns: metric.columns.map(({ name, unit }) => ({ name, unit: unit ?? null })),
    filters: values,
  };
}

/**
 * The only way Arc reads a dictionary metric. Queries come from the dictionary,
 * values are bound as BigQuery query parameters, and every query runs through a
 * read-only client capped at 50 MiB. Provenance, unit and source come from the
 * dictionary entry, never from the caller.
 */
export function createMetricQueryService({
  projectId, location, fetchImpl, tokenProvider, modelAcceptance, dictionary = loadMetricDictionary(), bigquery,
} = {}) {
  const byId = new Map(dictionary.metrics.map((metric) => [metric.id, metric]));
  const client = bigquery ?? createBigQueryReadClient({
    projectId, location, fetchImpl, tokenProvider,
    maximumBytesBilled: Math.min(dictionary.maximumBytesBilled, METRIC_BYTE_CAP),
  });

  async function queryMetric({ metricId, params, signal } = {}) {
    const metric = typeof metricId === "string" ? byId.get(metricId) : undefined;
    if (!metric) {
      return fail(400, "METRIC_UNKNOWN", "That metric is not in the approved dictionary.");
    }
    if (!metric.enabled) {
      return {
        ok: true, status: "insufficient_data", code: "METRIC_DISABLED", ...describe(metric, {}),
        missing: metric.insufficient.missing, rows: [], rowCount: 0,
      };
    }
    const read = readParams(metric, params);
    if (!read.values) return read;

    let rows;
    let labelValues;
    let bytesProcessed = null;
    if (metric.kind === "config") {
      ({ rows, labelValues } = readers[metric.reader](read.values, { modelAcceptance }));
    } else {
      const parameters = Object.fromEntries(metric.params.filter((p) => read.values[p.name] !== undefined)
        .map((p) => [p.bind, { type: p.bigqueryType, value: read.values[p.name] }]));
      for (const constant of metric.constants ?? []) {
        parameters[constant.bind] = { type: constant.bigqueryType, value: constantValues[constant.ref] };
      }
      let result;
      try {
        result = await client.query({ sql: metric.sql, parameters, signal });
      } catch (error) {
        if (error?.name === "AbortError") throw error;
        if (error instanceof BigQueryReadError || error?.code) {
          return fail(503, "METRIC_QUERY_FAILED", "The metric query could not run.");
        }
        throw error;
      }
      rows = decodeRows(metric, result);
      if (!rows) return fail(502, "METRIC_RESULT_INVALID", "The metric query returned an unexpected result.");
      bytesProcessed = result.totalBytesProcessed ?? null;
    }

    const base = describe(metric, read.values, labelValues);
    if (isInsufficient(metric, rows)) {
      return { ok: true, status: "insufficient_data", ...base, missing: metric.insufficient.missing, rows: [], rowCount: 0, bytesProcessed };
    }
    return { ok: true, status: "ok", ...base, rows, rowCount: rows.length, bytesProcessed };
  }

  return Object.freeze({ queryMetric });
}
