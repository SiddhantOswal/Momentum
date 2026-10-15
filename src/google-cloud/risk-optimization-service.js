import { readFileSync } from "node:fs";
import { BigQueryReadError } from "./bigquery-read-client.js";
import { RiskOptimizationRequestSchema } from "../schemas.js";
import { mapRiskPredictionParameters } from "../bigquery-mapper.js";
import modelAcceptanceConfig from "../../config/model-acceptance.json" with { type: "json" };
import { getModelAcceptanceSummary, isModelSetAccepted } from "../model-acceptance.js";

// The seven levers in the order they appear in the optimizer SQL output
const LEVER_NAMES = Object.freeze([
  "sf_speed_mpm",
  "roll_temp_c",
  "gum_application",
  "gum_viscosity_sec",
  "pasting_pressure",
  "drying_hours",
  "print_speed_spm",
]);

// camelCase mapping for lever names
const LEVER_CAMEL = Object.freeze({
  sf_speed_mpm:      "sfSpeedMpm",
  roll_temp_c:       "rollTempC",
  gum_application:   "gumApplication",
  gum_viscosity_sec: "gumViscositySec",
  pasting_pressure:  "pastingPressure",
  drying_hours:      "dryingHours",
  print_speed_spm:   "printSpeedSpm",
});

const LEVER_REASON = Object.freeze({
  sfSpeedMpm:      "Single-facer speed changed in the lowest modeled total-cost candidate; not a causal effect estimate.",
  rollTempC:       "Roll temperature changed in the lowest modeled total-cost candidate; not a causal effect estimate.",
  gumApplication:  "Gum application changed in the lowest modeled total-cost candidate; not a causal effect estimate.",
  gumViscositySec: "Gum viscosity changed in the lowest modeled total-cost candidate; not a causal effect estimate.",
  pastingPressure: "Pasting pressure changed in the lowest modeled total-cost candidate; not a causal effect estimate.",
  dryingHours:     "Drying time changed in the lowest modeled total-cost candidate; not a causal effect estimate.",
  printSpeedSpm:   "Print speed changed in the lowest modeled total-cost candidate; not a causal effect estimate.",
});

const EXPECTED_COLUMNS = Object.freeze([
  "kind", "n_changes",
  "sf_speed_mpm", "roll_temp_c", "gum_application", "gum_viscosity_sec",
  "pasting_pressure", "drying_hours", "print_speed_spm",
  "rate_warp_pct", "rate_delam_pct", "rate_strength_pct", "rate_print_pct", "rate_crack_pct",
  "total_scrap_pct", "scrap_kg", "scrap_cost",
  "penalty", "total_cost", "currency", "primary_defect",
  "savings_kg", "savings_cost",
]);
const STRING_COLUMNS = new Set([
  "kind", "gum_application", "pasting_pressure", "currency", "primary_defect",
]);
const INTEGER_TYPES = new Set(["INT64", "INTEGER"]);
const NUMERIC_TYPES = new Set([...INTEGER_TYPES, "FLOAT64", "FLOAT", "NUMERIC", "BIGNUMERIC"]);

const VALID_DEFECTS = new Set(["WARP", "DELAM", "STRENGTH", "PRINT", "CRACK"]);
const VALID_LEVELS  = new Set(["LOW", "MED", "HIGH"]);
const CANDIDATE_GRID = Object.freeze({
  sfSpeedMpm: [30, 38, 45, 52],
  rollTempC: [160, 170, 180],
  gumApplication: ["LOW", "MED", "HIGH"],
  gumViscositySec: [35, 45],
  pastingPressure: ["LOW", "MED"],
  dryingHours: [4, 6, 8, 10, 12],
  printSpeedSpm: [40, 55, 70],
});
const PLANT_STANDARD_LEVERS = Object.freeze({
  sfSpeedMpm: 42,
  rollTempC: 168,
  gumApplication: "MED",
  gumViscositySec: 40,
  pastingPressure: "MED",
  dryingHours: 6,
  printSpeedSpm: 55,
});
const FLOAT_PARAMETERS = new Set([
  "ambient_rh_pct", "ambient_temp_c", "paper_moisture_pct", "sf_speed_mpm",
  "roll_temp_c", "gum_viscosity_sec", "drying_hours", "print_speed_spm",
]);

