import { readFileSync } from "node:fs";
import { RiskPredictionApiResponseSchema, RiskResultSchema } from "../schemas.js";
import { mapRiskPredictionParameters } from "../bigquery-mapper.js";
import { BigQueryReadError } from "./bigquery-read-client.js";
import modelAcceptanceConfig from "../../config/model-acceptance.json" with { type: "json" };
import { getModelAcceptanceSummary, isModelSetAccepted } from "../model-acceptance.js";

const RESULT_FIELDS = Object.freeze([
  "item_code", "rate_warp_pct", "rate_delam_pct", "rate_strength_pct",
  "rate_print_pct", "rate_crack_pct", "total_scrap_pct", "total_scrap_kg",
  "scrap_cost", "currency", "primary_defect",
]);
const NUMERIC_FIELDS = new Set(RESULT_FIELDS.slice(1, -2));
const NUMERIC_TYPES = new Set(["INT64", "INTEGER", "FLOAT64", "FLOAT", "NUMERIC", "BIGNUMERIC"]);

function decodePrediction(result, expectedItemCode) {
  const fields = result?.schema?.fields;
  if (!Array.isArray(fields) || fields.length !== RESULT_FIELDS.length ||
      fields.some((field, index) => field.name !== RESULT_FIELDS[index] ||
        (NUMERIC_FIELDS.has(field.name)
          ? !NUMERIC_TYPES.has(field.type)
          : field.type !== "STRING"))) {
    throw new BigQueryReadError("RISK_SCHEMA_MISMATCH", "The risk query returned an unexpected result schema.");
  }
  const rows = result.rows ?? [];
  if (rows.length === 0) return undefined;
  if (rows.length !== 1) {
    throw new BigQueryReadError("RISK_ROW_INVALID", "The risk query must return exactly one prediction row.");
  }
  const [row] = rows;
  if (!Array.isArray(row.f) || row.f.length !== fields.length) {
    throw new BigQueryReadError("RISK_ROW_INVALID", "The risk query returned an invalid result row.");
  }
  const values = Object.fromEntries(fields.map((field, index) => [field.name, row.f[index]?.v]));
  const numeric = (name) => {
    const raw = values[name];
    if ((typeof raw !== "number" && typeof raw !== "string") ||
        (typeof raw === "string" && raw.trim() === "")) {
      throw new BigQueryReadError("RISK_ROW_INVALID", "The risk query returned a missing numeric value.");
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      throw new BigQueryReadError("RISK_ROW_INVALID", "The risk query returned an invalid numeric value.");
    }
    return value;
  };
  if (typeof values.item_code !== "string" || values.item_code.trim() === "" ||
      (expectedItemCode !== undefined && values.item_code !== expectedItemCode)) {
    throw new BigQueryReadError("RISK_ROW_INVALID", "The risk query returned an unexpected item code.");
  }
  const risk = RiskResultSchema.parse({
    ratesPct: {
      WARP: numeric("rate_warp_pct"),
      DELAM: numeric("rate_delam_pct"),
      STRENGTH: numeric("rate_strength_pct"),
      PRINT: numeric("rate_print_pct"),
      CRACK: numeric("rate_crack_pct"),
    },
    totalScrapPct: numeric("total_scrap_pct"),
    totalScrapKg: numeric("total_scrap_kg"),
    scrapCost: numeric("scrap_cost"),
    currency: values.currency,
    primaryDefect: values.primary_defect,
  });
  const summedRate = Object.values(risk.ratesPct).reduce((sum, rate) => sum + rate, 0);
  if (Math.abs(summedRate - risk.totalScrapPct) > 0.01) {
    throw new BigQueryReadError("RISK_ROW_INVALID", "The risk query returned inconsistent scrap-rate totals.");
  }
  const primaryDefect = Object.entries(risk.ratesPct)
    .find(([, rate]) => rate === Math.max(...Object.values(risk.ratesPct)))?.[0];
  if (risk.primaryDefect !== primaryDefect) {
    throw new BigQueryReadError("RISK_ROW_INVALID", "The risk query returned a primary defect inconsistent with its rates.");
  }
  return {
    itemCode: values.item_code,
    risk,
  };
}

