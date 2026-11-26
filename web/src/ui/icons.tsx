import type { ReactNode } from "react";

type IconProps = { path: string; className?: string };

export function Icon({ path, className }: IconProps) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d={path} /></svg>;
}

export const SunIcon = (): ReactNode => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" />
  </svg>
);

export const BellPath = "M6 17h12l-1.5-2v-4.5a4.5 4.5 0 0 0-9 0V15zM10 20h4";
export const CheckPath = "M5 12.5l4.5 4.5L19 7";
export const DotStatus = (): ReactNode => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" /></svg>
);
