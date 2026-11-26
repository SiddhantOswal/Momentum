import { useEffect, useId, useRef, useState } from "react";
import { formatMoney, formatNumber } from "../../lib/api";
import {
  approveJobCard, arcWords, getJobRecord, getLotRecord, getOrderReview, jobCardPdfPath,
  type Defect, type DraftCondition, type JobRecord, type LeverKey, type LotRecord, type OrderReview, type OrderReviewLine,
  type RevisionBlock, type StoredJob,
} from "../../lib/arc";
import { href } from "../../lib/routes";
import { LEVERS } from "../../lib/session";
import { Button, ButtonLink, Chip, Icon, IdleMark, LabelChip, ProvenanceChip } from "../m";
import { ArcSteps, Loading, NotConnectedNote, Problem, ReviewCheck, ScreenHead, Tabs, useArcScreen } from "./parts";

export type StepProblem = { words: string; onRetry?: () => void; retryAt?: number };

/*
 * The J1 cards (Arc-Lot-*). Each is driven by a run step the server reported or by the stored
 * record a step points at. Where a step has no backend yet, the card keeps its designed layout
 * and says what is missing instead of showing a value.
 */

// The approved sample orders. The IDs are the server's SAMPLE_DOCUMENTS keys; the names and lines are the design's.
const SAMPLES = [
  { id: "PO1", name: "PO1 Single line", sub: "One line, one item." },
  { id: "PO2", name: "PO2 Multi-line", sub: "Several lines. You pick one." },
  { id: "PO3", name: "PO3 Fitment", sub: "Electronics packaging with fitment." },
  { id: "PO4", name: "PO4 Review", sub: "Ambiguous. Needs your decision." },
  { id: "PO5", name: "PO5 Scan", sub: "Scanned JPEG." },
] as const;

const LEVER_TEXT: Record<LeverKey, { name: string; unit?: string }> = {
  sfSpeedMpm: { name: "Single facer speed", unit: "m/min" },
  rollTempC: { name: "Roll temperature", unit: "°C" },
  gumApplication: { name: "Gum application" },
  gumViscositySec: { name: "Gum viscosity", unit: "s" },
  pastingPressure: { name: "Pasting pressure" },
  dryingHours: { name: "Drying time", unit: "h" },
  printSpeedSpm: { name: "Print speed", unit: "sheets/min" },
};
const LEVER_COUNT = Object.keys(LEVER_TEXT).length;
const LEVELS: Record<string, string> = { LOW: "LOW", MED: "MEDIUM", HIGH: "HIGH" };
const DEFECT_NAMES: Record<Defect, string> = { WARP: "Warp", DELAM: "Delamination", STRENGTH: "Strength", PRINT: "Print", CRACK: "Crack" };

const leverValue = (lever: LeverKey, value: number | string) => typeof value === "number"
  ? `${formatNumber(value, 1)}${LEVER_TEXT[lever].unit ? ` ${LEVER_TEXT[lever].unit}` : ""}`
  : LEVELS[value] ?? value;
const kg = (value: number) => formatNumber(value, 1);

/** Defects whose modeled risk is higher on the proposed plan. Values are compared, never subtracted here. */
function tradeOffs(job: StoredJob): string[] {
  const before = job.baseline.risk.ratesPct;
  const after = job.recommended.risk.ratesPct;
  return (Object.keys(DEFECT_NAMES) as Defect[]).flatMap((defect) => {
    const from = before[defect];
    const to = after[defect];
    return from !== undefined && to !== undefined && to > from
      ? [`${DEFECT_NAMES[defect]} risk goes from ${formatNumber(from, 3)}% to ${formatNumber(to, 3)}%.`] : [];
  });
}

function tradeOffLine(job: StoredJob): string | null {
  const rises = tradeOffs(job);
  if (!rises.length) return null;
  return job.recommended.risk.scrapCost < job.baseline.risk.scrapCost ? `${rises.join(" ")} Total cost still falls.` : rises.join(" ");
}

const SOURCE_WORDS: Record<string, string> = { "manual-entry": "entered by the operator", "simulated-sensor": "from the simulated sensor" };

// After APPROVAL_IN_PROGRESS the card reads the job once more after this wait.
const APPROVAL_RECHECK_MS = 3000;
const APPROVAL_STILL_RUNNING = "An approval for this card is already being processed. Check the job card before trying again.";

