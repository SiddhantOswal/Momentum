import type { ReactNode } from "react";
import { Factory, Layers, ScanSearch, TrendingUp, BrainCircuit, Sun, Moon } from "lucide-react";
import type { Screen, Theme } from "../lib/useApp";

const NAV: { key: Screen; label: string; Icon: typeof Factory }[] = [
  { key: "floor", label: "Floor", Icon: Factory },
  { key: "lots", label: "Lots", Icon: Layers },
  { key: "defects", label: "Defects", Icon: ScanSearch },
  { key: "impact", label: "Impact", Icon: TrendingUp },
  { key: "models", label: "Models", Icon: BrainCircuit },
];

function Mark() {
  return (
    <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden="true">
      <rect x="1.5" y="1.5" width="29" height="29" rx="5" fill="none" stroke="var(--accent)" strokeWidth="1.5" />
      <path d="M9 21V11l7 6 7-6v10" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="square" strokeLinejoin="miter" />
    </svg>
  );
}

export function Shell({ screen, go, theme, toggleTheme, title, subtitle, status, children }: {
  screen: Screen; go: (s: Screen) => void; theme: Theme; toggleTheme: () => void;
  title: string; subtitle?: string; status?: ReactNode; children: ReactNode;
}) {
  return (
    <div className="flex min-h-full">
      <nav aria-label="Main" className="sticky top-0 flex h-screen w-16 shrink-0 flex-col items-center border-r border-line bg-[var(--sb)]">
        <a href="#/floor" aria-label="Momentum home" className="flex h-16 w-full items-center justify-center border-b border-line"><Mark /></a>
        <div className="flex w-full flex-col pt-2">
          {NAV.map(({ key, label, Icon }) => {
            const active = key === screen;
            return (
              <button key={key} type="button" onClick={() => go(key)} aria-current={active ? "page" : undefined} title={label}
                className={`relative flex h-14 w-full flex-col items-center justify-center gap-1 transition-colors ${active ? "text-text" : "text-muted hover:text-text"}`}>
                {active && <i className="absolute left-0 top-2 bottom-2 w-[2px] bg-accent" />}
                <Icon size={18} strokeWidth={1.6} aria-hidden="true" />
                <span className="mono text-[9.5px] uppercase tracking-[0.08em]">{label}</span>
              </button>
            );
          })}
        </div>
        <div className="flex-1" />
        <button type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} title="Theme"
          className="mb-3 flex h-10 w-10 items-center justify-center text-faint hover:text-text">
          {theme === "dark" ? <Sun size={17} strokeWidth={1.6} /> : <Moon size={17} strokeWidth={1.6} />}
        </button>
      </nav>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur">
          <div className="flex h-[var(--arc-topbar-height)] items-center justify-between gap-6 px-[var(--arc-content-padding)]">
            <div className="flex min-w-0 items-baseline gap-4">
              <h1 className="arc-page-title truncate">{title}</h1>
              {subtitle && <p className="hidden truncate text-[13px] text-muted md:block">{subtitle}</p>}
            </div>
            <span className="mono hidden text-[11px] tracking-[0.2em] text-faint sm:block">MOMENTUM</span>
          </div>
          {status}
        </header>
        <main id="main" className="flex-1 px-[var(--arc-content-padding)] py-5">{children}</main>
      </div>
    </div>
  );
}
