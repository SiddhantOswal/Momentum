import type { Provenance } from "../../ui/components";

export type Tag = { kind: Provenance; label: string };
const research: Tag = { kind: "example", label: "Research direction" };
const needsData: Tag = { kind: "modeled", label: "Requires validated data" };
const planned: Tag = { kind: "missing", label: "Planned" };
const hardware: Tag = { kind: "missing", label: "Requires hardware" };

export const STAGES: { when: string; title: string; text: string; tag: Tag; needs: string; today?: boolean }[] = [
  { when: "Today", title: "Prepare", text: "Order to approved job card.", tag: { kind: "confirmed", label: "Working prototype" }, needs: "Order, catalog, five models", today: true },
  { when: "Next", title: "Guide", text: "Voice, briefings, scan access.", tag: planned, needs: "Shift and asset records" },
  { when: "Explore", title: "Challenge and remember", text: "Test plans. Keep the reasons.", tag: research, needs: "Validated models and outcomes" },
  { when: "Long term", title: "Observe and learn", text: "See the floor. Learn from it.", tag: hardware, needs: "Safety review and consent" },
];

export const PREFLIGHT_STEPS = [
  "Read the plan and its conditions",
  "Set the hard machine limits",
  "Vary humidity, temperature, material",
  "Check every case with the solver",
  "Hand a report to the supervisor",
];

export type Capability = { name: string; headline: string; tags: Tag[]; rows: [string, string][]; today: string };
const row = (problem: string, how: string, needs: string, human: string, limit: string): [string, string][] => [
  ["Problem", problem], ["How it works", how], ["Needs", needs], ["Human step", human], ["Limit", limit],
];

export const CAPABILITIES: Capability[] = [
  { name: "Production Preflight", headline: "Challenge the plan before production does.", tags: [research, needsData],
    rows: row("A plan can pass at one point and fail nearby.", "Vary conditions, re-run the limits, report weak spots.", "Validated models and approved ranges.", "A supervisor reads the report first.", "Passing a simulation is not physical proof."),
    today: "New Lot compares settings once, at entered conditions." },
  { name: "Experiment Designer", headline: "Design the smallest responsible trial to learn.", tags: [research],
    rows: row("Some settings stay tied because data cannot separate them.", "Propose a small trial with controls and stop rules.", "Measuring tools, an inspection protocol, approval.", "Safety and operations review before any trial.", "It never changes machine settings on its own."),
    today: "No trials are designed or run." },
  { name: "Proof-Carrying Job Cards", headline: "Every instruction carries its evidence.", tags: [research],
    rows: row("A job card shows settings, not why they were chosen.", "Attach sources, limits and approval to a stored record.", "Hashed revisions and verified approver identity.", "The approver signs the exact revision.", "A checksum is not a compliance certificate."),
    today: "The approved PDF is stored and read back." },
  { name: "Factory Time Machine", headline: "Replay what was known at the time.", tags: [needsData],
    rows: row("Past decisions get judged with today's hindsight.", "Rebuild the old inputs, limits and model version.", "Saved snapshots, model versions, real outcomes.", "A reviewer compares the replay with what happened.", "A replay is modeled, never a measured saving."),
    today: "History is modeled, not measured." },
  { name: "Production Fingerprints", headline: "Recognize a line's usual operating signature.", tags: [needsData],
    rows: row("New lots can differ in ways nobody checks.", "Learn usual ranges, flag unfamiliar combinations.", "Validated records per machine and material.", "A supervisor decides what to inspect.", "Unusual is not the same as defective."),
    today: "No measured per-machine history exists." },
  { name: "Inverse Production Planning", headline: "Start with the goal, not the settings.", tags: [research],
    rows: row("Supervisors think in goals, not seven settings.", "Set goals. A solver lists feasible plans within limits.", "Approved ranges and tested objectives.", "A supervisor reviews the chosen plan.", "Gemini never invents settings."),
    // The design's "8,640 options" holds for one lot only (docs/arc/delivery/data/stale-claims.md), so the count is left out.
    today: "The solver scores a grid of options. Up to 3 changes allowed." },
  { name: "Closed-Loop Quality Learning", headline: "Compare what was predicted with what ran.", tags: [research, needsData],
    rows: row("Predictions are never checked against real lots.", "Record outcomes, measure drift, review model updates.", "Measured scrap, QC results, a model release gate.", "People approve every model update.", "Samples alone cannot prove savings."),
    // The design's pass count was retired (stale-claims.md); this keeps the limit that still holds.
    today: "Crack is low confidence." },
  { name: "Factory Decision Memory", headline: "Keep why a decision was made, and what followed.", tags: [needsData],
    rows: row("Teams keep the setting and lose the reason.", "Find similar past decisions and what happened next.", "Recorded rationale, outcomes, access rules.", "A supervisor reviews any precedent before use.", "Similar is not causal. Rules are never copied."),
    today: "Each lot keeps its own approval record only." },
];