/** Arc-Lot-Source: choose one of the approved sample orders after list_samples succeeds. */
export function LotSource({ problem }: { problem?: StepProblem }) {
  const { send, busy } = useArcScreen();
  const [chosen, setChosen] = useState<string>(SAMPLES[0].id);
  const name = useId();
  return (
    <>
      <ArcSteps current={1} />
      <ScreenHead title="Choose the purchase order" sub="Arc reads the file once. You check what it found." />
      <section className="cd" style={{ padding: "4px 20px" }} role="radiogroup" aria-label="Approved sample orders">
        {SAMPLES.map((sample) => (
          <label key={sample.id} className={`po${chosen === sample.id ? " on" : ""}`}>
            <input type="radio" className="ovl" name={name} value={sample.id} checked={chosen === sample.id} onChange={() => setChosen(sample.id)} />
            <i aria-hidden="true" />
            <span><b>{sample.name}</b><span className="s">{sample.sub}</span></span>
            {chosen === sample.id ? <ProvenanceChip kind="approved-sample" /> : <span />}
          </label>
        ))}
      </section>
      <div className="drop">
        <ProvenanceChip kind="not-connected" />
        <span>Dropping your own PDF or JPEG is not connected to Arc yet.</span>
      </div>
      {problem && <Problem {...problem} />}
      <div className="row">
        <Button arrow disabled={busy} onClick={() => send({ kind: "action", actionId: "read_sample_order", params: { sampleId: chosen } }, `Read sample order ${chosen}`)}>Read this order</Button>
        <span className="lb" style={{ fontSize: 14 }}>Approved samples only.</span>
      </div>
    </>
  );
}

const REVIEW_CHECKS = ["The source line is the one you want", "The quantity matches the order", "The catalog item is the right box"];
const LINE_STATUS: Record<OrderReviewLine["status"], string> = {
  MATCHED: "Matched", AMBIGUOUS: "Pick an item", UNKNOWN_CODE: "Not in catalog",
  MISSING_ITEM_CODE: "No item code", MISSING_QTY: "No quantity", MALFORMED: "Check this line",
};
// The server confirms only a line matched to one catalog item with a quantity (confirmableLine in src/arc/lot-flow.js).
const confirmable = (line: OrderReviewLine) => line.status === "MATCHED" && line.itemCode !== null && line.quantity !== null;

/**
 * Arc-Lot-Review: the lines of the stored review, read with GET /api/arc/reviews/:reviewId.
 * Confirm order sends only the review and the line; the server takes the item and quantity
 * from the stored review.
 */
export function LotReview({ reviewId, problem, closed = false }: { reviewId: string | null; problem?: StepProblem; closed?: boolean }) {
  const { send, busy } = useArcScreen();
  const [read, setRead] = useState<{ review?: OrderReview; words?: string } | null>(reviewId ? null : { words: arcWords("ORDER_REVIEW_EXPIRED") });
  const [lineIndex, setLineIndex] = useState<number | null>(null);
  const [checks, setChecks] = useState<boolean[]>(REVIEW_CHECKS.map(() => false));
  const name = useId();
  useEffect(() => {
    if (!reviewId) return;
    const controller = new AbortController();
    void getOrderReview(reviewId, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      if (!result.ok) return setRead({ words: arcWords(result.code === "NOT_FOUND" ? "ORDER_REVIEW_EXPIRED" : result.code) });
      setRead({ review: result.data });
      const usable = result.data.lines.filter(confirmable);
      if (result.data.lines.length === 1 && usable.length === 1) setLineIndex(usable[0].lineIndex);
    });
    return () => controller.abort();
  }, [reviewId]);

  const review = read?.review;
  const chosen = review?.lines.find((line) => line.lineIndex === lineIndex && confirmable(line));
  const ready = Boolean(review && chosen && checks.every(Boolean)) && !closed;
  const choose = (index: number) => { setLineIndex(index); setChecks(REVIEW_CHECKS.map(() => false)); };
  const confirm = () => {
    if (!review || !chosen) return;
    send({ kind: "action", actionId: "confirm_order", params: { reviewId: review.reviewId, lineIndex: chosen.lineIndex } },
      `Confirm line ${chosen.lineIndex + 1}, ${chosen.itemCode}`);
  };
  return (
    <>
      <ArcSteps current={1} />
      <ScreenHead title="Check what was read" sub="Arc read the order and stored what it found." />
      <section className="cd" style={{ padding: "16px 20px" }}>
        <div className="ct2"><h3 className="t" style={{ fontSize: 16 }}>What we read from the order</h3>{review && <ProvenanceChip kind="approved-sample" />}</div>
        {!read && <Loading>Reading the order review</Loading>}
        {read?.words && <p className="lb" style={{ margin: 0, fontSize: 15 }}>{read.words}</p>}
        {review && (
          <>
            <div role="radiogroup" aria-label="Order lines">
              {review.lines.map((line) => (
                <label key={line.lineIndex} className={`po${line.lineIndex === lineIndex ? " on" : ""}`}>
                  <input type="radio" className="ovl" name={name} checked={line.lineIndex === lineIndex} disabled={busy || closed || !confirmable(line)}
                    onChange={() => choose(line.lineIndex)} />
                  <i aria-hidden="true" />
                  <span>
                    <b>Line {line.lineIndex + 1}: {line.itemCode ?? "No catalog item"}</b>
                    <span className="s">{line.quantity === null ? "No quantity" : `${formatNumber(line.quantity)} boxes`}{line.sourcePage ? `, page ${line.sourcePage}` : ""}</span>
                  </span>
                  <Chip tone={confirmable(line) ? "plain" : "none"}>{LINE_STATUS[line.status]}</Chip>
                </label>
              ))}
            </div>
            <p className="lb" style={{ margin: "10px 0 0", fontSize: 14 }}>
              {review.readByGemini ? "Read from the order by Gemini." : "Sample output, no model call."}{" "}
              {review.lines.length === 1 ? "One line on this order." : "Only the line you pick is in this lot."} The catalog match runs in code.
            </p>
          </>
        )}
      </section>
      <div className="stl">
        {REVIEW_CHECKS.map((check, index) => (
          <ReviewCheck key={check} checked={checks[index]} disabled={busy || closed || !chosen}
            onChange={(on) => setChecks((list) => list.map((value, at) => (at === index ? on : value)))}>{check}</ReviewCheck>
        ))}
      </div>
      {problem && <Problem {...problem} />}
      <div className="row">
        <Button arrow disabled={busy || !ready} onClick={confirm}>Confirm order</Button>
        {review && !ready && (
          <span className="lb" style={{ fontSize: 14 }}>
            {closed ? "Arc has moved on from this card. Read the order again to confirm another line."
              : chosen ? "Tick the three checks to confirm." : "Pick a matched line to confirm."}
          </span>
        )}
      </div>
    </>
  );
}

