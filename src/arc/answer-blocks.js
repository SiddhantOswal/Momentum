import modelAcceptanceConfig from "../../config/model-acceptance.json" with { type: "json" };
import { getModelAcceptanceSummary } from "../model-acceptance.js";
import { CHIPS, DEFECT_NAMES, SENTENCES } from "./answer-labels.js";
import { loadMetricDictionary } from "./metrics/dictionary.js";
import { metricLabel } from "./metrics/query.js";
import { createScopeRules } from "./scope-rules.js";

const MAX_BLOCKS = 8;
const SCORE_ID = /^model_scores(?:\.([A-Z]+))?$/;
const NO_DATA_ID = /^no_data\.([a-z][a-z0-9_]{2,48})$/;
// Weather and BigQuery reads are not repeated on every transcript read, and their values are not stored.
const NOT_REREAD = /^(?:weather|defect_history|metric\.[a-z][a-z0-9_]{2,48})$/;
const RECORD_LABELS = Object.freeze({ photo: [CHIPS.approvedPhoto] });

/**
 * Builds the answer card of a stored turn (wire contract section 5). The turn
 * record keeps only pointers, so every block is rebuilt here from config and
 * code; nothing in a block comes from model text. Model scores are read from
 * config/model-acceptance.json, the same source get_status uses. A record
 * reference names the record, and the client reads it with its own route.
 */
export function createAnswerBlocks({
  modelAcceptance = modelAcceptanceConfig, dictionary = loadMetricDictionary(), scope = createScopeRules(),
} = {}) {
  const metrics = new Map(dictionary.metrics.map((metric) => [metric.id, metric]));
  const scoreMetric = metrics.get("model_holdout_r2");
  const unavailable = (ref, errorCode) => ({ kind: "unavailable", ref, errorCode });

  function scoreChart(ref, defect) {
    const summary = getModelAcceptanceSummary(modelAcceptance);
    const models = summary.status === "accepted"
      ? summary.models.filter((model) => Object.hasOwn(DEFECT_NAMES, model.defect) && Number.isFinite(model.r2) &&
        (defect === undefined || model.defect === defect))
      : [];
    if (!models.length) return unavailable(ref, "SOURCE_UNAVAILABLE");
    const counts = new Set(models.map(({ sampleCount }) => sampleCount));
    const label = metricLabel(scoreMetric, { sampleCount: counts.size === 1 ? [...counts][0] : undefined });
    return {
      kind: "chart", title: "Holdout R2 per model", labels: [label], note: SENTENCES.modeled,
      series: models.map(({ defect: name, r2 }) => ({
        name: DEFECT_NAMES[name], value: Math.round(r2 * 100) / 100, unit: null, labels: [label],
      })),
    };
  }

  function metricBlock(ref) {
    const score = ref.id.match(SCORE_ID);
    if (score) return score[1] === undefined || Object.hasOwn(DEFECT_NAMES, score[1]) ? scoreChart(ref, score[1]) : null;
    const missing = ref.id.match(NO_DATA_ID);
    if (missing) {
      const metric = metrics.get(missing[1]);
      return metric ? { kind: "no_data", missing: metric.insufficient.missing, alternatives: scope.suggestions() } : null;
    }
    return NOT_REREAD.test(ref.id) ? unavailable(ref, "SOURCE_NOT_STORED") : null;
  }

  function blockFor(ref) {
    switch (ref.kind) {
      case "metric": return metricBlock(ref);
      case "job": case "lot": case "card": case "po_review": case "photo":
        // A diagnosis is the only text a photo reference carries, and Gemini wrote it.
        return { kind: "reference", ref, labels: [...(RECORD_LABELS[ref.kind] ?? [])], generatedByGemini: ref.kind === "photo" };
      default: return null;
    }
  }

  function answerBlocks(summary) {
    if (!summary) return [];
    const blocks = summary.intent === "reply_out_of_scope" ? [{ kind: "refusal", suggestions: scope.suggestions() }] : [];
    for (const ref of summary.resultRefs ?? []) {
      const block = blockFor(ref);
      if (block) blocks.push(block);
    }
    return blocks.slice(0, MAX_BLOCKS).map((block, index) => ({ blockId: `b${index + 1}`, ...block }));
  }

  /** True when a later read can show this result again with its code-set label, not as `unavailable`. */
  answerBlocks.rebuildable = (ref) => {
    const block = ref ? blockFor(ref) : null;
    return block !== null && block.kind !== "unavailable";
  };
  return Object.freeze(answerBlocks);
}

export const answerBlocks = createAnswerBlocks();
