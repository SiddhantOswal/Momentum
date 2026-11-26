import type { LiveLot } from "../../lib/live";

// Nine steps in three zones, as the approved design draws them. Copy per status comes from the
// design's three states (Prep-Flow, Prep-Flow-Held, Prep-Flow-Partial).
export type Mark = "done" | "needs" | "held" | "attention" | "idle";
export type ZoneKey = "ingestion" | "intelligence" | "decision";

export type StepDef = { n: number; title: string; source: string; zone: ZoneKey };
export const STEPS: readonly StepDef[] = [
  { n: 1, title: "Purchase order", source: "Gemini", zone: "ingestion" },
  { n: 2, title: "Catalog match", source: "BigQuery", zone: "ingestion" },
  { n: 3, title: "Conditions", source: "Operator", zone: "ingestion" },
  { n: 4, title: "Defect estimate", source: "", zone: "intelligence" },
  { n: 5, title: "Limited search", source: "BigQuery SQL", zone: "intelligence" },
  { n: 6, title: "Risk evidence", source: "Google Cloud", zone: "intelligence" },
  { n: 7, title: "Review plan", source: "Supervisor", zone: "decision" },
  { n: 8, title: "Approve card", source: "Supervisor gate", zone: "decision" },
  { n: 9, title: "Job record", source: "Cloud Storage", zone: "decision" },
];

export type FlowState = "normal" | "held" | "partial";

export type FlowInput = {
  state: FlowState;
  lotId: string;
  lotNote: string;
  /** Step the flow stopped at or is waiting on, 1 to 9. */
  at: number;
  /** Number of setting changes in the recommended plan, when known. */
  changeCount?: number;
  /** Candidate settings scored, when the backend reports it. */
  candidateCount?: number;
};

export type StepView = { step: StepDef; mark: Mark; text: string; current: boolean };
export type EdgeView = { from: number; to: number; tone: "done" | "needs" | "held" | "attention" | "idle" };
export type ZoneView = { key: ZoneKey; name: string; mark: Mark; label: string; foot: string };
export type Panel = {
  title: string; chip: string; lead: string;
  groups: { heading: string; items: string[] }[];
  action: string; actionHint?: string;
  decisionTitle: string; decisions: string[]; decisionNote: string;
};
export type Flow = {
  state: FlowState; heading: string; subtitle: string; legend: Mark[];
  hero: { label: string; value: string; note: string }[];
  steps: StepView[]; edges: EdgeView[]; zones: ZoneView[]; panel: Panel;
  toast?: { tone: "warn" | "bad"; title: string; text: string };
};

const boxes = (value: number) => `${new Intl.NumberFormat("en-IN").format(value)} boxes`;
const zoneName: Record<ZoneKey, string> = { ingestion: "Ingestion", intelligence: "Intelligence", decision: "Decision" };
const stepLine = (n: number) => `Step ${n} of 9, ${zoneName[STEPS[n - 1].zone]} zone`;

const EDGES: [number, number][] = [[1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9]];

function text(step: number, state: FlowState, mark: Mark, input: FlowInput): string {
  if (mark === "idle") {
    if (state === "partial" && step === 7) return "Waiting on evidence";
    if (state === "held" && step === 4) return "Waits for the earlier steps";
    return step === 9 ? "Not created" : "Not reached";
  }
  if (mark === "held") return "The line is ambiguous";
  if (mark === "attention") return "Explanation failed";
  if (state === "held" && step === 1) return "Order file read";
  const search = input.candidateCount
    ? `${new Intl.NumberFormat("en-IN").format(input.candidateCount)} tries, 3 changes max`
    : "3 changes max";
  return [
    "Reads the order file", "Finds the item", "You confirm today's inputs", "Five models score the risks",
    search, "Similar lots and an explanation", "Entered vs recommended", "Approve, or keep as draft",
    "Saved, PDF stored, checked",
  ][step - 1];
}

