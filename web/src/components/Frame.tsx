import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import logoOnDark from "../assets/logo-on-dark.png";
import logoOnLight from "../assets/logo-on-light.png";
import { useBackendState } from "../lib/backend";
import { href, type NavKey, type Route, type RouteId } from "../lib/routes";
import type { Theme } from "../lib/useApp";
import { ArcLauncher, ArcPanel } from "./arc/ArcPanel";
import { useArcConversation } from "./arc/useArcConversation";
import { Icon, ProvenanceChip, type IconName } from "./m";

const NAV: { key: NavKey; to: RouteId; label: string; icon: IconName }[] = [
  { key: "home", to: "home", label: "Home", icon: "home" },
  { key: "new-lot", to: "new-lot/order", label: "New Lot", icon: "newLot" },
  { key: "explorer", to: "explorer", label: "Plant Explorer", icon: "explorer" },
  { key: "prep-flow", to: "prep-flow", label: "Preparation Flow", icon: "prepFlow" },
  { key: "insights", to: "insights", label: "Insights", icon: "insights" },
  { key: "photo", to: "photo", label: "Photo Diagnosis", icon: "photo" },
];
const FUTURE: typeof NAV = [{ key: "planning", to: "planning", label: "Planning", icon: "planning" }];

function NavLink({ item, active }: { item: (typeof NAV)[number]; active: boolean }) {
  return (
    <a className={`nv${active ? " on" : ""}`} href={href(item.to)} aria-current={active ? "page" : undefined}>
      <Icon name={item.icon} />{item.label}
    </a>
  );
}

function BackendIndicator() {
  const state = useBackendState();
  // A healthy backend needs no badge; it shows only while checking or when the backend is down.
  if (state === "connected") return null;
  const view = {
    checking: { tone: "id", text: "Checking backend" },
    connected: { tone: "ok", text: "Backend connected" },
    unreachable: { tone: "bd", text: "Backend not reachable" },
  }[state];
  return (
    <span className={`sx ${view.tone}`} style={{ fontSize: 14 }} role="status">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" /></svg>{view.text}
    </span>
  );
}

/** The sidebar's "Light theme" switch; pressed means the light theme is on. */
export function ThemeSwitch({ theme, toggle, style }: { theme: Theme; toggle: () => void; style?: CSSProperties }) {
  return (
    <button type="button" className="thm" aria-pressed={theme === "light"} onClick={toggle} style={style}>
      <Icon name="sun" /><span>Light theme</span><span className="sw" aria-hidden="true" />
    </button>
  );
}

/** Sidebar, top bar and the Arc workspace shared by every dashboard page. */
export function Frame({ route, theme, toggleTheme, children }: { route: Route; theme: Theme; toggleTheme: () => void; children: ReactNode }) {
  const [arcOpen, setArcOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const conversation = useArcConversation();

  const closeArc = useCallback(() => {
    setArcOpen(false);
    launcherRef.current?.focus();
  }, []);

  useEffect(() => { setMenuOpen(false); }, [route.id]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <div className="m">
      <a className="sr-only skip" href="#main" onClick={(event) => { event.preventDefault(); mainRef.current?.focus(); }}>Skip to content</a>
      <aside id="side-nav" className={`side${menuOpen ? " open" : ""}`} inert={arcOpen}>
        <img className="brand" src={theme === "dark" ? logoOnDark : logoOnLight} alt="Momentum" />
        <nav aria-label="Main">
          {NAV.map((item) => <NavLink key={item.key} item={item} active={route.nav === item.key} />)}
          <div className="grp" id="nav-future">Future</div>
          <div role="group" aria-labelledby="nav-future">
            {FUTURE.map((item) => <NavLink key={item.key} item={item} active={route.nav === item.key} />)}
          </div>
        </nav>
        <ThemeSwitch theme={theme} toggle={toggleTheme} />
        <div className="sess"><b>Supervisor session</b>Demo access only.</div>
      </aside>
      <div className="main">
        <header className="top">
          <button type="button" className="bell menu" aria-label="Menu" aria-expanded={menuOpen} aria-controls="side-nav" onClick={() => setMenuOpen((open) => !open)}>
            <Icon name="menu" />
          </button>
          <div className="bc"><b>{route.crumb}</b></div>
          <ArcLauncher ref={launcherRef} open={arcOpen} onToggle={() => (arcOpen ? closeArc() : setArcOpen(true))} />
          <div className="tr">
            {/* No alert feed exists yet, so the bell is shown as designed but cannot be used. */}
            <button type="button" className="bell" aria-label="Alerts, not connected yet" disabled>
              <Icon name="bell" />
            </button>
            <BackendIndicator />
            <ProvenanceChip kind="prototype-data" />
          </div>
        </header>
        <main id="main" ref={mainRef} tabIndex={-1} inert={arcOpen} style={{ outline: "none" }}>
          {children}
        </main>
      </div>
      {arcOpen && (
        <>
          <div className="scr" aria-hidden="true" onClick={closeArc} />
          <ArcPanel hostName={route.crumb} conversation={conversation} onClose={closeArc} />
        </>
      )}
    </div>
  );
}
