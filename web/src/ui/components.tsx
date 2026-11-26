import type { ReactNode } from "react";
import { CheckPath, Icon } from "./icons";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string | null; actions?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function Card({ title, meta, span, flush, kraft, children }: {
  title?: ReactNode; meta?: ReactNode; span?: 3 | 4 | 5 | 6 | 7 | 8 | 12; flush?: boolean; kraft?: boolean; children: ReactNode;
}) {
  const classes = ["card", span && `span-${span}`, flush && "card-flush", kraft && "card-kraft"].filter(Boolean).join(" ");
  return (
    <section className={classes}>
      {(title || meta) && (
        <header className="card-head">
          {title && <h2 className="card-title">{title}</h2>}
          {meta && <span className="card-meta">{meta}</span>}
        </header>
      )}
      {children}
    </section>
  );
}

type ButtonProps = {
  variant?: "primary" | "secondary"; size?: "regular" | "small"; children: ReactNode;
  type?: "button" | "submit"; disabled?: boolean; onClick?: () => void;
};
export function Button({ variant = "primary", size = "regular", type = "button", children, ...rest }: ButtonProps) {
  return <button type={type} className={`button button-${variant}${size === "small" ? " button-small" : ""}`} {...rest}>{children}</button>;
}

export type Provenance = "confirmed" | "modeled" | "example" | "missing" | "accent";

/** Provenance chip. Callers pass the label from the approved set (Example, Sample, Modeled, Model estimate, ...). */
export function Chip({ kind = "confirmed", children }: { kind?: Provenance; children: ReactNode }) {
  const modifier = kind === "confirmed" ? "" : ` chip-${kind}`;
  return <span className={`chip${modifier}`}><i />{children}</span>;
}

export type Tone = "ok" | "active" | "warn" | "bad" | "idle";
const STATUS_SHAPE: Record<Tone, ReactNode> = {
  ok: <svg viewBox="0 0 24 24"><path d={CheckPath} /></svg>,
  active: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" /></svg>,
  warn: <svg viewBox="0 0 24 24"><path d="M12 4l9 16H3zM12 10v4M12 17v.5" /></svg>,
  bad: <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg>,
  idle: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" /></svg>,
};
export function Status({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`status status-${tone}`}>{STATUS_SHAPE[tone]}{children}</span>;
}

export function KeyValue({ label, value, unit }: { label: ReactNode; value: ReactNode; unit?: string }) {
  return (
    <div className="key-value">
      <span className="key-value-label">{label}</span>
      <span className="key-value-value">{value}{unit && <small>{unit}</small>}</span>
    </div>
  );
}

export function CheckRow({ checked, onChange, children }: { checked: boolean; onChange: (next: boolean) => void; children: ReactNode }) {
  return (
    <div className="check-row" role="checkbox" aria-checked={checked} tabIndex={0}
      onClick={() => onChange(!checked)}
      onKeyDown={(event) => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); onChange(!checked); } }}>
      <span className="check-box">{checked && <Icon path={CheckPath} />}</span>
      <span>{children}</span>
    </div>
  );
}

export type StepState = "done" | "current" | "upcoming";
export function Stepper({ steps }: { steps: { label: string; state: StepState }[] }) {
  return (
    <ol className="stepper" style={{ listStyle: "none", padding: 0 }}>
      {steps.map((step, index) => (
        <li key={step.label} className={`step${step.state === "upcoming" ? "" : ` step-${step.state}`}`}
          aria-current={step.state === "current" ? "step" : undefined}>
          <b>{index + 1}</b>{step.label}
        </li>
      ))}
    </ol>
  );
}

export function Alert({ tone, title, children }: { tone: "ok" | "warn" | "bad"; title: string; children?: ReactNode }) {
  const path = tone === "ok" ? CheckPath : tone === "warn" ? "M12 4l9 16H3zM12 10v4M12 17v.5" : "M6 6l12 12M18 6L6 18";
  return (
    <div className={`alert alert-${tone}`} role={tone === "bad" ? "alert" : "status"}>
      <Icon path={path} />
      <div className="alert-body">
        <span className="alert-title">{title}</span>
        {children && <span className="alert-text">{children}</span>}
      </div>
    </div>
  );
}

/** Shown wherever a screen is built but its backend source does not exist yet. */
export function NotConnected({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="not-connected" role="status"><strong>{title}</strong>{children}</div>;
}

export function TableRow({ columns, head, children }: { columns: string; head?: boolean; children: ReactNode }) {
  return <div className={`table-row${head ? " table-head" : ""}`} style={{ gridTemplateColumns: columns }}>{children}</div>;
}
