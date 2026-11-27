import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import logoOnDark from "../assets/logo-on-dark.png";
import logoOnLight from "../assets/logo-on-light.png";
import { useBackendState } from "../lib/backend";
import { href, type NavKey, type Route, type RouteId } from "../lib/routes";
import type { Theme } from "../lib/useApp";
import { ArcLauncher, ArcPanel } from "./arc/ArcPanel";
import { useArcConversation } from "./arc/useArcConversation";
import { Icon, type IconName } from "./m";
import { NotificationBell } from "./Notifications";

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

// Shown only when the server cannot be reached; a working connection needs no label.
function BackendIndicator() {
  const state = useBackendState();
  if (state !== "unreachable") return null;
  return (
    <span className="sx bd" style={{ fontSize: 14 }} role="status">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" /></svg>Backend not reachable
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
  const menuRef = useRef<HTMLButtonElement>(null);
  const menuCloseRef = useRef<HTMLButtonElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const conversation = useArcConversation();

  const closeArc = useCallback(() => {
    setArcOpen(false);
    launcherRef.current?.focus();
  }, []);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    menuRef.current?.focus();
  }, []);

  useEffect(() => { setMenuOpen(false); }, [route.id]);
  useEffect(() => {
    if (!menuOpen) return;
    menuCloseRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") closeMenu(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen, closeMenu]);

  return (
    <div className="m">
      <a className="sr-only skip" href="#main" onClick={(event) => { event.preventDefault(); mainRef.current?.focus(); }}>Skip to content</a>
      <aside id="side-nav" className={`side${menuOpen ? " open" : ""}`} inert={arcOpen}>
        <img className="brand" src={theme === "dark" ? logoOnDark : logoOnLight} alt="Momentum" />
        <button ref={menuCloseRef} type="button" className="bell side-close" aria-label="Close navigation" onClick={closeMenu}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5-7 7 7 7m-7-7h12" /></svg>
        </button>
        <nav aria-label="Main">
          {NAV.map((item) => <NavLink key={item.key} item={item} active={route.nav === item.key} />)}
          <div className="grp" id="nav-future">Future</div>
          <div role="group" aria-labelledby="nav-future">
            {FUTURE.map((item) => <NavLink key={item.key} item={item} active={route.nav === item.key} />)}
          </div>
        </nav>
        <ThemeSwitch theme={theme} toggle={toggleTheme} />
      </aside>
      <div className="main">
        <header className="top">
          <button ref={menuRef} type="button" className="bell menu" aria-label="Menu" aria-expanded={menuOpen} aria-controls="side-nav" onClick={() => setMenuOpen((open) => !open)}>
            <Icon name="menu" />
          </button>
          <div className="bc">Plant / <b>{route.crumb}</b></div>
          <ArcLauncher ref={launcherRef} open={arcOpen} onToggle={() => (arcOpen ? closeArc() : setArcOpen(true))} />
          <div className="tr">
            <NotificationBell key={route.id} disabled={arcOpen} />
            <BackendIndicator />
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