export class RiskOptimizationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "RiskOptimizationError";
    this.code = code;
  }
}

function decodeRow(fields, row) {
  if (!Array.isArray(row.f) || row.f.length !== fields.length) {
    throw new RiskOptimizationError("OPT_ROW_INVALID", "Optimizer returned a malformed result row.");
  }
  const raw = Object.fromEntries(fields.map((field, index) => [field.name, row.f[index]?.v ?? null]));
  const num = (name) => {
    const value = raw[name];
    if (value === null || value === undefined) return null;
    const n = Number(value);
    if (!Number.isFinite(n)) {
      throw new RiskOptimizationError("OPT_ROW_INVALID", `Optimizer returned a non-finite value for ${name}.`);
    }
    return n;
  };
  return {
    kind:             raw.kind,
    n_changes:        num("n_changes"),
    sf_speed_mpm:     num("sf_speed_mpm"),
    roll_temp_c:      num("roll_temp_c"),
    gum_application:  raw.gum_application,
    gum_viscosity_sec: num("gum_viscosity_sec"),
    pasting_pressure: raw.pasting_pressure,
    drying_hours:     num("drying_hours"),
    print_speed_spm:  num("print_speed_spm"),
    rate_warp_pct:    num("rate_warp_pct"),
    rate_delam_pct:   num("rate_delam_pct"),
    rate_strength_pct: num("rate_strength_pct"),
    rate_print_pct:   num("rate_print_pct"),
    rate_crack_pct:   num("rate_crack_pct"),
    total_scrap_pct:  num("total_scrap_pct"),
    scrap_kg:         num("scrap_kg"),
    scrap_cost:       num("scrap_cost"),
    penalty:          num("penalty"),
    total_cost:       num("total_cost"),
    currency:         raw.currency,
    primary_defect:   raw.primary_defect,
    savings_kg:       num("savings_kg"),
    savings_cost:     num("savings_cost"),
  };
}

function validateRow(row, kind) {
  if (row.kind !== kind) {
    throw new RiskOptimizationError("OPT_KIND_MISMATCH", `Expected kind=${kind}, got ${row.kind}.`);
  }
  if (!VALID_DEFECTS.has(row.primary_defect)) {
    throw new RiskOptimizationError("OPT_ROW_INVALID", `Invalid primary_defect in ${kind} row: ${row.primary_defect}.`);
  }
  if (!VALID_LEVELS.has(row.gum_application)) {
    throw new RiskOptimizationError("OPT_ROW_INVALID", `Invalid gum_application in ${kind} row.`);
  }
  if (!VALID_LEVELS.has(row.pasting_pressure)) {
    throw new RiskOptimizationError("OPT_ROW_INVALID", `Invalid pasting_pressure in ${kind} row.`);
  }
  const numericValues = [
    row.n_changes, row.sf_speed_mpm, row.roll_temp_c, row.gum_viscosity_sec,
    row.drying_hours, row.print_speed_spm, row.rate_warp_pct, row.rate_delam_pct,
    row.rate_strength_pct, row.rate_print_pct, row.rate_crack_pct,
    row.total_scrap_pct, row.scrap_kg, row.scrap_cost, row.penalty,
    row.total_cost, row.savings_kg, row.savings_cost,
  ];
  if (numericValues.some((value) => value === null || !Number.isFinite(value))) {
    throw new RiskOptimizationError("OPT_ROW_INVALID", `The ${kind} row contains a missing numeric value.`);
  }
  if (row.currency !== "INR") {
    throw new RiskOptimizationError("OPT_UNSUPPORTED_CURRENCY", `The ${kind} row currency must be INR.`);
  }
  if ([
    row.sf_speed_mpm, row.roll_temp_c, row.gum_viscosity_sec,
    row.drying_hours, row.print_speed_spm, row.scrap_kg, row.scrap_cost,
    row.penalty, row.total_cost,
  ].some((value) => value < 0)) {
    throw new RiskOptimizationError("OPT_ROW_INVALID", `The ${kind} row contains a negative setting or cost.`);
  }
  const totalRate = row.rate_warp_pct + row.rate_delam_pct + row.rate_strength_pct +
    row.rate_print_pct + row.rate_crack_pct;
  if ([
    row.rate_warp_pct, row.rate_delam_pct, row.rate_strength_pct,
    row.rate_print_pct, row.rate_crack_pct,
  ].some((value) => value < 0 || value > 25) ||
      Math.abs(totalRate - row.total_scrap_pct) > 0.02) {
    throw new RiskOptimizationError("OPT_ROW_INVALID", `The ${kind} row has inconsistent scrap-rate units.`);
  }
  if (Math.abs(row.scrap_cost + row.penalty - row.total_cost) > 1.1) {
    throw new RiskOptimizationError("OPT_ROW_INVALID", `The ${kind} row has inconsistent total-cost units.`);
  }
}

