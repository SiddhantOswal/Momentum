import type { ChipTone } from "../../components/m";

/**
 * The roadmap on the Planning page (ARC-M6-17), from Planning.html. Nothing here is built
 * unless its label says "Working prototype" or "Today". Three lines differ from the design:
 * pass-level and "8,640 options" wording is retired (data/stale-claims.md, Planning:274 and 279).
 */
export type Label = { text: string; tone: ChipTone };

const L = {
  prototype: { text: "Working prototype", tone: "plain" },
  today: { text: "Today", tone: "plain" },
  planned: { text: "Planned", tone: "none" },
  research: { text: "Research direction", tone: "example" },
  concept: { text: "Conceptual scenario", tone: "example" },
  hardware: { text: "Requires hardware", tone: "none" },
  validated: { text: "Requires validated data", tone: "modeled" },
  integration: { text: "Future integration", tone: "none" },
  outOfScope: { text: "Not in scope", tone: "none" },
  plannedNotDone: { text: "Planned, not done", tone: "example" },
} as const satisfies Record<string, Label>;

/** Labels that mark an item as roadmap, not shipped. */
export const ROADMAP_LABELS: string[] = [L.planned, L.research, L.concept, L.hardware, L.validated, L.integration, L.outOfScope, L.plannedNotDone].map((l) => l.text);

export const STAGES = [
  { when: "Today", title: "Prepare", text: "Order to approved job card.", label: L.prototype, needs: "Order, catalog, five models", now: true },
  { when: "Next", title: "Guide", text: "Voice, briefings, scan access.", label: L.planned, needs: "Shift and asset records" },
  { when: "Explore", title: "Challenge and remember", text: "Test plans. Keep the reasons.", label: L.research, needs: "Validated models and outcomes" },
  { when: "Long term", title: "Observe and learn", text: "See the floor. Learn from it.", label: L.hardware, needs: "Safety review and consent" },
];

export const PREFLIGHT_STEPS = [
  "Read the plan and its conditions",
  "Set the hard machine limits",
  "Vary humidity, temperature, material",
  "Check every case with the solver",
  "Hand a report to the supervisor",
];
export const PREFLIGHT_LABELS = [L.concept, L.research];
export const PREFLIGHT_CAVEAT = "Crack is low confidence. Preflight cannot hide that.";

export type Capability = { name: string; rail: Label; labels: Label[]; headline: string; rows: [string, string][]; today: string };

export const CAPABILITIES: Capability[] = [
  { name: "Production Preflight", rail: L.research, labels: [L.research, L.validated], headline: "Challenge the plan before production does.",
    rows: [["Problem", "A plan can pass at one point and fail nearby."], ["How it works", "Vary conditions, re-run the limits, report weak spots."], ["Needs", "Validated models and approved ranges."], ["Human step", "A supervisor reads the report first."], ["Limit", "Passing a simulation is not physical proof."]],
    today: "New Lot compares settings once, at entered conditions." },
  { name: "Experiment Designer", rail: L.research, labels: [L.research], headline: "Design the smallest responsible trial to learn.",
    rows: [["Problem", "Some settings stay tied because data cannot separate them."], ["How it works", "Propose a small trial with controls and stop rules."], ["Needs", "Measuring tools, an inspection protocol, approval."], ["Human step", "Safety and operations review before any trial."], ["Limit", "It never changes machine settings on its own."]],
    today: "No trials are designed or run." },
  { name: "Proof-Carrying Job Cards", rail: L.research, labels: [L.research], headline: "Every instruction carries its evidence.",
    rows: [["Problem", "A job card shows settings, not why they were chosen."], ["How it works", "Attach sources, limits and approval to a stored record."], ["Needs", "Hashed revisions and verified approver identity."], ["Human step", "The approver signs the exact revision."], ["Limit", "A checksum is not a compliance certificate."]],
    today: "The approved PDF is stored and read back." },
  { name: "Factory Time Machine", rail: L.validated, labels: [L.validated], headline: "Replay what was known at the time.",
    rows: [["Problem", "Past decisions get judged with today's hindsight."], ["How it works", "Rebuild the old inputs, limits and model version."], ["Needs", "Saved snapshots, model versions, real outcomes."], ["Human step", "A reviewer compares the replay with what happened."], ["Limit", "A replay is modeled, never a measured saving."]],
    today: "History is modeled, not measured." },
  { name: "Production Fingerprints", rail: L.validated, labels: [L.validated], headline: "Recognize a line's usual operating signature.",
    rows: [["Problem", "New lots can differ in ways nobody checks."], ["How it works", "Learn usual ranges, flag unfamiliar combinations."], ["Needs", "Validated records per machine and material."], ["Human step", "A supervisor decides what to inspect."], ["Limit", "Unusual is not the same as defective."]],
    today: "No measured per-machine history exists." },
  { name: "Inverse Production Planning", rail: L.research, labels: [L.research], headline: "Start with the goal, not the settings.",
    rows: [["Problem", "Supervisors think in goals, not seven settings."], ["How it works", "Set goals. A solver lists feasible plans within limits."], ["Needs", "Approved ranges and tested objectives."], ["Human step", "A supervisor reviews the chosen plan."], ["Limit", "Gemini never invents settings."]],
    today: "The solver scores every allowed combination, three changes at most." },
  { name: "Closed-Loop Quality Learning", rail: L.research, labels: [L.research, L.validated], headline: "Compare what was predicted with what ran.",
    rows: [["Problem", "Predictions are never checked against real lots."], ["How it works", "Record outcomes, measure drift, review model updates."], ["Needs", "Measured scrap, QC results, a model release gate."], ["Human step", "People approve every model update."], ["Limit", "Samples alone cannot prove savings."]],
    today: "Crack is low confidence." },
  { name: "Factory Decision Memory", rail: L.validated, labels: [L.validated], headline: "Keep why a decision was made, and what followed.",
    rows: [["Problem", "Teams keep the setting and lose the reason."], ["How it works", "Find similar past decisions and what happened next."], ["Needs", "Recorded rationale, outcomes, access rules."], ["Human step", "A supervisor reviews any precedent before use."], ["Limit", "Similar is not causal. Rules are never copied."]],
    today: "Each lot keeps its own approval record only." },
];

