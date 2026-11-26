import { useId, type ReactNode } from "react";

type Span = 3 | 4 | 5 | 6 | 7 | 8 | 12;

/**
 * The design's card: a title row with the card name on the left and meta (a short note or a
 * chip) on the right. `kraft` is the one emphasis surface a page may have: a faint yellow wash with a yellow outline.
 */
export function Card({ title, meta, span, kraft, flush, className = "", children }: {
  title?: ReactNode; meta?: ReactNode; span?: Span; kraft?: boolean; flush?: boolean;
  className?: string; children?: ReactNode;
}) {
  const titleId = useId();
  const classes = ["cd", span && `c${span}`, kraft && "kr", flush && "flush", className].filter(Boolean).join(" ");
  return (
    <section className={classes} aria-labelledby={title ? titleId : undefined}>
      {(title || meta) && (
        <div className="ct">
          {title && <h2 className="t" id={titleId}>{title}</h2>}
          {meta && (typeof meta === "string" ? <span className="mt">{meta}</span> : meta)}
        </div>
      )}
      {children}
    </section>
  );
}

/** Page heading row, as `.ph` in the designs. */
export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="ph">
      <div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>
      {actions && <div style={{ display: "flex", gap: 12, alignItems: "center" }}>{actions}</div>}
    </div>
  );
}
