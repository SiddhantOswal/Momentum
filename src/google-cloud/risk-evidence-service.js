import { readFileSync } from "node:fs";
import { z } from "zod";
import { mapRiskPredictionParameters } from "../bigquery-mapper.js";
import {
  DefectSchema,
  LeversSchema,
  OptimizationResultSchema,
  OrderProfileSchema,
  RiskResultSchema,
  RunConditionsSchema,
  SimilarRunSchema,
} from "../schemas.js";
import { BigQueryReadError } from "./bigquery-read-client.js";

const SIMILAR_COLUMNS = Object.freeze([
  "lot_id", "order_id", "run_date", "item_code", "description", "shift",
  "ambient_rh_pct", "paper_type", "paper_supplier", "sf_speed_mpm", "roll_temp_c",
  "gum_application", "gum_viscosity_sec", "pasting_pressure", "drying_hours",
  "print_speed_spm", "total_scrap_pct", "total_scrap_kg", "scrap_cost",
  "currency", "primary_defect", "distance", "operator_note",
]);
const EXPLAIN_COLUMNS = Object.freeze([
  "defect", "predicted_pct", "typical_pct", "driver_rank", "driver", "attribution_pts",
]);
const SEEN_COLUMNS = Object.freeze([
  "defect", "n_cases", "avg_rate_when_main", "cost_when_main", "good_runs", "bad_runs", "notes",
]);
const NUMERIC_COLUMN_NAMES = new Set([
  "ambient_rh_pct", "sf_speed_mpm", "roll_temp_c", "gum_viscosity_sec", "drying_hours",
  "print_speed_spm", "total_scrap_pct", "total_scrap_kg", "scrap_cost", "distance",
  "predicted_pct", "typical_pct", "driver_rank", "attribution_pts", "n_cases",
  "avg_rate_when_main", "cost_when_main",
]);
const STRING_COLUMN_NAMES = new Set([
  "lot_id", "order_id", "run_date", "item_code", "description", "shift", "paper_type",
  "paper_supplier", "gum_application", "pasting_pressure", "currency", "primary_defect",
  "operator_note", "defect", "driver",
]);
const LEVELS = new Set(["LOW", "MED", "HIGH"]);
const DRIVER_ALIASES = Object.freeze({
  ambient_rh_pct: ["ambient_rh_pct", "humidity", "relative humidity"],
  gum_application: ["gum_application", "gum application"],
  drying_hours: ["drying_hours", "drying time"],
  roll_temp_c: ["roll_temp_c", "roll temperature"],
  sf_speed_mpm: ["sf_speed_mpm", "single-facer speed"],
  paper_moisture_pct: ["paper_moisture_pct", "paper moisture"],
  ambient_temp_c: ["ambient_temp_c", "ambient temperature"],
  gum_viscosity_sec: ["gum_viscosity_sec", "gum viscosity"],
  pasting_pressure: ["pasting_pressure", "pasting pressure"],
  print_speed_spm: ["print_speed_spm", "print speed"],
  ink_colors: ["ink_colors", "ink colors"],
  ink_coverage_pct: ["ink_coverage_pct", "ink coverage"],
  flute_profile: ["flute_profile", "flute profile"],
  paper_type: ["paper_type", "paper type"],
  paper_supplier: ["paper_supplier", "paper supplier"],
  box_style: ["box_style", "box style"],
  height_mm: ["height_mm", "height"],
  width_mm: ["width_mm", "width"],
  length_mm: ["length_mm", "length"],
  top_liner_gsm: ["top_liner_gsm", "top liner"],
  flute_gsm: ["flute_gsm", "flute gsm"],
  inner_liner_gsm: ["inner_liner_gsm", "inner liner"],
  liner_bf: ["liner_bf", "liner bf"],
  ply: ["ply"],
  quantity: ["quantity"],
  shift: ["shift"],
});
const SeenBeforeInputSchema = z.object({
  defect: DefectSchema,
  ambientRhPct: z.number().finite().min(0).max(100),
}).strict();

