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
type StoredSheet = {
  order: { itemCode: string };
  conditions: { ambientRhPct: number; supervisorConfirmed?: boolean };
  recommended: { levers: Levers };
  changes: Change[];
};

/**
 * The plan shown on the page. "session" is this session's own lot, read in full from its stored
 * job sheet. "floor" is the newest lot on the shared floor view, which carries only the changed
 * settings, so its unchanged values and floor conditions are not known here.
 */
export type PlanView = {
  source: "session" | "floor";
  itemCode: string;
  changes: Change[];
  levers?: Levers;
  rh?: { value: number; confirmed: boolean };
};

export type PlanState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "none" }
  | { kind: "plan"; plan: PlanView };

type ArcSession = { session?: { activeLots?: { lotId: string; currentJobId: string | null }[] } };

function newestFloorLot(lots: LiveLot[]) {
  return lots
    .filter((lot) => Array.isArray(lot.changes) && typeof lot.itemCode === "string")
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];
}

/**
 * This session's lot comes from the Arc session (`/api/arc/session`), the only session-scoped
 * lot list, and its plan from `/jobs/:id`. Without one, the newest lot on the floor view
 * (`/api/lots`, every session's lots) is shown from the changes it carries. Another session's job
 * is never requested, because `/jobs/:id` refuses it.
 */
export function useCurrentPlan(): PlanState {
  const [state, setState] = useState<PlanState>({ kind: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    (async () => {
      const session = await getJson<ArcSession>("/api/arc/session", signal);
      if (signal.aborted) return;
      const own = session.ok ? (session.data.session?.activeLots ?? []).filter((lot) => lot.currentJobId).at(-1) : undefined;
      if (own?.currentJobId) {
        const job = await getJson<{ jobSheet: StoredSheet }>(`/jobs/${encodeURIComponent(own.currentJobId)}`, signal);
        if (signal.aborted) return;
        if (!job.ok) return setState({ kind: "error", message: job.error });
        const sheet = job.data.jobSheet;
        return setState({ kind: "plan", plan: {
          source: "session", itemCode: sheet.order.itemCode, changes: sheet.changes, levers: sheet.recommended.levers,
          rh: { value: sheet.conditions.ambientRhPct, confirmed: sheet.conditions.supervisorConfirmed === true },
        } });
      }
      const floor = await getJson<{ lots: LiveLot[] }>("/api/lots", signal);
      if (signal.aborted) return;
      if (!floor.ok) return setState({ kind: "error", message: floor.error });
      const lot = newestFloorLot(floor.data.lots ?? []);
      if (!lot) return setState({ kind: "none" });
      const known = (lot.changes ?? []).filter((change): change is Change => Object.hasOwn(LEVER_META, change.lever));
      setState({ kind: "plan", plan: { source: "floor", itemCode: lot.itemCode, changes: known } });
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
