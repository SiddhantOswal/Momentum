import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Droplets, Thermometer, Layers3, FileText, ClipboardCheck, BadgeCheck, ScanSearch, PencilLine } from "lucide-react";
import { PlantView, type StagePin, type StageKey } from "../components/PlantView";
import { Delta, Empty, Kpi, Panel, Skeleton, Tag } from "../components/ui";
import { DEFECTS, formatMoney, formatNumber, type Conditions, type Defect, type ImpactSummary } from "../lib/api";
import { useResource } from "../lib/useApp";
import { timeAgo, useLive, type LiveEvent, type LiveState } from "../lib/live";

const EVENT_ICON: Record<string, typeof FileText> = { "order.read": FileText, "lot.planned": ClipboardCheck, "lot.approved": BadgeCheck, "defect.logged": ScanSearch, "feedback.saved": PencilLine };

export function LiveDot({ status }: { status: LiveState["status"] }) {
  const tone = status === "live" ? "bg-good" : status === "connecting" ? "bg-warn" : "bg-bad";
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] text-muted">
      <i className={`h-2 w-2 rounded-full ${tone} ${status === "live" ? "animate-pulse" : ""}`} />
      {status === "live" ? "Live" : status === "connecting" ? "Connecting" : "Offline"}
    </span>
  );
}