function decodeFieldValue(value, field, code) {
  if (value === null || value === undefined) return null;
  if (field.mode === "REPEATED") {
    if (!Array.isArray(value)) {
      throw new BigQueryReadError(code, `The evidence query returned an invalid ${field.name} array.`);
    }
    return value.map((entry) => decodeFieldValue(
      entry !== null && typeof entry === "object" && !Array.isArray(entry) && "v" in entry
        ? entry.v
        : entry,
      { ...field, mode: "NULLABLE" },
      code,
    ));
  }
  if (field.type === "RECORD" || field.type === "STRUCT") {
    if (!Array.isArray(field.fields)) {
      throw new BigQueryReadError(code, `The evidence query returned an invalid ${field.name} schema.`);
    }
    if (value && typeof value === "object" && !Array.isArray(value) &&
        Array.isArray(value.f) && value.f.length !== field.fields.length) {
      throw new BigQueryReadError(code, `The evidence query returned an invalid ${field.name} record.`);
    }
    const nested = value && typeof value === "object" && !Array.isArray(value) &&
      Array.isArray(value.f)
      ? Object.fromEntries(field.fields.map((child, index) => {
        const cell = value.f[index];
        return [child.name, decodeFieldValue(cell?.v, child, code)];
      }))
      : value;
    if (nested === null || typeof nested !== "object" || Array.isArray(nested)) {
      throw new BigQueryReadError(code, `The evidence query returned an invalid ${field.name} record.`);
    }
    return nested;
  }
  return value;
}

function decodeRows(result, columns, code) {
  const fields = result?.schema?.fields;
  if (!Array.isArray(fields) || fields.length !== columns.length ||
      fields.some((field, index) => field.name !== columns[index] ||
        (NUMERIC_COLUMN_NAMES.has(field.name) && field.type !== undefined &&
          !["INT64", "INTEGER", "FLOAT64", "FLOAT", "NUMERIC", "BIGNUMERIC"].includes(field.type)) ||
        (STRING_COLUMN_NAMES.has(field.name) && field.type !== undefined && field.type !== "STRING") ||
        (field.name === "notes" && field.type !== undefined &&
          (field.type !== "STRING" || field.mode !== "REPEATED")))) {
    throw new BigQueryReadError(code, "The evidence query returned an unexpected result schema.");
  }
  return (result.rows ?? []).map((row) => {
    if (!Array.isArray(row.f) || row.f.length !== fields.length) {
      throw new BigQueryReadError(code, "The evidence query returned an invalid result row.");
    }
    return Object.fromEntries(fields.map((field, index) => [
      field.name,
      decodeFieldValue(row.f[index]?.v, field, code),
    ]));
  });
}

function finiteNumber(value, field, code) {
  const number = Number(value);
  if (value === null || value === undefined || !Number.isFinite(number)) {
    throw new BigQueryReadError(code, `The evidence query returned an invalid ${field}.`);
  }
  return number;
}

function parametersFor(order, conditions, levers) {
  const raw = mapRiskPredictionParameters({ order, conditions, levers });
  const floatParameters = new Set([
    "ambient_rh_pct", "ambient_temp_c", "paper_moisture_pct", "sf_speed_mpm",
    "roll_temp_c", "gum_viscosity_sec", "drying_hours", "print_speed_spm",
  ]);
  return Object.fromEntries(Object.entries(raw).map(([key, value]) => [
    key,
    typeof value === "number"
      ? { type: floatParameters.has(key) ? "FLOAT64" : "INT64", value }
      : value,
  ]));
}

function validateSql(sql, filename, marker) {
  const query = sql ?? readFileSync(new URL(`../../sql/${filename}`, import.meta.url), "utf8");
  if (typeof query !== "string" || !new RegExp(`^\\s*--[^\\n]*${marker}\\.sql`, "i").test(query) ||
      !query.includes("FROM prepagent.")) {
    throw new TypeError(`The supplied BigQuery ${filename} is required.`);
  }
  return query;
}

