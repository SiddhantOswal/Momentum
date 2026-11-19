import { useEffect, useState } from "react";
import { conditionsPath, currentShift, formatNumber, getJson, type Conditions } from "../lib/api";
import { useLive } from "../lib/live";

type Weather = { ambientRhPct: number; ambientTempC: number; observedAt: string };

// A control-room status line: line state, shift, live weather and plant reading, lots today, sync.
export function StatusStrip() {
  const live = useLive();
  const [weather, setWeather] = useState<Weather>();
  const [plant, setPlant] = useState<Conditions["data"]>();
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const load = () => {
      getJson<Weather>("/conditions/weather").then((r) => { if (r.ok) setWeather(r.data); });
      getJson<Conditions>(conditionsPath()).then((r) => { if (r.ok) setPlant(r.data.data); });
    };
    load();
    const refresh = setInterval(load, 10 * 60 * 1000);
    const tick = setInterval(() => setClock(new Date()), 30 * 1000);
    return () => { clearInterval(refresh); clearInterval(tick); };
  }, []);
  const today = new Date().toISOString().slice(0, 10);
  const lotsToday = live.view.lots.filter((l) => l.updatedAt.slice(0, 10) === today).length;
  const active = live.view.lots.find((l) => l.status === "approved" || l.status === "running" || l.status === "planned");
  const cells: { label: string; value: string; tone?: "good" | "warn" | "bad" | "accent" }[] = [
    { label: "Line 1", value: active ? (active.status === "planned" ? "Lot planned" : "Lot approved") : "Idle", tone: active ? "good" : undefined },
    { label: "Shift", value: currentShift(clock) },
    ...(weather ? [{ label: "Pune weather", value: `${formatNumber(weather.ambientRhPct)}% RH · ${formatNumber(weather.ambientTempC, 1)} °C` }] : []),
    ...(plant ? [{ label: "Plant reading", value: `${formatNumber(plant.ambientRhPct, 1)}% RH · paper ${formatNumber(plant.paperMoisturePct, 1)}%` }] : []),
    { label: "Lots today", value: String(lotsToday) },
    { label: "Sync", value: live.status === "live" ? "Live" : live.status === "connecting" ? "Connecting" : "Offline", tone: live.status === "live" ? "good" : live.status === "connecting" ? "warn" : "bad" },
  ];
  const toneClass = { good: "bg-good", warn: "bg-warn", bad: "bg-bad", accent: "bg-accent" };
  return (
    <div className="flex h-9 items-stretch overflow-x-auto border-t border-line px-6 text-[11.5px]" role="status" aria-label="Line status">
      {cells.map((cell, i) => (
        <div key={cell.label} className={`flex shrink-0 items-center gap-2 pr-5 ${i > 0 ? "border-l border-line pl-5" : ""}`}>
          <span className="label text-[10px]">{cell.label}</span>
          {cell.tone && <i className={`h-1.5 w-1.5 ${toneClass[cell.tone]} ${cell.tone === "good" ? "animate-pulse" : ""}`} />}
          <span className="mono text-text">{cell.value}</span>
        </div>
      ))}
      <div className="ml-auto flex shrink-0 items-center pl-5"><span className="mono text-faint">{clock.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} IST</span></div>
    </div>
  );
}
