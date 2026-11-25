import { Card, NotConnected } from "../../components/m";
import type { Defect, Result } from "../../lib/api";
import { DEFECT_NAME, DEFECT_ORDER, commonSampleCount, formatR2, splitMonth, type StatusResponse } from "../home/data";

// Geometry from the design's SVG: the track runs from x 140 (0.0) to x 540 (0.8), rows 52 apart.
const x = (r2: number) => 140 + Math.min(0.8, Math.max(0, r2)) * 500;
const TICKS = [0, 0.2, 0.4, 0.6, 0.8];

/** Current holdout R² per model. The retired pass levels and the "earlier check" markers are
 * not drawn: the first is no longer the acceptance test and the second has no route yet. */
export function ModelFit({ status, lowConfidence }: { status?: Result<StatusResponse>; lowConfidence: Set<Defect> }) {
  const acceptance = status?.ok ? status.data.modelAcceptance : undefined;
  const models = DEFECT_ORDER.map((defect) => acceptance?.models.find((m) => m.defect === defect && typeof m.r2 === "number"))
    .filter((model) => model !== undefined);
  const crack = models.find((model) => model.defect === "CRACK");

  const chart = !status
    ? <Card title="How well the five models hold up" span={8}><p className="lb" style={{ margin: 0 }}>Reading model scores…</p></Card>
    : models.length === 0
      ? <NotConnected span={8} title="How well the five models hold up" missing="Model scores could not be read from the status route, so no score is shown." />
      : (() => {
        const lots = commonSampleCount(models);
        const month = splitMonth(acceptance?.split);
        const meta = [lots && `${lots} test lots`, month].filter(Boolean).join(", ");
        const height = 52 * models.length + 70;
        return (
          <Card title="How well the five models hold up" meta={meta || undefined} span={8}>
            <div style={{ overflowX: "auto" }}>
              <svg viewBox={`0 0 726 ${height}`} width="100%" style={{ maxWidth: 726, minWidth: 560, display: "block" }} role="img"
                aria-label={`Fit score on held-out test lots: ${models.map((m) => `${DEFECT_NAME[m.defect]} ${formatR2(m.r2!)}`).join(", ")}`}>
                <circle cx="8" cy="12" r="6" fill="var(--mu)" />
                <text x="22" y="17" fontFamily="'Inter'" fontSize="13" fill="var(--mu)">Test lots</text>
                {models.map((model, index) => {
                  const y = 60 + index * 52;
                  const low = lowConfidence.has(model.defect);
                  return (
                    <g key={model.defect}>
                      <text x="0" y={y + 5} fontFamily="'Inter'" fontSize="16" fontWeight="600" fill="var(--tx)">{DEFECT_NAME[model.defect]}</text>
                      <line x1="140" y1={y} x2="540" y2={y} stroke="var(--ln2)" strokeWidth="6" strokeLinecap="round" />
                      <circle cx={x(model.r2!)} cy={y} r="8" fill={low ? "#F0707A" : "var(--tx)"} />
                      <text x="618" textAnchor="end" y={y + 6} fontFamily="'Inter Tight','Inter',sans-serif" fontSize="20" fontWeight="600" fill="var(--tx)">{formatR2(model.r2!)}</text>
                      {low && <text x="630" y={y + 5} fontFamily="'Inter'" fontSize="13" fill="var(--mu)">low confidence</text>}
                    </g>
                  );
                })}
                {TICKS.map((tick) => (
                  <text key={tick} x={x(tick)} y={height - 18} textAnchor="middle" fontFamily="'Inter'" fontSize="12" fill="var(--dim)">{tick.toFixed(1)}</text>
                ))}
              </svg>
            </div>
          </Card>
        );
      })();

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