function unavailable(message) {
  return { ok: false, error: { code: "SERVICE_UNAVAILABLE", message } };
}

function leverFromRow(row, code) {
  const levers = {
    sfSpeedMpm: finiteNumber(row.sf_speed_mpm, "sf_speed_mpm", code),
    rollTempC: finiteNumber(row.roll_temp_c, "roll_temp_c", code),
    gumApplication: row.gum_application,
    gumViscositySec: finiteNumber(row.gum_viscosity_sec, "gum_viscosity_sec", code),
    pastingPressure: row.pasting_pressure,
    dryingHours: finiteNumber(row.drying_hours, "drying_hours", code),
    printSpeedSpm: finiteNumber(row.print_speed_spm, "print_speed_spm", code),
  };
  const parsed = LeversSchema.safeParse(levers);
  if (!parsed.success) throw new BigQueryReadError(code, "The query returned invalid production settings.");
  return parsed.data;
}

export function createSimilarRunsService({ bigquery, sql } = {}) {
  if (!bigquery || typeof bigquery.query !== "function") {
    throw new TypeError("A bounded BigQuery read client is required.");
  }
  const query = validateSql(sql, "similar_runs.sql", "similar_runs");
  return async function findSimilarRuns({ order, conditions, signal } = {}) {
    try {
      if (typeof order?.itemCode !== "string" ||
          typeof conditions?.ambientRhPct !== "number" || !Number.isFinite(conditions.ambientRhPct)) {
        return unavailable("An item code and valid humidity are required to find similar runs.");
      }
      const result = await bigquery.query({
        sql: query,
        parameters: {
          item_code: order.itemCode,
          ambient_rh_pct: { type: "FLOAT64", value: conditions.ambientRhPct },
        },
        signal,
      });
      const rows = decodeRows(result, SIMILAR_COLUMNS, "SIMILAR_SCHEMA_MISMATCH");
      if (rows.length > 5) throw new BigQueryReadError("SIMILAR_ROW_INVALID", "The query returned more than five historical lots.");
      const evidence = rows.map((row) => {
        const primaryDefect = DefectSchema.safeParse(row.primary_defect);
        const runDate = typeof row.run_date === "string" ? new Date(`${row.run_date}T00:00:00Z`) : undefined;
        if (!primaryDefect.success || typeof row.run_date !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(row.run_date) ||
            !runDate || Number.isNaN(runDate.getTime()) || runDate.toISOString().slice(0, 10) !== row.run_date ||
            typeof row.lot_id !== "string" || !row.lot_id ||
            typeof row.order_id !== "string" || !row.order_id ||
            !LEVELS.has(row.gum_application) || !LEVELS.has(row.pasting_pressure) ||
            typeof row.currency !== "string" || !/^[A-Z]{3}$/.test(row.currency) ||
            (row.shift !== null && row.shift !== "DAY" && row.shift !== "NIGHT") ||
            (row.paper_type !== null && !["VIRGIN", "RECYCLED", "MIXED"].includes(row.paper_type)) ||
            (row.item_code !== null && (typeof row.item_code !== "string" || !row.item_code)) ||
            (row.description !== null && (typeof row.description !== "string" || !row.description)) ||
            (row.paper_supplier !== null && (typeof row.paper_supplier !== "string" || !row.paper_supplier)) ||
            (row.operator_note !== null && typeof row.operator_note !== "string")) {
          throw new BigQueryReadError("SIMILAR_ROW_INVALID", "The query returned an invalid historical lot.");
        }
        const ambientRhPct = finiteNumber(row.ambient_rh_pct, "ambient_rh_pct", "SIMILAR_ROW_INVALID");
        const totalScrapPct = finiteNumber(row.total_scrap_pct, "total_scrap_pct", "SIMILAR_ROW_INVALID");
        const totalScrapKg = finiteNumber(row.total_scrap_kg, "total_scrap_kg", "SIMILAR_ROW_INVALID");
        const scrapCost = finiteNumber(row.scrap_cost, "scrap_cost", "SIMILAR_ROW_INVALID");
        const distance = finiteNumber(row.distance, "distance", "SIMILAR_ROW_INVALID");
        if (ambientRhPct < 0 || ambientRhPct > 100 || totalScrapPct < 0 ||
            totalScrapPct > 125 || totalScrapKg < 0 || scrapCost < 0) {
          throw new BigQueryReadError("SIMILAR_ROW_INVALID", "The query returned out-of-range historical measurements.");
        }
        return SimilarRunSchema.parse({
          lotId: row.lot_id,
          orderId: row.order_id,
          runDate: row.run_date,
          primaryDefect: primaryDefect.data,
          levers: leverFromRow(row, "SIMILAR_ROW_INVALID"),
          ...(typeof row.item_code === "string" ? { itemCode: row.item_code } : {}),
          ...(typeof row.description === "string" ? { description: row.description } : {}),
          ...(row.shift === "DAY" || row.shift === "NIGHT" ? { shift: row.shift } : {}),
          ambientRhPct,
          ...(typeof row.paper_type === "string" && row.paper_type
            ? { paperType: row.paper_type } : {}),
          ...(typeof row.paper_supplier === "string" && row.paper_supplier
            ? { paperSupplier: row.paper_supplier } : {}),
          totalScrapPct,
          totalScrapKg,
          scrapCost,
          currency: row.currency,
          distance,
          ...(typeof row.operator_note === "string" ? { operatorNote: row.operator_note } : {}),
        });
      });
      return { ok: true, agent: "findSimilarRuns", source: "bigquery", evidence };
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      return unavailable("Historical similar-run evidence is temporarily unavailable.");
    }
  };
}

