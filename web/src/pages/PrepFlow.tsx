import { useEffect, useId, useState, type ReactNode } from "react";
import { ButtonLink, Card, Icon, IdleMark, NotConnected, PageHeader } from "../components/m";
import { DEFECTS, formatNumber } from "../lib/api";
import { href } from "../lib/routes";
import { deriveFlow, EDGES, edgeTone, STEPS, ZONES, type FlowSources, type FlowView, type StepState, type ZoneStatus } from "./prepflow/flow";
import { findReadableJob, pageParam, readJob, readLotHead, readLots, readTrace, type LotHead } from "./prepflow/records";
import "./prepflow/prepflow.css";

const JOB_FAILURES: Record<number, string> = {
  403: "This lot belongs to another session, so its steps cannot be shown here.",
  404: "No stored job has this ID, so no step can be shown.",
};
const LOT_FAILURES: Record<number, string> = {
  403: "This lot belongs to another session, so its steps cannot be shown here.",
  404: "No lot has this ID, so no step can be shown.",
};

/**
 * Reads the stored records for one lot: the job named in the URL (`job`), the lot head
 * (`lot`), or else the newest lot on the floor view; plus a run trace when the URL names one
 * (`run`). Each read that fails leaves its part of the page not connected.
 */
function useFlowSources(): { loading: boolean; sources: FlowSources } {
  const [state, setState] = useState<{ loading: boolean; sources: FlowSources }>({
    loading: true, sources: { lot: null, job: null, head: null, trace: null },
  });
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    (async () => {
      const sources: FlowSources = { lot: null, job: null, head: null, trace: null };
      let jobId = pageParam("job");
      const lotId = pageParam("lot");
      const runId = pageParam("run");
      let head: LotHead | null = null;
      if (lotId) {
        const read = await readLotHead(lotId, signal);
        if (read.ok) head = read.data;
        else sources.failure = LOT_FAILURES[read.status ?? 0] ?? "The lot record could not be read, so no step can be shown.";
        jobId ??= head?.lot.currentJobId ?? null;
      }
      if (jobId) {
        const read = await readJob(jobId, signal);
        if (read.ok) sources.job = read.data;
        else sources.failure = JOB_FAILURES[read.status ?? 0] ?? "The stored job could not be read, so no step can be shown.";
      } else if (!runId && !lotId) {
        const lots = await readLots(signal);
        if (!lots.ok) sources.failure = "The lot list could not be read, so no step can be shown.";
        else {
          const found = await findReadableJob(lots.data.lots, signal);
          if (found.ok) Object.assign(sources, { lot: found.lot, job: found.job });
          else if (found.reason === "other-sessions") sources.failure = "The newest lots belong to other sessions. Plan a lot in New Lot to see its steps.";
          else if (found.reason === "failed") sources.failure = JOB_FAILURES[found.status ?? 0] ?? "The stored job could not be read, so no step can be shown.";
        }
      }
      const revisionLot = sources.job?.revision?.lotId;
      if (!head && revisionLot) {
        const read = await readLotHead(revisionLot, signal);
        if (read.ok) head = read.data;
      }
      sources.head = head;
      if (runId) {
        const read = await readTrace(runId, signal);
        if (read.ok) sources.trace = read.data;
        else if (!sources.job) sources.failure = "The run trace could not be read, so no step can be shown.";
      }
      if (!signal.aborted) setState({ loading: false, sources });
    })();
    return () => controller.abort();
  }, []);
  return state;
}

const STATE_TEXT: Record<StepState, string> = {
  done: "Done", now: "Needs a person", held: "Held", failed: "Needs attention", idle: "Not reached", nc: "Not connected",
};

function NowMark() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2.6" fill="currentColor" /></svg>;
}

/** The shape for each state, as the designs draw it: colour, shape and text together. */
function StateMark({ state, text }: { state: StepState; text?: string }) {
  const mark: Record<StepState, [string, ReactNode]> = {
    done: ["ok", <Icon name="ok" />],
    now: ["ac", <NowMark />],
    held: ["wn", <Icon name="warn" />],
    failed: ["bd", <Icon name="bad" />],
    idle: ["id", <IdleMark />],
    nc: ["id", <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="var(--dim)" stroke="none" /></svg>],
  };
  const [tone, icon] = mark[state];
  return <span className={`sx ${tone}`} style={text ? undefined : { gap: 0 }}>{icon}{text ?? <span className="sr-only">{STATE_TEXT[state]}</span>}</span>;
}

const ZONE_STATUS: Record<ZoneStatus, [StepState, string]> = {
  complete: ["done", "Complete"], waiting: ["now", "Waiting on you"], held: ["held", "Held"], partly: ["failed", "Partly done"],
  blocked: ["idle", "Blocked"], "not-reached": ["idle", "Not reached"], nc: ["nc", "Not connected"],
};