export const CHAIN: { name: string; dashed?: boolean }[] = [
  { name: "Preflight" }, { name: "Proof card" }, { name: "Real outcome", dashed: true }, { name: "Memory" }, { name: "Time Machine" }, { name: "Learning" },
];

export const INTERFACES = [
  { name: "Voice for Arc", icon: "M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4", label: L.planned, lead: "Speak to Arc. Same tools as chat.", needs: "Mic access, noise tests.", limit: "A spoken yes never approves a card." },
  { name: "Shift briefing", icon: "M6 3h9l3 3v15H6zM9 8h3M9 12h6M9 16h6", label: L.planned, lead: "A short summary of lots and decisions waiting.", needs: "Shift records and a lot queue.", limit: "It informs. It cannot approve." },
  { name: "QR and NFC access", icon: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2M14 18h2v2M18 18h2v2", label: L.planned, lead: "Scan a station label to open its page.", needs: "An asset registry and labels.", limit: "A tag sends an ID, not machine data." },
  { name: "Camera troubleshooting", icon: "M4 8h3l2-3h6l2 3h3v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z", label: L.integration, lead: "Photo in, things to check out.", needs: "Plant-labelled photos, review.", limit: "Not a quality certificate." },
];

export const LADDER = [
  { n: 1, name: "Identity only", text: "A scan opens the station page. No machine data.", label: L.planned },
  { n: 2, name: "Read-only data", text: "Timed readings from approved sources.", label: L.hardware },
  { n: 3, name: "Recommendations only", text: "Momentum proposes. People decide.", label: L.today, today: true },
  { n: 4, name: "Control", text: "Software sets machine values.", label: L.outOfScope, out: true },
];

export const WORN_LABEL = L.hardware;
export const WORN = [
  { name: "Smart glasses", text: "Hands-free steps and lookup." },
  { name: "Live vision", text: "Ask Arc about what a camera sees." },
  { name: "Projected guidance", text: "Instructions shown at a station." },
  { name: "Worn cameras", text: "Task capture, with consent." },
];

export const VALIDATION_LABEL = L.plannedNotDone;
export const VALIDATION = [
  { name: "Pick safe lots", text: "Owner and supervisor agree." },
  { name: "Record real inputs", text: "Real conditions, settings." },
  { name: "Compare to baseline", text: "Plan against what ran." },
  { name: "Measure the outcome", text: "Scrap and QC results." },
  { name: "Report all results", text: "Good and bad, published." },
];

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const LINES = ["Corrugator", "Converting", "Finishing"];
export const SCHEDULE_NEEDS = ["Production schedule", "Shift calendar", "Machine capacity", "Material stock", "Routing for each item"];