function sentenceCount(text) {
  return text.trim().split(/(?<=[.!?])(?:\s+|$)/).filter(Boolean).length;
}

function permittedNumbers(values) {
  const allowed = new Set();
  for (const value of values) {
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    allowed.add(String(value));
    for (let precision = 0; precision <= 3; precision += 1) {
      allowed.add(value.toFixed(precision).replace(/\.?0+$/, ""));
    }
  }
  return allowed;
}

function numericClaims(text) {
  return text.match(/[-+]?\d+(?:\.\d+)?/g) ?? [];
}

function containsCausalClaim(text) {
  return /\b(?:cause[sd]?|causing|causal(?:ly)?|because of|due to|leads? to|results? (?:in|from)|drives?|proves?|demonstrates?)\b|\b(?:increases?|decreases?|raises?|lowers?|worsens?|improves?)(?:\s+\w+){0,3}\s+\b(?:risk|scrap|defect|prediction|rate)\b/i.test(text);
}

function sameRisk(left, right) {
  return Object.keys(left.ratesPct).every((defect) =>
    Math.abs(left.ratesPct[defect] - right.ratesPct[defect]) <= 0.001) &&
    left.totalScrapPct !== undefined && right.totalScrapPct !== undefined &&
    Math.abs(left.totalScrapPct - right.totalScrapPct) <= 0.01 &&
    Math.abs(left.totalScrapKg - right.totalScrapKg) <= 0.1 &&
    Math.abs(left.scrapCost - right.scrapCost) <= 1 &&
    left.currency === right.currency &&
    left.primaryDefect === right.primaryDefect;
}