type ConditionField = DraftCondition["field"];
type FieldKey = ConditionField | LeverKey;
type Values = Record<FieldKey, string>;
// The paper moisture pre-fill (PAPER_MOISTURE_EXAMPLE_PCT in src/commands/update-conditions.js). Only this value is labelled as the example.
const EXAMPLE_MOISTURE = "7.3";

const CONDITION_ROWS: { field: ConditionField; name: string; unit: string; empty: string; min?: number; max?: number }[] = [
  { field: "ambientRhPct", name: "Humidity", unit: "%", empty: "Enter value", min: 0, max: 100 },
  { field: "paperMoisturePct", name: "Paper moisture", unit: "%", empty: "Enter value", min: 0, max: 20 },
  { field: "ambientTempC", name: "Ambient temperature", unit: "°C", empty: "Enter value" },
  { field: "runDate", name: "Run date", unit: "", empty: "Select date" },
  { field: "shift", name: "Shift", unit: "", empty: "Select shift" },
];
const NUMBER = /^-?\d+(?:\.\d+)?$/;

/** Whether a field holds a value the server's schema accepts. The plant's recorded ranges are checked on the server. */
function valid(field: FieldKey, value: string): boolean {
  const text = value.trim();
  if (field === "runDate") return /^\d{4}-\d{2}-\d{2}$/.test(text);
  if (field === "shift") return text === "DAY" || text === "NIGHT";
  const lever = LEVERS.find((entry) => entry.key === field);
  if (lever && "options" in lever) return (lever.options as readonly string[]).includes(text);
  if (!NUMBER.test(text)) return false;
  const limits = lever ?? CONDITION_ROWS.find((row) => row.field === field);
  const number = Number(text);
  return (limits?.min === undefined || number >= limits.min) && (limits?.max === undefined || number <= limits.max);
}

const blankValues = (): Values => ({
  runDate: "", shift: "", ambientRhPct: "", ambientTempC: "", paperMoisturePct: EXAMPLE_MOISTURE,
  ...Object.fromEntries(LEVERS.map((lever) => [lever.key, ""])),
} as Values);

/** Values from a turn's params, so a step that failed shows what the operator sent. */
function valuesFrom(params: Record<string, string | number | boolean> | undefined): Partial<Values> {
  if (!params) return {};
  return Object.fromEntries(Object.entries(params).filter(([key]) => key !== "paperMoistureSource").map(([key, value]) => [key, String(value)]));
}

function rowLabel(field: FieldKey, value: string, stored?: DraftCondition) {
  if (value.trim() === "") return "Required";
  if (stored && String(stored.value) === value.trim()) return stored.label;
  if (field === "paperMoisturePct" && Number(value) === Number(EXAMPLE_MOISTURE)) return "Example value";
  return "Entered by operator";
}

/**
 * Arc-Lot-Conditions: the five conditions and seven planned settings the operator confirms.
 * Confirm conditions sends them as one action; the server saves the conditions on the lot with
 * their labels and plans with the order it rebuilds from the lot and the stored review.
 */
