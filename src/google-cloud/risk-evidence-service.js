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
  shownDefects,
  SimilarRunSchema,
} from "../schemas.js";
import { HUMIDITY_BAND_POINTS } from "../humidity-band.js";
import { BigQueryReadError } from "./bigquery-read-client.js";
import { geminiUsageFailure } from "../daily-gemini-call-cap.js";
import { arcModelSettings } from "../arc-model-settings.js";

const EXPLANATION_PROMPT = arcModelSettings.taskPrompt("explanation");

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
  sheet_area_m2: ["sheet_area_m2", "sheet area"],
  box_weight_kg: ["box_weight_kg", "box weight"],
  // Engineered in the m2_* model TRANSFORM (sql/model_v2_training.sql).
  rh_band: ["rh_band", "humidity band"],
  rh_x_paper_moisture: ["rh_x_paper_moisture", "humidity and paper moisture"],
  dew_point_c: ["dew_point_c", "dew point"],
  recycled_paper_flag: ["recycled_paper_flag", "recycled paper"],
  board_gsm_per_m2: ["board_gsm_per_m2", "board weight"],
  gum_visc_x_roll_temp: ["gum_visc_x_roll_temp", "gum viscosity and roll temperature"],
});
// A combined driver may be described through the inputs it is built from.
const DRIVER_PARTS = Object.freeze({
  rh_band: ["ambient_rh_pct"],
  rh_x_paper_moisture: ["ambient_rh_pct", "paper_moisture_pct"],
  dew_point_c: ["ambient_rh_pct", "ambient_temp_c"],
  recycled_paper_flag: ["paper_type"],
  board_gsm_per_m2: ["box_weight_kg", "sheet_area_m2"],
  gum_visc_x_roll_temp: ["gum_viscosity_sec", "roll_temp_c"],
});
const withDriverParts = (drivers) => new Set([...drivers].flatMap((driver) => [driver, ...(DRIVER_PARTS[driver] ?? [])]));
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

function sentences(text) {
  return text.trim().split(/(?<=[.!?])(?:\s+|$)/).filter(Boolean);
}

export function sentenceCount(text) {
  return sentences(text).length;
}

// Historical run dates are supplied in the prompt; only those exact dates may appear.
function withoutSuppliedDates(text, suppliedDates) {
  return text.replace(/\b\d{4}-\d{2}-\d{2}\b/g, (date) => (suppliedDates.has(date) ? " " : date));
}