export function buildFlow(input: FlowInput): Flow {
  const { state, at } = input;
  const marks: Mark[] = STEPS.map((step) => {
    if (step.n < at) return "done";
    if (step.n === at) return state === "held" ? "held" : state === "partial" ? "attention" : "needs";
    // In the partial design the numbers, search and the earlier steps stand even though step 6 stopped.
    if (state === "partial" && (step.n === 4 || step.n === 5)) return "done";
    return "idle";
  });
  const steps: StepView[] = STEPS.map((step, i) => ({ step, mark: marks[i], text: text(step.n, state, marks[i], input), current: step.n === at }));

  // An arrow is green once its source step is done, orange when it leads into the step waiting on a
  // person, and amber or red when it leaves a held or failed step.
  const edges: EdgeView[] = EDGES.map(([from, to]) => {
    const source = marks[from - 1];
    if (source === "done") return { from, to, tone: marks[to - 1] === "needs" ? "needs" : "done" };
    if (source === "held" || source === "attention") return { from, to, tone: source };
    return { from, to, tone: "idle" };
  });

  const zoneMarks = (key: ZoneKey): { mark: Mark; label: string } => {
    const own = steps.filter((s) => s.step.zone === key);
    if (own.every((s) => s.mark === "done")) return { mark: "done", label: "Complete" };
    if (own.some((s) => s.mark === "held")) return { mark: "held", label: "Held" };
    if (own.some((s) => s.mark === "attention")) return { mark: "attention", label: "Partly done" };
    if (own.some((s) => s.mark === "needs")) return { mark: "needs", label: "Waiting on you" };
    return { mark: "idle", label: state === "partial" ? "Blocked" : "Not reached" };
  };
  const foots: Record<FlowState, Record<ZoneKey, string>> = {
    normal: { ingestion: "Stops if anything is unclear.", intelligence: "Stops if no setting is allowed.", decision: "Nothing is released before approval." },
    held: { ingestion: "Stops if anything is unclear.", intelligence: "Nothing has run yet.", decision: "No job card yet." },
    partial: { ingestion: "Stops if anything is unclear.", intelligence: "Numbers saved. Explanation missing.", decision: "Approval is off until evidence is in." },
  };
  const zones: ZoneView[] = (["ingestion", "intelligence", "decision"] as const).map((key) => ({ key, name: zoneName[key], ...zoneMarks(key), foot: foots[state][key] }));

  const current = STEPS[at - 1];
  const hero = (label: string, value: string, note: string) => ({ label, value, note });
  const common = { state, edges, steps, zones };
  const decisionCount = input.changeCount === 3 ? "three" : input.changeCount ? String(input.changeCount) : null;

  if (state === "held") {
    return {
      ...common, heading: "Held at the catalog match", subtitle: "Held. Nothing runs after the unclear order.", legend: ["done", "held", "idle"],
      hero: [hero("Lot", input.lotId, input.lotNote), hero("Now at", current.title, stepLine(at)), hero("Held for", "Supervisor", "Demo session, no named person"), hero("Next", "Choose the line", "Then continue, or leave on hold")],
      panel: {
        title: "Why it stopped", chip: "Held", lead: "The order is unclear. A supervisor picks the line.",
        groups: [{ heading: "Kept", items: ["The uploaded order and what was read from it"] }, { heading: "Not run", items: ["Conditions, defect estimate, search, explanation", "Approval and job card"] }],
        action: "Open this step in New Lot",
        decisionTitle: "Ways out of a hold",
        decisions: ["Choose the right line, then confirm the order.", "Correct a field that was read wrongly.", "Leave the lot on hold. Nothing downstream is created."],
        decisionNote: "Changing the order marks later steps out of date.",
      },
      toast: { tone: "warn", title: "Order is unclear", text: "A supervisor picks the line." },
    };
  }
  if (state === "partial") {
    return {
      ...common, heading: "Stopped at risk evidence", subtitle: "Partial. Numbers saved, explanation missing.", legend: ["done", "attention", "idle"],
      hero: [hero("Lot", input.lotId, input.lotNote), hero("Now at", current.title, stepLine(at)), hero("Waiting on", "Supervisor", "Demo session, no named person"), hero("Next", "Retry, continue or hold", "See New Lot, recovery")],
      panel: {
        title: "Why it stopped", chip: "Partly done", lead: "Rev 1 numbers are saved. Approval is blocked.",
        groups: [
          { heading: "Kept", items: ["Defect estimate", input.candidateCount ? `${new Intl.NumberFormat("en-IN").format(input.candidateCount)} setting combinations checked` : "Setting combinations checked", "Similar past lots"] },
          { heading: "Missing", items: ["Explanation"] },
        ],
        action: "Open recovery in New Lot",
        decisionTitle: "Ways out",
        decisions: ["Retry the explanation. Numbers stay.", "Continue with saved numbers, if plant rules allow.", "Hold the lot. Rev 1 and the reason are kept."],
        decisionNote: "Approval stays off until one is done.",
      },
      toast: { tone: "bad", title: "Explanation did not finish", text: "Approval is blocked." },
    };
  }
  // Decision wording keeps the design's questions. The design's trade-off figure and its "Only Print
  // passes" clause are retired claims (docs/arc/delivery/data/stale-claims.md), so they are not shown.
  return {
    ...common, heading: "From order to approved card", subtitle: "Purchase order to approved job card, step by step.", legend: ["done", "needs", "idle"],
    hero: [hero("Lot", input.lotId, input.lotNote), hero("Now at", current.title, stepLine(at)), hero("Waiting on", "Supervisor", "Demo session, no named person"), hero("Next", "Approve, then store PDF", "Or keep as draft")],
    panel: {
      title: "Selected: Review plan", chip: "Needs you", lead: "Recommended settings beside your plan.",
      groups: [
        { heading: "Inputs", items: ["Entered plan and recommended plan", "Five modeled risks and how far to trust them", "Similar past lots"] },
        { heading: "Output", items: ["Your decision: approve, or keep as draft"] },
      ],
      action: "Open this step in New Lot",
      decisionTitle: "What you are deciding",
      decisions: [
        decisionCount ? `Do the ${decisionCount} changes make sense for today's floor?` : "Do the changes make sense for today's floor?",
        "Acceptable trade-off?",
        "Trust the models?",
        "Is any source unclear or missing?",
      ],
      decisionNote: "Approving saves a job card. Not a machine command.",
    },
  };
}

/**
 * A planned lot has a recommended plan waiting for a supervisor, which only exists after steps 1 to 6.
 * No stored record says which step any other lot stopped at (DR-006), so those return nothing and
 * the page shows the not-connected state.
 */
export function flowFromLot(lot: LiveLot): FlowInput | null {
  if (lot.status !== "planned") return null;
  return { state: "normal", lotId: lot.lotId, lotNote: boxes(lot.quantity), at: 7, changeCount: lot.changes?.length };
}