export function LotConditions({ lotId, initial, problem }: {
  lotId: string | null; initial?: Record<string, string | number | boolean>; problem?: StepProblem;
}) {
  const { send, busy } = useArcScreen();
  const [tab, setTab] = useState<"conditions" | "settings">("conditions");
  const [lot, setLot] = useState<{ record?: LotRecord; words?: string } | null>(lotId ? null : { words: arcWords("LOT_NOT_FOUND") });
  const [values, setValues] = useState<Values>(() => ({ ...blankValues(), ...valuesFrom(initial) }));
  const form = useId();
  useEffect(() => {
    if (!lotId) return;
    const controller = new AbortController();
    void getLotRecord(lotId, controller.signal).then((read) => {
      if (controller.signal.aborted) return;
      setLot(read.ok ? { record: read.data } : { words: arcWords(read.code) });
      // Values already stored on the lot fill the form unless this card was drawn from a turn's own values.
      if (read.ok && !initial) {
        setValues((current) => ({ ...current, ...Object.fromEntries(read.data.lot.draftConditions.map(({ field, value }) => [field, String(value)])) }));
      }
    });
    return () => controller.abort();
  }, [lotId, initial]);

  const stored = lot?.record?.lot.draftConditions ?? [];
  const set = (field: FieldKey, value: string) => setValues((current) => ({ ...current, [field]: value }));
  const conditionsLeft = CONDITION_ROWS.filter(({ field }) => !valid(field, values[field])).length;
  const settingsLeft = LEVERS.filter(({ key }) => !valid(key, values[key])).length;
  const ready = Boolean(lotId && lot?.record) && conditionsLeft === 0 && settingsLeft === 0;
  const order = lot?.record?.lot.order;
  const confirm = () => {
    if (!ready || !lotId) return;
    const number = (field: FieldKey) => Number(values[field].trim());
    const moisture = number("paperMoisturePct");
    send({
      kind: "action", actionId: "confirm_conditions",
      params: {
        lotId, runDate: values.runDate.trim(), shift: values.shift.trim(),
        ambientRhPct: number("ambientRhPct"), ambientTempC: number("ambientTempC"), paperMoisturePct: moisture,
        paperMoistureSource: moisture === Number(EXAMPLE_MOISTURE) ? "example" : "confirmed",
        ...Object.fromEntries(LEVERS.map((lever) => [lever.key, "options" in lever ? values[lever.key].trim() : number(lever.key)])),
      },
    }, "Confirm conditions and plan the lot");
  };

  const field = (key: FieldKey, unit: string, placeholder: string, options?: readonly { value: string; label: string }[]) => {
    const id = `${form}-${key}`;
    const value = values[key];
    const bad = value.trim() !== "" && !valid(key, value);
    return (
      <div className={`fld${value.trim() === "" ? " rq" : ""}`}>
        {options
          ? (
            <select id={id} value={value} disabled={busy} aria-invalid={bad} onChange={(event) => set(key, event.target.value)}>
              <option value="">{placeholder}</option>
              {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          )
          : (
            <input id={id} value={value} disabled={busy} aria-invalid={bad} placeholder={placeholder}
              type={key === "runDate" ? "date" : "text"} inputMode={key === "runDate" ? undefined : "decimal"}
              onChange={(event) => set(key, event.target.value)} />
          )}
        {unit && <small>{unit}</small>}
      </div>
    );
  };

  return (
    <>
      <ArcSteps current={2} />
      <ScreenHead title="Confirm today's conditions" sub="Type what you see on the floor. Sensor readings are not connected yet." />
      {order && <p className="lb" style={{ margin: 0, fontSize: 15 }}>For <b>{order.itemCode}</b>, {formatNumber(order.quantity)} boxes.</p>}
      <Tabs label="Lot inputs" selected={tab} onSelect={setTab} tabs={[
        { key: "conditions", text: <>Conditions {conditionsLeft > 0 && <small>{conditionsLeft} left</small>}</> },
        { key: "settings", text: <>Planned settings {settingsLeft > 0 && <small>{settingsLeft} left</small>}</> },
      ]} />
      {!lot && <Loading>Reading the lot</Loading>}
      {lot?.words && <section className="cd"><p className="lb" style={{ margin: 0, fontSize: 15 }}>{lot.words}</p></section>}
      {lot?.record && tab === "conditions" && (
        <section className="cd" style={{ padding: "6px 20px" }} aria-label="Conditions">
          {CONDITION_ROWS.map((row) => (
            <div key={row.field} className="fr">
              <div>
                <label htmlFor={`${form}-${row.field}`} style={{ display: "block", fontSize: 16, fontWeight: 600 }}>{row.name}</label>
                <div className="lb" style={{ fontSize: 13 }}>{rowLabel(row.field, values[row.field], stored.find((entry) => entry.field === row.field))}</div>
              </div>
              {field(row.field, row.unit, row.empty, row.field === "shift" ? [{ value: "DAY", label: "Day" }, { value: "NIGHT", label: "Night" }] : undefined)}
            </div>
          ))}
        </section>
      )}
      {lot?.record && tab === "settings" && (
        <section className="cd" style={{ padding: "6px 20px" }} aria-label="Planned settings">
          {LEVERS.map((lever) => (
            <div key={lever.key} className="fr">
              <div>
                <label htmlFor={`${form}-${lever.key}`} style={{ display: "block", fontSize: 16, fontWeight: 600 }}>{lever.label}</label>
                <div className="lb" style={{ fontSize: 13 }}>{values[lever.key].trim() === "" ? "Required" : "Your planned setting"}</div>
              </div>
              {field(lever.key, "unit" in lever ? lever.unit : "", "options" in lever ? "Select" : "Enter value",
                "options" in lever ? lever.options.map((option) => ({ value: option, label: LEVELS[option] })) : undefined)}
            </div>
          ))}
        </section>
      )}
      {problem && <Problem {...problem} />}
      <div className="row">
        <Button arrow disabled={busy || !ready} onClick={confirm}>Confirm conditions</Button>
        <span className="lb" style={{ fontSize: 14 }}>
          {ready ? "Arc saves these values and plans the lot." : `${CONDITION_ROWS.length + LEVERS.length - conditionsLeft - settingsLeft} of ${CONDITION_ROWS.length + LEVERS.length} values entered.`}
        </span>
      </div>
    </>
  );
}

/** Arc-Lot-Compare when plan_lot did not run: no estimate exists, so nothing is compared. */
export function PlanStopped({ problem }: { problem?: StepProblem }) {
  return (
    <>
      <ArcSteps current={3} />
      <ScreenHead title="Compare the two plans" />
      {problem && <Problem {...problem} />}
      <section className="cd">
        <div className="ct2"><h3 className="t" style={{ fontSize: 15 }}>Scrap for this lot</h3></div>
        <NotConnectedNote>Arc could not plan this lot, so there is no estimate to compare. Plan it on the New Lot page.</NotConnectedNote>
      </section>
    </>
  );
}

function ChangeList({ job }: { job: StoredJob }) {
  if (!job.changes.length) return <div>No setting changes.</div>;
  return (
    <div>
      {job.changes.map((change) => (
        <div key={change.lever}>
          {/* The design writes the unit once, after the new value: "162 → 170 °C". */}
          <b>{LEVER_TEXT[change.lever].name}</b> {typeof change.from === "number" ? formatNumber(change.from, 1) : leverValue(change.lever, change.from)} → {leverValue(change.lever, change.to)}
        </div>
      ))}
    </div>
  );
}

function Compare({ job, onNext }: { job: StoredJob; onNext: () => void }) {
  const { send, busy } = useArcScreen();
  const { kg: savedKg, amount, currency } = job.savings;
  const tradeOff = tradeOffLine(job);
  return (
    <>
      <ArcSteps current={3} />
      <ScreenHead title="Compare the two plans" sub="Up to 3 changes allowed." />
      <section className="cd kr">
        <div className="ct2"><h3 className="t" style={{ fontSize: 15 }}>Scrap for this lot</h3><ProvenanceChip kind="model-estimate" /></div>
        <div className="n" style={{ fontSize: 40, lineHeight: "46px", fontWeight: 600, letterSpacing: "-.6px", overflowWrap: "anywhere" }}>
          {kg(job.baseline.risk.totalScrapKg)} → {kg(job.recommended.risk.totalScrapKg)}
          <span style={{ fontSize: 18, color: "var(--mu)", marginLeft: 6, fontWeight: 500 }}>kg</span>
        </div>
        <div style={{ marginTop: 4, fontSize: 16 }}>
          {savedKg === 0
            ? "No change in scrap, modeled"
            : <><b>{kg(Math.abs(savedKg))} kg</b> and <b>{formatMoney(Math.abs(amount), currency)}</b> {savedKg > 0 ? "lower" : "higher"}, modeled</>}
        </div>
      </section>
      <section className="cd">
        <div className="ct2"><h3 className="t">{job.changes.length} of {LEVER_COUNT} settings change</h3><span className="mt">{LEVER_COUNT - job.changes.length} stay as entered</span></div>
        <div role="table" aria-label="Setting changes">
          <div role="row" className="tb h cmp" style={{ minHeight: 28 }}>
            <span role="columnheader" className="th">Setting</span><span role="columnheader" className="th">Entered</span>
            <span role="columnheader" className="th">Proposed</span><span role="columnheader" className="th"><span className="sr-only">Change</span></span>
          </div>
          {job.changes.map((change) => (
            <div key={change.lever} role="row" className="tb cmp" style={{ minHeight: 50 }}>
              <span role="cell" style={{ fontSize: 16, fontWeight: 600 }}>{LEVER_TEXT[change.lever].name}</span>
              <span role="cell" className="n" style={{ fontSize: 17, color: "var(--mu)" }}>{leverValue(change.lever, change.from)}</span>
              <span role="cell" className="n" style={{ fontSize: 19, fontWeight: 600 }}>{leverValue(change.lever, change.to)}</span>
              <span role="cell"><Chip tone="accent">Changed</Chip></span>
            </div>
          ))}
        </div>
      </section>
      {tradeOff && (
        <section className="cd" style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-start", padding: "14px 18px" }}>
          <span className="sx wn" style={{ alignItems: "flex-start", fontSize: 16, fontWeight: 600, lineHeight: 1.35, color: "var(--tx)", whiteSpace: "normal", flex: "1 1 260px" }}>
            <Icon name="warn" /><span>{tradeOff}</span>
          </span>
          <button type="button" className="lk" disabled={busy} style={{ marginLeft: "auto", marginTop: 2 }}
            onClick={() => send({ kind: "action", actionId: "get_status" }, "How far can I trust the five models?")}>How far to trust this</button>
        </section>
      )}
      <section className="cd">
        <div className="ct2"><h3 className="t" style={{ fontSize: 15 }}>Why these settings</h3></div>
        <NotConnectedNote>The draft stores an explanation but not who wrote it, so Arc does not show it until the record says whether Gemini wrote it.</NotConnectedNote>
      </section>
      <div className="row">
        <Button arrow onClick={onNext}>Prepare job-card draft</Button>
        <Button variant="secondary" disabled>Keep entered plan</Button>
        <span className="lb" style={{ fontSize: 14 }}>Keeping the entered plan is not connected to Arc yet.</span>
      </div>
    </>
  );
}

function Approve({ job, revision, onApproved, onReplaced, onRevise, onKeep }: {
  job: StoredJob; revision?: RevisionBlock; onApproved: (job: StoredJob) => void; onReplaced: () => void; onRevise: () => void; onKeep: () => void;
}) {
  const [reviewed, setReviewed] = useState(false);
  const [state, setState] = useState<{ pending: string | null; words: string | null }>({ pending: null, words: null });
  // State updates land after the click's task, so a second click in the same task would still see
  // pending as false; the ref closes that gap and keeps it to one request.
  const inFlight = useRef(false);
  const fingerprint = revision?.fingerprint ?? null;
  const tradeOff = tradeOffLine(job);
  const { ambientRhPct, paperMoisturePct, conditionSource } = job.conditions;

  // Another request holds the approval lease. The card is read once more after a short wait, and
  // shows what the stored record says; it never claims a result it has not read.
  const recheck = async () => {
    setState({ pending: "Checking the job card", words: null });
    await new Promise((resolve) => setTimeout(resolve, APPROVAL_RECHECK_MS));
    const read = await getJobRecord(job.jobId);
    if (read.ok && read.data.revision?.status === "SUPERSEDED") return onReplaced();
    if (read.ok && read.data.jobSheet.status !== "DRAFT") return onApproved(read.data.jobSheet);
    setState({ pending: null, words: APPROVAL_STILL_RUNNING });
  };

  // The only caller of the approve route. It does nothing unless the reviewer ticked the box.
  const approve = async () => {
    if (!reviewed || !fingerprint || inFlight.current) return;
    inFlight.current = true;
    setState({ pending: "Storing the PDF", words: null });
    try {
      const result = await approveJobCard(job.jobId, fingerprint);
      if (result.ok) return onApproved(result.data.jobSheet);
      if (result.code === "REVISION_SUPERSEDED" || result.code === "REVISION_FINGERPRINT_MISMATCH") return onReplaced();
      if (result.code === "APPROVAL_IN_PROGRESS") return await recheck();
      setState({ pending: null, words: result.code === "CONFLICT" ? "Only a draft can be approved. This card is no longer a draft." : arcWords(result.code) });
    } finally {
      inFlight.current = false;
    }
  };

  return (
    <>
      <ArcSteps current={4} />
      <ScreenHead title="Approve the job card" sub="Approving issues the card. It does not change any machine." />
      <section className="cd" style={{ padding: "6px 20px 8px" }}>
        <div className="ct2" style={{ padding: "12px 0 6px", margin: 0 }}>
          <h3 className="t">{job.order.itemCode}{revision ? `, Rev ${revision.number}` : ""}</h3>
          <LabelChip label="Draft, not approved" />
        </div>
        <div className="kvr2"><span>Changes</span><ChangeList job={job} /></div>
        {tradeOff && <div className="kvr2"><span>Trade-off</span><div>{tradeOff}</div></div>}
        <div className="kvr2"><span>Limits</span><div>Crack is low confidence. Delamination and Print gains are within noise.</div></div>
        <div className="kvr2"><span>Data</span><div>Humidity {formatNumber(ambientRhPct, 1)}% and paper moisture {formatNumber(paperMoisturePct, 1)}%, {SOURCE_WORDS[conditionSource ?? ""] ?? "source not recorded"}.</div></div>
        <div className="kvr2"><span>Approver</span><div>Supervisor session, demo access. This approval is simulated.</div></div>
      </section>
      <ReviewCheck checked={reviewed} disabled={Boolean(state.pending) || !fingerprint} onChange={setReviewed}>I reviewed the settings and limits on this card.</ReviewCheck>
      {!fingerprint && <Problem words={arcWords("REVISION_NOT_REGISTERED")} />}
      {state.words && <Problem words={state.words} />}
      <div className="row">
        <Button disabled={!reviewed || !fingerprint || Boolean(state.pending)} onClick={approve}>Approve job card</Button>
        <Button variant="secondary" disabled={Boolean(state.pending)} onClick={onRevise}>Revise</Button>
        <Button variant="secondary" disabled={Boolean(state.pending)} onClick={onKeep}>Keep draft</Button>
      </div>
      {state.pending
        ? <Loading>{state.pending}</Loading>
        : <div className="lb" style={{ fontSize: 13, lineHeight: 1.45 }}>After approval Momentum stores the PDF. Nothing runs on the machine.</div>}
    </>
  );
}

function HappenedRow({ done, title, detail }: { done: boolean; title: string; detail: string }) {
  return (
    <div className="hrow">
      {done ? <span className="sx ok"><Icon name="ok" /></span> : <span className="sx id"><IdleMark /></span>}
      <div>{title}</div>
      <span className="lb">{detail}</span>
    </div>
  );
}

function Receipt({ job, revision }: { job: StoredJob; revision?: RevisionBlock }) {
  const { send, busy } = useArcScreen();
  const [details, setDetails] = useState(false);
  const rev = revision ? `, Rev ${revision.number}` : "";
  const board = [job.order.ply && `${job.order.ply}-ply`, job.order.fluteProfile].filter(Boolean).join(" ");
  const demo = job.approvalAudit?.authorizationMode === "HACKATHON_DEMO";
  return (
    <>
      <ArcSteps current={4} />
      <ScreenHead title="Job card approved" sub={job.cardUri ? "The approval is recorded and the PDF is stored." : "The approval is recorded."} />
      <section className="cd kr" style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "center" }}>
        <div className="sheet" aria-hidden="true">
          <b>{job.order.itemCode}</b><small>{revision ? `Rev ${revision.number}` : "Approved"}</small>
          <i /><i style={{ width: "80%" }} /><i /><i style={{ width: "60%" }} />
        </div>
        <div style={{ minWidth: 0, flex: "1 1 200px" }}>
          <div className="d" style={{ fontSize: 22, lineHeight: "28px", fontWeight: 600 }}>{job.order.itemCode}{rev}</div>
          <div className="lb" style={{ marginTop: 2, fontSize: 15 }}>{board ? `${board}, ` : ""}{formatNumber(job.order.quantity)} boxes</div>
          <div className="row" style={{ marginTop: 14 }}>
            <Button small aria-expanded={details} onClick={() => setDetails((on) => !on)}>{details ? "Hide job card" : "View job card"}</Button>
            {job.cardUri && <a className="bt s sm" href={jobCardPdfPath(job.jobId)} target="_blank" rel="noopener">Open PDF</a>}
          </div>
        </div>
      </section>
      {details && (
        <section className="cd" style={{ padding: "6px 20px 8px" }} aria-label="Approved job card">
          <div className="kvr2"><span>Changes</span><ChangeList job={job} /></div>
          <div className="kvr2"><span>Scrap</span><div>{kg(job.baseline.risk.totalScrapKg)} → {kg(job.recommended.risk.totalScrapKg)} kg, model estimate</div></div>
        </section>
      )}
      <section className="cd" style={{ padding: "4px 20px 6px" }}>
        <div style={{ padding: "10px 0 6px" }}><h3 className="t" style={{ fontSize: 16 }}>What happened</h3></div>
        <HappenedRow done title="Draft saved" detail={revision ? `Rev ${revision.number}, stored` : "Stored"} />
        <HappenedRow done title="Approval recorded" detail={demo ? "Demo session, simulated" : "Recorded"} />
        <HappenedRow done={Boolean(job.cardUri)} title="PDF stored" detail={job.cardUri ? "Stored" : "Not stored"} />
        <HappenedRow done={false} title="Card checked" detail="Not connected" />
      </section>
      <div className="stl">
        <div className="sx id" style={{ fontSize: 14, whiteSpace: "normal" }}><IdleMark />This approval came from a demo session. It is simulated.</div>
        <div className="sx id" style={{ fontSize: 14, whiteSpace: "normal" }}><IdleMark />Production has not started. No machine was changed.</div>
      </div>
      <div><Button variant="secondary" disabled={busy} onClick={() => send({ kind: "action", actionId: "list_samples" }, "New lot")}>Start another lot</Button></div>
    </>
  );
}