function Feed({ events }: { events: LiveEvent[] }) {
  if (!events.length) return <Empty title="Nothing on the line yet" hint="Orders read, lots planned and approvals appear here as they happen." />;
  return (
    <ol className="flex flex-col">
      {events.slice(0, 12).map((e, i) => {
        const Icon = EVENT_ICON[e.type] ?? FileText;
        return (
          <li key={`${e.at}-${i}`} className="flex gap-3 border-b border-line py-3 last:border-0">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent"><Icon size={14} strokeWidth={1.9} aria-hidden="true" /></span>
            <div className="min-w-0">
              <p className="text-[13px] leading-snug text-text">{e.text}</p>
              <p className="mt-0.5 text-[11.5px] text-faint">{timeAgo(e.at)}{e.actor ? ` · ${e.actor}` : ""}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// Where on the line each defect shows up.
const STAGE_OF: Record<Defect, StageKey> = { WARP: "dry", DELAM: "paste", STRENGTH: "facer", PRINT: "print", CRACK: "cut" };
const SEASON_OF_MONTH = ["Winter", "Winter", "Summer", "Summer", "Summer", "Monsoon", "Monsoon", "Monsoon", "Monsoon", "Post-monsoon", "Post-monsoon", "Winter"];

type Season = ImpactSummary["seasonal"][number];
function currentSeason(seasonal: Season[]): Season | undefined {
  const name = SEASON_OF_MONTH[new Date().getMonth()].toLowerCase();
  return seasonal.find((s) => s.season.toLowerCase() === name) ?? seasonal.find((s) => s.season.toLowerCase().includes(name.split("-")[0])) ?? seasonal[0];
}
const seasonRates = (season: Season) => DEFECTS.map((d) => ({ ...d, rate: season[d.key.toLowerCase() as keyof Omit<Season, "season">] as number }));

const tooltipStyle = { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, color: "var(--text)", fontSize: 12 };

export function Floor() {
  const impact = useResource<ImpactSummary>("/impact/summary");
  const conditions = useResource<Conditions>("/conditions/current");
  const summary = impact.result?.ok ? impact.result.data : undefined;
  const season = summary ? currentSeason(summary.seasonal) : undefined;
  const rates = season ? seasonRates(season).sort((a, b) => b.rate - a.rate) : [];
  const live = useLive();
  // Pins follow the latest planned lot; with no lot on the line they show this season's typical risk.
  const activeLot = live.view.lots.find((l) => (l.status === "planned" || l.status === "approved" || l.status === "running") && l.ratesPct);
  const lotRates = activeLot ? DEFECTS.map((d) => ({ ...d, rate: activeLot.ratesPct?.[d.key] ?? 0 })).sort((a, b) => b.rate - a.rate) : [];
  const pins: StagePin[] = activeLot
    ? lotRates.slice(0, 2).map((d, i) => ({ stage: STAGE_OF[d.key], level: i === 0 ? "high" : "watch", label: `${d.label} · ${activeLot.itemCode}`, value: `${formatNumber(d.rate, 2)}% predicted` }))
    : rates.slice(0, 2).map((d, i) => ({ stage: STAGE_OF[d.key], level: i === 0 ? "high" : "watch", label: `${d.label} · ${season!.season}`, value: `${formatNumber(d.rate, 2)}% typical` }));
  const k = summary?.kpis;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-5">
        <Panel title="Line 1 · Corrugation" action={activeLot ? <Tag tone="accent">Risk by stage · lot {activeLot.itemCode}</Tag> : season && <Tag tone="accent">Risk by stage · {season.season}</Tag>} pad={false}>
          <div className="px-3 pb-2">
            {impact.loading && !summary ? <Skeleton className="m-3 h-[360px]" /> : <PlantView pins={pins} />}
          </div>
          <footer className="flex flex-wrap items-center gap-4 border-t border-line px-5 py-3 text-[12px] text-muted">
            <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-bad" />Highest risk now</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-warn" />Watch</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-good" />Running normally</span>
            <span className="ml-auto text-faint">{activeLot ? "Predicted by the five defect models" : "Seasonal averages from our lot history"}</span>
          </footer>
        </Panel>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {k ? (
            <>
              <Kpi label="Predicted savings" value={formatMoney(k.netSavingMonth, k.currency)} unit="/ month" foot="on a held-out month" />
              <Kpi label="Scrap rate with Momentum" value={formatNumber(k.scrapPctAfter, 2)} unit="%" delta={<Delta value={k.scrapPctAfter - k.scrapPctBefore} unit=" pts" />} foot={`from ${formatNumber(k.scrapPctBefore, 2)}%`} />
              <Kpi label="Board saved" value={formatNumber(k.kgSavedMonth)} unit="kg / month" foot="predicted" />
              <Kpi label="Lots checked" value={formatNumber(k.lotsScored)} foot={`${formatNumber(k.lotsChanged)} with better settings`} />
            </>
          ) : impact.result && !impact.result.ok ? (
            <div className="sm:col-span-2 lg:col-span-4"><Empty title="Impact numbers are unavailable" hint={impact.result.error} /></div>
          ) : (
            Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[112px]" />)
          )}
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Panel title="Scrap rate by month">
            {summary?.monthly.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={summary.monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="floor-scrap" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: "var(--faint)", fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
                  <YAxis tick={{ fill: "var(--faint)", fontSize: 11 }} tickLine={false} axisLine={false} unit="%" width={44} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${formatNumber(Number(v), 2)}%`, "Scrap"]} />
                  <Area type="monotone" dataKey="avgScrapPct" stroke="var(--accent)" strokeWidth={2} fill="url(#floor-scrap)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : summary ? <Empty title="No monthly history yet" /> : <Skeleton className="h-[220px]" />}
          </Panel>
          <Panel title={season ? `Defects this season · ${season.season}` : "Defects this season"}>
            {rates.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={rates} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="short" tick={{ fill: "var(--faint)", fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: "var(--faint)", fontSize: 11 }} tickLine={false} axisLine={false} unit="%" width={44} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--raised)" }} formatter={(v) => [`${formatNumber(Number(v), 2)}%`, "Typical scrap"]} />
                  <Bar dataKey="rate" radius={[6, 6, 0, 0]} maxBarSize={36}>
                    {rates.map((r, i) => <Cell key={r.key} fill={i === 0 ? "var(--accent)" : "var(--line-strong)"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : summary ? <Empty title="No seasonal history yet" /> : <Skeleton className="h-[220px]" />}
          </Panel>
        </div>
      </div>

      <aside className="flex flex-col gap-5">
        <Panel title="Conditions now" action={conditions.result?.ok && <Tag>{conditions.result.data.sensorSource === "simulated" ? "Plant feed" : "Last reading"}</Tag>}>
          {conditions.result?.ok ? (
            <dl className="grid gap-3">
              {[
                { Icon: Droplets, label: "Humidity", value: `${formatNumber(conditions.result.data.data.ambientRhPct, 1)}%` },
                { Icon: Thermometer, label: "Temperature", value: `${formatNumber(conditions.result.data.data.ambientTempC, 1)} °C` },
                { Icon: Layers3, label: "Paper moisture", value: `${formatNumber(conditions.result.data.data.paperMoisturePct, 1)}%` },
              ].map(({ Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3 rounded-xl bg-panel-2 px-3.5 py-3">
                  <Icon size={17} strokeWidth={1.75} className="text-accent" aria-hidden="true" />
                  <dt className="text-[13px] text-muted">{label}</dt>
                  <dd className="num ml-auto text-[17px] font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          ) : conditions.loading ? <Skeleton className="h-[170px]" /> : <Empty title="No plant reading yet" hint={conditions.result && !conditions.result.ok && conditions.result.status === 401 ? "Sign in to see the latest plant reading." : "Readings appear here once the plant feed reports."} />}
        </Panel>
        <Panel title="Live feed" action={<LiveDot status={live.status} />} className="flex-1">
          <Feed events={live.view.events} />
        </Panel>
      </aside>
    </div>
  );
}
