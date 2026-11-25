// Stroke paths copied from the design HTML so icons match the approved screens.
export const PATHS = {
  home: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  newLot: "M6 3h8l4 4v14H6zM14 3v4h4M12 11v6M9 14h6",
  explorer: "M3 21V10l6 3V10l6 3V6h3v15z",
  prepFlow: "M4 5h5v5H4zM15 14h5v5h-5zM9 8h3a3 3 0 0 1 3 3v3",
  insights: "M5 20V11M12 20V5M19 20v-7",
  photo: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4",
  planning: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  jobCard: "M6 3h9l3 3v15H6zM9 11h6M9 15h6",
  bell: "M6 17h12l-1.5-2v-4.5a4.5 4.5 0 0 0-9 0V15zM10 20h4",
  arrow: "M5 12h14M13 6l6 6-6 6",
  chevron: "M9 5l7 7-7 7",
  check: "M5 12l5 5 9-10",
  close: "M6 6l12 12M18 6L6 18",
  history: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2",
  mic: "M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4",
  sun: "M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6",
  warn: "M12 3.5l9.5 16.5h-19zM12 10v5M12 17.6v.1",
  bad: "M12 2.8l9.2 9.2-9.2 9.2L2.8 12zM12 8v5M12 15.6v.1",
  ok: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12.5l3 3 5-6",
  menu: "M4 7h16M4 12h16M4 17h16",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      {name === "sun" && <circle cx="12" cy="12" r="4" />}
      <path d={PATHS[name]} />
    </svg>
  );
}

/** The dashed circle the designs use for "not started" and "outside Arc" states. */
export function IdleMark() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" strokeDasharray="3 3" /></svg>;
}

export function ArcMark({ size }: { size: number }) {
  return (
    <svg className="mk" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" style={{ fill: "var(--ac)" }} />
      <path d="M6.8 21.6A9.2 9.2 0 0 1 22.2 14.6" fill="none" stroke="#18110E" strokeWidth="2.7" strokeLinecap="round" />
      <path d="M17.6 21.4l3 3 5.6-6.4" fill="none" stroke="#18110E" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6.8" cy="21.6" r="2.5" fill="#18110E" />
    </svg>
  );
}