const FIELD_NAMES: Record<string, { name: string; step: string }> = {
  ambientRhPct: { name: "Humidity", step: "Conditions" }, ambientTempC: { name: "Ambient temperature", step: "Conditions" },
  paperMoisturePct: { name: "Paper moisture", step: "Conditions" }, runDate: { name: "Run date", step: "Conditions" }, shift: { name: "Shift", step: "Conditions" },
};

function Replaced({ job, revision }: { job: StoredJob; revision: RevisionBlock }) {
  const [lot, setLot] = useState<LotRecord | null>(null);
  const [kept, setKept] = useState(false);
  const alertRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    void getLotRecord(revision.lotId, controller.signal).then((read) => { if (read.ok && !controller.signal.aborted) setLot(read.data); });
    return () => controller.abort();
  }, [revision.lotId]);
  // The "Keep as history" button removes itself, so focus moves to the notice it changed.
  useEffect(() => { if (kept) alertRef.current?.focus(); }, [kept]);
  const reason = lot?.revision?.jobId === job.jobId ? lot.revision.supersededReason : null;
  const field = reason ? FIELD_NAMES[reason.field] : undefined;
  const rev = `Rev ${revision.number}`;
  return (
    <>
      <ArcSteps current={4} />
      <section ref={alertRef} tabIndex={-1} data-arc-focus="" className="cd" role="alert" style={{ borderColor: "rgba(227,163,64,.6)", padding: "16px 18px" }}>
        <span className="sx wn" style={{ fontSize: 18, fontWeight: 600, color: "var(--tx)", whiteSpace: "normal" }}><Icon name="warn" />An input changed after {rev} was prepared.</span>
        <div className="lb" style={{ fontSize: 15, margin: "4px 0 0 24px" }}>{kept ? `${rev} stays as read-only history.` : "A replaced revision cannot be approved. Plan the lot again."}</div>
        <div className="row" style={{ margin: "14px 0 0 24px" }}>
          <ButtonLink arrow href={href("new-lot/conditions")}>Plan this lot again</ButtonLink>
          {!kept && <Button variant="secondary" onClick={() => setKept(true)}>Keep {rev} as history</Button>}
        </div>
      </section>
      <section className="cd kr">
        <div className="ct2"><h3 className="t">What changed</h3><LabelChip label="Replaced, read only" /></div>
        {reason ? (
          <>
            <div className="kv" style={{ fontSize: 15 }}><span className="lb">Input</span><b>{field?.name ?? reason.field}</b></div>
            <div className="kv" style={{ fontSize: 15 }}><span className="lb">Edited in</span><b>{field?.step ?? "Not recorded"}</b></div>
            <div className="kv" style={{ fontSize: 15 }}><span className="lb">Edited by</span><b>{reason.byRole}</b></div>
          </>
        ) : <p className="lb" style={{ margin: 0, fontSize: 15 }}>{lot ? "The lot record does not say which input changed." : "Reading the lot record."}</p>}
      </section>
      <section className="cd" style={{ padding: "6px 20px" }}>
        <div style={{ padding: "10px 0 6px" }}><h3 className="t" style={{ fontSize: 16 }}>What is now out of date</h3></div>
        {["Defect estimate", "Limited search", "Explanation"].map((item) => (
          <div key={item} className="hrow"><span className="sx wn"><Icon name="warn" /></span><div>{item}</div><span className="lb">Needs a new run</span></div>
        ))}
        <div className="hrow"><span className="sx wn"><Icon name="warn" /></span><div>Job card {rev}</div><span className="lb">Replaced</span></div>
      </section>
      <div className="row">
        <Button disabled>Approve {rev}</Button>
        <span className="lb" style={{ fontSize: 14 }}>Off. {rev} is replaced.</span>
      </div>
    </>
  );
}