// Whole-word alias match, so "ply" does not fire on "supply" or "apply".
function mentions(text, alias) {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![a-z0-9_])${escaped}(?![a-z0-9_])`, "i").test(text);
}

// Inputs and recommended settings the prompt supplies. They may be named outside
// attribution sentences; attribution claims stay limited to reported drivers.
const SUPPLIED_SETTING_DRIVERS = Object.freeze([
  "sf_speed_mpm", "roll_temp_c", "gum_application", "gum_viscosity_sec", "pasting_pressure",
  "drying_hours", "print_speed_spm", "quantity", "shift", "ambient_rh_pct", "ambient_temp_c",
  "paper_moisture_pct",
]);
const ATTRIBUTION_LANGUAGE = /\b(?:attribut\w*|contribut\w*|associat\w*|drivers?)\b/i;

// A sentence about the supplied source-history records describes their settings, which the
// prompt supplies; "associated with past settings" there is not a model-attribution claim.
const HISTORY_LANGUAGE = /\b(?:source[- ]history|histor(?:y|ical)|records?|past (?:runs?|lots?))\b/i;

/** The first driver named outside what the evidence allows, or undefined. */
function unsupportedDriverIn(text, reportedDrivers) {
  for (const sentence of sentences(text)) {
    const strict = ATTRIBUTION_LANGUAGE.test(sentence) && !HISTORY_LANGUAGE.test(sentence);
    const allowed = strict ? reportedDrivers : new Set([...reportedDrivers, ...SUPPLIED_SETTING_DRIVERS]);
    const hit = Object.entries(DRIVER_ALIASES).find(([driver, aliases]) =>
      !allowed.has(driver) && aliases.some((alias) => mentions(sentence, alias)));
    if (hit) return hit[0];
  }
  return undefined;
}
function namesUnsupportedDriver(text, reportedDrivers) {
  return unsupportedDriverIn(text, reportedDrivers) !== undefined;
}

const DEFECT_WORDS = Object.freeze({ WARP: "warp", DELAM: "delamination", STRENGTH: "box strength", PRINT: "print", CRACK: "crease cracking" });
const driverWords = (driver) => DRIVER_ALIASES[driver]?.[1] ?? driver.replaceAll("_", " ");

// Words that name a defect in generated text. "print" alone would also match the print-speed
// setting, so a print mention needs the defect sense.
const DEFECT_MENTIONS = Object.freeze({
  WARP: /\bwarp/i, DELAM: /\bdelam/i, STRENGTH: /\b(?:box )?strength\b/i,
  PRINT: /\bprint(?:ing)? (?:defect|risk|rate|scrap)/i, CRACK: /\bcrack|\bcrease/i,
});
const ADVISORY_LABEL = "advisory, low confidence";

// An advisory target (ARC-ML-03) may be described only in a sentence that says it is low confidence.
function unlabelledAdvisoryMention(text, advisory) {
  return sentences(text).some((sentence) => !/low confidence/i.test(sentence) &&
    advisory.some((defect) => DEFECT_MENTIONS[defect].test(sentence)));
}

// Used when Gemini is unavailable or its text fails the evidence checks twice. It states only
// the validated attribution rows and the supplied totals, and passes the same checks. Optimizer
// targets come first; an advisory target is named with its low-confidence label.
function attributionSummary(rows, baseline, best, advisory = []) {
  const byDefect = new Map();
  for (const row of rows) byDefect.set(row.defect, [...(byDefect.get(row.defect) ?? []), row]);
  const defects = [...byDefect.keys()].sort((left, right) =>
    Number(advisory.includes(left)) - Number(advisory.includes(right)));
  const lines = [];
  if (Number.isFinite(best?.totalScrapPct) && Number.isFinite(baseline?.totalScrapPct)) {
    lines.push(`The model predicts a total scrap rate of ${best.totalScrapPct}% with the recommended settings, compared with ${baseline.totalScrapPct}% with the planned settings.`);
  }
  for (const defect of defects.slice(0, lines.length ? 2 : 3)) {
    const ranked = byDefect.get(defect).sort((a, b) => a.driverRank - b.driverRank);
    const [first, second] = ranked;
    const drivers = second
      ? `${driverWords(first.driver)} at ${first.attributionPts} points and ${driverWords(second.driver)} at ${second.attributionPts} points`
      : `${driverWords(first.driver)} at ${first.attributionPts} points`;
    const name = `${DEFECT_WORDS[defect] ?? defect.toLowerCase()}${advisory.includes(defect) ? ` (${ADVISORY_LABEL})` : ""}`;
    lines.push(`For ${name}, the model predicts ${first.predictedPct}% against a typical ${first.typicalPct}%, and its largest attributions are ${drivers}.`);
  }
  lines.push("These attributions are model associations, not proof of cause and effect, and come from history modelled on the plant.");
  return lines.join(" ");
}

// The prompt asks Gemini to disclaim causation; a negated disclaimer ("do not imply causal
// links", "not proof of cause and effect", "neither establishes a causal effect") is not a claim.
const NEGATED_CAUSATION = /\b(?:not|no|never|neither|nor|without|rather than|instead of)\b[^.!?]{0,60}?\b(?:cause[- ]and[- ]effect|causal(?:ity|ly)?(?:\s+(?:links?|relationships?|effects?|claims?|connections?|inferences?))?|causation)\b/gi;
export function withoutNegatedCausation(text) {
  return text.replace(NEGATED_CAUSATION, " ");
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

export function containsCausalClaim(text) {
  return /\b(?:cause[sd]?|causing|causal(?:ly)?|because of|due to|leads? to|result(?:s|ing)? (?:in|from)|drives?|proves?|demonstrates?)\b|\b(?:increases?|decreases?|raises?|lowers?|worsens?|improves?)(?:\s+\w+){0,3}\s+\b(?:risk|scrap|defect|prediction|rate)\b/i.test(text);
}

export function containsUnverifiedOutcomeClaim(text) {
  const outcome = String.raw`(?:actual(?:\s+observed)?|measured|real[- ]world)\s+(?:factory\s+|production\s+)?outcomes?`;
  const assertions = text.replace(new RegExp(String.raw`\b(?:not|rather than|instead of)\s+${outcome}\b`, "gi"), " ");
  return new RegExp(String.raw`\b${outcome}\b`, "i").test(assertions);
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
      // Abstain targets are dropped: their attribution rows would put a predicted rate into the prompt.
      const targetUse = inputOptimization.best.risk.targetUse;
      const shown = shownDefects(targetUse);
      const advisory = shown.filter((defect) => targetUse?.[defect].useClass === "advisory");
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
      }).filter((row) => shown.includes(row.defect));
      const expectedDefects = ["WARP", "DELAM", "STRENGTH", "PRINT", "CRACK"].filter((defect) =>
        (defect !== "PRINT" || inputOrder.inkColors > 0) && shown.includes(defect));
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
        explanationRows: rows.map((row) => advisory.includes(row.defect) ? { ...row, useClass: ADVISORY_LABEL } : row),
        historicalEvidence: evidenceForPrompt,
      };
      const instruction = `${EXPLANATION_PROMPT}\\n${JSON.stringify(promptData)}`;
      // Ground against the exact validated JSON supplied to Gemini, including
      // original settings in changes.from. A separately maintained subset can
      // reject genuine supplied values when the prompt evolves.
      const numericValues = (value) => typeof value === "number" ? [value]
        : value && typeof value === "object" ? Object.values(value).flatMap(numericValues) : [];
      const allowedNumbers = permittedNumbers(numericValues(promptData));
      const suppliedDates = new Set(historicalEvidence.map((run) => run.runDate));
      const reportedDrivers = withDriverParts(rows.map((row) => row.driver.toLowerCase()));
      /** Why a text breaks the evidence contract, or undefined when it passes. */
      const violation = (text) => {
        const unsupportedNumbers = numericClaims(withoutSuppliedDates(text, suppliedDates)).filter((value) => !allowedNumbers.has(value)).length;
        if (!text || sentenceCount(text) < 3 || sentenceCount(text) > 5 || unsupportedNumbers > 0) {
          return { reason: "evidence_contract", sentenceCount: sentenceCount(text), unsupportedNumericClaims: unsupportedNumbers };
        }
        const driver = unsupportedDriverIn(text, reportedDrivers);
        const causalClaim = containsCausalClaim(withoutNegatedCausation(text));
        const unverifiedOutcomeClaim = containsUnverifiedOutcomeClaim(text);
        if (driver || causalClaim || unverifiedOutcomeClaim) {
          return { reason: "attribution_contract", unsupportedDriver: driver ?? false, causalClaim, unverifiedOutcomeClaim };
        }
        return unlabelledAdvisoryMention(text, advisory) ? { reason: "use_class_contract" } : undefined;
      };
      // Gemini writes the explanation; a text outside the contract gets one more attempt.
      let explanation;
      let source = "bigquery-ml-and-gemini";
      for (let attempt = 1; attempt <= 2 && explanation === undefined; attempt += 1) {
        let text;
        try {
          const response = await gemini.generateContent({
            role: "explanation",
            contents: [{ role: "user", parts: [{ text: instruction }] }],
            // Measured live: this prompt used 1,964 thinking tokens, exhausting the 2,048 default.
            maxOutputTokens: 8192,
            signal,
          });
          text = response.parts.map((part) => part.text).filter((part) => typeof part === "string").join("").trim();
        } catch (error) {
          if (error?.name === "AbortError" || signal?.aborted) throw error;
          console.error(JSON.stringify({ event: "risk_explanation_gemini_failed", attempt, code: /^[A-Z_]{1,64}$/.test(error?.code ?? "") ? error.code : "UNEXPECTED_ERROR" }));
          break;
        }
        const problem = violation(text);
        if (problem) console.error(JSON.stringify({ event: "risk_explanation_rejected", attempt, ...problem }));
        else explanation = text;
      }
      // Never lose a completed plan to the narrative: fall back to a summary of the validated
      // attribution rows, held to the same contract.
      if (explanation === undefined) {
        const summary = attributionSummary(rows, inputPrediction, inputOptimization.best.risk, advisory);
        const problem = violation(summary);
        if (problem) {
          console.error(JSON.stringify({ event: "risk_explanation_rejected", attempt: "summary", ...problem }));
          throw new BigQueryReadError("EXPLANATION_INVALID", "No explanation met the attribution evidence contract.");
        }
        console.warn(JSON.stringify({ event: "risk_explanation_fallback", source: "bigquery-ml-attribution-summary" }));
        explanation = summary;
        source = "bigquery-ml-attribution-summary";
      }
      return {
        ok: true,
        source,
        explanation,
        rows,
        ...(source === "bigquery-ml-and-gemini" ? { generation: arcModelSettings.generation("explanation") } : {}),
        evidenceRefs: historicalEvidence.map(({ lotId, orderId, runDate }) => ({ lotId, orderId, runDate })),
      };
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      console.error(JSON.stringify({ event: "risk_explanation_failed", code: /^[A-Z_]{1,64}$/.test(error?.code ?? "") ? error.code : "UNEXPECTED_ERROR" }));
      return geminiUsageFailure(error) ?? unavailable("The evidence-grounded risk explanation is temporarily unavailable.");
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
          band_pts: { type: "INT64", value: HUMIDITY_BAND_POINTS },
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
