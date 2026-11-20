import { readFileSync } from "node:fs";
import { DefectSchema, RiskPredictionApiResponseSchema, RiskResultSchema } from "../schemas.js";
import { mapRiskPredictionParameters } from "../bigquery-mapper.js";
import { BigQueryReadError } from "./bigquery-read-client.js";
import modelAcceptanceConfig from "../../config/model-acceptance.json" with { type: "json" };
import { getModelAcceptanceSummary, isModelSetAccepted } from "../model-acceptance.js";
import { createConditionGuard } from "../condition-guard.js";

const DEFECTS = DefectSchema.options;
const RESULT_FIELDS = Object.freeze([
  "item_code", "rate_warp_pct", "rate_delam_pct", "rate_strength_pct",
  "rate_print_pct", "rate_crack_pct", "total_scrap_pct", "total_scrap_kg",
  "scrap_cost", "currency", "primary_defect",
]);
// Optional humidity-band columns appended by predict.sql (RH-5 / RH+5 rows).
const BAND_FIELDS = Object.freeze([
  "rh_band_low_pct", "rh_band_high_pct",
  "rate_warp_low_pct", "rate_warp_high_pct",
  "rate_delam_low_pct", "rate_delam_high_pct",
  "rate_strength_low_pct", "rate_strength_high_pct",
  "rate_print_low_pct", "rate_print_high_pct",
  "rate_crack_low_pct", "rate_crack_high_pct",
]);
const STRING_FIELDS = new Set(["item_code", "currency", "primary_defect"]);
const NUMERIC_TYPES = new Set(["INT64", "INTEGER", "FLOAT64", "FLOAT", "NUMERIC", "BIGNUMERIC"]);

// Fixed whitelist for per-defect fallback queries. Model names are never built
// from request input.
export const DEFECT_MODELS = Object.freeze({
  WARP: Object.freeze({ model: "prepagent.m2_warp", predictedColumn: "predicted_rate_warp_pct" }),
  DELAM: Object.freeze({ model: "prepagent.m2_delam", predictedColumn: "predicted_rate_delam_pct" }),
  STRENGTH: Object.freeze({ model: "prepagent.m2_strength", predictedColumn: "predicted_rate_strength_pct" }),
  PRINT: Object.freeze({ model: "prepagent.m2_print", predictedColumn: "predicted_rate_print_pct" }),
  CRACK: Object.freeze({ model: "prepagent.m2_crack", predictedColumn: "predicted_rate_crack_pct" }),
});
const DEFECT_RESULT_FIELDS = Object.freeze([
  "item_code", "defect", "rate_pct", "rate_low_pct", "rate_high_pct",
  "rh_band_low_pct", "rh_band_high_pct", "lot_board_kg", "cost_per_kg", "currency",
]);
const DEFECT_STRING_FIELDS = new Set(["item_code", "defect", "currency"]);

function fieldTypesMatch(fields, names, stringFields) {
  return fields.every((field, index) => field.name === names[index] &&
    (stringFields.has(field.name) ? field.type === "STRING" : NUMERIC_TYPES.has(field.type)));
}

function readNumeric(values, name) {
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
}

function singleRow(result, fields) {
  const rows = result.rows ?? [];
  if (rows.length === 0) return undefined;
  if (rows.length !== 1) {
    throw new BigQueryReadError("RISK_ROW_INVALID", "The risk query must return exactly one prediction row.");
  }
  const [row] = rows;
  if (!Array.isArray(row.f) || row.f.length !== fields.length) {
    throw new BigQueryReadError("RISK_ROW_INVALID", "The risk query returned an invalid result row.");
  }
  return Object.fromEntries(fields.map((field, index) => [field.name, row.f[index]?.v]));
}

function assertItemCode(values, expectedItemCode) {
  if (typeof values.item_code !== "string" || values.item_code.trim() === "" ||
      (expectedItemCode !== undefined && values.item_code !== expectedItemCode)) {
    throw new BigQueryReadError("RISK_ROW_INVALID", "The risk query returned an unexpected item code.");
  }
}

function checkedBounds(low, high, central) {
  if (low > high || central < low - 0.0005 || central > high + 0.0005) {
    throw new BigQueryReadError("RISK_ROW_INVALID", "The risk query returned an inconsistent humidity band.");
  }
  return { low, high };
}

