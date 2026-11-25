import type { ReactNode } from "react";

/**
 * A labelled figure: label, big tabular value, unit and a sub-line. Pass the value from an
 * API response. A null value reads "Not recorded" and is never drawn as 0.
 */
export function Stat({ label, value, unit, sub, chip, large }: {
  label: ReactNode; value: string | number | null; unit?: string; sub?: ReactNode; chip?: ReactNode; large?: boolean;
}) {
  const size = large ? { fontSize: 44, lineHeight: "50px", letterSpacing: "-.8px" } : { fontSize: 24, lineHeight: "28px" };
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <span className="lb" style={{ fontSize: 15 }}>{label}</span>{chip}
      </div>
      {value === null
        ? <div style={{ fontSize: 17, fontWeight: 500, color: "var(--mu)", marginTop: 6 }}>Not recorded</div>
        : (
          <div className="n" style={{ ...size, fontWeight: 600, marginTop: 6, whiteSpace: "nowrap" }}>
            {value}{unit && <span style={{ fontSize: large ? 20 : 15, color: "var(--mu)", fontWeight: 500, marginLeft: large ? 8 : 4 }}>{unit}</span>}
          </div>
        )}
      {sub && <div className="lb" style={{ marginTop: 4 }}>{sub}</div>}
    </div>
  );
}