const NODE_CLASS: Record<StepState, string> = { done: "", now: "cur", held: "cur w", failed: "cur b", idle: "pd", nc: "pd" };
const TONE_NOTE = { ok: "", wn: ", low confidence", bd: ", no estimate", dim: "" } as const;

function FlowDrawing({ view }: { view: FlowView }) {
  const markerId = useId().replace(/:/g, "");
  const tones = { g1: "var(--g1)", ac: "#E8664F", wn: "#E3A340", bd: "#F0707A", g2: "var(--g2)" } as const;
  return (
    <div className="pf-wrap">
      <div className="pf">
        {ZONES.map((zone, zoneIndex) => {
          const [zoneState, zoneText] = ZONE_STATUS[view.zones[zoneIndex].status];
          const zoneSteps = STEPS.filter((step) => step.zone === zoneIndex);
          return (
            <section key={zone} className={`zn z${zoneIndex}`} aria-labelledby={`${markerId}-z${zoneIndex}`}>
              <div className="zh"><h3 id={`${markerId}-z${zoneIndex}`}>{zone}</h3><StateMark state={zoneState} text={zoneText} /></div>
              <ol start={zoneSteps[0].n}>
                {zoneSteps.map((step) => {
                  const { state, sub } = view.steps[step.n - 1];
                  return (
                    <li key={step.n} className={`nd s${step.n} ${NODE_CLASS[state]}`.trim()} data-step={step.n} data-state={state}>
                      <div className="nr"><span>{step.n}</span><StateMark state={state} /></div>
                      <div className="nt">{step.title}</div>
                      <div className="ns">{sub}</div>
                      {step.n === 4
                        ? (
                          <ul className="pts" aria-label="Defect models">
                            {DEFECTS.map(({ key, short }) => (
                              <li key={key} className={`pt ${view.defectTones[key]}`}><i aria-hidden="true" />{short}<span className="sr-only">{TONE_NOTE[view.defectTones[key]]}</span></li>
                            ))}
                          </ul>
                        )
                        : <div className="nk">{step.by}</div>}
                    </li>
                  );
                })}
              </ol>
              <div className="zf">{view.zones[zoneIndex].footer}</div>
            </section>
          );
        })}
        <svg className="pf-arrows" width="1128" height="440" aria-hidden="true">
          <defs>
            {Object.entries(tones).map(([tone, fill]) => (
              <marker key={tone} id={`${markerId}-${tone}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                <path d="M0 0L8 4L0 8z" fill={fill} />
              </marker>
            ))}
          </defs>
          {EDGES.map((edge) => {
            const tone = edgeTone(view.steps[edge.from - 1].state, view.steps[edge.to - 1].state);
            const solid = tone === "g1" || tone === "ac";
            return <path key={edge.d} d={edge.d} fill="none" stroke={tones[tone]} strokeWidth="1.8" strokeDasharray={solid ? undefined : "5 4"} markerEnd={`url(#${markerId}-${tone})`} />;
          })}
        </svg>
      </div>
    </div>
  );
}

type Strip = [label: string, value: string, sub: string][];

function stripFor(view: FlowView): Strip {
  const lotSub = view.quantity === undefined
    ? "Quantity not recorded"
    : `${formatNumber(view.quantity)} boxes${view.revisionNumber ? `, Rev ${view.revisionNumber}` : ""}`;
  const lot: Strip[number] = ["Lot", view.itemCode ?? "Not recorded", lotSub];
  switch (view.kind) {
    case "held":
      return [["Lot", view.itemCode ?? "Not confirmed", "Order line not chosen"], ["Now at", "Catalog match", "Step 2 of 9, Ingestion zone"],
        ["Held for", "Supervisor", "Choose the order line"], ["Next", "Choose the line", "Then continue, or leave on hold"]];
    case "partial":
      return [lot, ["Now at", "Risk evidence", "Step 6 of 9, Intelligence zone"],
        ["Waiting on", "Supervisor", "Decide how to continue"], ["Next", "Retry, continue or hold", "See New Lot, recovery"]];
    case "held-job":
      return [lot, ["Now at", "On hold", "The lot record does not say where"],
        ["Held for", "Supervisor", "The lot is on hold"], ["Next", "Open the lot in New Lot", "Then continue, or leave on hold"]];
    case "replaced":
      return [lot, view.notCurrent === "replaced"
        ? ["Now at", "Replaced, read only", `${view.revisionNumber ? `Rev ${view.revisionNumber}` : "This revision"} was replaced. Plan the lot again.`]
        : ["Now at", "Not current", "This revision did not finish. Plan the lot again."],
        ["Waiting on", "No one", "This revision is read only"], ["Next", "Plan the lot again", "In New Lot"]];
    case "approved":
      return [lot, ["Now at", "Approved", "Step 9 of 9, Decision zone"],
        ["Waiting on", "No one", "The job card is approved"], ["Next", "Hand the card to the floor", "Open it on the operator's phone"]];
    default:
      return [lot, ["Now at", "Review plan", "Step 7 of 9, Decision zone"],
        ["Waiting on", "Supervisor", "Review and approve"], ["Next", "Approve, then store PDF", "Or keep as draft"]];
  }
}

const COUNT_WORDS = ["", "one", "two", "three"];

function List({ items }: { items: string[] }) {
  return <ul className="ul">{items.map((item) => <li key={item}>{item}</li>)}</ul>;
}

function Checks({ items }: { items: string[] }) {
  return <ul className="cks">{items.map((item) => <li key={item} className="ck"><i aria-hidden="true" />{item}</li>)}</ul>;
}

function SidePanels({ view }: { view: FlowView }) {
  const detail = (title: string, lead: string, sections: [string, string[]][], action: ReactNode) => (
    <Card span={6} title={title}>
      <div style={{ fontSize: 15, lineHeight: 1.5, color: "var(--mu)" }}>{lead}</div>
      {sections.map(([heading, items]) => (
        <div key={heading}><div className="th" style={{ marginTop: 14 }}>{heading}</div><List items={items} /></div>
      ))}
      <div className="pf-act">{action}</div>
    </Card>
  );
  const choices = (title: string, items: string[] | null, footer: string, body?: ReactNode) => (
    <Card span={6} title={title} className="pf-col">
      {items ? <Checks items={items} /> : body}
      <div className="lb" style={{ marginTop: "auto", paddingTop: 12, fontSize: 13.5, lineHeight: 1.45 }}>{footer}</div>
    </Card>
  );
  if (view.kind === "held") {
    return (
      <>
        {detail("Why it stopped", "The order is unclear. A supervisor picks the line.",
          [["Not run", ["Conditions, defect estimate, search, explanation", "Approval and job card"]]],
          <ButtonLink href={href("new-lot/order")} arrow>Open this step in New Lot</ButtonLink>)}
        {choices("Ways out of a hold", ["Choose the right line, then confirm the order.", "Correct a field that was read wrongly.", "Leave the lot on hold. Nothing downstream is created."],
          "Changing the order marks later steps out of date.")}
      </>
    );
  }
  if (view.kind === "held-job") {
    return (
      <>
        {detail("Why it stopped", "The lot is on hold. Its record does not say at which step or why.",
          [["Stored", ["The draft job for this lot"]]],
          <ButtonLink href={href("new-lot/order")} arrow>Open New Lot</ButtonLink>)}
        {choices("Ways out of a hold", ["Continue the lot from New Lot.", "Leave the lot on hold."],
          "Approving saves a job card. Not a machine command.")}
      </>
    );
  }
  if (view.kind === "replaced") {
    const replaced = view.notCurrent === "replaced";
    return (
      <>
        {detail("Why it is read only",
          replaced ? "A replaced revision cannot be approved. Plan the lot again." : "This revision did not finish. It cannot be approved.",
          [["Stored", ["The draft job for this revision"]]],
          <ButtonLink href={href("new-lot/order")} arrow>Plan the lot again</ButtonLink>)}
        {choices("What you are deciding", null, "Approving saves a job card. Not a machine command.",
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.4 }}>Nothing to decide on this revision.</p>)}
      </>
    );
  }
  if (view.kind === "partial") {
    return (
      <>
        {detail("Why it stopped", "The estimate and search finished. Approval is blocked.",
          [["Finished", ["Defect estimate", "Setting search", "Similar past lots"]], ["Not finished", ["Explanation"]]],
          <ButtonLink href={href("new-lot/settings")} arrow>Open recovery in New Lot</ButtonLink>)}
        {choices("Ways out", ["Retry the explanation.", "Continue without it, if plant rules allow.", "Hold the lot."],
          "Approval stays off until one is done.")}
      </>
    );
  }
  if (view.kind === "approved") {
    const operator = view.jobId ? `?job=${encodeURIComponent(view.jobId)}${href("operator")}` : href("operator");
    return (
      <>
        {detail("Selected: Job record",
          view.steps[8].state === "done" ? "The approved card is stored with its PDF." : "The card is approved. Its stored PDF is not shown here.",
          [["Inputs", ["Approved plan"]], ["Output", ["Job card PDF"]]],
          <ButtonLink href={operator} arrow>Open on the operator's phone</ButtonLink>)}
        {choices("What you are deciding", null, "Approving saves a job card. Not a machine command.",
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.4 }}>Nothing waits on you. The card is approved.</p>)}
      </>
    );
  }
  const changes = view.changeCount ?? 0;
  const lowConfidence = DEFECTS.filter(({ key }) => view.lowConfidence.includes(key)).map(({ short }) => short);
  return (
    <>
      {detail("Selected: Review plan", "Recommended settings beside your plan.",
        [["Inputs", ["Entered plan and recommended plan", "Five modeled risks and how far to trust them", "Similar past lots"]], ["Output", ["Your decision: approve, or keep as draft"]]],
        <ButtonLink href={href("new-lot/approve")} arrow>Open this step in New Lot</ButtonLink>)}
      {choices("What you are deciding", [
        changes === 0 ? "Does the plan make sense for today's floor?" : `Do the ${COUNT_WORDS[changes]} change${changes === 1 ? "" : "s"} make sense for today's floor?`,
        lowConfidence.length ? `Trust the models? ${lowConfidence.join(" and ")} ${lowConfidence.length === 1 ? "is" : "are"} low confidence.` : "Trust the models?",
        "Is any source unclear or missing?",
      ], "Approving saves a job card. Not a machine command.")}
    </>
  );
}