function decodePrediction(result, expectedItemCode) {
  const fields = result?.schema?.fields;
  const withBand = Array.isArray(fields) && fields.length === RESULT_FIELDS.length + BAND_FIELDS.length;
  const expectedNames = withBand ? [...RESULT_FIELDS, ...BAND_FIELDS] : RESULT_FIELDS;
  if (!Array.isArray(fields) || fields.length !== expectedNames.length ||
      !fieldTypesMatch(fields, expectedNames, STRING_FIELDS)) {
    throw new BigQueryReadError("RISK_SCHEMA_MISMATCH", "The risk query returned an unexpected result schema.");
  }
  const values = singleRow(result, fields);
  if (!values) return undefined;
  const numeric = (name) => readNumeric(values, name);
  assertItemCode(values, expectedItemCode);
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
  if (!withBand) {
    return { itemCode: values.item_code, risk };
  }
  const humidityBand = {
    ambientRhPct: { low: numeric("rh_band_low_pct"), high: numeric("rh_band_high_pct") },
    ratesPct: Object.fromEntries(DEFECTS.map((defect) => {
      const key = defect.toLowerCase();
      return [defect, checkedBounds(numeric(`rate_${key}_low_pct`), numeric(`rate_${key}_high_pct`), risk.ratesPct[defect])];
    })),
  };
  if (humidityBand.ambientRhPct.low > humidityBand.ambientRhPct.high) {
    throw new BigQueryReadError("RISK_ROW_INVALID", "The risk query returned an inconsistent humidity band.");
  }
  return { itemCode: values.item_code, risk, humidityBand };
}

function decodeDefectPrediction(result, defect, expectedItemCode) {
  const fields = result?.schema?.fields;
  if (!Array.isArray(fields) || fields.length !== DEFECT_RESULT_FIELDS.length ||
      !fieldTypesMatch(fields, DEFECT_RESULT_FIELDS, DEFECT_STRING_FIELDS)) {
    throw new BigQueryReadError("RISK_SCHEMA_MISMATCH", "The defect query returned an unexpected result schema.");
  }
  const values = singleRow(result, fields);
  if (!values) return undefined;
  assertItemCode(values, expectedItemCode);
  if (values.defect !== defect || typeof values.currency !== "string" || !/^[A-Z]{3}$/.test(values.currency)) {
    throw new BigQueryReadError("RISK_ROW_INVALID", "The defect query returned an unexpected row.");
  }
  const numeric = (name) => readNumeric(values, name);
  const rate = numeric("rate_pct");
  const lotBoardKg = numeric("lot_board_kg");
  const costPerKg = numeric("cost_per_kg");
  if (rate < 0 || rate > 25 || lotBoardKg < 0 || costPerKg < 0) {
    throw new BigQueryReadError("RISK_ROW_INVALID", "The defect query returned an out-of-range value.");
  }
  return {
    defect,
    rate,
    band: checkedBounds(numeric("rate_low_pct"), numeric("rate_high_pct"), rate),
    rhBand: { low: numeric("rh_band_low_pct"), high: numeric("rh_band_high_pct") },
    lotBoardKg,
    costPerKg,
    currency: values.currency,
  };
}

/** Combines per-defect rows into one (possibly partial) prediction. Totals use only available defects. */
function combineDefectPredictions(itemCode, rows, unavailableDefects) {
  const [first] = rows;
  if (rows.some((row) => row.currency !== first.currency ||
      Math.abs(row.lotBoardKg - first.lotBoardKg) > 1e-6 * Math.max(1, first.lotBoardKg) ||
      row.costPerKg !== first.costPerKg)) {
    throw new BigQueryReadError("RISK_ROW_INVALID", "The defect queries disagree on the lot weight or plant cost.");
  }
  const ratesPct = Object.fromEntries(rows.map((row) => [row.defect, row.rate]));
  const summed = rows.reduce((sum, row) => sum + row.rate, 0);
  const maxRate = Math.max(...rows.map((row) => row.rate));
  const scrapKg = first.lotBoardKg * summed / 100;
  return {
    itemCode,
    risk: {
      ratesPct,
      totalScrapPct: Math.round(summed * 100) / 100,
      totalScrapKg: Math.round(scrapKg * 10) / 10,
      scrapCost: Math.round(scrapKg * first.costPerKg),
      currency: first.currency,
      primaryDefect: DEFECTS.find((defect) => ratesPct[defect] === maxRate),
    },
    humidityBand: {
      ambientRhPct: first.rhBand,
      ratesPct: Object.fromEntries(rows.map((row) => [row.defect, row.band])),
    },
    unavailableDefects,
  };
}

function loadPredictionSql(sql) {
  const queryText = sql ?? readFileSync(new URL("../../sql/predict.sql", import.meta.url), "utf8");
  if (typeof queryText !== "string" || !/^\s*--[^\n]*predict\.sql/i.test(queryText) ||
      !queryText.includes("ML.PREDICT")) {
    throw new TypeError("The verified BigQuery ML prediction SQL is required.");
  }
  return queryText;
}

/**
 * Builds the per-defect fallback queries from predict.sql's shared CTEs and the
 * predict_defect.sql tail. Returns undefined when predict.sql has no shared
 * input CTE to reuse (for example a caller-supplied legacy query).
 */
export function buildDefectQueries(predictSql, defectSqlTemplate) {
  const marker = "\nw  AS (";
  const cut = predictSql.indexOf(marker);
  if (cut < 0 || !predictSql.includes("rh_scenarios AS (") || typeof defectSqlTemplate !== "string" ||
      !/^\s*--[^\n]*predict_defect\.sql/i.test(defectSqlTemplate)) {
    return undefined;
  }
  const prefix = predictSql.slice(0, cut);
  return Object.freeze(Object.fromEntries(DEFECTS.map((defect) => {
    const { model, predictedColumn } = DEFECT_MODELS[defect];
    const tail = defectSqlTemplate
      .replaceAll("{{MODEL}}", model)
      .replaceAll("{{PREDICTED_COLUMN}}", predictedColumn);
    return [defect, `${prefix}\n${tail}`];
  })));
}

