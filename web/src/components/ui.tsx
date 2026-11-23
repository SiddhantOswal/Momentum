import type { ReactNode } from "react";

export function Panel({ title, index, action, children, className = "", pad = true }: { title?: ReactNode; index?: string; action?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`panel flex flex-col ${className}`}>
      {(title || action) && (
        <header className="flex min-h-11 items-center justify-between gap-3 border-b border-line px-4">
          <h2 className="arc-card-title flex items-center gap-2">{index && <span className="text-faint">{index}</span>}{title}</h2>
          {action}
        </header>
      )}
      <div className={pad ? "flex-1 p-4" : "flex-1"}>{children}</div>
    </section>
  );
}

export function Delta({ value, unit = "", goodWhen = "down" }: { value: number; unit?: string; goodWhen?: "up" | "down" }) {
  const good = goodWhen === "down" ? value < 0 : value > 0;
  return (
    <span className={`mono text-[11.5px] ${good ? "text-good" : "text-bad"}`}>
      {value < 0 ? "▼" : value > 0 ? "▲" : "■"} {Math.abs(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}{unit}
    </span>
  );
}

export function Kpi({ label, value, unit, foot, delta, accent }: { label: string; value: ReactNode; unit?: string; foot?: ReactNode; delta?: ReactNode; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      <span className="label">{label}</span>
      <div className="flex items-baseline gap-1.5">
        <span className={`figure text-[34px] ${accent ? "text-accent" : "text-text"}`}>{value}</span>
        {unit && <span className="mono text-[12px] text-muted">{unit}</span>}
      </div>
      <div className="flex min-h-4 items-center gap-2 text-[12px] text-faint">{delta}{foot}</div>
    </div>
  );
}

/** A row of KPIs inside one frame, split by hairlines (reads as one instrument, not four cards). */
export function KpiStrip({ children }: { children: ReactNode }) {
  return <div className="panel grid divide-y divide-line sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x [&>*]:border-line">{children}</div>;
}

export function Tag({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "good" | "bad" }) {
  const tones = { neutral: "text-muted", accent: "text-accent", good: "text-good", bad: "text-bad" };
  const dots = { neutral: "bg-faint", accent: "bg-accent", good: "bg-good", bad: "bg-bad" };
  return (
    <span className={`mono inline-flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.1em] ${tones[tone]}`}>
      <i className={`h-1.5 w-1.5 ${dots[tone]}`} />{children}
    </span>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex h-full min-h-24 flex-col justify-center gap-1 border-l-2 border-line-strong py-2 pl-4">
      <span className="text-[13px] text-muted">{title}</span>
      {hint && <span className="text-[12px] text-faint">{hint}</span>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-raised ${className}`} />;
}