function expectedThroughputPenalty(row, plannedLevers) {
  return Math.round(
    200 * Math.max(row.drying_hours - plannedLevers.dryingHours, 0) +
    60 * Math.max(plannedLevers.sfSpeedMpm - row.sf_speed_mpm, 0) +
    30 * Math.max(plannedLevers.printSpeedSpm - row.print_speed_spm, 0),
  );
}

function rowToLeversAndRisk(row) {
  return {
    levers: {
      sfSpeedMpm:      row.sf_speed_mpm,
      rollTempC:       row.roll_temp_c,
      gumApplication:  row.gum_application,
      gumViscositySec: row.gum_viscosity_sec,
      pastingPressure: row.pasting_pressure,
      dryingHours:     row.drying_hours,
      printSpeedSpm:   row.print_speed_spm,
    },
    risk: {
      ratesPct: {
        WARP:     row.rate_warp_pct,
        DELAM:    row.rate_delam_pct,
        STRENGTH: row.rate_strength_pct,
        PRINT:    row.rate_print_pct,
        CRACK:    row.rate_crack_pct,
      },
      totalScrapPct: row.total_scrap_pct,
      totalScrapKg:  row.scrap_kg,
      scrapCost:     row.scrap_cost,
      currency:      row.currency,
      primaryDefect: row.primary_defect,
    },
  };
}

function deriveChanges(baseline, best) {
  const changes = [];
  for (const sqlName of LEVER_NAMES) {
    const camel = LEVER_CAMEL[sqlName];
    const from  = baseline[sqlName];
    const to    = best[sqlName];
    // Compare as strings so MED !== HIGH and 48 !== 50
    if (String(from) !== String(to)) {
      changes.push({
        lever:  camel,
        from,
        to,
        reason: LEVER_REASON[camel],
      });
    }
  }
  return changes;
}