// The "Working on" stage names the step the card on screen belongs to, as the designs label it.
const PHASE_STAGE = { compare: "Settings and risk", approve: "Review and approve", kept: "Draft kept", replaced: "Out of date" } as const;

/**
 * A stored job from GET /jobs/:id, shown as the card its state calls for: compare and approve
 * for a draft, the receipt once approved, and the replaced view when its revision was superseded.
 */
export function JobFlow({ jobId }: { jobId: string }) {
  const { setWorkingOn } = useArcScreen();
  const [read, setRead] = useState<{ record?: JobRecord; words?: string } | null>(null);
  const [phase, setPhase] = useState<"compare" | "approve" | "kept" | "replaced">("compare");
  const rootRef = useRef<HTMLDivElement>(null);
  const [moved, setMoved] = useState(0);
  // Every phase change replaces the card whose button held focus, so focus goes to the new card's heading.
  useEffect(() => {
    if (moved) rootRef.current?.querySelector<HTMLElement>("[data-arc-focus]")?.focus();
  }, [moved]);
  const go = (next: typeof phase) => { setPhase(next); setMoved((count) => count + 1); };

  useEffect(() => {
    const controller = new AbortController();
    void getJobRecord(jobId, controller.signal).then((result) => {
      if (!controller.signal.aborted) setRead(result.ok ? { record: result.data } : { words: arcWords(result.code) });
    });
    return () => controller.abort();
  }, [jobId]);

  const record = read?.record;
  const replaced = phase === "replaced" || record?.revision?.status === "SUPERSEDED";
  useEffect(() => {
    if (!record) return;
    const { jobSheet, revision } = record;
    const stage = replaced ? "Out of date" : jobSheet.status !== "DRAFT" ? "Approved" : PHASE_STAGE[phase];
    setWorkingOn({ label: `${jobSheet.order.itemCode}${revision ? `, Rev ${revision.number}` : ""}`, stage });
  }, [record, replaced, phase, setWorkingOn]);

  if (!read) return <Loading>Reading the job card</Loading>;
  if (!record) return <Problem words={read.words ?? arcWords("UNKNOWN")} />;
  const { jobSheet, revision } = record;
  let card;
  if (replaced && revision) card = <Replaced job={jobSheet} revision={revision} />;
  else if (jobSheet.status !== "DRAFT") card = <Receipt job={jobSheet} revision={revision} />;
  else if (phase === "kept") {
    card = (
      <section className="cd" role="status" tabIndex={-1} data-arc-focus="">
        <span className="sx id" style={{ fontSize: 15, whiteSpace: "normal" }}><IdleMark />Draft kept. {jobSheet.order.itemCode} is not approved.</span>
        <div style={{ marginTop: 12 }}><Button variant="secondary" small onClick={() => go("approve")}>Review it again</Button></div>
      </section>
    );
  } else if (phase === "compare") card = <Compare job={jobSheet} onNext={() => go("approve")} />;
  else {
    card = (
      <Approve job={jobSheet} revision={revision}
        onApproved={(approved) => { setRead({ record: { jobSheet: approved, revision: revision && { ...revision, status: "APPROVED" } } }); setMoved((count) => count + 1); }}
        onReplaced={() => go("replaced")} onRevise={() => go("compare")} onKeep={() => go("kept")} />
    );
  }
  // display: contents keeps the cards as direct items of the exchange's column, as before.
  return <div ref={rootRef} style={{ display: "contents" }}>{card}</div>;
}