export function createRiskPredictionService({
  bigquery,
  sql,
  projectId = "prepagent-hack",
  modelAcceptance = modelAcceptanceConfig,
} = {}) {
  if (!bigquery || typeof bigquery.query !== "function") {
    throw new TypeError("A bounded BigQuery read client is required.");
  }
  if (typeof projectId !== "string" || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) {
    throw new TypeError("A valid Google Cloud project ID is required.");
  }
  const queryText = sql ?? readFileSync(new URL("../../sql/predict.sql", import.meta.url), "utf8");
  if (typeof queryText !== "string" || !/^\s*--[^\n]*predict\.sql/i.test(queryText) ||
      !queryText.includes("ML.PREDICT")) {
    throw new TypeError("The verified BigQuery ML prediction SQL is required.");
  }

  return async function predictRisk(input = {}) {
    try {
      const rawParameters = mapRiskPredictionParameters(input);
      const parameters = {
        item_code: rawParameters.item_code,
        quantity: { type: "INT64", value: rawParameters.quantity },
        paper_type: rawParameters.paper_type,
        paper_supplier: rawParameters.paper_supplier,
        shift: rawParameters.shift,
        ambient_rh_pct: { type: "FLOAT64", value: rawParameters.ambient_rh_pct },
        ambient_temp_c: { type: "FLOAT64", value: rawParameters.ambient_temp_c },
        paper_moisture_pct: { type: "FLOAT64", value: rawParameters.paper_moisture_pct },
        sf_speed_mpm: { type: "FLOAT64", value: rawParameters.sf_speed_mpm },
        roll_temp_c: { type: "FLOAT64", value: rawParameters.roll_temp_c },
        gum_application: rawParameters.gum_application,
        gum_viscosity_sec: { type: "FLOAT64", value: rawParameters.gum_viscosity_sec },
        pasting_pressure: rawParameters.pasting_pressure,
        drying_hours: { type: "FLOAT64", value: rawParameters.drying_hours },
        print_speed_spm: { type: "FLOAT64", value: rawParameters.print_speed_spm },
      };
      if (!isModelSetAccepted(modelAcceptance)) {
        return {
          ok: false,
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: "Prediction is blocked until the current five-model set has complete version-linked acceptance evidence.",
          },
          modelAcceptance: getModelAcceptanceSummary(modelAcceptance),
        };
      }
      const result = await bigquery.query({ sql: queryText, parameters, signal: input.signal });
      const prediction = decodePrediction(result, rawParameters.item_code);
      if (!prediction) {
        return { ok: false, error: { code: "NOT_FOUND", message: "No prediction was returned for this item and plant." } };
      }
      return RiskPredictionApiResponseSchema.parse({
        ok: true,
        agent: "predictRisk",
        source: "bigquery-ml",
        isRealModelPrediction: true,
        itemCode: prediction.itemCode,
        modelProvenance: {
          query: "sql/predict.sql",
          outputs: modelAcceptance?.recordedEvaluation?.models ?? modelAcceptance?.models ?? [],
          currentModelVersionsLinked: isModelSetAccepted(modelAcceptance) ||
            modelAcceptance?.recordedEvaluation?.linkedToCurrentResourceVersions === true,
        },
        modelAcceptance: getModelAcceptanceSummary(modelAcceptance),
        ...prediction.risk,
      });
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      if (error instanceof BigQueryReadError || error?.name === "ZodError") {
        return { ok: false, error: { code: "SERVICE_UNAVAILABLE", message: "Risk prediction is temporarily unavailable." } };
      }
      return { ok: false, error: { code: "SERVICE_UNAVAILABLE", message: "Risk prediction is temporarily unavailable." } };
    }
  };
}

export { decodePrediction as decodeRiskPredictionResult };
