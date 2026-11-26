// Thin client for the Momentum backend. Every call returns either data or a plain error message.
export type Result<T> = { ok: true; data: T } | { ok: false; error: string; status?: number };

// Opens a session before protected calls. Google sign-in replaces the demo session once
// Firebase Auth is configured; until then the server's signed session cookie is used.
let session: Promise<void> | undefined;
export function ensureSession() {
  session ??= (async () => {
    const config = await request<{ authorizationMode?: string }>("/api/auth/config", undefined, true);
    if (config.ok && config.data.authorizationMode === "HACKATHON_DEMO") {
      await fetch("/api/auth/demo-session", { method: "POST", credentials: "same-origin", cache: "no-store" });
    }
  })().catch(() => { session = undefined; });
  return session;
}

async function request<T>(path: string, init?: RequestInit, retried = false): Promise<Result<T>> {
  try {
    const response = await fetch(path, { credentials: "same-origin", ...init, headers: { Accept: "application/json", ...init?.headers } });
    // No session yet (or it expired): open one and try once more.
    if (response.status === 401 && !retried) {
      session = undefined;
      await ensureSession();
      return request<T>(path, init, true);
    }
    const body = await response.json().catch(() => undefined);
    if (!response.ok || body?.ok === false) {
      return { ok: false, status: response.status, error: body?.error?.message ?? `Request failed (${response.status})` };
    }
    return { ok: true, data: body as T };
  } catch {
    return { ok: false, error: "Can't reach Momentum. Check the connection and try again." };
  }
}

export const getJson = <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal });
export const postJson = <T>(path: string, body: unknown, signal?: AbortSignal) =>
  request<T>(path, { method: "POST", signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export type Defect = "WARP" | "DELAM" | "STRENGTH" | "PRINT" | "CRACK";
export const DEFECTS: { key: Defect; label: string; short: string }[] = [
  { key: "WARP", label: "Warp", short: "Warp" },
  { key: "DELAM", label: "Delamination", short: "Delam" },
  { key: "STRENGTH", label: "Box strength", short: "Strength" },
  { key: "PRINT", label: "Print", short: "Print" },
  { key: "CRACK", label: "Crease cracking", short: "Crack" },
];

export type ImpactSummary = {
  kpis: { lotsScored: number; lotsChanged: number; netSavingMonth: number; kgSavedMonth: number; scrapPctBefore: number; scrapPctAfter: number; scrapCostBefore: number; scrapCostAfter: number; currency: string };
  monthly: { month: string; lots: number; scrapCost: number; scrapKg: number; avgScrapPct: number }[];
  seasonal: { season: string; warp: number; delam: number; strength: number; print: number; crack: number }[];
  topItems: { itemGroup?: string; lots: number; scrapPct: number; scrapCost: number; mainDefect: string }[];
};

export type Conditions = {
  data: { runDate: string; shift?: string; ambientRhPct: number; ambientTempC: number; paperMoisturePct: number };
  sensorSource: string;
  provenance?: { timestamp: string; freshness: string };
};

// The plant runs a day shift from 06:00 to 18:00 and a night shift otherwise.
export const currentShift = (date = new Date()) => (date.getHours() >= 6 && date.getHours() < 18 ? "DAY" : "NIGHT");
export const conditionsPath = (shift: string = currentShift()) => `/conditions/current?shift=${shift}`;

export const formatMoney = (value: number, currency = "INR") =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
export const formatNumber = (value: number, digits = 0) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: digits }).format(value);
