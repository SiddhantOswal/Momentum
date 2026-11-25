import { createContext, useContext, useEffect, useId, useState, type KeyboardEvent, type ReactNode } from "react";
import type { TurnInput } from "../../lib/arc";
import { Button, Icon, IdleMark, NEW_LOT_STEPS, ProvenanceChip, Stepper } from "../m";
import type { WorkingOn } from "./useArcConversation";
import "./arc-screens.css";

/** What a screen inside the panel may do: send a turn, know a turn is running, and name its lot. */
export type ArcScreen = {
  send: (input: TurnInput, asked: string) => void;
  busy: boolean;
  setWorkingOn: (workingOn: WorkingOn | null) => void;
};

export const ArcScreenContext = createContext<ArcScreen>({ send: () => undefined, busy: false, setWorkingOn: () => undefined });
export const useArcScreen = () => useContext(ArcScreenContext);

/** The four New Lot steps: the page stepper at desktop width, bars and "Step n of 4" on a phone (Arc-Phone). */
export function ArcSteps({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <div>
      <Stepper current={current} />
      <div className="stq">
        <div className="bars" aria-hidden="true">
          {NEW_LOT_STEPS.map((name, index) => <i key={name} className={index + 1 < current ? "d" : index + 1 === current ? "c" : ""} />)}
        </div>
        <p>Step {current} of 4 <span>{NEW_LOT_STEPS[current - 1]}</span></p>
      </div>
    </div>
  );
}

export function ScreenHead({ title, sub }: { title: string; sub?: ReactNode }) {
  return (
    <div>
      {/* A focus target (JobFlow) for when the card whose button held focus is replaced by this one. */}
      <h2 className="h1a h1s" tabIndex={-1} data-arc-focus="">{title}</h2>
      {sub && <p className="lb" style={{ margin: "4px 0 0", fontSize: 15 }}>{sub}</p>}
    </div>
  );
}

/** The design's large tick box. A real checkbox underneath, so keyboard and screen readers use it as one. */
export function ReviewCheck({ checked, onChange, disabled, children }: {
  checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean; children: ReactNode;
}) {
  return (
    <label className={`cka${checked ? " on" : ""}`}>
      <input type="checkbox" className="ovl" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <i aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10" /></svg></i>
      <span>{children}</span>
    </label>
  );
}

/** The two-way switch. Left and right arrows move between the tabs, as a tab list does. */
export function Tabs<K extends string>({ label, tabs, selected, onSelect }: {
  label: string; tabs: { key: K; text: ReactNode }[]; selected: K; onSelect: (key: K) => void;
}) {
  const id = useId();
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const index = tabs.findIndex((tab) => tab.key === selected);
    const next = tabs[(index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    onSelect(next.key);
    document.getElementById(`${id}-${next.key}`)?.focus();
  };
  return (
    <div className="seg2" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {tabs.map((tab) => (
        <button key={tab.key} id={`${id}-${tab.key}`} type="button" role="tab" aria-selected={tab.key === selected}
          tabIndex={tab.key === selected ? 0 : -1} onClick={() => onSelect(tab.key)}>{tab.text}</button>
      ))}
    </div>
  );
}

/** A failed or blocked step in plain words, with Try again only when the server marked the step safe to repeat. */
export function Problem({ words, onRetry, retryAt }: { words: string; onRetry?: () => void; retryAt?: number }) {
  const { busy } = useArcScreen();
  const [waiting, setWaiting] = useState(() => retryAt !== undefined && retryAt > Date.now());
  // A rate-limited step offers Try again only once the server's wait is over.
  useEffect(() => {
    if (retryAt === undefined || retryAt <= Date.now()) return setWaiting(false);
    setWaiting(true);
    const timer = setTimeout(() => setWaiting(false), retryAt - Date.now());
    return () => clearTimeout(timer);
  }, [retryAt]);
  return (
    <section className="cd" role="alert" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
      <span className="sx wn" style={{ fontSize: 15, whiteSpace: "normal", alignItems: "flex-start", lineHeight: 1.45, flex: "1 1 260px" }}>
        <Icon name="warn" /><span style={{ color: "var(--tx)" }}>{words}</span>
      </span>
      {onRetry && !waiting && <Button variant="secondary" small disabled={busy} onClick={onRetry}>Try again</Button>}
    </section>
  );
}

/** The designed "not connected" line inside a card: the chip, one sentence naming what is missing, and the dashed bar. */
export function NotConnectedNote({ children }: { children: ReactNode }) {
  return (
    <div>
      <ProvenanceChip kind="not-connected" />
      <p className="lb" style={{ margin: "8px 0 0", fontSize: 15, lineHeight: 1.5 }}>{children}</p>
      <div className="ncbar" aria-hidden="true" />
    </div>
  );
}

export function Loading({ children }: { children: ReactNode }) {
  return <div className="sx id" role="status" style={{ fontSize: 15 }}><IdleMark />{children}</div>;
}