export const CHAIN: { label: string; gap?: boolean }[] = [
  { label: "Preflight" }, { label: "Proof card" }, { label: "Real outcome", gap: true },
  { label: "Memory" }, { label: "Time Machine" }, { label: "Learning" },
];

export const NEXT_INTERFACES: { title: string; lead: string; tag: Tag; needs: string; limit: string; glyph: string }[] = [
  { title: "Voice for Arc", lead: "Speak to Arc. Same tools as chat.", tag: planned, needs: "Mic access, noise tests.", limit: "A spoken yes never approves a card.",
    glyph: "M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4" },
  { title: "Shift briefing", lead: "A short summary of lots and decisions waiting.", tag: planned, needs: "Shift records and a lot queue.", limit: "It informs. It cannot approve.",
    glyph: "M6 3h9l3 3v15H6zM9 8h3M9 12h6M9 16h6" },
  { title: "QR and NFC access", lead: "Scan a station label to open its page.", tag: planned, needs: "An asset registry and labels.", limit: "A tag sends an ID, not machine data.",
    glyph: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2M14 18h2v2M18 18h2v2" },
  { title: "Camera troubleshooting", lead: "Photo in, things to check out.", tag: { kind: "missing", label: "Future integration" }, needs: "Plant-labelled photos, review.", limit: "Not a quality certificate.",
    glyph: "M4 8h3l2-3h6l2 3h3v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" },
];

export const LADDER: { title: string; text: string; tag: Tag; today?: boolean; out?: boolean }[] = [
  { title: "Identity only", text: "A scan opens the station page. No machine data.", tag: planned },
  { title: "Read-only data", text: "Timed readings from approved sources.", tag: hardware },
  { title: "Recommendations only", text: "Momentum proposes. People decide.", tag: { kind: "confirmed", label: "Today" }, today: true },
  { title: "Control", text: "Software sets machine values.", tag: { kind: "missing", label: "Not in scope" }, out: true },
];

export const CAPTURE = [
  { title: "Smart glasses", text: "Hands-free steps and lookup." },
  { title: "Live vision", text: "Ask Arc about what a camera sees." },
  { title: "Projected guidance", text: "Instructions shown at a station." },
  { title: "Worn cameras", text: "Task capture, with consent." },
];

export const VALIDATION = [
  { title: "Pick safe lots", text: "Owner and supervisor agree." },
  { title: "Record real inputs", text: "Real conditions, settings." },
  { title: "Compare to baseline", text: "Plan against what ran." },
  { title: "Measure the outcome", text: "Scrap and QC results." },
  { title: "Report all results", text: "Good and bad, published." },
];

export const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const WEEK_LINES = ["Corrugator", "Converting", "Finishing"];
export const SCHEDULE_NEEDS = ["Production schedule", "Shift calendar", "Machine capacity", "Material stock", "Routing for each item"];
