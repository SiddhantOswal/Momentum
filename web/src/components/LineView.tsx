// The corrugation line as a real-looking machine (an illustrative render made with Gemini on
// Vertex AI), with pins on the stations and callouts for what to change or watch at each one.
import type { Defect } from "../lib/api";

export type StationKey = "reel" | "facer" | "glue" | "backer" | "cutter" | "stack";
export type Callout = { station: StationKey; title: string; from?: string; to: string; tone: "accent" | "bad" | "warn" };

// Station anchors as % of the render (1536 × 672).
export const STATIONS: Record<StationKey, { label: string; x: number; y: number }> = {
  reel: { label: "Reel stand", x: 19, y: 58 },
  facer: { label: "Single facer", x: 35, y: 51 },
  glue: { label: "Glue station", x: 45, y: 56 },
  backer: { label: "Double backer", x: 62, y: 33 },
  cutter: { label: "Cutter & creaser", x: 79, y: 23 },
  stack: { label: "Stacker & print", x: 88, y: 17 },
};
export const STATION_OF_LEVER: Record<string, StationKey> = {
  sfSpeedMpm: "facer", rollTempC: "facer", gumViscositySec: "facer",
  gumApplication: "glue", pastingPressure: "glue", dryingHours: "backer", printSpeedSpm: "stack",
};
export const STATION_OF_DEFECT: Record<Defect, StationKey> = { WARP: "backer", DELAM: "glue", STRENGTH: "facer", PRINT: "stack", CRACK: "cutter" };

const TONE = { accent: "var(--accent)", bad: "var(--bad)", warn: "var(--warn)" };
const BOX_W = 23; // callout width, % of the view

// Callouts for left-side stations sit above the line, right-side ones below, spread so they never overlap.
function place(callouts: Callout[]) {
  const above = callouts.filter((c) => STATIONS[c.station].y > 40).sort((a, b) => STATIONS[a.station].x - STATIONS[b.station].x);
  const below = callouts.filter((c) => STATIONS[c.station].y <= 40).sort((a, b) => STATIONS[a.station].x - STATIONS[b.station].x);
  const spread = (list: Callout[], from: number, to: number, y: number) => list.map((c, i) => {
    const slots = Math.max(list.length, 1);
    const ideal = STATIONS[c.station].x - BOX_W / 2;
    const left = Math.min(Math.max(list.length === 1 ? ideal : from + (i * (to - from - BOX_W)) / Math.max(slots - 1, 1), from), to - BOX_W);
    return { ...c, left, top: y, above: y < 40 };
  });
  return [...spread(above, 2, 58, 5), ...spread(below, 44, 98, 74)];
}

export function LineView({ callouts, caption }: { callouts: Callout[]; caption?: string }) {
  const placed = place(callouts.slice(0, 4));
  const pinned = new Set(placed.map((c) => c.station));
  return (
    <div className="relative overflow-hidden rounded-[6px] border border-line bg-[#111110]" style={{ aspectRatio: "1536 / 672" }}>
      <img src="/app/line/corrugator.jpg" alt="Corrugation line: reel stand, single facer, glue station, double backer, cutter and stacker" className="absolute inset-0 h-full w-full object-cover" />
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at 55% 45%, transparent 55%, rgba(10,11,12,0.55) 100%)" }} />
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 43.75" preserveAspectRatio="none" aria-hidden="true">
        {placed.map((c) => {
          const s = STATIONS[c.station];
          const ax = s.x, ay = (s.y / 100) * 43.75;
          const bx = c.left + BOX_W / 2, by = ((c.above ? c.top + 13 : c.top) / 100) * 43.75;
          return <polyline key={c.station + c.title} points={`${ax},${ay} ${ax},${(ay + by) / 2} ${bx},${(ay + by) / 2} ${bx},${by}`} fill="none" stroke={TONE[c.tone]} strokeWidth="0.12" strokeDasharray="0.5 0.4" opacity="0.9" />;
        })}
      </svg>
      {(Object.keys(STATIONS) as StationKey[]).map((key) => {
        const s = STATIONS[key];
        const tone = placed.find((c) => c.station === key)?.tone;
        return (
          <span key={key} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${s.x}%`, top: `${s.y}%` }}>
            {tone ? (
              <span className="relative flex h-4 w-4 items-center justify-center">
                <span className="absolute h-4 w-4 animate-ping rounded-full opacity-40" style={{ background: TONE[tone] }} />
                <span className="h-2.5 w-2.5 rounded-full ring-2 ring-black/40" style={{ background: TONE[tone] }} />
              </span>
            ) : <span className="block h-1.5 w-1.5 rounded-full bg-white/35" title={s.label} />}
          </span>
        );
      })}
      {placed.map((c) => (
        <div key={`box-${c.station}-${c.title}`} className="absolute rounded-[4px] border bg-[rgba(14,15,16,0.86)] px-3 py-2 backdrop-blur-sm"
          style={{ left: `${c.left}%`, top: `${c.top}%`, width: `${BOX_W}%`, borderColor: `color-mix(in srgb, ${TONE[c.tone]} 45%, transparent)` }}>
          <p className="mono truncate text-[10px] uppercase tracking-[0.12em] text-[#9aa3a8]">{STATIONS[c.station].label} · {c.title}</p>
          <p className="figure mt-1 truncate text-[19px] text-[#eef1f2]">
            {c.from !== undefined && <><span>{c.from}</span><span className="mx-1.5 text-[#6d767b]">→</span></>}
            <span style={{ color: TONE[c.tone] }}>{c.to}</span>
          </p>
        </div>
      ))}
      <p className="mono absolute bottom-2.5 right-3 text-[10px] uppercase tracking-[0.1em] text-[#6d767b]">{caption ?? "Illustrative line"}</p>
      {!pinned.size && <p className="mono absolute left-3 top-3 text-[10px] uppercase tracking-[0.12em] text-[#9aa3a8]">Line 1 · Corrugator</p>}
    </div>
  );
}
