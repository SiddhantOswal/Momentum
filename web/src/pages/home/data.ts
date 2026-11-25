// Response shapes and display helpers shared by Home and Insights. Types mirror the server
// schemas in src/schemas.js and src/model-acceptance.js; only the fields these pages read.
import { DEFECTS, type Defect, type Result } from "../../lib/api";
import type { LiveLot } from "../../lib/live";

export type ModelScore = { defect: Defect; r2: number | null; sampleCount: number | null };

/** GET /api/status. Only `r2`, `sampleCount` and the split are read: the October thresholds
 * (`requiredR2`, `prototypeThresholdsMet`) are retired and never drawn (spec AC2.3). */
export type StatusResponse = {
  modelAcceptance?: { status: string; split: string | null; models: ModelScore[] };
};

type Levers = Record<string, number | string>;
type TargetUse = Partial<Record<Defect, { useClass: "optimizer" | "advisory" | "abstain"; reason: string }>>;
type Risk = { ratesPct: Partial<Record<Defect, number>>; totalScrapPct?: number; totalScrapKg: number; scrapCost: number; currency: string; primaryDefect: Defect; targetUse?: TargetUse };

/** GET /jobs/:id. A job is readable only from the demo session that planned it. */
export type JobResponse = {
  jobSheet: {
    jobId: string; status: "DRAFT" | "APPROVED" | "RUN" | "CLOSED"; createdAt: string; approvedAt: string | null;
    order: Record<string, unknown> & { orderId: string; itemCode: string; quantity: number; ply: number; fluteProfile: string; paperType: string };
    conditions: Record<string, unknown> & { runDate: string; shift: string; ambientRhPct: number; ambientTempC: number; paperMoisturePct: number; supervisorConfirmed?: boolean };
    baseline: { levers: Levers; risk: Risk };
    recommended: { levers: Levers; risk: Risk };
    changes: { lever: string; from: number | string; to: number | string; reason: string }[];
    evidence: unknown[];
    savings: { kg: number; amount: number; currency: string };
  };
};

/** The job record only when it belongs to this lot, so a stale or mismatched read shows nothing. */
export function sheetFor(job: Result<JobResponse> | undefined, lot: LiveLot | undefined) {
  return job?.ok && lot?.jobId !== undefined && job.data.jobSheet.jobId === lot.jobId ? job.data.jobSheet : undefined;
}

/** Defects the stored plan marks advisory, which the app shows as low confidence (ARC-ML-03). */
export function advisoryDefects(sheet: JobResponse["jobSheet"] | undefined) {
  const targetUse = sheet?.recommended.risk.targetUse ?? sheet?.baseline.risk.targetUse;
  return new Set(DEFECT_ORDER.filter((defect) => targetUse?.[defect]?.useClass === "advisory"));
}

// The names the Main and Insights designs print on the model rows.
export const DEFECT_NAME: Record<Defect, string> = { WARP: "Warp", DELAM: "Delamination", STRENGTH: "Strength", PRINT: "Print", CRACK: "Crack" };
export const DEFECT_ORDER = DEFECTS.map((d) => d.key);

const LEVERS: Record<string, { label: string; unit?: string; stage: string }> = {
  printSpeedSpm: { label: "Print speed", unit: "sheets/min", stage: "Printing" },
  sfSpeedMpm: { label: "Single facer speed", unit: "m/min", stage: "Single facer" },
  rollTempC: { label: "Roll temperature", unit: "°C", stage: "Single facer" },
  // The approved Main screen shows gum application and viscosity at Pasting, not the single facer.
  gumApplication: { label: "Gum application", stage: "Pasting" },
  gumViscositySec: { label: "Gum viscosity", unit: "s", stage: "Pasting" },
  pastingPressure: { label: "Pasting pressure", stage: "Pasting" },
  dryingHours: { label: "Drying time", unit: "h", stage: "Drying" },
};

export const STAGES = ["Printing", "Single facer", "Sheet cutting", "Pasting", "Drying", "Cut and crease", "Slotting", "Stitch and glue", "QC and bundling"] as const;

const LEVEL_WORD: Record<string, string> = { LOW: "LOW", MED: "MEDIUM", HIGH: "HIGH" };

export const leverLabel = (lever: string) => LEVERS[lever]?.label ?? lever;
export const leverStage = (lever: string) => LEVERS[lever]?.stage;

/** "162 → 170 °C" or "HIGH → MEDIUM", with the values exactly as the server sent them. */
export function leverChange(change: { lever: string; from: number | string; to: number | string }) {
  const word = (value: number | string) => (typeof value === "string" ? LEVEL_WORD[value] ?? value : String(value));
  const unit = LEVERS[change.lever]?.unit;
  return `${word(change.from)} → ${word(change.to)}${unit ? ` ${unit}` : ""}`;
}

/** Two decimals with a true minus sign, as the designs print fit scores. */
export const formatR2 = (r2: number) => `${r2 < 0 ? "−" : ""}${Math.abs(r2).toFixed(2)}`;

/** The holdout month from the split ID, such as "holdout-2026-09: ..." → "September 2026". */
export function splitMonth(split: string | null | undefined) {
  const match = split?.match(/holdout-(\d{4})-(\d{2})/);
  if (!match) return undefined;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** The test-lot count when every model was scored on the same lots; otherwise none. */
export function commonSampleCount(models: ModelScore[]) {
  const counts = new Set(models.map((model) => model.sampleCount));
  const [only] = counts;
  return counts.size === 1 && typeof only === "number" ? only : undefined;
}

/** Defects the server marks low confidence on any stored lot (advisory use class, ARC-ML-03). */
export function lowConfidence(lots: LiveLot[]) {
  return new Set(lots.flatMap((lot) => lot.lowConfidence ?? []));
}

/** The newest lot that matches, by its update time. The server already sorts newest first. */
export const newest = (lots: LiveLot[], test: (lot: LiveLot) => boolean = () => true) => lots.find(test);

export const STATUS_VIEW: Record<LiveLot["status"], { tone: "ok" | "ac" | "wn" | "bd" | "id"; text: string }> = {
  planned: { tone: "ac", text: "Ready for review" },
  approved: { tone: "ok", text: "Approved" },
  running: { tone: "ac", text: "Running" },
  done: { tone: "ok", text: "Done" },
  blocked: { tone: "bd", text: "Blocked" },
};
