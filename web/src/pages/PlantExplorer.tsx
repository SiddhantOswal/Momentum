import { useEffect, useState } from "react";
import { Button, Card, Icon, PageHeader, ProvenanceChip } from "../components/m";
import { href } from "../lib/routes";
import "./explorer/explorer.css";
import { leverLabel, leverValue, STAGES, useCurrentPlan, useModelScores, type PlanSheet, type PlanState, type StageId } from "./explorer/plan";
import { StageMap } from "./explorer/StageMap";

const HISTORY_CHIPS = ["Warp", "Delamination", "Strength", "Print", "Crack"];

// Opens on the stage with the most changes in the plan, as the design opens on Glue.
function busiestStage(sheet: PlanSheet): StageId {
  const counts = STAGES.map((stage) => sheet.changes.filter((change) => stage.levers.includes(change.lever)).length);
  const most = Math.max(...counts);
  return most > 0 ? STAGES[counts.indexOf(most)].id : 1;
}

export function PlantExplorer() {
  const plan = useCurrentPlan();
  const [selected, setSelected] = useState<StageId>(1);
  const sheet = plan.kind === "plan" ? plan.sheet : undefined;
  useEffect(() => { if (sheet) setSelected(busiestStage(sheet)); }, [sheet]);

  return (
    <>
      <PageHeader title="Plant Explorer" sub="Stage by stage. Illustrative, no live readings." />
      <div className="g">
        <StageMap sheet={sheet} selected={selected} onSelect={setSelected} />
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
  const sheet = plan.kind === "plan" ? plan.sheet : undefined;
  const firstChange = sheet?.changes.find((change) => levers.includes(change.lever));
  const compareLabel = firstChange ? `Compare ${leverValue(firstChange.lever, firstChange.from)} and ${leverValue(firstChange.lever, firstChange.to)}` : "Compare settings";

  return (
    <section className="cd kr" id="pe-stage-panel" role="tabpanel" aria-labelledby={`pe-tab-${stage}`}>
      <div className="ct"><h2 className="t">{name}, stage {stage}</h2>{sheet && <ProvenanceChip kind="model-estimate" />}</div>
      {plan.kind === "loading" && <p className="pe-msg" role="status">Reading the current lot.</p>}
      {plan.kind === "error" && <p className="pe-msg" role="alert">The current lot could not be read. {plan.message}</p>}
      {plan.kind === "none" && (
        <p className="pe-msg">No lot is planned yet, so there are no settings to show. Plan one in <a className="lk" href={href("new-lot/order")}>New Lot</a>.</p>
      )}
      {sheet && levers.length === 0 && <p className="pe-msg">The plan has no setting at this stage.</p>}
      {sheet && levers.map((lever) => {
        const change = sheet.changes.find((c) => c.lever === lever);
        return (
          <div key={lever} className="pe-row">
            <div>
              <div className="k">{leverLabel(lever)}</div>
              <div className="lb">{change ? `was ${leverValue(lever, change.from)}` : "No change"}</div>
            </div>
            <div className="n">{leverValue(lever, change ? change.to : sheet.recommended.levers[lever])}</div>
          </div>
        );
      })}
      <div style={{ marginTop: 6 }}>
        {/* The compare command (ARC-M6-12) does not exist, so the control is shown but sends nothing. */}
        <Button variant="secondary" small disabled aria-describedby="pe-compare-note">{compareLabel}</Button>
        <div className="lb pe-note">A comparison only. Changes go through New Lot.</div>
        <div id="pe-compare-note" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          <ProvenanceChip kind="not-connected" />
          <span className="lb" style={{ fontSize: 13 }}>Comparing two estimates for one lot is not built yet.</span>
        </div>
      </div>
    </section>
  );
}

function ModelWatch() {
  const scores = useModelScores();
  const print = Array.isArray(scores) ? scores.find((score) => score.defect === "PRINT") : undefined;
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
              ? `${print.r2.toFixed(2)} on ${print.sampleCount === undefined ? "the held-out" : print.sampleCount} test lots`
              : "No score recorded for this model.")}
          </div>
        </div>
      </div>
    </Card>
  );
}
