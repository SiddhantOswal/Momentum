import { Card, ProvenanceChip } from "../../components/m";
import { formatMoney, formatNumber, type Result } from "../../lib/api";
import { monthName, type ImpactResponse } from "../insights/Impact";

/** The first-screen headline: the recorded held-out month, read from /impact/summary. When the
 * route cannot be read nothing is drawn, so Home never shows a placeholder where a figure belongs. */
export function ImpactStrip({ impact }: { impact?: Result<ImpactResponse> }) {
  if (!impact?.ok) return null;
  const { kpis, counterfactual } = impact.data;
  const month = monthName(counterfactual?.month);
  const figures: [string, string, string][] = [
    ["Scrap cost, modeled reduction", formatMoney(kpis.netSavingMonth, kpis.currency), "Net, in one held-out month"],
    ["Board, modeled reduction", `${formatNumber(kpis.kgSavedMonth)} kg`, "In one held-out month"],
    ["Scrap rate, modeled", `${formatNumber(kpis.scrapPctBefore, 2)}% → ${formatNumber(kpis.scrapPctAfter, 2)}%`, "Entered plans to recommended plans"],
    ["Lots with changed settings", `${formatNumber(kpis.lotsChanged)} of ${formatNumber(kpis.lotsScored)}`, "Lots scored"],
  ];
  return (
    <Card title={month ? `What the recommendations did, ${month}` : "What the recommendations did"} meta={<ProvenanceChip kind="model-estimate" />} span={12} className="hm-impact">
      <ul className="hm-impact-figs">
        {figures.map(([label, value, sub]) => (
          <li key={label}><div className="lb">{label}</div><div className="n">{value}</div><div className="lb">{sub}</div></li>
        ))}
      </ul>
      <div className="lb" style={{ marginTop: 14, fontSize: 13.5 }}>Modeled on one held-out month of past lots. A model estimate, not a measured result.</div>
    </Card>
  );
}
