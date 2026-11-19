import type { ReactNode } from "react";

export function Panel({ title, action, children, className = "", pad = true }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`panel flex flex-col ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 px-5 pt-4">
          <h2 className="text-[13px] font-medium tracking-wide text-muted">{title}</h2>
          {action}
        </header>
      )}
      <div className={pad ? "flex-1 px-5 pb-5 pt-3" : "flex-1"}>{children}</div>
    </section>
  );
}

export function Delta({ value, unit = "", goodWhen = "down" }: { value: number; unit?: string; goodWhen?: "up" | "down" }) {
  const good = goodWhen === "down" ? value < 0 : value > 0;
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return (
    <span className={`num inline-flex items-center rounded-full px-2 py-0.5 text-[11.5px] font-medium ${good ? "bg-good-soft text-good" : "bg-bad-soft text-bad"}`}>
      {sign}{Math.abs(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}{unit}
    </span>
  );
}

export function Kpi({ label, value, unit, foot, delta }: { label: string; value: ReactNode; unit?: string; foot?: ReactNode; delta?: ReactNode }) {
  return (
    <div className="panel flex flex-col gap-2 px-5 py-4">
      <span className="text-[12.5px] text-muted">{label}</span>
      <div className="flex items-baseline gap-1.5">
        <span className="num text-[28px] font-semibold leading-none text-text">{value}</span>
        {unit && <span className="text-[13px] text-muted">{unit}</span>}
      </div>
      <div className="flex min-h-5 items-center gap-2 text-[12px] text-faint">{delta}{foot}</div>
    </div>
  );
}

export function Tag({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "good" | "bad" }) {
  const tones = { neutral: "border-line text-muted", accent: "border-transparent bg-accent-soft text-accent", good: "border-transparent bg-good-soft text-good", bad: "border-transparent bg-bad-soft text-bad" };
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium ${tones[tone]}`}>{children}</span>;
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex h-full min-h-28 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line px-4 py-6 text-center">
      <span className="text-[13px] text-muted">{title}</span>
      {hint && <span className="text-[12px] text-faint">{hint}</span>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-raised ${className}`} />;
}
