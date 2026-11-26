import { useEffect, useRef, useState, type ReactNode } from "react";
import { ROUTES, type RouteDef } from "../routes";
import { getJson } from "../lib/api";
import { ArcLauncher, ArcPanel } from "../components/ArcPanel";
import { BellPath, DotStatus, Icon, SunIcon } from "./icons";
import type { Theme } from "../lib/useApp";

type Status = { backendReachable?: boolean; syntheticOnlyModeEnabled?: boolean };
type Backend = { state: "checking" | "connected" | "unavailable"; synthetic: boolean };

function useBackendStatus(): Backend {
  const [backend, setBackend] = useState<Backend>({ state: "checking", synthetic: false });
  useEffect(() => {
    const controller = new AbortController();
    getJson<Status>("/api/status", controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setBackend(result.ok && result.data.backendReachable
        ? { state: "connected", synthetic: result.data.syntheticOnlyModeEnabled === true }
        : { state: "unavailable", synthetic: false });
    });
    return () => controller.abort();
  }, []);
  return backend;
}

function Sidebar({ current, onNavigate, theme, onToggleTheme }: {
  current: RouteDef; onNavigate: (route: RouteDef) => void; theme: Theme; onToggleTheme: () => void;
}) {
  const link = (route: RouteDef) => (
    <a key={route.key} className="nav-item" href={`#${route.path}`}
      aria-current={route.key === current.key ? "page" : undefined}
      onClick={(event) => { event.preventDefault(); onNavigate(route); }}>
      <Icon path={route.icon} />{route.label}
    </a>
  );
  return (
    <aside className="sidebar">
      <img className="sidebar-brand" src="/app/brand/logo-momentum.jpg" alt="Momentum" />
      <nav aria-label="Main">
        {ROUTES.filter((route) => route.group === "main").map(link)}
        <div className="nav-group">Future</div>
        {ROUTES.filter((route) => route.group === "future").map(link)}
      </nav>
      <button type="button" className="theme-switch" aria-pressed={theme === "light"} onClick={onToggleTheme}>
        <SunIcon /><span>Light theme</span><span className="theme-switch-track" aria-hidden="true" />
      </button>
      <div className="session-note"><strong>Supervisor session</strong>Demo access only.</div>
    </aside>
  );
}

export function Shell({ route, onNavigate, theme, onToggleTheme, children }: {
  route: RouteDef; onNavigate: (route: RouteDef) => void; theme: Theme; onToggleTheme: () => void; children: ReactNode;
}) {
  const backend = useBackendStatus();
  const arcPanel = useRef<HTMLDialogElement>(null);
  const [arcOpen, setArcOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  function toggleArc() {
    const panel = arcPanel.current;
    if (!panel) return;
    if (panel.open) {
      panel.close();
    } else {
      panel.showModal();
      setArcOpen(true);
    }
  }

  return (
    <div className="shell">
      <Sidebar current={route} onNavigate={onNavigate} theme={theme} onToggleTheme={onToggleTheme} />
      <div className="main">
        <header className="topbar">
          <div className="breadcrumb">Plant / <strong>{route.title}</strong></div>
          <ArcLauncher open={arcOpen} onToggle={toggleArc} />
          <div className="topbar-end">
            <button type="button" className="icon-button" aria-label="Alerts"><Icon path={BellPath} /></button>
            <span className={`status ${backend.state === "connected" ? "status-ok" : backend.state === "unavailable" ? "status-bad" : "status-idle"}`}
              role="status" style={{ fontSize: 14 }}>
              <DotStatus />
              {backend.state === "connected" ? "Backend connected" : backend.state === "unavailable" ? "Backend unavailable" : "Checking backend"}
            </span>
            {backend.synthetic && <span className="chip chip-modeled"><i />Synthetic demonstration</span>}
          </div>
        </header>
        <main id="content">{children}</main>
      </div>
      <ArcPanel ref={arcPanel} open={arcOpen} onNavigate={key => { const target = ROUTES.find(route => route.key === key); if (target) onNavigate(target); }} hostTitle={route.title} showHistory={showHistory}
        onToggleHistory={() => setShowHistory((value) => !value)}
        onClose={() => { setArcOpen(false); setShowHistory(false); }} />
    </div>
  );
}
