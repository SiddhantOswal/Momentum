import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { ThemeSwitch } from "../components/Frame";
import { Chip, Icon, IdleMark, ProvenanceChip } from "../components/m";
import { LEVERS, type LeverKey } from "../lib/session";
import type { Theme } from "../lib/useApp";
import { cardPdfPath, pageParam, readJob, readLots, type JobRead } from "./prepflow/records";
import "./operator/operator.css";

// Labels and units as Operator-Phone writes them.
const LEVER_LABELS: Record<LeverKey, string> = {
  sfSpeedMpm: "Single-facer speed", rollTempC: "Roll temperature", gumApplication: "Gum application",
  gumViscositySec: "Gum viscosity", pastingPressure: "Pasting pressure", dryingHours: "Drying time", printSpeedSpm: "Print speed",
};
const LEVEL_WORDS: Record<string, string> = { LOW: "LOW", MED: "MEDIUM", HIGH: "HIGH" };
// Only the stations the design names; other settings read without one.
const STATIONS: Partial<Record<LeverKey, string>> = { rollTempC: "the single facer", sfSpeedMpm: "the single facer" };

const unitOf = (key: LeverKey) => {
  const lever = LEVERS.find((item) => item.key === key);
  return lever && "unit" in lever ? lever.unit : "";
};
const shown = (value: string | number) => (typeof value === "string" ? LEVEL_WORDS[value] ?? value : String(value));

type Load = { state: "loading" } | { state: "missing"; text: string } | { state: "ready"; job: JobRead };

/** The job named by `?job=`, or else the newest approved lot on the floor view. */
function useOperatorJob(): Load {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    (async () => {
      let jobId = pageParam("job");
      if (!jobId) {
        const lots = await readLots(signal);
        if (signal.aborted) return;
        if (!lots.ok) return setLoad({ state: "missing", text: "The lot list could not be read, so no card can be shown." });
        jobId = lots.data.lots.find((lot) => lot.status === "approved" && lot.jobId)?.jobId ?? null;
        if (!jobId) return setLoad({ state: "missing", text: "No card has been approved yet. An approved card shows here." });
      }
      const read = await readJob(jobId, signal);
      if (signal.aborted) return;
      if (!read.ok) {
        return setLoad({ state: "missing", text: read.status === 404 ? "No stored card has this ID." : "The stored card could not be read." });
      }
      setLoad({ state: "ready", job: read.data });
    })();
    return () => controller.abort();
  }, []);
  return load;
}

/** What a button shows when its backend (ARC-M6-13) does not exist: nothing is sent. */
function NotConnectedNote({ id, text }: { id: string; text: string }) {
  return <p className="op-nc" id={id} role="status"><ProvenanceChip kind="not-connected" /><span>{text}</span></p>;
}

const NOTES: [string, string][] = [
  ["One task at a time", "Next check first, then every value with its unit."],
  ["Same revision as the supervisor", "A replaced card cannot be acknowledged."],
  ["Received, used, measured are different records", "Missing reads Not recorded, never zero."],
  ["An instruction for people", "Momentum does not send commands to a machine."],
];
const RECORDS = ["Card received", "Settings used", "Quality measured"];
const MISMATCH_KINDS = ["A setting value", "The lot or board", "A unit", "Machine cannot reach value"];

