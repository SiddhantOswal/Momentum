import { useSyncExternalStore } from "react";
import { LEVERS, type LeverKey } from "../../lib/session";
import type { Explanation, Extraction, JobSheet, PlanOutputs, PlanResult, Revision } from "./api";

/** The five approved sample orders the backend serves from /samples. */
export const SAMPLES = [
  // Order context for PO1 is the one the dashboard has always used for this sample (src/ui/workflow.js).
  { id: "PO1", label: "PO1 Single line", file: "PO1_ClientA_single_B1047.pdf", context: { orderId: "TEST-CLA/PO/2026/1047", paperType: "RECYCLED", paperSupplier: "SUP-D" } },
  { id: "PO2", label: "PO2 Multi-line", file: "PO2_ClientA_multiline.pdf" },
  { id: "PO3", label: "PO3 Fitment", file: "PO3_ClientP_electronics_with_fitment.pdf" },
  { id: "PO4", label: "PO4 Review", file: "PO4_ClientQ_ambiguous_set.pdf" },
  { id: "PO5", label: "PO5 Scan", file: "PO5_ClientB_scanned.jpg" },
] as const;
export type SampleId = (typeof SAMPLES)[number]["id"];

export const CONDITION_FIELDS = [
  { key: "ambientRhPct", label: "Humidity", unit: "%" },
  { key: "paperMoisturePct", label: "Paper moisture", unit: "%" },
  { key: "ambientTempC", label: "Ambient temperature", unit: "°C" },
  { key: "runDate", label: "Run date", unit: "" },
  { key: "shift", label: "Shift", unit: "" },
] as const;
export type ConditionKey = (typeof CONDITION_FIELDS)[number]["key"];
export type ConditionValues = Record<ConditionKey, string>;

/** Where a condition value on the form came from. Only the server's own responses set "weather" or "dataset". */
export type FieldSource =
  | { kind: "weather"; observedAt: string; location?: string }
  | { kind: "dataset"; simulated: boolean; recordedAt: string }
  | { kind: "operator" };

export type OrderContext = { orderId: string; paperType: string; paperSupplier: string };

export type LotState = {
  file?: { name: string; size: number; sample?: SampleId };
  context: OrderContext;
  extraction?: Extraction;
  lineIndex?: number;
  itemCode: string;
  quantity: string;
  checks: [boolean, boolean, boolean];
  orderConfirmed: boolean;
  conditions: ConditionValues;
  sources: Partial<Record<ConditionKey, FieldSource>>;
  levers: Record<LeverKey, string>;
  idempotency?: { fingerprint: string; key: string };
  lotId?: string;
  /** The inputs the current plan was made from, to tell when the form no longer matches it. */
  plannedInputs?: { conditions: ConditionValues; levers: Record<LeverKey, string> };
  plan?: PlanResult;
  /** A plan that stopped at the explanation step, with the outputs it finished. */
  partial?: { outputs: PlanOutputs; message: string };
  explanation?: Explanation;
  /** Set when the server reports the draft as replaced (supersede on edit, or the approve guard). */
  stale?: { jobId: string; number?: number; message: string };
  approved?: { jobSheet: JobSheet; revision?: Revision };
};

const blankConditions = (): ConditionValues => ({ ambientRhPct: "", paperMoisturePct: "", ambientTempC: "", runDate: "", shift: "" });
const blankLevers = () => Object.fromEntries(LEVERS.map((lever) => [lever.key, ""])) as Record<LeverKey, string>;

const initialState = (): LotState => ({
  context: { orderId: "", paperType: "", paperSupplier: "" },
  itemCode: "", quantity: "", checks: [false, false, false], orderConfirmed: false,
  conditions: blankConditions(), sources: {}, levers: blankLevers(),
});

const KEY = "momentum-new-lot";

function load(): LotState {
  try {
    const saved = sessionStorage.getItem(KEY);
    return saved ? { ...initialState(), ...JSON.parse(saved) } : initialState();
  } catch {
    return initialState();
  }
}

let state: LotState = load();
const listeners = new Set<() => void>();

// The uploaded file stays in memory only; a sample can be fetched again after a reload.
let orderFile: File | undefined;
export const getOrderFile = () => orderFile;
export const setOrderFile = (file: File | undefined) => { orderFile = file; };

export function getLot() { return state; }

export function updateLot(change: Partial<LotState> | ((current: LotState) => Partial<LotState>)) {
  const patch = typeof change === "function" ? change(state) : change;
  state = { ...state, ...patch };
  try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch { /* The page still works without the saved copy. */ }
  for (const listener of listeners) listener();
}

/**
 * Records that the server replaced the draft. The idempotency key goes with it: reusing the key
 * would replay the replaced revision instead of planning a new one.
 */
export function markStale(stale: NonNullable<LotState["stale"]>) {
  updateLot({ stale, idempotency: undefined });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLot(): LotState {
  return useSyncExternalStore(subscribe, getLot);
}

/** The form's values differ from the ones the current plan was made from. */
export function inputsChanged(lot: LotState) {
  const planned = lot.plannedInputs;
  if (!planned) return false;
  return JSON.stringify(planned.conditions) !== JSON.stringify(lot.conditions) || JSON.stringify(planned.levers) !== JSON.stringify(lot.levers);
}

