import { getJson, type Defect, type Result } from "../../lib/api";
import type { LeverKey, Levers } from "../../lib/session";

/** One lot on the live floor view, as `GET /api/lots` returns it (`src/google-cloud/live-store.js`). */
export type LiveLot = {
  lotId: string; jobId?: string; orderId: string; itemCode: string; quantity: number;
  status: "planned" | "approved" | "running" | "done" | "blocked"; updatedAt: string;
};

type TargetUse = Partial<Record<Defect, { useClass: "optimizer" | "advisory" | "abstain"; reason: string }>>;
type RiskProfile = { levers: Levers; risk: { ratesPct: Partial<Record<Defect, number>>; primaryDefect: Defect; targetUse?: TargetUse } };

/** The stored job, as `GET /jobs/:id` returns it (`StoredJobSheetSchema` in `src/schemas.js`). */
export type StoredJob = {
  jobId: string; createdAt: string; status: "DRAFT" | "APPROVED" | "RUN" | "CLOSED";
  order: { orderId: string; itemCode: string; quantity: number };
  conditions: { runDate: string; shift: string };
  baseline: RiskProfile; recommended: RiskProfile;
  changes: { lever: LeverKey; from: string | number; to: string | number }[];
  evidence: unknown[]; explanation: string;
  approvedAt: string | null; cardUri: string | null;
  approvalAudit?: { authorizationMode?: string; authenticatedHuman?: boolean } | null;
};
export type Revision = { lotId: string; number: number; status: string };
export type JobRead = { jobSheet: StoredJob; revision?: Revision };

/** The lot head and its current revision, as `GET /lots/:lotId` returns them (`src/commands/get-lot.js`). */
export type LotHead = {
  lot: { lotId: string; stage: "order_review" | "conditions" | "planning" | "draft_review" | "approval_pending" | "approved" | "held"; currentRevision: number; currentJobId: string | null };
  revision: { jobId: string; number: number; status: string } | null;
};

/** One event of a run trace (`TraceEventSchema` in `src/trace-registry.js`). */
export type TraceEvent = { type: string; tool?: string; sequence: number };

export const readLots = (signal?: AbortSignal) => getJson<{ lots: LiveLot[] }>("/api/lots", signal);
export const readJob = (jobId: string, signal?: AbortSignal) => getJson<JobRead>(`/jobs/${encodeURIComponent(jobId)}`, signal);
export const readLotHead = (lotId: string, signal?: AbortSignal) => getJson<LotHead>(`/lots/${encodeURIComponent(lotId)}`, signal);
export const cardPdfPath = (jobId: string) => `/jobs/${encodeURIComponent(jobId)}/card.pdf`;

const TRACE_READ_MS = 5000;

/**
 * Reads the stored events of one run from its event stream. The stream ends at the run's last
 * event; a run still going is read for a few seconds and judged on what arrived.
 */
export async function readTrace(runId: string, signal: AbortSignal): Promise<Result<TraceEvent[]>> {
  const controller = new AbortController();
  const stop = () => controller.abort();
  signal.addEventListener("abort", stop, { once: true });
  const timer = setTimeout(stop, TRACE_READ_MS);
  const events: TraceEvent[] = [];
  try {
    const response = await fetch(`/api/runs/${encodeURIComponent(runId)}/events`, {
      credentials: "same-origin", signal: controller.signal, headers: { Accept: "text/event-stream" },
    });
    if (!response.ok || !response.body) return { ok: false, status: response.status, error: `Request failed (${response.status})` };
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffered = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffered += decoder.decode(value, { stream: true });
      const frames = buffered.split("\n\n");
      buffered = frames.pop() ?? "";
      for (const frame of frames) {
        const data = frame.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("");
        if (!data) continue;
        try {
          const event = JSON.parse(data) as TraceEvent;
          if (typeof event?.type === "string") events.push(event);
        } catch { /* A frame that is not JSON (a heartbeat) carries no step. */ }
      }
      if (events.some((event) => event.type.startsWith("run.") && event.type !== "run.started")) break;
    }
    return { ok: true, data: events };
  } catch {
    if (signal.aborted) return { ok: false, error: "Cancelled" };
    return events.length ? { ok: true, data: events } : { ok: false, error: "Can't reach Momentum. Check the connection and try again." };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", stop);
    controller.abort();
  }
}

/**
 * Query values for a page, read from the URL search or from after the "?" in the hash, so both
 * `/app/?job=X#/operator` and `#/operator?job=X` work once the router accepts the second form.
 */
export function pageParam(name: string): string | null {
  const fromSearch = new URLSearchParams(location.search).get(name);
  if (fromSearch) return fromSearch;
  const hashQuery = location.hash.split("?")[1];
  return hashQuery ? new URLSearchParams(hashQuery).get(name) : null;
}
