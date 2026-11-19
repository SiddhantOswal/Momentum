import { useEffect, useState } from "react";
import { getJson, type Defect } from "./api";

export type LiveLot = {
  lotId: string; jobId?: string; orderId: string; itemCode: string; quantity: number;
  status: "planned" | "approved" | "running" | "done" | "blocked";
  totalScrapPct?: number; primaryDefect?: Defect; ratesPct?: Partial<Record<Defect, number>>;
  predictedSaving?: number; currency?: string; updatedAt: string;
};
export type LiveEvent = { type: string; lotId?: string; text: string; actor?: string; at: string };
export type FloorView = { lots: LiveLot[]; events: LiveEvent[] };
export type LiveState = { view: FloorView; status: "connecting" | "live" | "offline" };

const EMPTY: FloorView = { lots: [], events: [] };

// One shared stream for the whole app: every screen sees the same lots and events.
let shared: { state: LiveState; listeners: Set<(s: LiveState) => void>; source?: EventSource } | undefined;

function connect() {
  const hub = shared!;
  const set = (next: Partial<LiveState>) => {
    hub.state = { ...hub.state, ...next };
    for (const listener of hub.listeners) listener(hub.state);
  };
  // A first snapshot over plain HTTP, so the screen fills even before the stream opens.
  getJson<FloorView>("/api/lots").then((r) => { if (r.ok && hub.state.status !== "live") set({ view: { lots: r.data.lots, events: r.data.events } }); });
  const source = new EventSource("/api/live");
  hub.source = source;
  source.addEventListener("floor", (e) => {
    try { const data = JSON.parse((e as MessageEvent).data); set({ view: { lots: data.lots ?? [], events: data.events ?? [] }, status: "live" }); } catch { /* keep the last good view */ }
  });
  source.onopen = () => set({ status: "live" });
  // EventSource reconnects by itself; show "offline" until it does.
  source.onerror = () => set({ status: source.readyState === EventSource.CLOSED ? "offline" : "connecting" });
}

export function useLive(): LiveState {
  shared ??= { state: { view: EMPTY, status: "connecting" }, listeners: new Set() };
  const [state, setState] = useState(shared.state);
  useEffect(() => {
    const hub = shared!;
    hub.listeners.add(setState);
    if (!hub.source) connect();
    setState(hub.state);
    return () => { hub.listeners.delete(setState); };
  }, []);
  return state;
}

export function timeAgo(iso: string, now = Date.now()) {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
