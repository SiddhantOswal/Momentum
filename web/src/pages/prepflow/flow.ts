import { DEFECTS, type Defect } from "../../lib/api";
import type { JobRead, LotHead, LiveLot, TraceEvent } from "./records";

/**
 * Step states. "nc" is the designed not-connected state: no stored record covers the step, so
 * the page claims nothing about it. ARC-M6-11 (a stored stage record per lot) will give every
 * step its own recorded state.
 */
export type StepState = "done" | "now" | "held" | "failed" | "idle" | "nc";
export type ZoneStatus = "complete" | "waiting" | "held" | "partly" | "blocked" | "not-reached" | "nc";
export type FlowKind = "draft" | "approved" | "held" | "held-job" | "replaced" | "partial" | "none";
export type ChipTone = "ok" | "wn" | "bd" | "dim";

export type StepDef = { n: number; title: string; sub: string; by: string; zone: 0 | 1 | 2 };

// Copy from Prep-Flow.html. Step 5 drops "8,640 tries": the count depends on the planned
// settings and the optimizer does not return it (data/stale-claims.md, C12).
export const STEPS: StepDef[] = [
  { n: 1, title: "Purchase order", sub: "Reads the order file", by: "Gemini", zone: 0 },
  { n: 2, title: "Catalog match", sub: "Finds the item", by: "BigQuery", zone: 0 },
  { n: 3, title: "Conditions", sub: "You confirm today's inputs", by: "Operator", zone: 0 },
  { n: 4, title: "Defect estimate", sub: "Five models score the risks", by: "", zone: 1 },
  { n: 5, title: "Limited search", sub: "Up to 3 changes allowed", by: "BigQuery SQL", zone: 1 },
  { n: 6, title: "Risk evidence", sub: "Similar lots and an explanation", by: "Google Cloud", zone: 1 },
  { n: 7, title: "Review plan", sub: "Entered vs recommended", by: "Supervisor", zone: 2 },
  { n: 8, title: "Approve card", sub: "Approve, or keep as draft", by: "Supervisor gate", zone: 2 },
  { n: 9, title: "Job record", sub: "Saved, PDF stored, checked", by: "Cloud Storage", zone: 2 },
];
export const ZONES = ["Ingestion", "Intelligence", "Decision"] as const;

export type StepView = { state: StepState; sub: string };
export type ZoneView = { status: ZoneStatus; footer: string };

export type FlowView = {
  kind: FlowKind;
  steps: StepView[];
  zones: ZoneView[];
  /** Colour of each defect chip on step 4, from the stored target use; dim when unknown. */
  defectTones: Record<Defect, ChipTone>;
  jobId?: string;
  itemCode?: string;
  quantity?: number;
  orderId?: string;
  revisionNumber?: number;
  changeCount?: number;
  lowConfidence: Defect[];
  /** For "replaced": whether a newer revision replaced it or planning failed. */
  notCurrent?: "replaced" | "failed";
  /** For "none": what is missing, in one plain sentence. */
  missing?: string;
};

export type FlowSources = {
  lot: LiveLot | null;
  job: JobRead | null;
  head: LotHead | null;
  trace: TraceEvent[] | null;
  /** Set when a source could not be read, so the page can say which. */
  failure?: string;
};

const DIM_TONES = Object.fromEntries(DEFECTS.map(({ key }) => [key, "dim"])) as Record<Defect, ChipTone>;
const USE_TONE = { optimizer: "ok", advisory: "wn", abstain: "bd" } as const;

const NORMAL_FOOTERS = ["Stops if anything is unclear.", "Stops if no setting is allowed.", "Nothing is released before approval."];

const steps = (states: StepState[], subs: Partial<Record<number, string>> = {}): StepView[] =>
  STEPS.map((step, index) => ({ state: states[index], sub: subs[step.n] ?? step.sub }));

function toolsSucceeded(trace: TraceEvent[], ...tools: string[]) {
  return tools.every((tool) => trace.some((event) => event.type === "tool.succeeded" && event.tool === tool));
}

function explanationFailed(trace: TraceEvent[]) {
  return trace.some((event) => (event.type === "tool.failed" || event.type === "tool.unavailable") && event.tool === "explainRisk");
}

function lotFields(sources: FlowSources) {
  const order = sources.job?.jobSheet.order;
  return {
    itemCode: order?.itemCode ?? sources.lot?.itemCode,
    quantity: order?.quantity ?? sources.lot?.quantity,
    orderId: order?.orderId ?? sources.lot?.orderId,
    revisionNumber: sources.job?.revision?.number ?? sources.head?.revision?.number,
  };
}

/**
 * Builds the page state from stored records only. A step is "done" only when a stored record
 * holds its output: the stored job for steps 1 to 9, the run trace for a run that stopped at
 * the explanation. A lot head on hold says that the lot is held, not where: it is read as a
 * hold at the catalog match only when the lot has no job yet.
 */
