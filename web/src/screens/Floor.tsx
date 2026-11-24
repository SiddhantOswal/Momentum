import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LineView, STATION_OF_DEFECT, STATION_OF_LEVER, type Callout } from "../components/LineView";
import { Delta, Empty, Kpi, KpiStrip, Panel, Skeleton, Tag } from "../components/ui";
import { DEFECTS, formatMoney, formatNumber, type ImpactSummary } from "../lib/api";
import { useResource } from "../lib/useApp";
import { timeAgo, useLive, type LiveEvent, type LiveLot } from "../lib/live";

const SEASON_OF_MONTH = ["Winter", "Winter", "Summer", "Summer", "Summer", "Monsoon", "Monsoon", "Monsoon", "Monsoon", "Post-monsoon", "Post-monsoon", "Winter"];
const LEVER_NAME: Record<string, { name: string; unit: string }> = {
  sfSpeedMpm: { name: "Speed", unit: " m/min" }, rollTempC: { name: "Roll temp", unit: " °C" }, gumViscositySec: { name: "Gum viscosity", unit: " s" },
  gumApplication: { name: "Gum", unit: "" }, pastingPressure: { name: "Pressure", unit: "" }, dryingHours: { name: "Drying", unit: " h" }, printSpeedSpm: { name: "Print speed", unit: " /min" },
};
const EVENT_MARK: Record<string, string> = { "order.read": "ORDER", "lot.planned": "PLAN", "lot.approved": "APPROVE", "defect.logged": "DEFECT", "feedback.saved": "ACTUAL" };

type Season = ImpactSummary["seasonal"][number];
function currentSeason(seasonal: Season[]): Season | undefined {
  const name = SEASON_OF_MONTH[new Date().getMonth()].toLowerCase();
  return seasonal.find((s) => s.season.toLowerCase() === name) ?? seasonal.find((s) => s.season.toLowerCase().includes(name.split("-")[0])) ?? seasonal[0];
}
const seasonRates = (season: Season) => DEFECTS.map((d) => ({ ...d, rate: season[d.key.toLowerCase() as keyof Omit<Season, "season">] as number }));
const tooltipStyle = { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 4, color: "var(--text)", fontSize: 12 };
const tick = { fill: "var(--faint)", fontSize: 10.5, fontFamily: "IBM Plex Mono" };

function calloutsFor(lot: LiveLot | undefined, seasonal: { key: string; label: string; rate: number }[], seasonName?: string): { callouts: Callout[]; caption: string } {
  if (lot?.changes?.length) {
    return {
      callouts: lot.changes.filter((c) => STATION_OF_LEVER[c.lever]).map((c) => ({
        station: STATION_OF_LEVER[c.lever], title: LEVER_NAME[c.lever]?.name ?? c.lever,
        from: `${c.from}${LEVER_NAME[c.lever]?.unit ?? ""}`, to: `${c.to}${LEVER_NAME[c.lever]?.unit ?? ""}`, tone: "accent" as const,
      })),
      caption: `Recommended for lot ${lot.itemCode} · illustrative line`,
    };
  }
  const rates = lot?.ratesPct
    ? DEFECTS.filter((d) => lot.ratesPct?.[d.key] !== undefined)
      .map((d) => ({ ...d, rate: lot.ratesPct?.[d.key] ?? 0 })).sort((a, b) => b.rate - a.rate)
    : seasonal;
  return {
    callouts: rates.slice(0, 2).map((d, i) => ({
      station: STATION_OF_DEFECT[d.key as keyof typeof STATION_OF_DEFECT], title: d.label,
      to: `${formatNumber(d.rate, 2)}% ${lot ? "predicted" : "typical"}${lot?.lowConfidence?.includes(d.key) ? ", low confidence" : ""}`, tone: i === 0 ? "bad" as const : "warn" as const,
    })),
    caption: lot ? `Predicted risk for lot ${lot.itemCode} · illustrative line` : `Typical risk in ${seasonName ?? "this season"} · illustrative line`,
  };
}

