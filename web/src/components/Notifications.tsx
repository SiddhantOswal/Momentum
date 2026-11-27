import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./m";

export type Notice = { id: string; tone: "ok" | "wn" | "bd"; title: string; text?: string };

const History = createContext<{ notices: Notice[]; record: (notices: readonly Notice[]) => void }>({
  notices: [], record: () => {},
});

export function NotificationHistory({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const record = useCallback((visible: readonly Notice[]) => {
    if (!visible.length) return;
    setNotices((previous) => {
      const updated = visible.filter((notice) => !previous.some(({ id, tone, title, text }) =>
        id === notice.id && tone === notice.tone && title === notice.title && text === notice.text,
      ));
      if (!updated.length) return previous;
      return [...updated.reverse(), ...previous.filter(({ id }) => !updated.some((notice) => notice.id === id))].slice(0, 20);
    });
  }, []);

  return <History.Provider value={{ notices, record }}>{children}</History.Provider>;
}

export function useNotificationHistory(notices: readonly Notice[]) {
  const { record } = useContext(History);
  useEffect(() => record(notices), [record, notices]);
}

const ICONS = { ok: "ok", wn: "warn", bd: "bad" } as const;
const LABELS = { ok: "Success", wn: "Warning", bd: "Error" };

export function NotificationBell({ disabled }: { disabled: boolean }) {
  const { notices } = useContext(History);
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const expanded = open && !disabled;

  useEffect(() => {
    if (!expanded) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [expanded]);

  return (
    <div className="notifications" ref={root} onBlur={(event) => {
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }} onKeyDown={(event) => {
      if (event.key !== "Escape" || !expanded) return;
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    }}>
      <button ref={trigger} type="button" className="bell" aria-label="Notifications" aria-expanded={expanded}
        aria-controls="notification-history" disabled={disabled} onClick={() => setOpen(!open)}>
        <Icon name="bell" />
        {notices.length > 0 && <b aria-hidden="true">{notices.length}</b>}
      </button>
      <section className="notification-panel" id="notification-history" aria-label="Recent notifications"
        hidden={!expanded} tabIndex={0}>
        <h2>Notifications</h2>
        {notices.length === 0
          ? <p className="lb">No notifications yet.</p>
          : <ul>{notices.map(({ id, tone, title, text }) => (
            <li key={id} className={`notice-tone ${tone}`}>
              <Icon name={ICONS[tone]} />
              <div><span className="sr-only">{LABELS[tone]}: </span><strong>{title}</strong>{text && <div className="lb">{text}</div>}</div>
            </li>
          ))}</ul>}
      </section>
    </div>
  );
}
