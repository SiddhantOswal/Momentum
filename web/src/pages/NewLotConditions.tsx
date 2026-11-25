import { useEffect, useRef, useState } from "react";
import { Banner, Button, ButtonLink, Card } from "../components/m";
import { LEVERS, type LeverKey } from "../lib/session";
import { loadPlantReading, loadWeather, planLot, recordConditionEdit } from "./newlot/actions";
import { FieldInput, FieldSelect, IdsBar, LEVEL_OPTIONS, leverLabel, NewLotPage, StatusIcon, timeText, Toasts, useToasts } from "./newlot/parts";
import { CONDITION_FIELDS, getLot, updateLot, useLot, type ConditionKey, type FieldSource, type LotState } from "./newlot/store";

const SHIFTS = [{ value: "DAY", label: "Day" }, { value: "NIGHT", label: "Night" }];
const TOTAL_FIELDS = CONDITION_FIELDS.length + LEVERS.length;

const CONDITION_LIMITS: Partial<Record<ConditionKey, [number, number]>> = {
  ambientRhPct: [0, 100], paperMoisturePct: [0, 20], ambientTempC: [-50, 60],
};

function conditionValid(key: ConditionKey, value: string) {
  if (value.trim() === "") return false;
  if (key === "runDate") return /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (key === "shift") return value === "DAY" || value === "NIGHT";
  const number = Number(value);
  const [min, max] = CONDITION_LIMITS[key]!;
  return Number.isFinite(number) && number >= min && number <= max;
}

function leverValid(key: LeverKey, value: string) {
  const lever = LEVERS.find((entry) => entry.key === key)!;
  if ("options" in lever) return (lever.options as readonly string[]).includes(value);
  const number = Number(value);
  return value.trim() !== "" && Number.isFinite(number) && number >= lever.min && number <= lever.max;
}

function doneCount(lot: LotState) {
  return CONDITION_FIELDS.filter((field) => conditionValid(field.key, lot.conditions[field.key])).length +
    LEVERS.filter((lever) => leverValid(lever.key, lot.levers[lever.key])).length;
}

/** The line under each condition says where its value came from. */
function sourceText(source: FieldSource | undefined, filled: boolean) {
  if (!filled) return "Required";
  if (!source || source.kind === "operator") return "Entered by operator";
  if (source.kind === "weather") return `Weather record, ${source.location ?? "Pune"}, ${timeText(source.observedAt)}`;
  return source.simulated ? `Last stored plant reading, simulated, ${timeText(source.recordedAt)}` : `Last stored plant reading, ${timeText(source.recordedAt)}`;
}

