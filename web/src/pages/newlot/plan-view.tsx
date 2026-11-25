import { Chip, ProvenanceChip } from "../../components/m";
import { DEFECTS, type Defect } from "../../lib/api";
import { LEVERS, type LeverKey } from "../../lib/session";
import type { Change, Optimization, Risk } from "./api";
import { defectLabel, kg, leverLabel, leverText, money, pct } from "./parts";

/** Defects the API counts in totals and in the search. Advisory targets are shown as low confidence only. */
export const counted = (risk: Risk) => DEFECTS.map((d) => d.key).filter((defect) => !risk.targetUse || risk.targetUse[defect]?.useClass === "optimizer");
export const advisory = (risk: Risk) => DEFECTS.map((d) => d.key).filter((defect) => risk.targetUse?.[defect]?.useClass === "advisory");

/** The defects whose rate the recommendation raises, compared value by value as the API returned them. */
export function risesIn(optimization: Optimization): { defect: Defect; from: number; to: number }[] {
  const { baseline, best } = optimization;
  return counted(best.risk).flatMap((defect) => {
    const from = baseline.risk.ratesPct[defect];
    const to = best.risk.ratesPct[defect];
    return from !== undefined && to !== undefined && to > from ? [{ defect, from, to }] : [];
  });
}

export function ScrapFigures({ optimization, size = 36 }: { optimization: Optimization; size?: number }) {
  return (
    <span className="n" style={{ fontSize: size, lineHeight: `${size + 6}px`, fontWeight: 600, whiteSpace: "nowrap" }}>
      {kg(optimization.baseline.risk.totalScrapKg)} &rarr; {kg(optimization.best.risk.totalScrapKg)}
      <span style={{ fontSize: size / 2, color: "var(--mu)", marginLeft: 6, fontWeight: 500 }}>kg</span>
    </span>
  );
}

export function ExcludedNote({ risk }: { risk: Risk }) {
  const left = advisory(risk);
  if (left.length === 0) return null;
  return <div className="lb" style={{ fontSize: 13, marginTop: 10 }}>Totals leave out {left.map(defectLabel).join(", ")}: low confidence, not counted.</div>;
}

/** The changed settings, as the design's three-column table. */
export function ChangesTable({ changes, withChip = true, rowHeight = 52 }: { changes: Change[]; withChip?: boolean; rowHeight?: number }) {
  const columns = withChip ? "1fr 130px 150px 100px" : "1fr 120px 140px";
  return (
    <div role="table" aria-label="Settings that change" className="rt chg">
      <div role="row" className="tb h" style={{ gridTemplateColumns: columns, minHeight: 30 }}>
        <span role="columnheader" className="th">Setting</span><span role="columnheader" className="th">Entered</span>
        <span role="columnheader" className="th">Recommended</span>{withChip && <span role="columnheader" className="th"><span className="sr-only">Change</span></span>}
      </div>
      {changes.map((change) => (
        <div role="row" key={change.lever} className="tb" style={{ minHeight: rowHeight, gridTemplateColumns: columns }}>
          <span role="cell" style={{ fontSize: 16, fontWeight: 600 }}>{leverLabel(change.lever)}</span>
          <span role="cell" className="n" style={{ fontSize: 18, color: "var(--mu)" }}>{leverText(change.lever, change.from)}</span>
          <span role="cell" className="n" style={{ fontSize: 20, fontWeight: 600 }}>{leverText(change.lever, change.to)}</span>
          {withChip && <span role="cell"><Chip tone="accent">Changed</Chip></span>}
        </div>
      ))}
    </div>
  );
}

export const unchangedCount = (changes: Change[]) => LEVERS.filter((lever) => !changes.some((change) => change.lever === lever.key as LeverKey)).length;

export function ScrapCard({ optimization, band }: { optimization: Optimization; band?: { ambientRhPct: { low: number; high: number }; ratesPct: Partial<Record<Defect, { low: number; high: number }>> } }) {
  const { baseline, best, savings } = optimization;
  const primary = baseline.risk.primaryDefect;
  const bandRate = band?.ratesPct[primary];
  return (
    <section className="cd kr c4" aria-labelledby="nl-scrap">
      <div className="ct"><h2 className="t" id="nl-scrap">Scrap for this lot</h2><ProvenanceChip kind="model-estimate" /></div>
      <ScrapFigures optimization={optimization} />
      <div style={{ marginTop: 6, fontSize: 16 }}>
        {savings.kg > 0
          ? <><b>{kg(savings.kg)} kg</b> and <b>{money(savings.inr, best.risk.currency)}</b> lower, modeled</>
          : "The entered plan is already the lowest found."}
      </div>
      <div style={{ marginTop: 14, borderTop: "1px solid var(--ln)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--ln)" }}>
          <span className="lb">Entered plan</span><span className="n"><b>{kg(baseline.risk.totalScrapKg)} kg</b> &nbsp;{money(baseline.risk.scrapCost, baseline.risk.currency)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0" }}>
          <span className="lb">Recommended</span><span className="n"><b>{kg(best.risk.totalScrapKg)} kg</b> &nbsp;{money(best.risk.scrapCost, best.risk.currency)}</span>
        </div>
      </div>
      <ExcludedNote risk={best.risk} />
      {band && bandRate && (
        <div className="lb" style={{ fontSize: 13, marginTop: 6 }}>
          At {band.ambientRhPct.low}% to {band.ambientRhPct.high}% humidity, {defectLabel(primary)} on the entered plan is {pct(bandRate.low)} to {pct(bandRate.high)}.
        </div>
      )}
    </section>
  );
}
