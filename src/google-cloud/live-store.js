// Central live store: lots and floor events in Firestore, pushed to every open browser.
// One Firestore listener per process fans out to all subscribers, so two browsers on two
// Cloud Run instances see the same lot list within a second. Without Firestore (local runs,
// tests) the same interface keeps records in memory.
import { z } from "zod";

const LOT_STATUSES = ["planned", "approved", "running", "done", "blocked"];
const EVENT_TYPES = ["order.read", "lot.planned", "lot.approved", "defect.logged", "feedback.saved"];
const DEFECTS = ["WARP", "DELAM", "STRENGTH", "PRINT", "CRACK"];

export const LiveLotSchema = z.object({
  lotId: z.string().min(1).max(120),
  jobId: z.string().min(1).max(120).optional(),
  orderId: z.string().min(1).max(120),
  itemCode: z.string().min(1).max(80),
  quantity: z.number().int().positive(),
  status: z.enum(LOT_STATUSES),
  totalScrapPct: z.number().min(0).max(125).optional(),
  primaryDefect: z.enum(DEFECTS).optional(),
  // Low-confidence targets are the advisory ones; abstain targets carry no rate (ARC-ML-03).
  ratesPct: z.partialRecord(z.enum(DEFECTS), z.number().min(0).max(25)).optional(),
  lowConfidence: z.array(z.enum(DEFECTS)).max(5).optional(),
  abstain: z.array(z.enum(DEFECTS)).max(4).optional(),
  predictedSaving: z.number().min(0).optional(),
  changes: z.array(z.object({ lever: z.string().max(40), from: z.union([z.string().max(20), z.number()]), to: z.union([z.string().max(20), z.number()]) }).strict()).max(3).optional(),
  currency: z.string().length(3).optional(),
  updatedBy: z.string().max(120).optional(),
  updatedAt: z.string().datetime(),
}).strict().superRefine((lot, context) => {
  if (!lot.ratesPct) return;
  for (const defect of DEFECTS) {
    const abstains = lot.abstain?.includes(defect) === true;
    if (abstains === (lot.ratesPct[defect] !== undefined)) {
      context.addIssue({
        code: "custom",
        path: ["ratesPct", defect],
        message: abstains ? "An abstain target must not carry a rate." : "Only an abstain target may omit its rate.",
      });
    }
  }
});

export const LiveEventSchema = z.object({
  type: z.enum(EVENT_TYPES),
  lotId: z.string().max(120).optional(),
  text: z.string().min(1).max(200),
  actor: z.string().max(120).optional(),
  at: z.string().datetime(),
}).strict();

const LOT_LIMIT = 50;
const EVENT_LIMIT = 40;
const safeId = (value) => String(value).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 120);
// Firestore rejects undefined values, so optional fields that are absent are dropped first.
const defined = (record) => Object.fromEntries(Object.entries(record).filter(([, v]) => v !== undefined));

function memoryBackend() {
  const lots = new Map();
  const events = [];
  const listeners = new Set();
  const view = () => ({
    lots: [...lots.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, LOT_LIMIT),
    events: events.slice(0, EVENT_LIMIT),
  });
  const emit = () => { const v = view(); for (const listener of listeners) listener(v); };
  return {
    kind: "memory",
    async upsertLot(lot) { lots.set(lot.lotId, { ...lots.get(lot.lotId), ...lot }); emit(); },
    async addEvent(event) { events.unshift(event); events.length = Math.min(events.length, 200); emit(); },
    watch(listener) { listeners.add(listener); listener(view()); return () => listeners.delete(listener); },
  };
}

function firestoreBackend(db) {
  const lotsRef = db.collection("lots");
  const eventsRef = db.collection("events");
  const listeners = new Set();
  let current = { lots: [], events: [] };
  let unsubscribe;
  const emit = () => { for (const listener of listeners) listener(current); };
  const start = () => {
    const stopLots = lotsRef.orderBy("updatedAt", "desc").limit(LOT_LIMIT).onSnapshot(
      (snap) => { current = { ...current, lots: snap.docs.map((d) => d.data()) }; emit(); },
      () => { /* the listener retries on its own; subscribers keep the last view */ });
    const stopEvents = eventsRef.orderBy("at", "desc").limit(EVENT_LIMIT).onSnapshot(
      (snap) => { current = { ...current, events: snap.docs.map((d) => d.data()) }; emit(); },
      () => {});
    unsubscribe = () => { stopLots(); stopEvents(); };
  };
  return {
    kind: "firestore",
    async upsertLot(lot) { await lotsRef.doc(safeId(lot.lotId)).set(lot, { merge: true }); },
    async addEvent(event) { await eventsRef.add(event); },
    watch(listener) {
      listeners.add(listener);
      if (!unsubscribe) start();
      listener(current);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && unsubscribe) { unsubscribe(); unsubscribe = undefined; }
      };
    },
  };
}

async function defaultFirestore(projectId) {
  const [{ applicationDefault, getApps, initializeApp }, { getFirestore }] = await Promise.all([
    import("firebase-admin/app"), import("firebase-admin/firestore"),
  ]);
  const name = "momentum-live-store";
  const app = getApps().find((a) => a.name === name) ?? initializeApp({ credential: applicationDefault(), projectId }, name);
  return getFirestore(app);
}

/**
 * @param {{ enabled?: boolean, projectId?: string, firestore?: () => Promise<any>, now?: () => Date }} options
 * No cloud call is made until the first write or watch.
 */
export function createLiveStore({ enabled = false, projectId, firestore, now = () => new Date() } = {}) {
  let backend;
  const getBackend = async () => {
    if (backend) return backend;
    backend = enabled ? firestoreBackend(await (firestore ?? (() => defaultFirestore(projectId)))()) : memoryBackend();
    return backend;
  };
  const stamp = () => now().toISOString();
  return {
    get mode() { return enabled ? "firestore" : "memory"; },
    /** Records a lot change and its floor event. Never throws: the live view must not block planning. */
    async publish({ lot, event }) {
      try {
        const b = await getBackend();
        const at = stamp();
        if (lot) await b.upsertLot(defined(LiveLotSchema.parse({ ...lot, updatedAt: at })));
        if (event) await b.addEvent(defined(LiveEventSchema.parse({ ...event, at })));
        return true;
      } catch (error) {
        // Never blocks the request, but always leaves a trace in Cloud Logging.
        console.warn(JSON.stringify({ event: "momentum_live_store_publish_failed", mode: enabled ? "firestore" : "memory", message: String(error?.message ?? error).slice(0, 300) }));
        return false;
      }
    },
    /** Calls listener with { lots, events } now and after every change. Returns an unsubscribe function. */
    async watch(listener) {
      const b = await getBackend();
      return b.watch(listener);
    },
  };
}
