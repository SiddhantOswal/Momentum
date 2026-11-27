import { useEffect, useState } from "react";
import { Banner, Button, ButtonLink, Card, NotConnected } from "../components/m";
import { DEFECTS, formatNumber } from "../lib/api";
import type { ModelScore, PlanResult, Risk } from "./newlot/api";
import { explain, readStatus } from "./newlot/actions";
import { IdsBar, NewLotPage, StatusIcon, Toasts, useToasts, defectLabel, pct, type Toast } from "./newlot/parts";
import { ChangesTable, ScrapCard, risesIn, unchangedCount } from "./newlot/plan-view";
import { inputsChanged, useLot, type LotState } from "./newlot/store";
import { NewLotRecovery } from "./NewLotRecovery";

function ExplainPanel({ lot }: { lot: LotState }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const run = async () => {
    setBusy(true); setError(undefined);
    const result = await explain(lot.plan!);
    setBusy(false);
    if (!result.ok) setError(result.message);
  };
  const shown = lot.explanation;
  return (
    <>
      <div style={{ borderTop: "1px solid var(--ln)", paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <span className="lb">{unchangedCount(lot.plan!.optimization?.changes ?? lot.plan!.jobSheet.changes)} settings unchanged</span>
        <Button small variant="secondary" onClick={run} disabled={busy} aria-expanded={!!shown} aria-controls="nl-explanation">
          {busy ? "Explaining" : shown ? "Explain again" : "Explain"}
        </Button>
      </div>
      <div id="nl-explanation" aria-live="polite">
        {error && <p className="err" role="alert">{error}</p>}
        {shown && (
          <div style={{ borderTop: "1px solid var(--ln)", marginTop: 12, paddingTop: 12 }}>
            <div className="th" style={{ marginBottom: 8 }}>Why these settings</div>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, whiteSpace: "pre-line" }}>{shown.explanation}</p>
            <p className="lb" style={{ fontSize: 13, margin: "8px 0 0" }}>
              {shown.source === "bigquery-ml-and-gemini" ? "Written by Gemini from the model attribution and similar past lots." : "A summary of the model attribution. Gemini did not write this text."}
              {" "}Model attribution is not proof of cause.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

function TradeOffCard({ plan }: { plan: PlanResult }) {
  const optimization = plan.optimization;
  const rises = optimization ? risesIn(optimization) : [];
  const costFalls = (optimization?.savings.inr ?? 0) > 0;
  return (
    <section className="cd c4" style={{ display: "flex", flexDirection: "column" }} aria-labelledby="nl-tradeoff">
      <div className="ct"><h2 className="t" id="nl-tradeoff">Trade-off and choice</h2></div>
      {rises.length > 0 ? rises.map((rise) => (
        <div key={rise.defect} className="sx wn" style={{ alignItems: "flex-start", fontSize: 18, fontWeight: 600, lineHeight: 1.3, color: "var(--tx)", whiteSpace: "normal" }}>
          <StatusIcon kind="warn" /><span>{defectLabel(rise.defect)} risk rises, {pct(rise.from)} to {pct(rise.to)}</span>
        </div>
      )) : (
        <div className="sx ok" style={{ alignItems: "flex-start", fontSize: 18, fontWeight: 600, lineHeight: 1.3, color: "var(--tx)", whiteSpace: "normal" }}>
          <StatusIcon kind="ok" /><span>No counted defect risk rises</span>
        </div>
      )}
      <div className="lb" style={{ marginTop: 8, fontSize: 15, lineHeight: 1.5 }}>{costFalls ? "Total cost falls." : "Total cost does not fall."}</div>
      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10, paddingTop: 16 }}>
        <ButtonLink arrow href="#/new-lot/approve">Review job card</ButtonLink>
        <Button variant="secondary" disabled aria-describedby="nl-keep-note">Keep entered plan</Button>
        <span className="lb" id="nl-keep-note" style={{ fontSize: 13 }}>Approving the entered plan instead is not connected yet.</span>
      </div>
    </section>
  );
}

// The bar scale follows the design, where a full bar is 0.8.
const barWidth = (r2: number) => `${Math.max(1, Math.min(100, (r2 / 0.8) * 100))}%`;

function TrustCard({ risk }: { risk: Risk }) {
  const [scores, setScores] = useState<{ models: ModelScore[] } | "missing" | undefined>();
  useEffect(() => {
    let live = true;
    readStatus().then((result) => {
      if (!live) return;
      const models = result.ok ? result.data.modelAcceptance?.models : undefined;
      setScores(models && models.length > 0 ? { models } : "missing");
    });
    return () => { live = false; };
  }, []);
  if (scores === "missing") return <NotConnected span={12} title="How far to trust this" missing="The model scores are not available from the server right now." />;
  const lots = scores?.models.find((model) => model.sampleCount !== null)?.sampleCount;
  return (
    <Card span={12} title="How far to trust this" meta={lots ? `Tested on ${formatNumber(lots)} lots.` : scores ? undefined : "Loading the model scores"}>
      {scores && (
        <div role="table" aria-label="Model fit scores" className="rt trust">
          {DEFECTS.map(({ key }) => {
            const model = scores.models.find((entry) => entry.defect === key);
            const use = risk.targetUse?.[key]?.useClass;
            const low = use === "advisory";
            return (
              <div role="row" key={key} className="tb" style={{ minHeight: 46, gridTemplateColumns: "130px 1fr 70px 240px" }}>
                <span role="cell" style={{ fontWeight: 600 }}>{defectLabel(key)}</span>
                <span role="cell" className="tr2" aria-hidden="true">
                  {model?.r2 != null && <i style={{ width: barWidth(model.r2), background: low ? "var(--bd)" : "var(--g2)" }} />}
                </span>
                <span role="cell" className="n" style={{ textAlign: "right" }}>
                  <b style={{ fontSize: 18 }}>{model?.r2 == null ? "None" : formatNumber(model.r2, 2)}</b>
                  <span className="sr-only"> fit score</span>
                </span>
                <span role="cell">
                  {low ? <span className="sx bd"><StatusIcon kind="bad" />Low confidence, not counted</span>
                    : use === "abstain" ? <span className="sx id"><StatusIcon kind="idle" />Not shown</span>
                      : <span className="lb">Counted in the totals</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function settingsToasts(plan: PlanResult): Toast[] {
  const changes = plan.optimization?.changes ?? plan.jobSheet.changes;
  const list: Toast[] = [{ id: "ready", tone: "ok", title: "Recommendation ready", text: `${changes.length} ${changes.length === 1 ? "change" : "changes"}, up to 3 allowed.` }];
  for (const rise of plan.optimization ? risesIn(plan.optimization) : []) {
    list.push({ id: `rise-${rise.defect}`, tone: "wn", title: `${defectLabel(rise.defect)} risk rises`, text: (plan.optimization!.savings.inr > 0) ? "Total cost still falls." : "Total cost does not fall." });
  }
  return list;
}

function Comparison({ lot, plan }: { lot: LotState; plan: PlanResult }) {
  const { toasts, dismiss } = useToasts(settingsToasts(plan));
  const optimization = plan.optimization;
  const changes = optimization?.changes ?? plan.jobSheet.changes;
  const number = plan.revision?.number;
  const changed = inputsChanged(lot);
  return (
    <NewLotPage step={3} sub="Compare the two plans, then decide."
      ids={<IdsBar lot={lot} status={lot.stale ? "Out of date" : changed ? "Inputs changed" : "Comparison ready"} next={lot.stale || changed ? "Operator: plan this lot again" : "Supervisor review"} replaced={!!lot.stale} />}
      toasts={<Toasts toasts={toasts} dismiss={dismiss} />}>
      <div className="g">
        {(lot.stale || changed) && (
          <Banner tone="warn" title={lot.stale ? `An input changed after Rev ${lot.stale.number ?? number} was prepared.` : "Your inputs changed after this plan was made."}
            actions={<ButtonLink small arrow href="#/new-lot/conditions">Plan this lot again</ButtonLink>}>
            This comparison no longer matches the lot.
          </Banner>
        )}
        {plan.confidence === "reduced" && (
          <Banner tone="warn" title="Reduced confidence">{plan.conditionNotes?.join(" ") ?? "A condition value was replaced by a fallback."}</Banner>
        )}
        {optimization
          ? <ScrapCard optimization={optimization} band={plan.humidityBand} />
          : <NotConnected span={4} title="Scrap for this lot" missing="The plan response did not include the scrap comparison." />}
        <Card span={8} title={`${changes.length} of 7 settings change`} meta="Up to 3 changes allowed">
          <ChangesTable changes={changes} />
          <ExplainPanel lot={lot} />
        </Card>
        <NotConnected span={8} title="Constraints for this comparison"
          missing="Typed constraints, such as keeping a setting as entered, are not connected yet. The search may change up to three of the seven settings.">
          <div className="lb" style={{ fontSize: 13, marginTop: 10 }}>The system calculates and checks. A person approves.</div>
        </NotConnected>
        <TradeOffCard plan={plan} />
        <TrustCard risk={plan.jobSheet.recommended.risk} />
      </div>
    </NewLotPage>
  );
}

export function NewLotSettings() {
  const lot = useLot();
  if (lot.partial && !lot.plan) return <NewLotRecovery lot={lot} />;
  if (!lot.plan) {
    return (
      <NewLotPage step={3} sub="Compare the two plans, then decide." ids={<IdsBar lot={lot} status="Not planned yet" next="Operator: plan this lot" />}>
        <div className="g">
          <Card span={12} title="No plan yet">
            <p className="lb" style={{ margin: "0 0 14px", fontSize: 15 }}>Confirm the order and the conditions, then plan the lot. The comparison appears here.</p>
            <ButtonLink href="#/new-lot/conditions" arrow>Go to Conditions</ButtonLink>
          </Card>
        </div>
      </NewLotPage>
    );
  }
  return <Comparison lot={lot} plan={lot.plan} />;
}