export function createRiskExplanationService({ bigquery, gemini, sql } = {}) {
  if (!bigquery || typeof bigquery.query !== "function") {
    throw new TypeError("A bounded BigQuery read client is required.");
  }
  if (!gemini || typeof gemini.generateContent !== "function") {
    throw new TypeError("A Vertex Gemini text-generation client is required.");
  }
  const query = validateSql(sql, "explain.sql", "explain");
  return async function explainRisk({ order, conditions, prediction, optimization, evidence, signal } = {}) {
    try {
      const parsedOrder = OrderProfileSchema.safeParse(order);
      const parsedConditions = RunConditionsSchema.safeParse(conditions);
      const parsedPrediction = RiskResultSchema.safeParse(prediction);
      const parsedOptimization = OptimizationResultSchema.safeParse(optimization);
      const parsedEvidence = z.array(SimilarRunSchema).max(5).safeParse(evidence);
      if (!parsedOrder.success || !parsedConditions.success || !parsedPrediction.success ||
          !parsedOptimization.success || !parsedEvidence.success) {
        return unavailable("Validated order, conditions, prediction, optimizer result and historical evidence are required for an explanation.");
      }
      const inputOrder = parsedOrder.data;
      const inputConditions = parsedConditions.data;
      const inputPrediction = parsedPrediction.data;
      const inputOptimization = parsedOptimization.data;
      const historicalEvidence = parsedEvidence.data;
      if (!sameRisk(inputPrediction, inputOptimization.baseline.risk)) {
        return unavailable("The explanation prediction does not match the optimizer baseline.");
      }
      const levers = inputOptimization.best.levers;
      const result = await bigquery.query({
        sql: query,
        parameters: parametersFor(inputOrder, inputConditions, levers),
        signal,
      });
      const rows = decodeRows(result, EXPLAIN_COLUMNS, "EXPLAIN_SCHEMA_MISMATCH").map((row) => {
        const defect = DefectSchema.safeParse(row.defect);
        if (!defect.success) {
          throw new BigQueryReadError("EXPLAIN_ROW_INVALID", "The explanation query returned an unknown defect.");
        }
        return {
          defect: defect.data,
          predictedPct: finiteNumber(row.predicted_pct, "predicted_pct", "EXPLAIN_ROW_INVALID"),
          typicalPct: finiteNumber(row.typical_pct, "typical_pct", "EXPLAIN_ROW_INVALID"),
          driverRank: finiteNumber(row.driver_rank, "driver_rank", "EXPLAIN_ROW_INVALID"),
          driver: row.driver,
          attributionPts: finiteNumber(row.attribution_pts, "attribution_pts", "EXPLAIN_ROW_INVALID"),
        };
      });
      const expectedDefects = ["WARP", "DELAM", "STRENGTH", "CRACK"];
      if (inputOrder.inkColors > 0) expectedDefects.splice(3, 0, "PRINT");
      const knownDrivers = new Set(Object.values(DRIVER_ALIASES).flat().map((driver) => driver.toLowerCase()));
      const defectsPresent = new Set(rows.map((row) => row.defect));
      if (rows.length === 0 || expectedDefects.some((defect) => !defectsPresent.has(defect)) ||
          rows.some((row) => {
            const ranksForDefect = rows.filter((candidate) => candidate.defect === row.defect)
              .map((candidate) => candidate.driverRank);
            return !Number.isInteger(row.driverRank) || row.driverRank < 1 || row.driverRank > 3 ||
              typeof row.driver !== "string" || !knownDrivers.has(row.driver.toLowerCase()) ||
              Math.abs(row.predictedPct - inputOptimization.best.risk.ratesPct[row.defect]) > 0.001 ||
              new Set(ranksForDefect).size !== ranksForDefect.length;
          })) {
        throw new BigQueryReadError("EXPLAIN_ROW_INVALID", "The explanation query returned invalid driver evidence.");
      }
      for (const defect of expectedDefects) {
        const ranks = rows.filter((row) => row.defect === defect)
          .map((row) => row.driverRank).sort((left, right) => left - right);
        if (ranks.some((rank, index) => rank !== index + 1)) {
          throw new BigQueryReadError("EXPLAIN_ROW_INVALID", "The explanation query returned inconsistent attribution ranks.");
        }
      }
      const evidenceForPrompt = historicalEvidence.map((run) => ({
        runDate: run.runDate,
        primaryDefect: run.primaryDefect,
        ...(run.ambientRhPct === undefined ? {} : { ambientRhPct: run.ambientRhPct }),
        ...(run.totalScrapPct === undefined ? {} : { totalScrapPct: run.totalScrapPct }),
        ...(run.totalScrapKg === undefined ? {} : { totalScrapKg: run.totalScrapKg }),
        ...(run.scrapCost === undefined ? {} : { scrapCost: run.scrapCost, currency: run.currency }),
        ...(run.distance === undefined ? {} : { distance: run.distance }),
        levers: run.levers,
      }));
      const promptData = {
        inputs: {
          itemCode: inputOrder.itemCode,
          quantity: inputOrder.quantity,
          shift: inputConditions.shift,
          ambientRhPct: inputConditions.ambientRhPct,
          ambientTempC: inputConditions.ambientTempC,
          paperMoisturePct: inputConditions.paperMoisturePct,
        },
        bestSettings: levers,
        baselinePrediction: inputPrediction,
        bestPrediction: inputOptimization.best.risk,
        changes: inputOptimization.changes,
        explanationRows: rows,
        historicalEvidence: evidenceForPrompt,
      };
      const response = await gemini.generateContent({
        contents: [{
          role: "user",
          parts: [{
            text: `Write 3 to 5 concise plain-language sentences explaining the validated model attribution and, when relevant, the supplied historical observations. Distinguish predictions and attribution from observed historical outcomes. Describe attribution only as a model contribution or association, not as proof of cause and effect. Use only the provided drivers, percentages, attribution points, inputs, settings, and historical metrics. Do not mention lot or order identifiers, add unsupported facts, claim causality or guarantees, or use numeric values not present in the JSON. A positive attribution contributes upward to the model prediction and a negative attribution contributes downward; neither establishes a real-world causal effect. Return only the explanation.\\n${JSON.stringify(promptData)}`,
          }],
        }],
        signal,
      });
      const explanation = response.parts.map((part) => part.text)
        .filter((text) => typeof text === "string").join("").trim();
      const allowedNumbers = permittedNumbers([
        inputOrder.quantity,
        inputConditions.ambientRhPct,
        inputConditions.ambientTempC,
        inputConditions.paperMoisturePct,
        ...Object.values(levers).filter((value) => typeof value === "number"),
        ...rows.flatMap((row) => [row.predictedPct, row.typicalPct, row.attributionPts]),
        ...Object.values(inputPrediction.ratesPct),
        inputPrediction.totalScrapPct,
        inputPrediction.totalScrapKg,
        inputPrediction.scrapCost,
        ...Object.values(inputOptimization.best.risk.ratesPct),
        inputOptimization.best.risk.totalScrapPct,
        inputOptimization.best.risk.totalScrapKg,
        inputOptimization.best.risk.scrapCost,
        inputOptimization.savings.kg,
        inputOptimization.savings.inr,
        ...historicalEvidence.flatMap((run) => [
          run.ambientRhPct, run.totalScrapPct, run.totalScrapKg, run.scrapCost, run.distance,
          ...Object.values(run.levers).filter((value) => typeof value === "number"),
        ]),
      ]);
      if (!explanation || sentenceCount(explanation) < 3 || sentenceCount(explanation) > 5 ||
          numericClaims(explanation).some((value) => !allowedNumbers.has(value))) {
        throw new BigQueryReadError("EXPLANATION_INVALID", "Gemini returned an explanation outside the evidence contract.");
      }
      const reportedDrivers = new Set(rows.map((row) => row.driver.toLowerCase()));
      const lowerExplanation = explanation.toLowerCase();
      const unsupportedDriver = Object.entries(DRIVER_ALIASES).some(([driver, aliases]) =>
        aliases.some((alias) => lowerExplanation.includes(alias)) && !reportedDrivers.has(driver));
      if (unsupportedDriver || containsCausalClaim(explanation)) {
        throw new BigQueryReadError("EXPLANATION_INVALID", "Gemini returned an explanation outside the attribution evidence contract.");
      }
      return {
        ok: true,
        source: "bigquery-ml-and-gemini",
        explanation,
        rows,
        evidenceRefs: historicalEvidence.map(({ lotId, orderId, runDate }) => ({ lotId, orderId, runDate })),
      };
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      return unavailable("The evidence-grounded risk explanation is temporarily unavailable.");
    }
  };
}

