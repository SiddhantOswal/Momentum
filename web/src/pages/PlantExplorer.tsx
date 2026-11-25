import { useEffect, useState } from "react";
import { Button, Card, Icon, PageHeader, ProvenanceChip } from "../components/m";
import { href } from "../lib/routes";
import "./explorer/explorer.css";
import { leverLabel, leverValue, STAGES, useCurrentPlan, useModelScores, type PlanState, type PlanView, type StageId } from "./explorer/plan";
import { StageMap } from "./explorer/StageMap";

const HISTORY_CHIPS = ["Warp", "Delamination", "Strength", "Print", "Crack"];

// Opens on the stage with the most changes in the plan, as the design opens on Glue.
function busiestStage(plan: PlanView): StageId {
  const counts = STAGES.map((stage) => plan.changes.filter((change) => stage.levers.includes(change.lever)).length);
  const most = Math.max(...counts);
  return most > 0 ? STAGES[counts.indexOf(most)].id : 1;
}

export function PlantExplorer() {
  const plan = useCurrentPlan();
  const [selected, setSelected] = useState<StageId>(1);
  const view = plan.kind === "plan" ? plan.plan : undefined;
  useEffect(() => { if (view) setSelected(busiestStage(view)); }, [view]);

  return (
    <>
      <PageHeader title="Plant Explorer" sub="Stage by stage. Illustrative, no live readings." />
      <div className="g">
        <StageMap plan={view} selected={selected} onSelect={setSelected} />
        <div className="c4 pe-side">
          <StageCard plan={plan} stage={selected} />
          <Card title="Historical evidence" meta="Modeled lots">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {HISTORY_CHIPS.map((name) => <span key={name} className="pe-chp">{name}</span>)}
            </div>
            <div style={{ marginTop: 12 }}><a className="lk" href={href("insights")}>Open Insights</a></div>
          </Card>
          <ModelWatch />
        </div>
      </div>
    </>
  );
}

function StageCard({ plan, stage }: { plan: PlanState; stage: StageId }) {
  const { name, levers } = STAGES.find((s) => s.id === stage)!;
  const view = plan.kind === "plan" ? plan.plan : undefined;
  const firstChange = view?.changes.find((change) => levers.includes(change.lever));
  const compareLabel = firstChange ? `Compare ${leverValue(firstChange.lever, firstChange.from)} and ${leverValue(firstChange.lever, firstChange.to)}` : "Compare settings";
  // A floor record lists only the changed settings, so unchanged ones have no value to show.
  const rows = view ? levers.flatMap((lever) => {
    const change = view.changes.find((c) => c.lever === lever);
    if (change) return [{ lever, sub: `was ${leverValue(lever, change.from)}`, value: leverValue(lever, change.to) }];
    return view.levers ? [{ lever, sub: "No change", value: leverValue(lever, view.levers[lever]) }] : [];
  }) : [];

  return (
    <section className="cd kr" id="pe-stage-panel" role="tabpanel" aria-labelledby={`pe-tab-${stage}`}>
      <div className="ct"><h2 className="t">{name}, stage {stage}</h2>{view && <ProvenanceChip kind="model-estimate" />}</div>
      {plan.kind === "loading" && <p className="pe-msg" role="status">Reading the current lot.</p>}
      {plan.kind === "error" && <p className="pe-msg" role="alert">The current lot could not be read. {plan.message}</p>}
      {plan.kind === "none" && (
        <p className="pe-msg">No lot is planned yet, so there are no settings to show. Plan one in <a className="lk" href={href("new-lot/order")}>New Lot</a>.</p>
      )}
      {view && rows.length === 0 && <p className="pe-msg">{levers.length === 0 ? "The plan has no setting at this stage." : "The plan changes nothing at this stage."}</p>}
      {rows.map(({ lever, sub, value }) => (
        <div key={lever} className="pe-row">
          <div><div className="k">{leverLabel(lever)}</div><div className="lb">{sub}</div></div>
          <div className="n">{value}</div>
        </div>
      ))}
      {view?.source === "floor" && (
        <p className="lb pe-note" style={{ marginTop: 0, paddingTop: 8, borderTop: "1px solid var(--ln)" }}>Newest lot on the floor view, changed settings only.</p>
      )}
      <div style={{ marginTop: 6 }}>
        {/* The compare command (ARC-M6-12) does not exist, so the control is shown but sends nothing. */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Button variant="secondary" small disabled aria-describedby="pe-compare-note">{compareLabel}</Button>
          <ProvenanceChip kind="not-connected" />
        </div>
        <div className="lb pe-note" id="pe-compare-note">A comparison only. Changes go through New Lot. Comparing two estimates for one lot is not built yet.</div>
      </div>
    </section>
  );
}

function ModelWatch() {
  const scores = useModelScores();
  const print = Array.isArray(scores) ? scores.find((score) => score.defect === "PRINT" && typeof score.r2 === "number") : undefined;
  return (
    <Card title="Model watch" className="pe-watch-card">
      <div className="pe-watch">
        <span className="sx bd"><Icon name="bad" /></span>
        <div><b>Crack</b><div className="lb">Low confidence in humid months</div></div>
      </div>
      <div className="pe-watch">
        <span className="sx ok"><Icon name="ok" /></span>
        <div>
          <b>Print</b>
          <div className="lb">
            {scores === "loading" && "Reading the model scores."}
            {scores === "error" && "The model scores could not be read."}
            {Array.isArray(scores) && (print
              ? `${print.r2!.toFixed(2)} on ${typeof print.sampleCount === "number" ? print.sampleCount : "the held-out"} test lots`
              : "No score recorded for this model.")}
          </div>
        </div>
      </div>
    </Card>
  );
}
