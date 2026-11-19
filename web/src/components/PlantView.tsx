// Isometric view of the corrugation line, from printing to bundling.
// Pins mark the stage where a defect risk sits; with no pins the line shows as idle.

export type StageKey = "print" | "facer" | "paste" | "dry" | "cut" | "slot" | "glue" | "qc";
export type StagePin = { stage: StageKey; level: "high" | "watch"; label: string; value: string };

const STAGES: { key: StageKey; label: string; w: number; h: number }[] = [
  { key: "print", label: "Printing", w: 70, h: 46 },
  { key: "facer", label: "Single facer", w: 84, h: 60 },
  { key: "paste", label: "Pasting", w: 64, h: 38 },
  { key: "dry", label: "Drying", w: 96, h: 30 },
  { key: "cut", label: "Cutting & creasing", w: 72, h: 50 },
  { key: "slot", label: "Slotting", w: 58, h: 40 },
  { key: "glue", label: "Stitching & gluing", w: 58, h: 40 },
  { key: "qc", label: "QC & bundling", w: 62, h: 26 },
];
// A flatter projection than true isometric, so the long line fills a wide panel.
const GAP = 26, DEPTH = 56, OX = 92, OY = 128;
const iso = (x: number, y: number, z: number): [number, number] => [OX + x * 1.04 - y * 0.66, OY + x * 0.29 + y * 0.44 - z * 1.15];
const poly = (points: [number, number, number][]) => points.map((p) => iso(...p).map((v) => v.toFixed(1)).join(",")).join(" ");

const layout = (() => {
  let x = 0;
  return STAGES.map((stage) => { const placed = { ...stage, x }; x += stage.w + GAP; return placed; });
})();
const LINE_END = layout.at(-1)!.x + layout.at(-1)!.w;

export function PlantView({ pins = [] }: { pins?: StagePin[] }) {
  const pinFor = (key: StageKey) => pins.find((p) => p.stage === key);
  return (
    <svg viewBox="0 0 900 430" className="h-auto w-full" role="img" aria-label="Corrugation line from printing to bundling, with risk pins by stage">
      <defs>
        <radialGradient id="pv-glow" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.10" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="900" height="430" fill="url(#pv-glow)" />
      {/* floor and grid */}
      <polygon points={poly([[-40, -40, 0], [LINE_END + 40, -40, 0], [LINE_END + 40, 110, 0], [-40, 110, 0]])} fill="var(--iso-floor)" stroke="var(--line)" />
      {Array.from({ length: Math.floor((LINE_END + 80) / 40) + 1 }, (_, i) => -40 + i * 40).map((gx) => (
        <line key={`gx${gx}`} x1={iso(gx, -40, 0)[0]} y1={iso(gx, -40, 0)[1]} x2={iso(gx, 110, 0)[0]} y2={iso(gx, 110, 0)[1]} stroke="var(--line)" strokeOpacity="0.55" />
      ))}
      {[-10, 20, 50, 80].map((gy) => (
        <line key={`gy${gy}`} x1={iso(-40, gy, 0)[0]} y1={iso(-40, gy, 0)[1]} x2={iso(LINE_END + 40, gy, 0)[0]} y2={iso(LINE_END + 40, gy, 0)[1]} stroke="var(--line)" strokeOpacity="0.55" />
      ))}
      {/* conveyor */}
      <polygon points={poly([[-24, 20, 6], [LINE_END + 24, 20, 6], [LINE_END + 24, 36, 6], [-24, 36, 6]])} fill="var(--line-strong)" />
      <polygon points={poly([[-24, 36, 0], [LINE_END + 24, 36, 0], [LINE_END + 24, 36, 6], [-24, 36, 6]])} fill="var(--iso-left)" />
      {/* machines */}
      {layout.map((m, i) => {
        const pin = pinFor(m.key);
        const tone = pin ? (pin.level === "high" ? "var(--bad)" : "var(--warn)") : undefined;
        const [lx, ly] = iso(m.x + m.w / 2, DEPTH + (i % 2 === 0 ? 26 : 50), 0);
        return (
          <g key={m.key}>
            <polygon points={poly([[m.x, DEPTH, 0], [m.x + m.w, DEPTH, 0], [m.x + m.w, DEPTH, m.h], [m.x, DEPTH, m.h]])} fill="var(--iso-left)" stroke="var(--line-strong)" strokeWidth="0.75" />
            <polygon points={poly([[m.x + m.w, 0, 0], [m.x + m.w, DEPTH, 0], [m.x + m.w, DEPTH, m.h], [m.x + m.w, 0, m.h]])} fill="var(--iso-right)" stroke="var(--line-strong)" strokeWidth="0.75" />
            <polygon points={poly([[m.x, 0, m.h], [m.x + m.w, 0, m.h], [m.x + m.w, DEPTH, m.h], [m.x, DEPTH, m.h]])}
              fill={tone ?? "var(--iso-top)"} fillOpacity={tone ? 0.28 : 1} stroke={tone ?? "var(--line-strong)"} strokeWidth={tone ? 1.5 : 0.75} />
            {/* panel strip and status light on the front face */}
            <polygon points={poly([[m.x + 8, DEPTH, m.h * 0.55], [m.x + m.w - 8, DEPTH, m.h * 0.55], [m.x + m.w - 8, DEPTH, m.h * 0.55 + 5], [m.x + 8, DEPTH, m.h * 0.55 + 5]])} fill="var(--line-strong)" />
            <circle cx={iso(m.x + 10, DEPTH, m.h - 8)[0]} cy={iso(m.x + 10, DEPTH, m.h - 8)[1]} r="2.6" fill={tone ?? "var(--good)"} />
            <text x={lx} y={ly + 4} textAnchor="middle" fontSize="11" fill="var(--muted)">
              <tspan fill="var(--faint)">{i + 1} </tspan>{m.label}
            </text>
          </g>
        );
      })}
      {/* risk pins, drawn last so they sit above the machines */}
      {layout.map((m) => {
        const pin = pinFor(m.key);
        if (!pin) return null;
        const tone = pin.level === "high" ? "var(--bad)" : "var(--warn)";
        const [bx, by] = iso(m.x + m.w / 2, DEPTH / 2, m.h);
        const top = by - 58;
        return (
          <g key={`pin-${m.key}`}>
            <line x1={bx} y1={by} x2={bx} y2={top + 12} stroke={tone} strokeWidth="1.5" strokeDasharray="3 3" />
            <circle cx={bx} cy={top} r="12" fill={tone} fillOpacity="0.18" stroke={tone} strokeWidth="1.5">
              <animate attributeName="r" values="12;15;12" dur="2.4s" repeatCount="indefinite" />
            </circle>
            <circle cx={bx} cy={top} r="4.5" fill={tone} />
            <g transform={`translate(${bx + 18} ${top - 13})`}>
              <rect width={Math.max(pin.label.length, pin.value.length) * 6.6 + 20} height="36" rx="8" fill="var(--panel)" stroke={tone} strokeOpacity="0.6" />
              <text x="10" y="15" fontSize="11" fill="var(--muted)">{pin.label}</text>
              <text x="10" y="29" fontSize="12.5" fontWeight="600" fill="var(--text)">{pin.value}</text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}