function CardView({ job, onReport }: { job: JobRead; onReport: () => void }) {
  const [receiptTried, setReceiptTried] = useState(false);
  const noteId = useId();
  const { jobSheet: sheet, revision } = job;
  const approved = sheet.status !== "DRAFT";
  const latest = revision?.status === "APPROVED";
  const replaced = revision?.status === "SUPERSEDED";
  const changed = new Map(sheet.changes.map((change) => [change.lever, change]));
  const order = [...LEVERS.filter(({ key }) => changed.has(key)), ...LEVERS.filter(({ key }) => !changed.has(key))];
  const first = LEVERS.find(({ key }) => changed.has(key));
  const firstValue = first && sheet.recommended.levers[first.key];
  const nextCheck = first && firstValue !== undefined
    ? `Set ${LEVER_LABELS[first.key].toLowerCase()} to ${shown(firstValue)}${unitOf(first.key) ? ` ${unitOf(first.key)}` : ""}${STATIONS[first.key] ? ` at ${STATIONS[first.key]}` : ""}.`
    : "No setting changed. Run the card as listed.";
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span className="brandw">momentum</span><ProvenanceChip kind="modelled-on-plant" />
      </div>
      <div style={{ marginTop: 18 }}>
        <div className="lb">Approved job card</div>
        <h2 className="big">{sheet.order.itemCode}{revision ? `, Rev ${revision.number}` : ""}</h2>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        {replaced
          ? <span className="sx bd"><Icon name="bad" />Replaced by a newer revision</span>
          : approved
            ? <span className="sx ok"><Icon name="ok" />{latest ? "Approved, latest revision" : "Approved"}</span>
            : <span className="sx wn"><Icon name="warn" />Draft, not approved</span>}
      </div>
      {approved && <div className="lb" style={{ fontSize: 13.5, marginTop: 4 }}>Approved in a demo session. Not a named supervisor.</div>}
      {approved && sheet.cardUri && (
        <a className="lk" style={{ display: "inline-block", marginTop: 10 }} href={cardPdfPath(sheet.jobId)} target="_blank" rel="noopener">Open the approved PDF</a>
      )}
      {!approved
        ? <p className="lb" style={{ marginTop: 16 }}>This card has not been approved. Do not run it.</p>
        : (
          <>
            <div className="op-next"><div className="th">Next check</div><p>{nextCheck}</p></div>
            <ul className="op-rows" aria-label="Settings">
              {order.map(({ key }) => {
                const change = changed.get(key);
                const unit = unitOf(key);
                return (
                  <li key={key} className="sr">
                    <div>
                      <div className="sl">{LEVER_LABELS[key]}</div>
                      {change && <div style={{ marginTop: 3 }}><Chip tone="accent">Changed</Chip></div>}
                    </div>
                    <div className="sv">
                      <b>{shown(sheet.recommended.levers[key])}{unit && <small>{unit}</small>}</b>
                      {change && <div className="was">was {shown(change.from)}{unit ? ` ${unit}` : ""}</div>}
                    </div>
                  </li>
                );
              })}
            </ul>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
              <button type="button" className="mb p" aria-disabled="true" aria-describedby={receiptTried ? noteId : undefined} onClick={() => setReceiptTried(true)}>I received this card</button>
              {receiptTried && <NotConnectedNote id={noteId} text="Receipts are not recorded yet. Nothing was sent." />}
              <button type="button" className="mb s" onClick={onReport}>Report a mismatch</button>
            </div>
          </>
        )}
      <div style={{ borderTop: "1px solid var(--ln)", marginTop: 20, paddingTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <h3 className="th" style={{ margin: 0 }}>Three separate records</h3><ProvenanceChip kind="demo-session" />
        </div>
        <ul className="op-recs">
          {RECORDS.map((record) => (
            <li key={record}><span className="sx id"><IdleMark /></span><span className="rn">{record}</span><span className="lb" style={{ fontSize: 13 }}>Not connected</span></li>
          ))}
        </ul>
      </div>
    </>
  );
}

/** The mismatch form. Its text stays in this page: no route stores it yet (ARC-M6-13). */
function MismatchSheet({ title, onClose, headingRef }: { title: string; onClose: () => void; headingRef: RefObject<HTMLHeadingElement | null> }) {
  const [kind, setKind] = useState(MISMATCH_KINDS[0]);
  const [tried, setTried] = useState(false);
  const ids = useId();
  return (
    <section className="ph2 op-sheet" aria-labelledby={`${ids}-h`}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 id={`${ids}-h`} ref={headingRef} tabIndex={-1} className="brandw" style={{ margin: 0, outline: "none" }}>Report a mismatch</h2>
        <button type="button" className="op-close" onClick={onClose}>Close</button>
      </div>
      <div className="lb" style={{ marginTop: 6 }}>{title}</div>
      <form onSubmit={(event) => event.preventDefault()} noValidate>
        <fieldset>
          <legend className="first">What does not match?</legend>
          {MISMATCH_KINDS.map((option) => (
            <label key={option} className={`rd${kind === option ? " on" : ""}`}>
              <input type="radio" name={`${ids}-kind`} value={option} checked={kind === option} onChange={() => setKind(option)} />
              <i aria-hidden="true" />{option}
            </label>
          ))}
        </fieldset>
        <label className="q" htmlFor={`${ids}-setting`}>Which setting?</label>
        <select id={`${ids}-setting`} className="op-select" defaultValue="">
          <option value="" disabled>Choose a setting</option>
          {LEVERS.map(({ key }) => <option key={key} value={key}>{LEVER_LABELS[key]}</option>)}
        </select>
        <label className="q" htmlFor={`${ids}-text`}>What do you see?</label>
        <textarea id={`${ids}-text`} className="op-text" placeholder="Type what you see" maxLength={500} />
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
          <button type="button" className="mb p" aria-disabled="true" aria-describedby={tried ? `${ids}-nc` : undefined} onClick={() => setTried(true)}>Send to supervisor</button>
          <button type="button" className="mb s" aria-disabled="true" aria-describedby={tried ? `${ids}-nc` : undefined} onClick={() => setTried(true)}>Stop and call supervisor</button>
        </div>
        {tried && <NotConnectedNote id={`${ids}-nc`} text="Mismatch reports are not connected yet. Nothing was sent. Tell your supervisor in person." />}
      </form>
      <div className="lb" style={{ fontSize: 13.5, lineHeight: 1.5, marginTop: 16 }}>A mismatch report does not change the card.</div>
    </section>
  );
}

/** The operator's phone view. It has no sidebar or top bar, as in Operator-Phone. */
export function Operator({ theme, toggleTheme }: { theme: Theme; toggleTheme: () => void }) {
  const load = useOperatorJob();
  // The design shows the form beside the card at full width; on a phone it opens on request.
  const [sheetOpen, setSheetOpen] = useState(() => matchMedia("(min-width: 1400px)").matches);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const reportRef = useRef(false);
  useEffect(() => {
    if (sheetOpen && reportRef.current) headingRef.current?.focus();
    reportRef.current = false;
  }, [sheetOpen]);
  const job = load.state === "ready" ? load.job : null;
  const title = job ? `${job.jobSheet.order.itemCode}${job.revision ? `, Rev ${job.revision.number}` : ""}` : "";
  const canReport = job !== null && job.jobSheet.status !== "DRAFT";
  return (
    <main id="main" className="op">
      <div className="op-intro">
        <div className="th">Operator handoff</div>
        <h1>The same card, on the operator's phone.</h1>
        <div className="lb">Opens the exact revision the supervisor approved.</div>
      </div>
      <div className="op-notes">
        {NOTES.map(([heading, text]) => <div key={heading}><b>{heading}</b><div className="lb">{text}</div></div>)}
      </div>
      <div className="op-theme"><ThemeSwitch theme={theme} toggle={toggleTheme} /></div>
      <section className="ph2 kr op-card" aria-label="Approved job card" aria-busy={load.state === "loading"}>
        {load.state === "loading" && <p className="lb" role="status" style={{ margin: 0 }}>Reading the approved card.</p>}
        {load.state === "missing" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h2 className="brandw" style={{ margin: 0 }}>Approved job card</h2><ProvenanceChip kind="not-connected" />
            </div>
            <p className="lb" style={{ margin: "12px 0 0", fontSize: 15, lineHeight: 1.5 }}>{load.text}</p>
          </>
        )}
        {job && <CardView job={job} onReport={() => { reportRef.current = true; setSheetOpen(true); if (sheetOpen) headingRef.current?.focus(); }} />}
      </section>
      {canReport && sheetOpen && <MismatchSheet title={title} onClose={() => setSheetOpen(false)} headingRef={headingRef} />}
    </main>
  );
}