function decodeStruct(value, fieldName) {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      throw new BigQueryReadError("SEEN_BEFORE_ROW_INVALID", `The query returned invalid ${fieldName}.`);
    }
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const parsed = {
    lots: finiteNumber(value.lots, `${fieldName}.lots`, "SEEN_BEFORE_ROW_INVALID"),
    avgRatePct: finiteNumber(value.avg_rate_pct, `${fieldName}.avg_rate_pct`, "SEEN_BEFORE_ROW_INVALID"),
    sfSpeedMpm: finiteNumber(value.sf_speed_mpm, `${fieldName}.sf_speed_mpm`, "SEEN_BEFORE_ROW_INVALID"),
    rollTempC: finiteNumber(value.roll_temp_c, `${fieldName}.roll_temp_c`, "SEEN_BEFORE_ROW_INVALID"),
    gumApplication: value.gum_application,
    gumViscositySec: finiteNumber(value.gum_viscosity_sec, `${fieldName}.gum_viscosity_sec`, "SEEN_BEFORE_ROW_INVALID"),
    pastingPressure: value.pasting_pressure,
    dryingHours: finiteNumber(value.drying_hours, `${fieldName}.drying_hours`, "SEEN_BEFORE_ROW_INVALID"),
    printSpeedSpm: finiteNumber(value.print_speed_spm, `${fieldName}.print_speed_spm`, "SEEN_BEFORE_ROW_INVALID"),
  };
  if (!LEVELS.has(parsed.gumApplication) || !LEVELS.has(parsed.pastingPressure)) {
    throw new BigQueryReadError("SEEN_BEFORE_ROW_INVALID", `The query returned invalid ${fieldName} settings.`);
  }
  return parsed;
}

