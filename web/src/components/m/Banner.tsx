import type { ReactNode } from "react";
import { Icon } from "./icons";

const TONES = {
  warn: { icon: "warn", status: "wn", border: "rgba(227,163,64,.6)" },
  bad: { icon: "bad", status: "bd", border: "rgba(240,112,122,.6)" },
  ok: { icon: "ok", status: "ok", border: "var(--ln)" },
} as const;

/**
 * A full-width alert card (NewLot-Stale pattern): a status line with its shape, one plain
 * sentence, and actions on the right. Warnings and failures are announced as alerts.
 */
export function Banner({ tone, title, children, actions }: {
  tone: keyof typeof TONES; title: string; children?: ReactNode; actions?: ReactNode;
}) {
  const { icon, status, border } = TONES[tone];
  return (
    <section className="cd c12" role={tone === "ok" ? "status" : "alert"}
      style={{ borderColor: border, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 20, padding: "18px 22px" }}>
      <div style={{ minWidth: 0, flex: "1 1 320px" }}>
        <span className={`sx ${status}`} style={{ fontSize: 18, fontWeight: 600, color: "var(--tx)", whiteSpace: "normal" }}>
          <Icon name={icon} />{title}
        </span>
        {children && <div className="lb" style={{ fontSize: 15, marginTop: 4, marginLeft: 24 }}>{children}</div>}
      </div>
      {actions && <span style={{ marginLeft: "auto", display: "flex", gap: 10, flexWrap: "wrap" }}>{actions}</span>}
    </section>
  );
}
