import { Card, Icon, NotConnected } from "../../components/m";
import type { Defect, Result } from "../../lib/api";
import { DEFECT_NAME, DEFECT_ORDER, commonSampleCount, formatR2, type StatusResponse } from "./data";

// The tiles' bars run from 0 to 0.8, as in the design; a score outside that range is clamped.
const barWidth = (r2: number) => `${Math.min(1, Math.max(0.01, r2 / 0.8)) * 100}%`;

/** Current holdout R² per model from /api/status, with no pass marks (spec C3, AC2.3). */
export function ModelTrust({ status, lowConfidence, span = 8 }: { status?: Result<StatusResponse>; lowConfidence: Set<Defect>; span?: 8 | 12 }) {
  const acceptance = status?.ok ? status.data.modelAcceptance : undefined;
  const models = (acceptance?.models ?? []).filter((model) => typeof model.r2 === "number");
  if (!status) {
    return <Card title="How far to trust each model" meta="Reading model scores…" span={span}><div className="lb">Reading model scores…</div></Card>;
  }
  if (models.length === 0) {
    return <NotConnected span={span} title="How far to trust each model" missing="Model scores could not be read from the status route, so no score is shown." />;
  }
  const lots = commonSampleCount(models);
  const ordered = DEFECT_ORDER.map((defect) => models.find((model) => model.defect === defect)).filter((model) => model !== undefined);
  const lowest = ordered.reduce((worst, model) => (model.r2! < worst.r2! ? model : worst), ordered[0]);
  return (
    <Card title="How far to trust each model" meta={lots ? `Fit score on ${lots} test lots.` : "Fit score on held-out test lots."} span={span}>
      <ul className="hm-tiles" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {ordered.map((model) => {
          const low = lowConfidence.has(model.defect);
          return (
            <li key={model.defect} className="hm-tile">
              <div className="lb">{DEFECT_NAME[model.defect]}</div>
              <div className="n" style={{ fontSize: 26, lineHeight: "32px", fontWeight: 600, marginTop: 4, whiteSpace: "nowrap" }}>{formatR2(model.r2!)}</div>
              <div className="hm-bar" aria-hidden="true"><i style={{ width: barWidth(model.r2!), background: low ? "var(--bd)" : "var(--mu)" }} /></div>
              {low && <div className="sx bd" style={{ fontSize: 13, gap: 6 }}><Icon name="bad" />Low confidence</div>}
            </li>
          );
        })}
      </ul>
      <div style={{ marginTop: 14, borderTop: "1px solid var(--ln)", paddingTop: 12, fontSize: 14, color: "var(--mu)", lineHeight: 1.5 }}>Scores run from 1, a perfect fit, to 0, no better than the average. Lowest: {DEFECT_NAME[lowest.defect]}, {formatR2(lowest.r2!)}. A supervisor approves every plan.</div>
    </Card>
  );
}