const TOASTS = {
  held: { tone: "wn", icon: "warn", title: "Order is unclear", text: "A supervisor picks the line." },
  "held-job": { tone: "wn", icon: "warn", title: "Lot is on hold", text: "The record does not say where it stopped." },
  partial: { tone: "bd", icon: "bad", title: "Explanation did not finish", text: "Approval is blocked." },
} as const;

function Toast({ kind }: { kind: keyof typeof TOASTS }) {
  const [open, setOpen] = useState(true);
  const toast = TOASTS[kind];
  return (
    <div className="tsts" aria-live="polite">
      {open && (
        <div className={`tst ${toast.tone}`} role="alert">
          <Icon name={toast.icon} />
          <div><b>{toast.title}</b><span>{toast.text}</span></div>
          <button type="button" className="x" aria-label="Dismiss" onClick={() => setOpen(false)}><Icon name="close" /></button>
        </div>
      )}
    </div>
  );
}

const SUBTITLES: Partial<Record<FlowView["kind"], string>> = {
  held: "Held. Nothing runs after the unclear order.",
  "held-job": "Held. The lot record does not say at which step.",
  partial: "Partial. Estimate done, explanation missing.",
};
const CARD_TITLES: Partial<Record<FlowView["kind"], string>> = { held: "Held at the catalog match", partial: "Stopped at risk evidence" };

