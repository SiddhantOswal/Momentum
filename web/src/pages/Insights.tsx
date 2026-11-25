import { PageHeader } from "../components/m";
import { useLive } from "../lib/live";
import { useResource } from "../lib/useApp";
import { lowConfidence, newest, type StatusResponse } from "./home/data";
import { Attribution } from "./insights/Attribution";
import { ImpactCompare, ImpactTiles, SettingsCard, type ImpactResponse } from "./insights/Impact";
import { ModelFit } from "./insights/ModelFit";
import { ConveyorScene, EvidenceTiles, LowConfidenceNotice, MeasuredSavings, NotConnectedYet } from "./insights/Sections";
import "./insights/insights.css";

// Questions about these figures go to Arc, which answers from the same routes; the page has no
// chat of its own. The frame owns the launcher, so the page presses it.
function openArc() {
  document.querySelector<HTMLButtonElement>('button[aria-controls="arc-panel"][aria-expanded="false"]')?.click();
}

/** Insights (Insights.png). Figures come from /impact/summary, /api/status, /api/lots and, on
 * request, /risk/explanation; elements with no stored record show the not-connected state. */
export function Insights() {
  const { view } = useLive();
  const impact = useResource<ImpactResponse>("/impact/summary");
  const status = useResource<StatusResponse>("/api/status");
  const flagged = lowConfidence(view.lots);

  return (
    <div className="in-page">
      {/* Ask Insights sits beside the description: the design's low-confidence notice covers the
          header's right side, where an action would otherwise go. */}
      <PageHeader title="Insights" sub={
        <>Quality, impact and next steps. Every view is labelled.{" "}
          <button type="button" className="lk in-ask" onClick={openArc}>Ask Insights</button></>
      } />
      <LowConfidenceNotice defects={flagged} />
      <div className="g">
        <ImpactTiles impact={impact.result} />
        <ImpactCompare impact={impact.result} />
        <SettingsCard lot={newest(view.lots)} />
        <ModelFit status={status.result} lowConfidence={flagged} />
        <Attribution lots={view.lots} />
        <section className="cd c4" aria-labelledby="in-read-attr" style={{ display: "flex", flexDirection: "column" }}>
          <div className="ct"><h2 className="t" id="in-read-attr" style={{ margin: 0 }}>Reading attribution</h2></div>
          <ul className="in-read">
            <li>What the model used, not what caused it.</li>
            <li>Negative lowers modeled risk.</li>
          </ul>
        </section>
        <EvidenceTiles />
        <ConveyorScene />
        <MeasuredSavings />
        <NotConnectedYet />
      </div>
    </div>
  );
}