function decodeOptimizationResult(result, { plannedLevers } = {}) {
  const fields = result?.schema?.fields;
  if (!Array.isArray(fields) || fields.length !== EXPECTED_COLUMNS.length) {
    throw new RiskOptimizationError("OPT_SCHEMA_MISMATCH", "Optimizer returned an unexpected number of columns.");
  }
  for (let i = 0; i < EXPECTED_COLUMNS.length; i++) {
    if (fields[i].name !== EXPECTED_COLUMNS[i]) {
      throw new RiskOptimizationError(
        "OPT_SCHEMA_MISMATCH",
        `Optimizer column ${i} is ${fields[i].name}, expected ${EXPECTED_COLUMNS[i]}.`,
      );
    }
    const name = EXPECTED_COLUMNS[i];
    const validType = STRING_COLUMNS.has(name)
      ? fields[i].type === "STRING"
      : name === "n_changes"
        ? INTEGER_TYPES.has(fields[i].type)
        : NUMERIC_TYPES.has(fields[i].type);
    if (!validType) {
      throw new RiskOptimizationError(
        "OPT_SCHEMA_MISMATCH",
        `Optimizer column ${fields[i].name} has an unexpected type.`,
      );
    }
  }

  const rows = result.rows ?? [];
  if (rows.length !== 2) {
    throw new RiskOptimizationError(
      "OPT_WRONG_ROW_COUNT",
      `Optimizer must return exactly 2 rows (BASELINE + BEST); got ${rows.length}.`,
    );
  }

  const decoded = rows.map((row) => decodeRow(fields, row));
  const baselines = decoded.filter((row) => row.kind === "BASELINE");
  const bestRows = decoded.filter((row) => row.kind === "BEST");
  if (baselines.length !== 1 || bestRows.length !== 1) {
    throw new RiskOptimizationError(
      "OPT_KIND_MISMATCH",
      "Optimizer must return one BASELINE row and one BEST row.",
    );
  }
  const [baselineRaw] = baselines;
  const [bestRaw] = bestRows;

  validateRow(baselineRaw, "BASELINE");
  validateRow(bestRaw, "BEST");

  if (baselineRaw.n_changes !== 0) {
    throw new RiskOptimizationError("OPT_BASELINE_INVALID", "BASELINE row must have n_changes = 0.");
  }
  if (bestRaw.n_changes < 0 || bestRaw.n_changes > 3) {
    throw new RiskOptimizationError(
      "OPT_CHANGE_COUNT_EXCEEDED",
      `BEST row n_changes (${bestRaw.n_changes}) must be between 0 and 3.`,
    );
  }
  if (baselineRaw.savings_kg !== 0 || baselineRaw.savings_cost !== 0 ||
      baselineRaw.currency !== bestRaw.currency) {
    throw new RiskOptimizationError("OPT_BASELINE_INVALID", "BASELINE savings and currencies are inconsistent.");
  }
  if (plannedLevers) {
    for (const lever of LEVER_NAMES) {
      const camel = LEVER_CAMEL[lever];
      if (baselineRaw[lever] !== plannedLevers[camel]) {
        throw new RiskOptimizationError(
          "OPT_BASELINE_INVALID",
          `BASELINE ${lever} does not match the operator's planned setting.`,
        );
      }
      const candidates = [...CANDIDATE_GRID[camel], plannedLevers[camel]];
      if (!candidates.includes(bestRaw[lever])) {
        throw new RiskOptimizationError(
          "OPT_ROW_INVALID",
          `BEST ${lever} is outside the documented optimizer grid.`,
        );
      }
    }
    if (baselineRaw.penalty !== expectedThroughputPenalty(baselineRaw, plannedLevers) ||
        bestRaw.penalty !== expectedThroughputPenalty(bestRaw, plannedLevers)) {
      throw new RiskOptimizationError(
        "OPT_PENALTY_MISMATCH",
        "Optimizer throughput penalties do not match the documented slowing-down formula.",
      );
    }
  }

  const baseline = rowToLeversAndRisk(baselineRaw);
  const best     = rowToLeversAndRisk(bestRaw);
  const changes  = deriveChanges(baselineRaw, bestRaw);

  if (changes.length !== bestRaw.n_changes) {
    throw new RiskOptimizationError(
      "OPT_CHANGES_MISMATCH",
      `Derived ${changes.length} lever changes but n_changes=${bestRaw.n_changes}.`,
    );
  }

  const savingsKg = bestRaw.savings_kg;
  const savingsCost = bestRaw.savings_cost;
  if (bestRaw.total_cost > baselineRaw.total_cost + 1.1 ||
      Math.abs(savingsKg - (baselineRaw.scrap_kg - bestRaw.scrap_kg)) > 0.11 ||
      Math.abs(savingsCost - (baselineRaw.total_cost - bestRaw.total_cost)) > 1.1) {
    throw new RiskOptimizationError("OPT_INVALID_SAVINGS", "BEST savings do not match the optimizer's predicted cost and scrap deltas.");
  }

  return {
    baseline,
    best,
    changes,
    savings: {
      kg:  savingsKg,
      inr: savingsCost,
      percent: baselineRaw.total_cost === 0
        ? 0
        : (savingsCost / baselineRaw.total_cost) * 100,
    },
    modelPredicted: true,
    note: bestRaw.total_cost === baselineRaw.total_cost
      ? "Your plan is already the best option we found"
      : "Predicted savings compare this recommendation with the supervisor's plan. The slower-production allowance is a linear heuristic, not a measured cost.",
  };
}

