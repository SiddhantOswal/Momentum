import { formatNumber } from "../../lib/api";
import { LEVERS, type LeverKey } from "../../lib/session";
import type { ConditionSource, JobSheet, PlanResult } from "./api";
import { leverLabel, leverText } from "./parts";

/** The nine stages printed on the card (src/job-sheet-pdf.js), with the settings each one runs. */
const ROUTE: { name: string; levers: LeverKey[] }[] = [
  { name: "Printing", levers: ["printSpeedSpm"] },
  { name: "Single facer", levers: ["sfSpeedMpm", "rollTempC", "gumApplication", "gumViscositySec"] },
  { name: "Sheet cutting", levers: [] },
  { name: "Pasting", levers: ["pastingPressure"] },
  { name: "Drying", levers: ["dryingHours"] },
  { name: "Cut and crease", levers: [] },
  { name: "Slotting", levers: [] },
  { name: "Stitch and glue", levers: [] },
  { name: "QC and bundling", levers: [] },
];

export function RouteOnCard({ sheet }: { sheet: JobSheet }) {
  const changed = new Set(sheet.changes.map((change) => change.lever));
  return (
    <div style={{ borderTop: "1px solid var(--ln)", paddingTop: 12 }}>
      <span className="th" id="nl-route">Route on the card</span>
      <ol className="route" aria-labelledby="nl-route" style={{ listStyle: "none", padding: 0, margin: "10px 0 0" }}>
        {ROUTE.map((stage) => {
          const on = stage.levers.some((lever) => changed.has(lever));
          return <li key={stage.name}><div className={on ? "on" : undefined}>{stage.name}{on && <span className="sr-only">, a setting changes here</span>}</div></li>;
        })}
      </ol>
    </div>
  );
}

const SOURCE_WORDS: Record<ConditionSource, string> = { plant: "confirmed by operator", weather: "weather record", seasonal: "seasonal typical" };

/** The line under the card title: board, quantity and the three conditions with where each came from. */
export function cardSummary(sheet: JobSheet, plan?: PlanResult) {
  const { order, conditions } = sheet;
  const source = (field: "ambientRhPct" | "ambientTempC" | "paperMoisturePct") => {
    const kind = plan?.conditionSources?.[field];
    return kind ? ` (${SOURCE_WORDS[kind]})` : "";
  };
  return `${order.ply}-ply ${order.fluteProfile}, ${formatNumber(order.quantity)} boxes. Humidity ${conditions.ambientRhPct}%${source("ambientRhPct")}, ` +
    `temperature ${conditions.ambientTempC} °C${source("ambientTempC")}, moisture ${conditions.paperMoisturePct}%${source("paperMoisturePct")}.`;
}

/** Every setting on the card with its unit; changed ones show the entered value beside them. */
export function CardSettings({ sheet, columns, dim }: { sheet: JobSheet; columns: string; dim?: boolean }) {
  return (
    <div role="table" aria-label="Settings on the card" className="rt card">
      <div role="row" className="tb h" style={{ gridTemplateColumns: columns, minHeight: 30 }}>
        <span role="columnheader" className="th">Setting</span><span role="columnheader" className="th">Run with</span>
        <span role="columnheader" className="th"><span className="sr-only">Entered</span></span>
      </div>
      {LEVERS.map((lever) => {
        const change = sheet.changes.find((entry) => entry.lever === lever.key);
        const value = sheet.recommended.levers[lever.key];
        return (
          <div role="row" key={lever.key} className="tb" style={{ minHeight: 44, gridTemplateColumns: columns, opacity: dim ? .62 : undefined }}>
            <span role="cell" style={{ fontSize: 16, fontWeight: change ? 600 : 500 }}>{leverLabel(lever.key)}</span>
            <span role="cell" className="n" style={{ fontSize: 19, fontWeight: 600 }}>{leverText(lever.key, value)}</span>
            <span role="cell" className="lb">{change ? `was ${leverText(lever.key, change.from)}` : "Entered value"}</span>
          </div>
        );
      })}
    </div>
  );
}