// The design's legend for each state; a state with no step waiting on a person does not list one.
const LEGENDS: Record<FlowView["kind"], StepState[]> = {
  draft: ["done", "now", "idle"], approved: ["done", "now", "idle"], none: ["done", "now", "idle"],
  held: ["done", "held", "idle"], partial: ["done", "failed", "idle"], "held-job": ["done", "nc"], replaced: ["done", "nc"],
};

export function PrepFlow() {
  const { loading, sources } = useFlowSources();
  const view = deriveFlow(sources);
  const keyed = LEGENDS[view.kind];
  const hasNc = view.steps.some((step) => step.state === "nc");
  const legend: StepState[] = hasNc && !keyed.includes("nc") ? [...keyed, "nc"] : keyed;
  return (
    <div className="pf-page">
      <PageHeader title="Preparation flow" sub={SUBTITLES[view.kind] ?? "Purchase order to approved job card, step by step."}
        actions={<ButtonLink variant="secondary" href={href("new-lot/order")}>Open New Lot</ButtonLink>} />
      <div className="g" aria-busy={loading}>
        {loading
          ? <Card span={12} kraft><p className="lb" role="status" style={{ margin: 0 }}>Reading the lot records.</p></Card>
          : view.kind === "none"
            ? <NotConnected span={12} title="Lot" missing={view.missing ?? ""} />
            : (
              <section className="cd kr c12" style={{ padding: "18px 20px" }} aria-label="Lot status">
                <div className="sm4">
                  {stripFor(view).map(([label, value, sub]) => (
                    <div key={label}><div className="lb">{label}</div><div className="sv">{value}</div><div className="lb">{sub}</div></div>
                  ))}
                </div>
              </section>
            )}
        <Card span={12} className="pf-card" title={CARD_TITLES[view.kind] ?? "From order to approved card"}
          meta={<div className="pf-legend">{legend.map((state) => <StateMark key={state} state={state} text={STATE_TEXT[state]} />)}</div>}>
          <FlowDrawing view={view} />
        </Card>
        {!loading && view.kind !== "none" && <SidePanels view={view} />}
      </div>
      {(view.kind === "held" || view.kind === "held-job" || view.kind === "partial") && <Toast kind={view.kind} />}
    </div>
  );
}