export function deriveFlow(sources: FlowSources): FlowView {
  const base = { defectTones: DIM_TONES, lowConfidence: [] as Defect[], ...lotFields(sources) };
  const head = sources.head?.lot;
  const stored = sources.job?.jobSheet;

  if (head?.stage === "held" && !stored && head.currentJobId === null && head.currentRevision === 0) {
    return {
      ...base,
      kind: "held",
      // The lot head returns no order fields, so nothing proves the order was read: step 1 stays not connected.
      steps: steps(["nc", "held", "idle", "idle", "idle", "idle", "idle", "idle", "idle"], {
        2: "The line is ambiguous", 3: "Not reached", 4: "Waits for the earlier steps",
        5: "Not reached", 6: "Not reached", 7: "Not reached", 8: "Not reached", 9: "Not created",
      }),
      zones: [
        { status: "held", footer: NORMAL_FOOTERS[0] },
        { status: "not-reached", footer: "Nothing has run yet." },
        { status: "not-reached", footer: "No job card yet." },
      ],
    };
  }

  if (sources.trace && explanationFailed(sources.trace)
      && toolsSucceeded(sources.trace, "extractOrder", "getConditions", "predictRisk", "optimizeLevers", "findSimilarRuns")) {
    return {
      ...base,
      kind: "partial",
      steps: steps(["done", "done", "done", "done", "done", "failed", "idle", "idle", "idle"], {
        6: "Explanation failed", 7: "Waiting on evidence", 8: "Not reached", 9: "Not created",
      }),
      zones: [
        { status: "complete", footer: NORMAL_FOOTERS[0] },
        { status: "partly", footer: "Estimate done. Explanation missing." },
        { status: "blocked", footer: "Approval is off until evidence is in." },
      ],
    };
  }

  if (stored) {
    const targetUse = stored.baseline.risk.targetUse;
    const defectTones = targetUse
      ? Object.fromEntries(DEFECTS.map(({ key }) => [key, targetUse[key] ? USE_TONE[targetUse[key].useClass] : "dim"])) as Record<Defect, ChipTone>
      : DIM_TONES;
    const lowConfidence = targetUse ? DEFECTS.map(({ key }) => key).filter((key) => targetUse[key]?.useClass === "advisory") : [];
    const known = { ...base, defectTones, lowConfidence, jobId: stored.jobId, changeCount: stored.changes.length };
    const upToSix: StepState[] = ["done", "done", "done", "done", "done", "done"];
    const revisionStatus = sources.job?.revision?.status;
    const approved = stored.status !== "DRAFT";

    if (!approved && (revisionStatus === "SUPERSEDED" || revisionStatus === "FAILED")) {
      const notCurrent = revisionStatus === "SUPERSEDED" ? "replaced" : "failed";
      return {
        ...known,
        kind: "replaced",
        notCurrent,
        steps: steps([...upToSix, "nc", "nc", "nc"], { 7: notCurrent === "replaced" ? "Replaced, read only" : "Not current" }),
        zones: [
          { status: "complete", footer: NORMAL_FOOTERS[0] },
          { status: "complete", footer: NORMAL_FOOTERS[1] },
          { status: "nc", footer: "A replaced revision cannot be approved. Plan the lot again." },
        ],
      };
    }

    if (!approved && head?.stage === "held") {
      // Held after a draft exists: the stored job proves steps 1 to 6; the head does not say where the hold sits.
      return {
        ...known,
        kind: "held-job",
        steps: steps([...upToSix, "nc", "nc", "nc"]),
        zones: [
          { status: "complete", footer: NORMAL_FOOTERS[0] },
          { status: "complete", footer: NORMAL_FOOTERS[1] },
          { status: "nc", footer: NORMAL_FOOTERS[2] },
        ],
      };
    }

    const cardStored = approved && stored.cardUri !== null;
    return {
      ...known,
      kind: approved ? "approved" : "draft",
      steps: steps(approved
        ? [...upToSix, "done", "done", cardStored ? "done" : "nc"]
        : [...upToSix, "now", "idle", "idle"]),
      zones: [
        { status: "complete", footer: NORMAL_FOOTERS[0] },
        { status: "complete", footer: NORMAL_FOOTERS[1] },
        { status: approved ? (cardStored ? "complete" : "nc") : "waiting", footer: NORMAL_FOOTERS[2] },
      ],
    };
  }

  return {
    ...base,
    kind: "none",
    steps: steps(Array(9).fill("nc")),
    zones: NORMAL_FOOTERS.map((footer) => ({ status: "nc" as const, footer })),
    missing: sources.failure ?? (head?.stage === "held"
      ? "This lot is on hold, but its stored job could not be read, so no step can be shown."
      : sources.lot
        ? "This lot has no stored job yet, so no step can be shown."
        : "No lot has been planned yet. Steps show here once a lot has a stored job."),
  };
}

export type Edge = { from: number; to: number; d: string };

// Arrow paths from Prep-Flow.html, in the 1128 x 440 drawing.
export const EDGES: Edge[] = [
  { from: 1, to: 2, d: "M154 122 H186" },
  { from: 2, to: 3, d: "M256 184 V208" },
  { from: 3, to: 4, d: "M326 270 H394" },
  { from: 4, to: 5, d: "M564 270 H592" },
  { from: 5, to: 6, d: "M662 208 V184" },
  { from: 6, to: 7, d: "M732 122 H802" },
  { from: 7, to: 8, d: "M942 122 H974" },
  { from: 8, to: 9, d: "M1044 184 V208" },
];

export type EdgeTone = "g1" | "ac" | "wn" | "bd" | "g2";

/** Arrow colour as the designs draw it: solid green between finished steps, dashed past a stop. */
export function edgeTone(from: StepState, to: StepState): EdgeTone {
  if (from === "held") return "wn";
  if (from === "failed") return "bd";
  if (to === "now") return "ac";
  if (from === "done" && (to === "done" || to === "held" || to === "failed")) return "g1";
  return "g2";
}
