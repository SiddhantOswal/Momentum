import type { ReactNode } from "react";
import { CheckPath, Icon } from "../../ui/icons";

const WARN = "M12 3.5l9.5 16.5h-19zM12 10v5M12 17.6v.1";
const BAD = "M12 3l9 9-9 9-9-9zM12 8v5M12 15.6v.1";
const CLOSE = "M6 6l12 12M18 6L6 18";

export type Toast = { id: string; tone: "ok" | "warn" | "bad"; title: string; text: string };

export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div className="nl-toasts" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`nl-toast nl-toast-${toast.tone}`} role={toast.tone === "bad" ? "alert" : "status"}>
          <Icon path={toast.tone === "ok" ? "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 12.5l3 3 5-6" : toast.tone === "warn" ? WARN : BAD} />
          <div><b>{toast.title}</b><span>{toast.text}</span></div>
          <button type="button" className="nl-toast-close" aria-label="Dismiss" onClick={() => onDismiss(toast.id)}><Icon path={CLOSE} /></button>
        </div>
      ))}
    </div>
  );
}

export function IdStrip({ items, tone }: { items: { label: string; value: string; end?: boolean }[]; tone?: "warn" }) {
  return (
    <div className={`nl-ids${tone === "warn" ? " nl-ids-warn" : ""}`}>
      {items.map((item) => (
        <div key={item.label} className={item.end ? "nl-ids-end" : undefined}><small>{item.label}</small><b>{item.value}</b></div>
      ))}
    </div>
  );
}

export function ActionBand({ tone, title, text, children }: { tone: "warn" | "bad"; title: string; text: string; children: ReactNode }) {
  return (
    <section className={`nl-band nl-band-${tone}`}>
      <Icon path={tone === "bad" ? BAD : WARN} />
      <div className="nl-band-text"><b>{title}</b><span>{text}</span></div>
      <div className="nl-band-actions">{children}</div>
    </section>
  );
}

export function CheckLine({ ok, children }: { ok: boolean; children: ReactNode }) {
  return <div className="nl-check-line"><Icon path={ok ? "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 12.5l3 3 5-6" : WARN} className={ok ? "nl-ok" : "nl-warn"} />{children}</div>;
}

export { CheckPath };
