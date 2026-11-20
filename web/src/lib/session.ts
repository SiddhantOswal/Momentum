import { ensureSession, type Defect, type Result } from "./api";

export { ensureSession };

export async function send<T>(path: string, init: RequestInit): Promise<Result<T>> {
  await ensureSession();
  try {
    const response = await fetch(path, { credentials: "same-origin", ...init, headers: { Accept: "application/json", ...init.headers } });
    const body = await response.json().catch(() => undefined);
    if (!response.ok || body?.ok === false) {
      const issue = body?.error?.issues?.[0]?.message;
      return { ok: false, status: response.status, error: issue ?? body?.error?.message ?? `Request failed (${response.status})` };
    }
    return { ok: true, data: body as T };
  } catch {
    return { ok: false, error: "Can't reach Momentum. Check the connection and try again." };
  }
}

export type ExtractedLine = {
  lineIndex: number; sourcePage?: number; extractedItemCode?: string; quantity?: number;
  status: string; catalogStatus?: string; candidates?: string[]; validationIssues?: string[];
};
export type Extraction = { reviewId: string; reviewFingerprint: string; lines: ExtractedLine[]; purchaseOrderDocument?: { poNumber?: string; buyer?: string; deliveryDate?: string } };

export const LEVERS = [
  { key: "sfSpeedMpm", label: "Single facer speed", unit: "m/min", min: 20, max: 60 },
  { key: "rollTempC", label: "Roll temperature", unit: "°C", min: 150, max: 185 },
  { key: "gumApplication", label: "Gum application", options: ["LOW", "MED", "HIGH"] },
  { key: "gumViscositySec", label: "Gum viscosity", unit: "s", min: 25, max: 60 },
  { key: "pastingPressure", label: "Pasting pressure", options: ["LOW", "MED", "HIGH"] },
  { key: "dryingHours", label: "Drying time", unit: "h", min: 2, max: 16 },
  { key: "printSpeedSpm", label: "Print speed", unit: "sheets/min", min: 30, max: 80 },
] as const;
export type LeverKey = (typeof LEVERS)[number]["key"];
export type Levers = Record<LeverKey, string | number>;

export type RiskProfile = { levers: Levers; risk: { ratesPct: Record<Defect, number>; totalScrapPct?: number; totalScrapKg: number; scrapCost: number; currency: string; primaryDefect: Defect } };
export type JobSheet = {
  jobId: string; status: "DRAFT" | "APPROVED" | string;
  order: { orderId: string; itemCode: string; quantity: number; paperType?: string; paperSupplier?: string };
  conditions: { runDate: string; shift: string; ambientRhPct: number; ambientTempC: number; paperMoisturePct: number };
  baseline: RiskProfile; recommended: RiskProfile;
  changes: { lever: LeverKey; from: string | number; to: string | number; reason?: string }[];
  savings: { kg: number; inr: number };
  explanation?: string;
};
export type JobResult = { jobSheet: JobSheet; runId?: string; confidence?: "normal" | "reduced"; conditionSources?: Record<string, string>; conditionNotes?: string[]; humidityBand?: Record<Defect, { low: number; high: number }> };
