export const NEW_LOT_STEPS = ["Order", "Conditions", "Settings and risk", "Review and approve"] as const;

/** The four New Lot steps. Steps before `current` show a tick, the current one is orange. */
export function Stepper({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <ol className="stp" aria-label="New lot steps">
      {NEW_LOT_STEPS.map((name, index) => {
        const step = index + 1;
        const state = step < current ? "d" : step === current ? "c" : "";
        return (
          <li key={name} className={state} aria-current={step === current ? "step" : undefined}>
            <b>{step < current
              ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--inv)" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
              : step}</b>
            {name}
            {step < current && <span className="sr-only">, done</span>}
          </li>
        );
      })}
    </ol>
  );
}
