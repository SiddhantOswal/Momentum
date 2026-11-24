import { loadMetricDictionary } from "./metrics/dictionary.js";
import { metricLabel } from "./metrics/query.js";
import { CHIPS, DEFECT_NAMES, SENTENCES } from "./answer-labels.js";

/**
 * Turns the same turn's tool results into the facts the answer writer sees and
 * the checks compare against, and renders the template answer from them. Only
 * fields listed here leave a tool result: order-derived strings, notes and
 * free text never become facts (05 section 4, ADR-0009 decision 6).
 */

const dictionary = loadMetricDictionary();
const metrics = new Map(dictionary.metrics.map((metric) => [metric.id, metric]));
const scoreMetric = metrics.get("model_holdout_r2");
const MAX_TEMPLATE_ROWS = 3;

const finite = (value) => typeof value === "number" && Number.isFinite(value);
const pick = (row, fields) => Object.fromEntries(fields.filter((field) => Object.hasOwn(row ?? {}, field)).map((field) => [field, row[field]]));
const r2Text = (value) => value.toFixed(2);

function scoreFacts(models) {
  const rows = models.filter(({ defect, r2 }) => Object.hasOwn(DEFECT_NAMES, defect) && finite(r2))
    .map(({ defect, r2, sampleCount }) => ({ defect, r2, ...(Number.isSafeInteger(sampleCount) && { sampleCount }) }));
  const counts = new Set(rows.map(({ sampleCount }) => sampleCount));
  const sampleCount = counts.size === 1 ? [...counts][0] : undefined;
  return { label: metricLabel(scoreMetric, { sampleCount }), basis: scoreMetric.basis, rows };
}

function metricFacts(result) {
  const metric = metrics.get(result.metric);
  if (!metric) return null;
  if (result.status === "insufficient_data") return { metric: metric.id, status: "insufficient_data", missing: metric.insufficient.missing };
  return {
    metric: metric.id, status: "ok", label: result.label, basis: metric.basis,
    units: Object.fromEntries(metric.columns.filter(({ unit }) => unit).map(({ name, unit }) => [name, unit])),
    filters: result.filters ?? {},
    rows: (result.rows ?? []).map((row) => pick(row, metric.writerFields)),
  };
}

function conditionFacts(conditions) {
  return Array.isArray(conditions)
    ? conditions.map((condition) => pick(condition, ["field", "value", "unit", "label"]))
    : [];
}

/** One fact entry per data tool that succeeded, or null when the tool is not a data tool. */
export function factsFor({ tool, args = {}, result }) {
  if (!result?.ok) return null;
  switch (tool) {
    case "get_status":
      return Array.isArray(result.modelAcceptance?.models) ? { tool, ...scoreFacts(result.modelAcceptance.models) } : null;
    case "query_metric": {
      const facts = metricFacts(result);
      return facts && { tool, ...facts };
    }
    case "get_weather":
      return finite(result.ambientRhPct) && finite(result.ambientTempC) ? {
        tool, label: CHIPS.weatherRecord, note: SENTENCES.weather,
        ...(typeof result.location === "string" && { location: result.location }),
        ambientRhPct: result.ambientRhPct, ambientTempC: result.ambientTempC,
        ...(typeof result.observedAt === "string" && { observedAt: result.observedAt }),
      } : null;
    // The command checks that its row is for the requested defect, so the validated argument names it.
    case "search_defect_history":
      return Object.hasOwn(DEFECT_NAMES, args.defect) && finite(result.caseCount) ? {
        tool, label: CHIPS.modeledRecords, note: SENTENCES.modeled, defect: args.defect,
        ...(finite(args.ambientRhPct) && { ambientRhPct: args.ambientRhPct }),
        caseCount: result.caseCount,
        ...pick(result, ["avgRateWhenMain", "costWhenMain"]),
      } : null;
    case "get_lot":
      return result.lot ? {
        tool, stage: result.lot.stage, currentRevision: result.lot.currentRevision,
        conditions: conditionFacts(result.lot.draftConditions),
        ...(result.revision && { revision: pick(result.revision, ["number", "status"]) }),
      } : null;
    default:
      return null;
  }
}

/**
 * A pointer the turn record can keep for a data result, so the card can be
 * rebuilt when the turn is read. The ID is built from enums and dictionary IDs
 * only, never from a tool's free text.
 */
