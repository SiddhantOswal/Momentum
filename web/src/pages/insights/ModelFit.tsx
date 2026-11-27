import { Card, NotConnected } from "../../components/m";
import type { Defect, Result } from "../../lib/api";
import { DEFECT_NAME, DEFECT_ORDER, commonSampleCount, formatR2, splitMonth, type StatusResponse } from "../home/data";

// The design's track runs from 0.0 to 0.8; a score outside that range sits at the nearest end.
// The 16 px dot stays inside the track, so nothing reaches past the card at phone width.
const position = (r2: number) => `calc((100% - 16px) * ${Math.min(0.8, Math.max(0, r2)) / 0.8})`;
const TICKS = [0, 0.2, 0.4, 0.6, 0.8];

/** Current holdout R² per model. The retired pass levels and the "earlier check" markers are
 * not drawn: the first is no longer the acceptance test and the second has no route yet.
 * Drawn in HTML rather than one fixed-width SVG so the rows reflow at phone width. */
export function ModelFit({ status, lowConfidence }: { status?: Result<StatusResponse>; lowConfidence: Set<Defect> }) {
  const acceptance = status?.ok ? status.data.modelAcceptance : undefined;
  const models = DEFECT_ORDER.map((defect) => acceptance?.models.find((m) => m.defect === defect && typeof m.r2 === "number"))
    .filter((model) => model !== undefined);
  const crack = models.find((model) => model.defect === "CRACK");

  let chart;
  if (!status) {
    chart = <Card title="How well the five models hold up" span={8}><p className="lb" style={{ margin: 0 }}>Reading model scores…</p></Card>;
  } else if (models.length === 0) {
    chart = <NotConnected span={8} title="How well the five models hold up" missing="Model scores could not be read from the status route, so no score is shown." />;
  } else {
    const lots = commonSampleCount(models);
    const meta = [lots && `${lots} test lots`, splitMonth(acceptance?.split)].filter(Boolean).join(", ");
    chart = (
      <Card title="How well the five models hold up" meta={meta || undefined} span={8}>
        <div className="in-legend" aria-hidden="true"><i />Test lots</div>
        <ul className="in-fit" aria-label="Fit score on held-out test lots">
          {models.map((model) => {
            const low = lowConfidence.has(model.defect);
            return (
              <li key={model.defect}>
                <span className="in-fit-name">{DEFECT_NAME[model.defect]}</span>
                <span className="in-fit-track" aria-hidden="true"><i style={{ left: position(model.r2!), background: low ? "var(--bd)" : "var(--tx)" }} /></span>
                <span className="n in-fit-value">{formatR2(model.r2!)}</span>
                <span className="in-fit-note">{low ? "low confidence" : ""}</span>
              </li>
            );
          })}
        </ul>
        <div className="in-fit-ticks" aria-hidden="true">
          <span />
          <span className="in-fit-scale">{TICKS.map((tick) => <b key={tick}>{tick.toFixed(1)}</b>)}</span>
        </div>
      </Card>
    );
  }

  return (
    <>
      {chart}
      <section className="cd c4" aria-labelledby="in-read-chart" style={{ display: "flex", flexDirection: "column" }}>
        <div className="ct"><h2 className="t" id="in-read-chart" style={{ margin: 0 }}>Reading this chart</h2></div>
        <ul className="in-read">
          <li>Fit score: 1 is perfect, below 0 is poor.</li>
          <li>A supervisor approves every plan.</li>
          {crack && <li>Crack is {formatR2(crack.r2!)}.{lowConfidence.has("CRACK") ? " Low confidence." : ""}</li>}
        </ul>
      </section>
    </>
  );
}
