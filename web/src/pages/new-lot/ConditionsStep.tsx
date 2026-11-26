import { Button, Card } from "../../ui/components";
import { Icon } from "../../ui/icons";
import { LEVERS, type LeverKey, type Levers } from "../../lib/session";
import { CONDITION_FIELDS, LEVEL_LABEL, SHIFTS, conditionDone, fieldProgress, leverDone, type ConditionKey, type ConditionValues } from "./model";

type Props = {
  conditions: ConditionValues; levers: Levers; touched: ReadonlySet<ConditionKey>; prefilled: ReadonlySet<ConditionKey>;
  loadNote?: string; planning: boolean; planError?: string;
  onCondition: (key: ConditionKey, value: string) => void; onLever: (key: LeverKey, value: string) => void;
  onBack: () => void; onPlan: () => void;
};

const WARN = "M12 3.5l9.5 16.5h-19zM12 10v5M12 17.6v.1";

function sublabel(key: ConditionKey, done: boolean, touched: boolean, prefilled: boolean) {
  if (!done) return "Required";
  if (touched) return "Entered by the operator";
  if (prefilled) return key === "paperMoisturePct" ? "Reference record, not measured" : "Reference record, not a plant sensor";
  return "Entered by the operator";
}

export function ConditionsStep(p: Props) {
  const progress = fieldProgress(p.conditions, p.levers);
  const ready = progress.left === 0;
  return (
    <div className="grid">
      <Card span={5} title="Conditions today" meta="Blank fields are not in the reference record">
        <div className="nl-fields">
          {CONDITION_FIELDS.map((field) => {
            const done = conditionDone(field.key, p.conditions);
            const id = `nl-c-${field.key}`;
            return (
              <div key={field.key} className="nl-field">
                <label htmlFor={id}><b>{field.label}</b><small>{sublabel(field.key, done, p.touched.has(field.key), p.prefilled.has(field.key))}</small></label>
                {field.kind === "shift" ? (
                  <select id={id} className={`nl-input${done ? "" : " nl-todo"}`} value={p.conditions.shift} onChange={(event) => p.onCondition("shift", event.target.value)}>
                    <option value="" disabled>Select shift</option>{SHIFTS.map((shift) => <option key={shift.value} value={shift.value}>{shift.label}</option>)}
                  </select>
                ) : (
                  <span className="nl-unit-input">
                    <input id={id} className={`nl-input${done ? "" : " nl-todo"}`} type={field.kind === "date" ? "date" : "text"} inputMode={field.kind === "number" ? "decimal" : undefined}
                      placeholder={field.kind === "date" ? "Select date" : "Enter value"} value={p.conditions[field.key]} onChange={(event) => p.onCondition(field.key, event.target.value)} />
                    {field.unit && <em>{field.unit}</em>}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div className="nl-legend"><i className="nl-legend-swatch" />Amber outline: still to confirm</div>
        {p.loadNote && <p className="nl-note">{p.loadNote}</p>}
      </Card>

      <Card span={7} title="Planned machine settings" meta="Seven settings, each within its range">
        <div className="nl-fields">
          {LEVERS.map((lever) => {
            const done = leverDone(lever.key, p.levers);
            const id = `nl-l-${lever.key}`;
            return (
              <div key={lever.key} className="nl-field">
                <label htmlFor={id}><b>{lever.label}</b><small>{done ? "Entered by the operator" : "Required"}</small></label>
                {"options" in lever ? (
                  <select id={id} className={`nl-input${done ? "" : " nl-todo"}`} value={String(p.levers[lever.key])} onChange={(event) => p.onLever(lever.key, event.target.value)}>
                    <option value="" disabled>Select value</option>{lever.options.map((option) => <option key={option} value={option}>{LEVEL_LABEL[option] ?? option}</option>)}
                  </select>
                ) : (
                  <span className="nl-unit-input">
                    <input id={id} className={`nl-input${done ? "" : " nl-todo"}${lever.unit.length > 6 ? " nl-input-long" : ""}`} inputMode="decimal" placeholder={lever.unit.length > 6 ? "Enter" : "Enter value"} value={String(p.levers[lever.key])} onChange={(event) => p.onLever(lever.key, event.target.value)} />
                    <em>{lever.unit}</em>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <section className="card span-12 nl-confirm">
        <Button variant="secondary" onClick={p.onBack}>Back</Button>
        {p.planError
          ? <span className="nl-hint nl-hint-bad" role="alert"><Icon path={WARN} />{p.planError}</span>
          : ready
            ? <span className="nl-hint">All {progress.total} fields are confirmed.</span>
            : <span className="nl-hint"><Icon path={WARN} />Confirm all {progress.total} fields to continue. {progress.done} of {progress.total} done.</span>}
        <span className="nl-confirm-end"><Button disabled={!ready || p.planning} onClick={p.onPlan}>{p.planning ? "Planning" : "Plan this lot"}<Icon path="M5 12h14M13 6l6 6-6 6" /></Button></span>
      </section>
    </div>
  );
}