function ConditionsCard({ lot, onToast }: { lot: LotState; onToast: ReturnType<typeof useToasts>["show"] }) {
  const [busy, setBusy] = useState<"" | "weather" | "plant">("");
  const [note, setNote] = useState<string>();
  const asked = useRef(false);

  // The public weather record fills humidity and temperature once, as Arc does; the operator can change both.
  useEffect(() => {
    if (asked.current || lot.conditions.ambientRhPct !== "" || lot.conditions.ambientTempC !== "") return;
    asked.current = true;
    setBusy("weather");
    loadWeather().then((result) => {
      setBusy("");
      if (!result.ok) setNote("The weather record is not available right now. Enter humidity and temperature.");
    });
  }, [lot.conditions.ambientRhPct, lot.conditions.ambientTempC]);

  const set = (key: ConditionKey, value: string) =>
    updateLot((current) => ({ conditions: { ...current.conditions, [key]: value }, sources: { ...current.sources, [key]: { kind: "operator" } } }));

  const commit = async (key: ConditionKey) => {
    const result = await recordConditionEdit(key);
    if (!result) return;
    if (!result.ok) onToast({ id: "edit", tone: "bd", title: "The change was not saved", text: result.message });
    // Read the store after the await: this render's copy predates the server's answer.
    else if (getLot().stale) onToast({ id: "edit", tone: "wn", title: "The draft is out of date", text: "Plan the lot again before approving." });
  };

  const fillFrom = async (kind: "weather" | "plant") => {
    setBusy(kind); setNote(undefined);
    const result = kind === "weather" ? await loadWeather(true) : await loadPlantReading(lot.conditions.shift);
    setBusy("");
    if (!result.ok) setNote(result.message);
    else for (const key of kind === "weather" ? ["ambientRhPct", "ambientTempC"] as const : ["ambientRhPct", "ambientTempC", "paperMoisturePct"] as const) void commit(key);
  };

  return (
    <section className="cd c5" style={{ display: "flex", flexDirection: "column" }} aria-labelledby="nl-conditions" aria-busy={busy !== ""}>
      <div className="ct"><h2 className="t" id="nl-conditions">Conditions today</h2><span className="mt">Blank fields are required</span></div>
      {CONDITION_FIELDS.map((field) => {
        const value = lot.conditions[field.key];
        const filled = value.trim() !== "";
        const invalid = filled && !conditionValid(field.key, value);
        const id = `nl-${field.key}`;
        return (
          <div className="fr" key={field.key}>
            <div><div className="nm" id={`${id}-name`}>{field.label}</div><div className="sr" id={`${id}-src`}>{invalid ? "Check this value" : sourceText(lot.sources[field.key], filled)}</div></div>
            {field.key === "shift"
              ? <FieldSelect id={id} label={field.label} value={value} placeholder="Select shift" options={SHIFTS} describedBy={`${id}-src`}
                  onChange={(next) => { set("shift", next); void commit("shift"); }} />
              : <FieldInput id={id} label={field.label} value={value} unit={field.unit} type={field.key === "runDate" ? "date" : "text"}
                  inputMode={field.key === "runDate" ? undefined : "decimal"} placeholder={field.key === "runDate" ? "Select date" : "Enter value"}
                  required invalid={invalid} describedBy={`${id}-src`} onChange={(next) => set(field.key, next)} onCommit={() => void commit(field.key)} />}
          </div>
        );
      })}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
        <Button small variant="secondary" disabled={busy !== ""} onClick={() => fillFrom("weather")}>{busy === "weather" ? "Reading the weather record" : "Use weather record"}</Button>
        <Button small variant="secondary" disabled={busy !== "" || lot.conditions.shift === ""} onClick={() => fillFrom("plant")}>{busy === "plant" ? "Reading the dataset" : "Use last plant reading"}</Button>
      </div>
      {note && <p className="err" role="alert">{note}</p>}
      <div style={{ flex: 1, minHeight: 12 }} />
      <p className="lb" style={{ fontSize: 13, lineHeight: 1.45, margin: "12px 0 0" }}>No plant sensor is connected. Values come from the dataset, the public weather record for Pune or the operator.</p>
      <div style={{ borderTop: "1px solid var(--ln)", marginTop: 12, paddingTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
        <span className="lgd" aria-hidden="true" /><span className="lb" style={{ fontSize: 14 }}>Amber outline: still to confirm.</span>
      </div>
    </section>
  );
}

function SettingsCard({ lot }: { lot: LotState }) {
  const set = (key: LeverKey, value: string) => updateLot((current) => ({ levers: { ...current.levers, [key]: value } }));
  return (
    <Card span={7} title="Planned machine settings" meta="Seven settings, each within its range.">
      {LEVERS.map((lever) => {
        const value = lot.levers[lever.key];
        const filled = value.trim() !== "";
        const invalid = filled && !leverValid(lever.key, value);
        const id = `nl-${lever.key}`;
        const unit = "unit" in lever ? lever.unit : "";
        const sub = !filled ? "Required" : invalid && "min" in lever ? `Enter ${lever.min} to ${lever.max} ${unit}` : "Entered by operator";
        return (
          <div className="fr" key={lever.key}>
            <div><div className="nm">{leverLabel(lever.key)}</div><div className="sr" id={`${id}-src`}>{sub}</div></div>
            {"options" in lever
              ? <FieldSelect id={id} label={leverLabel(lever.key)} value={value} placeholder="Select value" options={LEVEL_OPTIONS} describedBy={`${id}-src`} onChange={(next) => set(lever.key, next)} />
              : <FieldInput id={id} label={leverLabel(lever.key)} value={value} unit={unit} inputMode="decimal" placeholder="Enter value" required invalid={invalid}
                  describedBy={`${id}-src`} onChange={(next) => set(lever.key, next)} />}
          </div>
        );
      })}
    </Card>
  );
}

function PlanBar({ lot }: { lot: LotState }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const done = doneCount(lot);
  const ready = done === TOTAL_FIELDS && lot.orderConfirmed;
  const plan = async () => {
    setBusy(true); setError(undefined);
    const result = await planLot();
    setBusy(false);
    if (result.ok || getLot().partial) { location.hash = "#/new-lot/settings"; return; }
    setError(result.message);
  };
  return (
    <section className="cd c12 bar" style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", flexWrap: "wrap" }} aria-label="Plan this lot" aria-busy={busy}>
      <ButtonLink variant="secondary" href="#/new-lot/order">Back</ButtonLink>
      {busy
        ? <span className="busy" role="status">Predicting the five risks, searching the settings and writing the explanation.</span>
        : done === TOTAL_FIELDS
          ? <span className="sx ok" style={{ marginLeft: 8 }}><StatusIcon kind="ok" />All {TOTAL_FIELDS} fields entered.</span>
          : <span className="sx wn" style={{ marginLeft: 8, whiteSpace: "normal" }}><StatusIcon kind="warn" />Confirm all {TOTAL_FIELDS} fields to continue. {done} of {TOTAL_FIELDS} done.</span>}
      <Button arrow disabled={!ready || busy} onClick={plan} style={{ marginLeft: "auto" }}>{busy ? "Planning this lot" : "Plan this lot"}</Button>
      {error && <p className="err" role="alert" style={{ flexBasis: "100%", margin: 0 }}>{error}</p>}
    </section>
  );
}

export function NewLotConditions() {
  const lot = useLot();
  const done = doneCount(lot);
  const left = TOTAL_FIELDS - done;
  const { toasts, dismiss, show } = useToasts(left > 0 ? [{ id: "left", tone: "wn", title: `${left} fields left to confirm`, text: "Analysis stays blocked until then." }] : []);
  const status = left > 0 ? "Conditions incomplete" : "Conditions entered";
  const next = left > 0 ? `Operator: confirm ${left} fields` : "Operator: plan this lot";
  return (
    <NewLotPage step={2} sub="Confirm today's conditions and your planned settings."
      ids={<IdsBar lot={lot} status={status} next={next} kraft />} toasts={<Toasts toasts={toasts} dismiss={dismiss} />}>
      <div className="g">
        {!lot.orderConfirmed && (
          <Banner tone="warn" title="Confirm the order first." actions={<ButtonLink small href="#/new-lot/order">Go to Order</ButtonLink>}>
            Planning needs a confirmed order line.
          </Banner>
        )}
        <ConditionsCard lot={lot} onToast={show} />
        <SettingsCard lot={lot} />
        <PlanBar lot={lot} />
      </div>
    </NewLotPage>
  );
}
