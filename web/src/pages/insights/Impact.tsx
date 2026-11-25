import type { ReactNode } from "react";
import { Card, NotConnected, ProvenanceChip } from "../../components/m";
import { formatMoney, formatNumber, type ImpactSummary, type Result } from "../../lib/api";
import type { LiveLot } from "../../lib/live";
import { leverChange, leverLabel } from "../home/data";

export type ImpactResponse = ImpactSummary & { counterfactual?: { month: string; label: string } };

const monthName = (month: string | undefined) => {
  const match = month?.match(/^(\d{4})-(\d{2})$/);
  return match
    ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })
    : undefined;
};

function Kpi({ label, value, unit, sub, chip, good }: { label: string; value: string; unit?: string; sub: string; chip: ReactNode; good?: boolean }) {
  return (
    <section className="cd c3 in-kpi" aria-label={label}>
      <h2 className="th" style={{ margin: 0 }}>{label}</h2>
      <div className="n" style={good ? { color: "var(--ok)" } : undefined}>{value}{unit && <small>{unit}</small>}</div>
      <div className="lb">{sub}</div>
      {chip}
    </section>
  );
}

/** The four figures from /impact/summary: one held-out month of modeled lots, before and
 * after the recommended settings. Every value is printed as the route returns it. */
export function ImpactTiles({ impact }: { impact?: Result<ImpactResponse> }) {
  if (!impact) {
    return <section className="cd c12"><p className="lb" style={{ margin: 0 }}>Reading the impact summary…</p></section>;
  }
  if (!impact.ok) {
    return <NotConnected span={12} title="Impact" missing="The impact summary could not be read, so no saving or scrap figure is shown." />;
  }
  const { kpis } = impact.data;
  const estimate = <ProvenanceChip kind="model-estimate" />;
  return (
    <>
      <Kpi label="Lots scored" value={formatNumber(kpis.lotsScored)} unit="lots" sub={`${formatNumber(kpis.lotsChanged)} with changed settings`} chip={<ProvenanceChip kind="modeled-records" />} />
      <Kpi label="Modeled scrap" value={formatNumber(kpis.scrapPctAfter, 2)} unit="%" sub={`Down from ${formatNumber(kpis.scrapPctBefore, 2)}%`} chip={estimate} good />
      <Kpi label="Modeled saving" value={formatMoney(kpis.netSavingMonth, kpis.currency)} unit="a month" sub="Not a measured saving" chip={estimate} good />
      <Kpi label="Board saved" value={formatNumber(kpis.kgSavedMonth)} unit="kg" sub="In one held-out month" chip={estimate} />
    </>
  );
}

function Bar({ label, value, share, accent }: { label: string; value: string; share: number; accent?: boolean }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 14, color: "var(--mu)", marginBottom: 6 }}>{label}</div>
      <div className="in-track">
        <div style={{ width: `${Math.max(0, Math.min(1, share)) * 100}%`, background: accent ? "#E8664F" : "var(--bar0)" }}>
          <span className="n" style={{ color: accent ? "#18110E" : "var(--tx)" }}>{value}</span>
        </div>
      </div>
    </div>
  );
}

/** Before and after for the held-out month, as the design's reference-lot bars. */
export function ImpactCompare({ impact }: { impact?: Result<ImpactResponse> }) {
  if (!impact?.ok) {
    return <NotConnected span={8} title="Held-out month" missing="The impact summary could not be read, so the before and after bars are not drawn." />;
  }
  const { kpis, counterfactual } = impact.data;
  const month = monthName(counterfactual?.month);
  return (
    <Card title={month ? `Held-out month, ${month}` : "Held-out month"} span={8}>
      <div className="in-cmp">
        <div>
          <div className="th">Scrap</div>
          <Bar label="Entered plans" value={`${formatNumber(kpis.scrapPctBefore, 2)}%`} share={1} />
          <Bar label="Recommended plans" value={`${formatNumber(kpis.scrapPctAfter, 2)}%`} share={kpis.scrapPctAfter / kpis.scrapPctBefore} accent />
        </div>
        <div>
          <div className="th">Scrap cost</div>
          <Bar label="Entered plans" value={formatMoney(kpis.scrapCostBefore, kpis.currency)} share={1} />
          <Bar label="Recommended plans" value={formatMoney(kpis.scrapCostAfter, kpis.currency)} share={kpis.scrapCostAfter / kpis.scrapCostBefore} accent />
        </div>
      </div>
      <div className="lb" style={{ marginTop: 14, fontSize: 13.5 }}>Modeled, one held-out month. Not a measured saving.</div>
    </Card>
  );
}

const WORDS = ["No", "One", "Two", "Three"];

/** The kraft card: the setting changes of the newest stored plan. */
export function SettingsCard({ lot }: { lot?: LiveLot }) {
  const changes = lot?.changes ?? [];
  return (
    <section className="cd kr c4" aria-labelledby="in-settings-title">
      <div className="ct">
        <h2 className="t" id="in-settings-title" style={{ margin: 0 }}>{lot ? `${WORDS[changes.length] ?? changes.length} ${changes.length === 1 ? "setting" : "settings"} changed` : "Settings changed"}</h2>
      </div>
      {lot
        ? (
          <>
            <div style={{ fontSize: 15 }}>
              {changes.map((change) => (
                <div key={change.lever} className="kv" style={{ padding: "6px 0" }}><span>{leverLabel(change.lever)}</span><b className="n">{leverChange(change)}</b></div>
              ))}
            </div>
            <div style={{ marginTop: 10, fontSize: 14, color: "var(--mu)" }}>Latest stored plan, {lot.itemCode}, {formatNumber(lot.quantity)} boxes.</div>
          </>
        )
        : <p style={{ margin: 0, fontSize: 15, color: "var(--mu)" }}>No stored plan yet.</p>}
    </section>
  );
}