export function createSeenBeforeService({ bigquery, sql } = {}) {
  if (!bigquery || typeof bigquery.query !== "function") {
    throw new TypeError("A bounded BigQuery read client is required.");
  }
  const query = validateSql(sql, "seen_before.sql", "seen_before");
  return async function findSeenBefore(input = {}) {
    try {
      const request = SeenBeforeInputSchema.safeParse({
        defect: input.defect,
        ambientRhPct: input.ambientRhPct,
      });
      if (!request.success) {
        return { ok: false, error: { code: "VALIDATION_ERROR", message: "A recognized defect and valid humidity are required." } };
      }
      const result = await bigquery.query({
        sql: query,
        parameters: {
          defect: request.data.defect,
          ambient_rh_pct: { type: "FLOAT64", value: request.data.ambientRhPct },
        },
        signal: input.signal,
      });
      const [row] = decodeRows(result, SEEN_COLUMNS, "SEEN_BEFORE_SCHEMA_MISMATCH");
      if (!row) throw new BigQueryReadError("SEEN_BEFORE_ROW_INVALID", "The query returned no historical summary.");
      const notes = row.notes;
      if (row.defect !== request.data.defect ||
          (notes !== null && (!Array.isArray(notes) || notes.some((note) => typeof note !== "string")))) {
        throw new BigQueryReadError("SEEN_BEFORE_ROW_INVALID", "The query returned invalid historical evidence.");
      }
      return {
        ok: true,
        source: "bigquery",
        defect: row.defect,
        caseCount: finiteNumber(row.n_cases, "n_cases", "SEEN_BEFORE_ROW_INVALID"),
        avgRateWhenMain: finiteNumber(row.avg_rate_when_main, "avg_rate_when_main", "SEEN_BEFORE_ROW_INVALID"),
        costWhenMain: finiteNumber(row.cost_when_main, "cost_when_main", "SEEN_BEFORE_ROW_INVALID"),
        goodRuns: decodeStruct(row.good_runs, "good_runs"),
        badRuns: decodeStruct(row.bad_runs, "bad_runs"),
        notes: notes ?? [],
      };
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      return unavailable("Historical defect evidence is temporarily unavailable.");
    }
  };
}

export { SIMILAR_COLUMNS, EXPLAIN_COLUMNS, SEEN_COLUMNS };