export function createRiskOptimizationService({
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
  const queryText = sql ?? readFileSync(new URL("../../sql/optimize.sql", import.meta.url), "utf8");
  if (typeof queryText !== "string" || !/^\s*--[^\n]*optimize\.sql/i.test(queryText) ||
      !queryText.includes("ML.PREDICT")) {
    throw new TypeError("The verified BigQuery ML optimization SQL is required.");
  }

  return async function optimizeRisk(input = {}) {
    const { signal } = input;
    const suppliedLevers = input.levers && typeof input.levers === "object" ? input.levers : {};
    const plantStandardLeversUsed = Object.keys(PLANT_STANDARD_LEVERS)
      .filter((lever) => suppliedLevers[lever] === undefined);
    const parsedInput = RiskOptimizationRequestSchema.safeParse({
      order: input.order,
      conditions: input.conditions,
      conditionsConfirmed: input.conditionsConfirmed,
      levers: { ...PLANT_STANDARD_LEVERS, ...suppliedLevers },
    });
    if (!parsedInput.success) {
      return {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Order, conditions and planned levers must match the optimizer contract.",
          issues: parsedInput.error.issues.map((issue) => ({
            field: issue.path.join(".") || "request",
            path: issue.path,
            code: issue.code,
            message: issue.message,
          })),
        },
      };
    }
    if (input.conditionsConfirmed !== true) {
      return {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Plant-condition confirmation is required before optimization.",
          issues: [{
            field: "conditionsConfirmed",
            path: ["conditionsConfirmed"],
            code: "confirmation_required",
            message: "Confirm or edit the displayed plant conditions before requesting optimization.",
          }],
        },
      };
    }
    const { order, conditions, levers } = parsedInput.data;

    if (!isModelSetAccepted(modelAcceptance)) {
      return {
        ok: false,
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "Optimization is blocked until the current five-model set has complete version-linked acceptance evidence.",
        },
        modelAcceptance: getModelAcceptanceSummary(modelAcceptance),
      };
    }

    try {
      const rawParameters = mapRiskPredictionParameters({ order, conditions, levers });
      const parameters = Object.fromEntries(Object.entries(rawParameters).map(([name, value]) => [
        name,
        typeof value === "number"
          ? { type: name === "quantity" ? "INT64" : FLOAT_PARAMETERS.has(name) ? "FLOAT64" : "INT64", value }
          : value,
      ]));

      const result = await bigquery.query({ sql: queryText, parameters, signal });
      const optimization = decodeOptimizationResult(result, { plannedLevers: levers });

      return {
        ok: true,
        agent: "optimizeLevers",
        source: "bigquery-ml",
        isRealModelPrediction: true,
        modelAcceptance: getModelAcceptanceSummary(modelAcceptance),
        plantStandardLeversUsed,
        planBaselineLabel: plantStandardLeversUsed.length
          ? "plant standard for blank levers"
          : "supervisor's planned settings",
        ...optimization,
      };
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      const queryMessage = typeof error?.message === "string" ? error.message : "";
      if (queryMessage.includes("Item not found in item master")) {
        return { ok: false, error: { code: "NOT_FOUND", message: "Item not found in item master" } };
      }
      if (queryMessage.includes("Plant settings missing")) {
        return { ok: false, error: { code: "SERVICE_UNAVAILABLE", message: "Plant settings missing" } };
      }
      if (error instanceof RiskOptimizationError) {
        return {
          ok: false,
          error: {
            code: error.code === "OPT_CHANGE_COUNT_EXCEEDED" ? "VALIDATION_ERROR" : "SERVICE_UNAVAILABLE",
            message: error.message,
          },
        };
      }
      return {
        ok: false,
        error: { code: "SERVICE_UNAVAILABLE", message: "Lever optimization is temporarily unavailable." },
      };
    }
  };
}

export { decodeOptimizationResult };
export { PLANT_STANDARD_LEVERS };
