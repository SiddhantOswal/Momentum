import { ensureSession, renewSession, type Defect } from "../../lib/api";
import type { LeverKey } from "../../lib/session";

/**
 * A failure keeps the response body: a plan that stops at the explanation still returns the
 * prediction and the optimization, and the approve guard returns its conflict code.
 */
export type Failure = { ok: false; status?: number; code?: string; message: string; body?: unknown };
export type Outcome<T> = { ok: true; data: T } | Failure;

const UNREACHABLE = "Can't reach Momentum. Check the connection and try again.";

export async function call<T>(path: string, init: RequestInit = {}, retried = false): Promise<Outcome<T>> {
  await ensureSession();
  let response: Response;
  try {
    response = await fetch(path, { credentials: "same-origin", ...init, headers: { Accept: "application/json", ...init.headers } });
  } catch (error) {
    if ((error as Error)?.name === "AbortError") throw error;
    return { ok: false, message: UNREACHABLE };
  }
  if (response.status === 401 && !retried) {
    await renewSession();
    return call<T>(path, init, true);
  }
  const body = await response.json().catch(() => undefined);
  if (!response.ok || body?.ok === false) {
    const issue = body?.error?.issues?.[0]?.message;
    return {
      ok: false, status: response.status, code: body?.error?.code, body,
      message: issue ?? body?.error?.message ?? `Request failed (${response.status}).`,
    };
  }
  return { ok: true, data: body as T };
}

export const postJson = <T>(path: string, payload: unknown) =>
  call<T>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });

export type ExtractedLine = {
  lineIndex: number; sourcePage?: number; extractedItemCode?: string; quantity?: number;
  status: "MATCHED" | "AMBIGUOUS" | "UNKNOWN_CODE" | "MISSING_ITEM_CODE" | "MISSING_QTY" | "MALFORMED";
  catalogStatus?: "MATCHED" | "AMBIGUOUS" | "UNKNOWN_CODE"; candidates: string[]; validationIssues?: string[];
  resolvedItemCode?: string;
  orderProfile?: Partial<OrderProfile>;
};

export type Extraction = {
  source: "vertex-gemini" | "mock-demo"; isRealModelPrediction: boolean;
  reviewId: string; reviewFingerprint: string; lines: ExtractedLine[];
  purchaseOrderDocument?: { poNumber?: string; buyer?: string; deliveryDate?: string };
  documentMissingFields?: string[]; needsClarification: boolean;
};

export type OrderProfile = {
  orderId: string; itemCode: string; customerId: string; boxStyle: "RSC" | "DIECUT" | "TRAY";
  lengthMm: number; widthMm: number; heightMm: number; ply: 3 | 5 | 7; fluteProfile: string;
  topLinerGsm: number; fluteGsm: number; innerLinerGsm: number; linerBf: number;
  paperType: "VIRGIN" | "RECYCLED" | "MIXED"; paperSupplier: string; inkColors: number; inkCoveragePct: number; quantity: number;
};
export const ORDER_PROFILE_KEYS: (keyof OrderProfile)[] = [
  "orderId", "itemCode", "customerId", "boxStyle", "lengthMm", "widthMm", "heightMm", "ply", "fluteProfile",
  "topLinerGsm", "fluteGsm", "innerLinerGsm", "linerBf", "paperType", "paperSupplier", "inkColors", "inkCoveragePct", "quantity",
];

export type RunConditions = { runDate: string; shift: "DAY" | "NIGHT"; ambientRhPct: number; ambientTempC: number; paperMoisturePct: number };
export type Levers = Record<LeverKey, number | string>;
export type UseClass = "optimizer" | "advisory" | "abstain";
export type Risk = {
  ratesPct: Partial<Record<Defect, number>>; totalScrapPct?: number; totalScrapKg: number; scrapCost: number;
  currency: string; primaryDefect: Defect; targetUse?: Partial<Record<Defect, { useClass: UseClass; reason: string }>>;
};
export type Change = { lever: LeverKey; from: number | string; to: number | string; reason: string };
export type Optimization = {
  baseline: { levers: Levers; risk: Risk }; best: { levers: Levers; risk: Risk };
  changes: Change[]; savings: { kg: number; inr: number; percent?: number }; modelPredicted?: true; note?: string;
};
export type SimilarRun = { lotId: string; orderId: string; runDate: string; [key: string]: unknown };
export type ConditionSource = "plant" | "weather" | "seasonal";
export type HumidityBand = { ambientRhPct: { low: number; high: number }; ratesPct: Partial<Record<Defect, { low: number; high: number }>> };

export type JobSheet = {
  jobId: string; status: "DRAFT" | "APPROVED" | "RUN" | "CLOSED";
  order: OrderProfile & { sourcePoNumber?: string; purchaseOrderLineIndex?: number };
  conditions: RunConditions & { conditionSource?: string };
  baseline: { levers: Levers; risk: Risk }; recommended: { levers: Levers; risk: Risk };
  changes: Change[];
  // A draft in flight carries `inr`; the stored record carries `amount` and `currency`.
  savings: { kg: number; inr?: number; amount?: number; currency?: string };
  explanation: string;
  approvedAt?: string | null; cardUri?: string | null;
};
export type Revision = { lotId: string; number: number; fingerprint: string | null; status: "PENDING" | "CURRENT" | "APPROVING" | "APPROVED" | "SUPERSEDED" | "FAILED" };

/** The parts of the POST /jobs response the pages read. */
export type PlanOutputs = {
  orderProfile?: OrderProfile; conditions?: RunConditions & Record<string, unknown>;
  conditionSources?: Partial<Record<"ambientRhPct" | "ambientTempC" | "paperMoisturePct", ConditionSource>>;
  confidence?: "normal" | "reduced"; conditionNotes?: string[];
  prediction?: Risk; humidityBand?: HumidityBand; optimization?: Optimization; evidence?: SimilarRun[];
  completedStages?: string[]; blockedAt?: string;
};
export type PlanResult = PlanOutputs & { jobSheet: JobSheet; revision?: Revision; durable?: boolean };

export type Explanation = { source: "bigquery-ml-and-gemini" | "bigquery-ml-attribution-summary"; explanation: string };

export type Weather = { source: string; ambientRhPct: number; ambientTempC: number; observedAt: string; location?: string };
export type PlantReading = {
  source: string; data: RunConditions; sensorSource?: "simulated" | "live" | "unverified";
  provenance?: { timestamp: string; freshness: string };
};

export type ModelScore = { defect: Defect; r2: number | null; sampleCount: number | null };
export type Status = { modelAcceptance?: { status: string; models: ModelScore[] } };

export type LotRecord = {
  lot: { lotId: string; stage: string; currentRevision: number; currentJobId: string | null };
  revision: null | {
    jobId: string; number: number; status: Revision["status"];
    supersededReason: null | { field: string; from: unknown; to: unknown; provenance?: string; byRole?: string };
  };
};
