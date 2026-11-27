import { useCallback, useState, type ReactNode } from "react";
import { PageHeader, PATHS, Stepper } from "../../components/m";
import { DEFECTS, formatMoney, formatNumber, type Defect } from "../../lib/api";
import { LEVERS, type LeverKey } from "../../lib/session";
import type { LotState } from "./store";
import "./newlot.css";

/** Page frame shared by the New Lot steps: heading, the four-step stepper and the lot identity bar. */
export function NewLotPage({ step, sub, ids, toasts, children }: {
  step: 1 | 2 | 3 | 4; sub: string; ids: ReactNode; toasts?: ReactNode; children: ReactNode;
}) {
  return (
    <div className="nl">
      <PageHeader title="New lot" sub={sub} />
      <Stepper current={step} />
      {ids}
      {children}
      {toasts}
    </div>
  );
}

/** The identity bar above each step. Every value comes from the lot record or the plan response. */
export function IdsBar({ lot, status, next, kraft, replaced }: { lot: LotState; status: string; next: string; kraft?: boolean; replaced?: boolean }) {
  const item = lot.plan?.jobSheet.order.itemCode ?? (lot.itemCode || undefined);
  const number = lot.stale?.number ?? lot.plan?.revision?.number;
  const proposal = number === undefined ? "Not planned yet" : `Rev ${number}${replaced ? ", replaced" : ""}`;
  return (
    <div className={`ids${kraft ? " kr" : ""}`} role="group" aria-label="Lot">
      <div><small>Lot</small><b>{item ?? "No order read"}</b></div>
      <div><small>Proposal</small><b>{proposal}</b></div>
      <div><small>Status</small><b>{status}</b></div>
      <div className="nx"><small>Next</small><b>{next}</b></div>
    </div>
  );
}

export type Toast = { id: string; tone: "ok" | "wn" | "bd"; title: string; text?: string };

export function useToasts(initial: Toast[] = []) {
  const [toasts, setToasts] = useState(initial);
  const show = useCallback((toast: Toast) => setToasts((list) => [...list.filter((entry) => entry.id !== toast.id), toast]), []);
  const dismiss = useCallback((id: string) => setToasts((list) => list.filter((entry) => entry.id !== id)), []);
  return { toasts, show, dismiss };
}

export function Toasts({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: string) => void }) {
  return (
    <div className="tsts" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`tst ${toast.tone}`} role={toast.tone === "ok" ? "status" : "alert"}>
          <StatusIcon kind={toast.tone === "ok" ? "ok" : toast.tone === "wn" ? "warn" : "bad"} />
          <div><b>{toast.title}</b>{toast.text && <span>{toast.text}</span>}</div>
          <button type="button" className="x" aria-label={`Dismiss: ${toast.title}`} onClick={() => dismiss(toast.id)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={PATHS.close} /></svg>
          </button>
        </div>
      ))}
    </div>
  );
}

/** Status marks from the designs: shape and colour together, so state never rests on colour alone. */
export function StatusIcon({ kind }: { kind: "ok" | "now" | "idle" | "warn" | "bad" }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {kind === "ok" && <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l3 3 5-6" /></>}
      {kind === "now" && <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2.6" fill="currentColor" /></>}
      {kind === "idle" && <circle cx="12" cy="12" r="9" strokeDasharray="3 3" />}
      {kind === "warn" && <path d="M12 3.5l9.5 16.5h-19zM12 10v5M12 17.6v.1" />}
      {kind === "bad" && <path d="M12 2.8l9.2 9.2-9.2 9.2L2.8 12zM12 8v5M12 15.6v.1" />}
    </svg>
  );
}

export const STATUS_CLASS = { ok: "ok", now: "ac", idle: "id", warn: "wn", bad: "bd" } as const;

/** A row in a status list: mark, name and a short state on the right. */
export function StatusRow({ kind, name, state, height }: { kind: keyof typeof STATUS_CLASS; name: string; state: string; height?: number }) {
  return (
    <div className="st" style={height ? { height } : undefined}>
      <span className={`sx ${STATUS_CLASS[kind]}`}><StatusIcon kind={kind} /></span>
      <div className={kind === "idle" ? "off" : undefined}>{name}</div>
      <span className="lb">{state}</span>
    </div>
  );
}

const LEVEL_TEXT: Record<string, string> = { LOW: "LOW", MED: "MEDIUM", HIGH: "HIGH" };

// The designs hyphenate "Single-facer"; the shared lever list does not.
const DESIGN_NAMES: Partial<Record<LeverKey, string>> = { sfSpeedMpm: "Single-facer speed" };
export const leverLabel = (key: LeverKey) => DESIGN_NAMES[key] ?? LEVERS.find((lever) => lever.key === key)?.label ?? key;
export const leverUnit = (key: LeverKey) => {
  const lever = LEVERS.find((entry) => entry.key === key);
  return lever && "unit" in lever ? lever.unit : "";
};

/** A setting value as the card prints it: levels in words, numbers with their unit. */
export function leverText(key: LeverKey, value: string | number | undefined) {
  if (value === undefined || value === "") return "Not set";
  if (typeof value === "string" && LEVEL_TEXT[value]) return LEVEL_TEXT[value];
  const unit = leverUnit(key);
  return unit ? `${value} ${unit}` : String(value);
}

export const defectLabel = (defect: Defect) => DEFECTS.find((entry) => entry.key === defect)?.label ?? defect;
export const kg = (value: number) => formatNumber(value, 1);
export const money = (value: number, currency = "INR") => formatMoney(value, currency);
export const pct = (value: number) => `${formatNumber(value, 2)}%`;

/** A labelled input in the design's field style. An amber outline marks a value still to enter. */
export function FieldInput({ id, value, onChange, onCommit, placeholder, unit, required, invalid, inputMode, type = "text", describedBy, label }: {
  id: string; value: string; onChange: (value: string) => void; onCommit?: () => void; placeholder: string; unit?: string;
  required?: boolean; invalid?: boolean; inputMode?: "decimal" | "numeric" | "text"; type?: "text" | "date"; describedBy?: string; label: string;
}) {
  return (
    <div className={`fld${invalid ? " bad" : required && value === "" ? " rq" : ""}`}>
      <input id={id} type={type} value={value} placeholder={placeholder} inputMode={inputMode} aria-label={label}
        aria-invalid={invalid || undefined} aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)} onBlur={onCommit} />
      {unit && <small aria-hidden="true">{unit}</small>}
    </div>
  );
}

export function FieldSelect({ id, value, onChange, options, placeholder, describedBy, label }: {
  id: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[];
  placeholder: string; describedBy?: string; label: string;
}) {
  return (
    <div className={`fld${value === "" ? " rq" : ""}`}>
      <select id={id} value={value} required aria-label={label} aria-describedby={describedBy} onChange={(event) => onChange(event.target.value)}>
        <option value="" disabled>{placeholder}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  );
}

export const LEVEL_OPTIONS = ["LOW", "MED", "HIGH"].map((value) => ({ value, label: LEVEL_TEXT[value] }));
