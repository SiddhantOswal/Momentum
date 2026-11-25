import { useEffect, useState } from "react";
import { getJson } from "../../lib/api";
import type { LiveLot } from "../../lib/live";
import { LEVERS, type LeverKey, type Levers } from "../../lib/session";

export type StageId = 1 | 2 | 3 | 4 | 5;

/**
 * The five stations of the illustrated line and the plan settings each one owns. Unwind has no
 * setting in the plan. The illustration has no print station, so print speed sits with Cut,
 * the last station before the board leaves the line; Om to confirm this grouping.
 */
export const STAGES: { id: StageId; name: string; levers: LeverKey[] }[] = [
  { id: 1, name: "Unwind", levers: [] },
  { id: 2, name: "Corrugate", levers: ["sfSpeedMpm", "rollTempC"] },
  { id: 3, name: "Glue", levers: ["gumApplication", "gumViscositySec", "pastingPressure"] },
  { id: 4, name: "Dry", levers: ["dryingHours"] },
  { id: 5, name: "Cut", levers: ["printSpeedSpm"] },
];

export const stageOf = (lever: LeverKey) => STAGES.find((stage) => stage.levers.includes(lever))!.id;

const LEVER_META = Object.fromEntries(LEVERS.map((lever) => [lever.key, lever])) as Record<LeverKey, (typeof LEVERS)[number]>;

export const leverLabel = (lever: LeverKey) => LEVER_META[lever].label;

// The API sends levels as LOW, MED and HIGH; the designs spell out MEDIUM.
const LEVEL_WORDS: Record<string, string> = { LOW: "LOW", MED: "MEDIUM", HIGH: "HIGH" };

/** A lever value as the designs print it, for example "35 s" or "MEDIUM". The value is shown as sent. */
export function leverValue(lever: LeverKey, value: string | number) {
  if (typeof value === "string") return LEVEL_WORDS[value] ?? value;
  const meta = LEVER_META[lever];
  return "unit" in meta ? `${value} ${meta.unit}` : String(value);
}

/** The same value without its unit, for the callouts that print the unit once at the end. */
export function leverNumber(value: string | number) {
  return typeof value === "string" ? LEVEL_WORDS[value] ?? value : String(value);
}

export const leverUnit = (lever: LeverKey) => {
  const meta = LEVER_META[lever];
  return "unit" in meta ? meta.unit : undefined;
};

type Change = { lever: LeverKey; from: string | number; to: string | number };

/** The parts of a stored job sheet (`GET /jobs/:id`) this page reads. */
export type PlanSheet = {
  jobId: string;
  order: { orderId: string; itemCode: string };
  conditions: { ambientRhPct: number; supervisorConfirmed?: boolean; conditionSource?: string };
  baseline: { levers: Levers };
  recommended: { levers: Levers };
  changes: Change[];
};

export type PlanState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "none" }
  | { kind: "plan"; lot: LiveLot; sheet: PlanSheet };

// The floor view lists every lot; the current one is the most recently updated lot that has a plan.
function currentLot(lots: LiveLot[]) {
  return lots
    .filter((lot) => typeof lot.jobId === "string" && lot.jobId.length > 0)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];
}

/** Reads the current lot from `/api/lots`, then its stored plan from `/jobs/:id`. */
export function useCurrentPlan(): PlanState {
  const [state, setState] = useState<PlanState>({ kind: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      const lots = await getJson<{ lots: LiveLot[] }>("/api/lots", controller.signal);
      if (controller.signal.aborted) return;
      if (!lots.ok) return setState({ kind: "error", message: lots.error });
      const lot = currentLot(lots.data.lots ?? []);
      if (!lot) return setState({ kind: "none" });
      const job = await getJson<{ jobSheet: PlanSheet }>(`/jobs/${encodeURIComponent(lot.jobId!)}`, controller.signal);
      if (controller.signal.aborted) return;
      if (!job.ok) return setState({ kind: "error", message: job.error });
      setState({ kind: "plan", lot, sheet: job.data.jobSheet });
    })();
    return () => controller.abort();
  }, []);
  return state;
}

export type ModelScore = { defect: string; r2: number; sampleCount?: number };

/** Model scores from `/api/status`. Only `r2` and `sampleCount` are read; the retired pass levels are not. */
export function useModelScores(): ModelScore[] | "loading" | "error" {
  const [scores, setScores] = useState<ModelScore[] | "loading" | "error">("loading");
  useEffect(() => {
    const controller = new AbortController();
    getJson<{ modelAcceptance?: { models?: ModelScore[] } }>("/api/status", controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setScores(result.ok && Array.isArray(result.data.modelAcceptance?.models) ? result.data.modelAcceptance.models : "error");
    });
    return () => controller.abort();
  }, []);
  return scores;
}