function Feed({ events }: { events: LiveEvent[] }) {
  if (!events.length) return <Empty title="Nothing on the line yet" hint="Orders read, lots planned and approvals appear here as they happen." />;
  return (
    <ol className="-my-1 flex flex-col">
      {events.slice(0, 10).map((e, i) => (
        <li key={`${e.at}-${i}`} className="grid grid-cols-[64px_1fr] gap-3 border-b border-line py-2.5 last:border-0">
          <span className="mono pt-0.5 text-[10px] tracking-[0.08em] text-accent">{EVENT_MARK[e.type] ?? "EVENT"}</span>
          <div className="min-w-0">
            <p className="text-[13px] leading-snug">{e.text}</p>
            <p className="mono mt-0.5 text-[10.5px] text-faint">{timeAgo(e.at)}{e.actor ? ` · ${e.actor}` : ""}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Floor() {
  const impact = useResource<ImpactSummary>("/impact/summary");
  const live = useLive();
  const summary = impact.result?.ok ? impact.result.data : undefined;
  const season = summary ? currentSeason(summary.seasonal) : undefined;
  const rates = season ? seasonRates(season).sort((a, b) => b.rate - a.rate) : [];
  const activeLot = live.view.lots.find((l) => (l.status === "planned" || l.status === "approved" || l.status === "running") && (l.changes?.length || l.ratesPct));
  const { callouts, caption } = calloutsFor(activeLot, rates, season?.season);
  const k = summary?.kpis;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="label">Line 1 · Corrugator</h2>
        {activeLot ? <Tag tone="accent">Lot {activeLot.itemCode} · {activeLot.status}</Tag> : season && <Tag>Typical risk · {season.season}</Tag>}
      </div>
      <LineView callouts={callouts} caption={caption} />

      {k ? (
        <KpiStrip>
          <Kpi label="Predicted savings" value={formatMoney(k.netSavingMonth, k.currency)} unit="/ month" foot="on a held-out month" accent />
          <Kpi label="Scrap rate" value={formatNumber(k.scrapPctAfter, 2)} unit="%" delta={<Delta value={k.scrapPctAfter - k.scrapPctBefore} unit=" pts" />} foot={`from ${formatNumber(k.scrapPctBefore, 2)}%`} />
          <Kpi label="Board saved" value={formatNumber(k.kgSavedMonth)} unit="kg / month" foot="predicted" />
          <Kpi label="Lots checked" value={formatNumber(k.lotsScored)} foot={`${formatNumber(k.lotsChanged)} with better settings`} />
        </KpiStrip>
      ) : impact.result && !impact.result.ok ? <Panel><Empty title="Impact numbers are unavailable" hint={impact.result.error} /></Panel> : <Skeleton className="h-[118px]" />}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_360px]">
        <Panel title="Scrap rate by month" index="01">
          {summary?.monthly.length ? (
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={summary.monthly} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="floor-scrap" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="month" tick={tick} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={28} />
                <YAxis tick={tick} tickLine={false} axisLine={false} unit="%" width={40} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${formatNumber(Number(v), 2)}%`, "Scrap"]} />
                <Area type="monotone" dataKey="avgScrapPct" stroke="var(--accent)" strokeWidth={1.75} fill="url(#floor-scrap)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : summary ? <Empty title="No monthly history yet" /> : <Skeleton className="h-[210px]" />}
        </Panel>
        <Panel title={season ? `Defects · ${season.season}` : "Defects this season"} index="02">
          {rates.length ? (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={rates} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="short" tick={tick} tickLine={false} axisLine={false} />
                <YAxis tick={tick} tickLine={false} axisLine={false} unit="%" width={40} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--raised)" }} formatter={(v) => [`${formatNumber(Number(v), 2)}%`, "Typical scrap"]} />
                <Bar dataKey="rate" maxBarSize={28}>
                  {rates.map((r, i) => <Cell key={r.key} fill={i === 0 ? "var(--accent)" : "var(--line-strong)"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : summary ? <Empty title="No seasonal history yet" /> : <Skeleton className="h-[210px]" />}
        </Panel>
        <Panel title="Live feed" index="03" action={<Tag tone={live.status === "live" ? "good" : live.status === "connecting" ? "accent" : "bad"}>{live.status}</Tag>}>
          <Feed events={live.view.events} />
        </Panel>
      </div>
    </div>
  );
}
