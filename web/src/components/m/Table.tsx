import type { ReactNode } from "react";

export type Column = { label: string; width: string; align?: "left" | "right" };
export type Row = { key: string; cells: ReactNode[] };

/**
 * The design's grid table (`.tb`): an uppercase header row and ruled rows. `width` is a CSS
 * grid track per column, such as "1fr" or "150px". `empty` is shown when there are no rows.
 */
export function Table({ label, columns, rows, empty, rowHeight }: {
  label: string; columns: Column[]; rows: Row[]; empty?: ReactNode; rowHeight?: number;
}) {
  const template = columns.map((column) => column.width).join(" ");
  const align = (index: number) => (columns[index]?.align === "right" ? { textAlign: "right" as const, justifySelf: "end" as const } : undefined);
  return (
    <div role="table" aria-label={label}>
      <div role="row" className="tb h" style={{ gridTemplateColumns: template }}>
        {columns.map((column, index) => <span key={column.label || index} role="columnheader" className="th" style={align(index)}>{column.label}</span>)}
      </div>
      {rows.length === 0 && empty
        ? <div className="tb lb" style={{ gridTemplateColumns: "1fr" }}>{empty}</div>
        : rows.map((row) => (
          <div key={row.key} role="row" className="tb" style={{ gridTemplateColumns: template, minHeight: rowHeight }}>
            {row.cells.map((cell, index) => <span key={index} role="cell" style={align(index)}>{cell}</span>)}
          </div>
        ))}
    </div>
  );
}