export function metricRef(tool, args, result) {
  if (!result?.ok) return null;
  if (tool === "get_status") return { kind: "metric", id: "model_scores" };
  if (tool === "get_weather") return { kind: "metric", id: "weather" };
  if (tool === "search_defect_history") return { kind: "metric", id: "defect_history" };
  if (tool !== "query_metric" || !metrics.has(result.metric)) return null;
  if (result.status === "insufficient_data") return { kind: "metric", id: `no_data.${result.metric}` };
  if (result.metric === scoreMetric.id && Object.hasOwn(DEFECT_NAMES, args?.filters?.defect)) {
    return { kind: "metric", id: `model_scores.${args.filters.defect}` };
  }
  return { kind: "metric", id: result.metric === scoreMetric.id ? "model_scores" : `metric.${result.metric}` };
}

function scoreSentence({ label, rows }) {
  const scores = rows.map(({ defect, r2 }) => `${DEFECT_NAMES[defect]} ${r2Text(r2)}`).join(", ");
  return `Holdout R2 per model: ${scores}. ${label}. ${SENTENCES.modeled}`;
}

const shown = (value) => value === null || value === undefined ? "not recorded" : String(value);

function metricSentence(facts) {
  if (facts.status === "insufficient_data") return facts.missing;
  const rows = facts.rows.slice(0, MAX_TEMPLATE_ROWS);
  switch (facts.metric) {
    case "model_holdout_r2":
      return scoreSentence(facts);
    case "defect_history_at_humidity": {
      const [row] = rows;
      return `In modeled lots near ${facts.filters.ambientRhPct}% humidity, ${DEFECT_NAMES[row.defect] ?? row.defect} was the main problem ` +
        `in ${row.n_cases} of ${row.lots_in_band} lots. ${facts.basis}`;
    }
    case "top_scrap_items":
      return `Highest modeled scrap cost: ${rows.map((row) => `${row.item_code} ${row.scrap_cost_12m} ${row.currency}`).join(", ")}. ${facts.basis}`;
    case "catalog_item": {
      const [row] = rows;
      return `${row.item_code}: ${shown(row.box_style)}, ${shown(row.length_mm)} by ${shown(row.width_mm)} by ${shown(row.height_mm)} mm, ` +
        `${shown(row.ply)} ply, flute ${shown(row.flute_profile)}. ${facts.basis}`;
    }
    default:
      return facts.basis;
  }
}

function sentenceFor(facts) {
  switch (facts.tool) {
    case "get_status": return scoreSentence(facts);
    case "query_metric": return metricSentence(facts);
    case "get_weather": {
      const time = facts.observedAt?.match(/T(\d{2}:\d{2})/)?.[1];
      return `${facts.location ? `${facts.location} weather record` : "Weather record"}: humidity ${facts.ambientRhPct}% and temperature ${facts.ambientTempC} °C` +
        `${time ? `, read at ${time} UTC` : ""}. ${facts.note}`;
    }
    case "search_defect_history":
      return `${DEFECT_NAMES[facts.defect]} was the main problem in ${facts.caseCount} modeled lots at similar humidity. ${facts.note}`;
    case "get_lot":
      return facts.currentRevision > 0
        ? `The lot is at the ${facts.stage.replaceAll("_", " ")} stage, on revision ${facts.currentRevision}.`
        : `The lot is at the ${facts.stage.replaceAll("_", " ")} stage and has not been planned yet.`;
    default:
      return null;
  }
}

const RETRIEVAL = Object.freeze({
  get_job: "Here is the job card from this session.",
  get_job_card: "Here is the job card from this session.",
});
const DEFAULT_TEXT = "Arc finished the requested steps.";
// Shown when the template itself fails its checks (05 section 5, step 7); the card then shows no values.
export const UNCHECKED_TEXT = "Arc could not check this answer against its sources, so it is not shown. " +
  "Try a suggested question, or ask again in different words.";
// The turn record stores at most 1,200 characters of answer text.
const MAX_TEXT = 1200;

/**
 * The code-written answer. It always exists, is the writer's fallback, and
 * passes the same grounding checks. A mixed message keeps the refusal line
 * after the in-scope part (AC5.4).
 */
export function renderTemplate({ tools = [], data = [], replyText } = {}) {
  const parts = data.map(sentenceFor).filter(Boolean);
  if (!parts.length) parts.push(tools.map((tool) => RETRIEVAL[tool]).find(Boolean));
  parts.push(replyText);
  let text = "";
  for (const part of parts.filter(Boolean)) {
    const next = text ? `${text} ${part}` : part;
    if (next.length > MAX_TEXT) break;
    text = next;
  }
  return text || DEFAULT_TEXT;
}