function logCombinedFailure(error) {
  console.error(JSON.stringify({
    event: "risk_prediction_combined_failed",
    code: typeof error?.code === "string" && /^[A-Z0-9_]{1,64}$/.test(error.code) ? error.code : "INTEGRATION_ERROR",
    fallback: "per-defect",
  }));
}

export function createRiskPredictionService({
  bigquery,
  sql,
  defectSql,
  projectId = "prepagent-hack",
  modelAcceptance = modelAcceptanceConfig,
  conditionGuard = createConditionGuard(),
} = {}) {
  if (!bigquery || typeof bigquery.query !== "function") {
    throw new TypeError("A bounded BigQuery read client is required.");
  }
  if (typeof projectId !== "string" || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) {
    throw new TypeError("A valid Google Cloud project ID is required.");
  }
  if (typeof conditionGuard !== "function") {
    throw new TypeError("A condition guard is required.");
  }
  const queryText = loadPredictionSql(sql);
  const defectTemplate = defectSql ??
    readFileSync(new URL("../../sql/predict_defect.sql", import.meta.url), "utf8");
  const defectQueries = buildDefectQueries(queryText, defectTemplate);

  async function predictPerDefect(parameters, itemCode, signal) {
    const settled = await Promise.allSettled(DEFECTS.map(async (defect) => {
      const result = await bigquery.query({
        sql: defectQueries[defect],
        parameters: { ...parameters, defect },
        signal,
      });
      return decodeDefectPrediction(result, defect, itemCode);
    }));
    const aborted = settled.find((entry) => entry.status === "rejected" && entry.reason?.name === "AbortError");
    if (aborted) throw aborted.reason;
    const rows = settled.filter((entry) => entry.status === "fulfilled" && entry.value).map((entry) => entry.value);
    const unavailableDefects = DEFECTS.filter((_, index) => settled[index].status === "rejected");
    if (rows.length === 0) {
      return unavailableDefects.length === 0 ? undefined : null;
    }
    if (rows.length + unavailableDefects.length !== DEFECTS.length) {
      throw new BigQueryReadError("RISK_ROW_INVALID", "The defect queries disagree on whether the item exists.");
    }
    return combineDefectPredictions(itemCode, rows, unavailableDefects);
  }

  return async function predictRisk(input = {}) {
    try {
      if (input.conditionsConfirmed !== true) {
        return {
          ok: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Plant-condition confirmation is required before prediction.",
            issues: [{
              field: "conditionsConfirmed",
              path: ["conditionsConfirmed"],
              code: "confirmation_required",
              message: "Confirm or edit the displayed plant conditions before requesting prediction.",
            }],
          },
        };
      }
      const guarded = await conditionGuard({
        conditions: input.conditions,
        runDate: input.conditions?.runDate,
        signal: input.signal,
      });
      if (!guarded.ok) return guarded;
      const { runDate: _runDate, ...suppliedConditions } = input.conditions ?? {};
      const rawParameters = mapRiskPredictionParameters({
        ...input,
        conditions: { ...suppliedConditions, ...guarded.conditions },
      });
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
      let prediction;
      try {
        const result = await bigquery.query({ sql: queryText, parameters, signal: input.signal });
        prediction = decodePrediction(result, rawParameters.item_code);
      } catch (error) {
        // Any failure of the combined job (one bad model, a schema change, a
        // transient error) retries each defect model on its own.
        if (error?.name === "AbortError" || input.signal?.aborted || !defectQueries) {
          throw error;
        }
        logCombinedFailure(error);
        prediction = await predictPerDefect(parameters, rawParameters.item_code, input.signal);
        if (prediction === null) {
          throw new BigQueryReadError("RISK_MODELS_UNAVAILABLE", "No defect model returned a prediction.");
        }
      }
      if (!prediction) {
        return { ok: false, error: { code: "NOT_FOUND", message: "No prediction was returned for this item and plant." } };
      }
      const unavailableDefects = prediction.unavailableDefects ?? [];
      const partial = unavailableDefects.length > 0;
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
        ...(prediction.humidityBand === undefined ? {} : { humidityBand: prediction.humidityBand }),
        ...(partial
          ? {
            partial: true,
            unavailableDefects,
            totalsCover: DEFECTS.filter((defect) => prediction.risk.ratesPct[defect] !== undefined),
          }
          : {}),
        conditionSources: guarded.conditionSources,
        confidence: guarded.confidence,
        ...(guarded.notes.length > 0 ? { conditionNotes: guarded.notes } : {}),
      });
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      return { ok: false, error: { code: "SERVICE_UNAVAILABLE", message: "Risk prediction is temporarily unavailable." } };
    }
  };
}

export {
  decodePrediction as decodeRiskPredictionResult,
  decodeDefectPrediction as decodeRiskDefectResult,
  combineDefectPredictions as combineRiskDefectPredictions,
};
