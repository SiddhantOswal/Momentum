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
    <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="9" fill="var(--accent-soft)" stroke="var(--accent)" strokeOpacity="0.5" />
      <path d="M9 21V11l7 6 7-6v10" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Shell({ screen, go, theme, toggleTheme, title, subtitle, status, children }: {
  screen: Screen; go: (s: Screen) => void; theme: Theme; toggleTheme: () => void;
  title: string; subtitle?: string; status?: ReactNode; children: ReactNode;
}) {
  return (
    <div className="flex min-h-full">
      <nav aria-label="Main" className="sticky top-0 flex h-screen w-[76px] shrink-0 flex-col items-center gap-1 border-r border-line bg-panel py-4">
        <a href="#/floor" aria-label="Momentum home" className="mb-5"><Mark /></a>
        {NAV.map(({ key, label, Icon }) => {
          const active = key === screen;
          return (
            <button key={key} type="button" onClick={() => go(key)} aria-current={active ? "page" : undefined}
              className={`group flex w-[60px] flex-col items-center gap-1 rounded-xl py-2.5 text-[10.5px] transition-colors ${active ? "bg-accent-soft text-accent" : "text-muted hover:bg-raised hover:text-text"}`}>
              <Icon size={19} strokeWidth={1.75} aria-hidden="true" />
              <span>{label}</span>
            </button>
          );
        })}
        <div className="flex-1" />
        <button type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-raised hover:text-text">
          {theme === "dark" ? <Sun size={18} strokeWidth={1.75} /> : <Moon size={18} strokeWidth={1.75} />}
        </button>
      </nav>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-bg/85 px-8 py-4 backdrop-blur">
          <div className="min-w-0">
            <div className="flex items-baseline gap-3">
              <span className="text-[13px] font-semibold tracking-[0.16em] text-text">MOMENTUM</span>
              <span className="text-faint">/</span>
              <h1 className="truncate text-[15px] font-medium text-text">{title}</h1>
            </div>
            {subtitle && <p className="mt-0.5 text-[12.5px] text-muted">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-3">{status}</div>
        </header>
        <main id="main" className="flex-1 px-8 py-6">{children}</main>
      </div>
    </div>
  );
}
