import { useState } from "react";
import { Button, Card, CheckRow, Chip, Status, type Tone } from "../../ui/components";
import { Icon } from "../../ui/icons";
import { formatNumber } from "../../lib/api";
import { LEVERS, send, type JobResult, type JobSheet } from "../../lib/session";
import { ActionBand } from "./parts";
import { fixed, leverText, revisionLabel, type LotRead } from "./model";

const unit = (key: string) => { const found = LEVERS.find((entry) => entry.key === key); return found && "unit" in found ? ` ${found.unit}` : ""; };
const arrow = "M5 12h14M13 6l6 6-6 6";

function JobCard({ result, replaced }: { result: JobResult; replaced?: boolean }) {
  const sheet = result.jobSheet;
  const changed = new Map(sheet.changes.map((change) => [change.lever, change]));
  const rev = revisionLabel(result);
  const values = sheet.recommended.levers;
  return (
    <Card span={8} kraft={!replaced} title={`Job card, ${sheet.order.itemCode}, ${rev}`}
      meta={replaced ? <Chip kind="missing">Replaced, read only</Chip> : <Chip kind="modeled">{sheet.status === "APPROVED" ? "Approved, demo session" : "Draft, not approved"}</Chip>}>
      <p className="nl-label">{replaced ? "These values no longer match the lot." : `${formatNumber(sheet.order.quantity)} boxes. Humidity ${sheet.conditions.ambientRhPct}%, moisture ${sheet.conditions.paperMoisturePct}%.`}</p>
      <div className="nl-card-rows">
        <div className="nl-card-row nl-card-th"><span>Setting</span><span>{replaced ? `${rev} value` : "Run with"}</span><span /></div>
        {LEVERS.map((lever) => {
          const change = changed.get(lever.key);
          return (
            <div key={lever.key} className="nl-card-row">
              <span className="nl-strong">{lever.label}</span>
              <span className="nl-run"><b>{leverText(lever.key, values[lever.key])}{unit(lever.key)}</b></span>
              <span className="nl-was">{change ? <><span>was {leverText(lever.key, change.from)}{unit(lever.key)}</span>{!replaced && <Chip kind="accent">Changed</Chip>}</> : <span>Entered value</span>}</span>
            </div>
          );
        })}
      </div>
      {!replaced && <p className="nl-label nl-foot">The card shows every value with its unit.</p>}
    </Card>
  );
}

function Steps({ rows }: { rows: { label: string; note: string; tone: Tone }[] }) {
  return <ul className="nl-progress">{rows.map((row) => <li key={row.label}><Status tone={row.tone}>{row.label}</Status><span>{row.note}</span></li>)}</ul>;
}

type Props = {
  result: JobResult; setResult: (next: JobResult) => void; lotRead?: LotRead; lotReadFailed: boolean; held: boolean; noExplanation: boolean;
  replaced: boolean; kept: boolean;
  onKeepDraft: () => void; onPlanAgain: () => void; onKeepHistory: () => void;
};

export function ReviewStep({ result, setResult, lotRead, lotReadFailed, held, noExplanation, replaced, kept, onKeepDraft, onPlanAgain, onKeepHistory }: Props) {
  const sheet = result.jobSheet;
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const approved = sheet.status === "APPROVED";
  const rev = revisionLabel(result);
  const blocked = held || noExplanation;

  const approve = async () => {
    setBusy(true); setError(undefined);
    const r = await send<{ jobSheet: JobSheet; revision?: JobResult["revision"] }>(`/jobs/${encodeURIComponent(sheet.jobId)}/approve?lang=en&currency=INR`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewConfirmed: true, revisionFingerprint: result.revision?.fingerprint }),
    });
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    setResult({ jobSheet: r.data.jobSheet, revision: r.data.revision });
  };

  if (replaced) {
    const reason = typeof lotRead?.revision?.supersededReason === "object" ? lotRead.revision.supersededReason : undefined;
    return (
      <>
        {!kept && (
          <ActionBand tone="warn" title={`An input changed after ${rev} was prepared.`} text="A replaced revision cannot be approved. Plan the lot again.">
            <Button onClick={onPlanAgain}>Plan this lot again<Icon path={arrow} /></Button>
            <Button variant="secondary" onClick={onKeepHistory}>Keep {rev} as history</Button>
          </ActionBand>
        )}
        <div className="grid nl-gap-top">
          <JobCard result={result} replaced />
          <div className="nl-side">
            <Card span={4} kraft title="What changed">
              <dl className="nl-facts">
                <dt>Input</dt><dd>{reason?.field ?? "Not recorded"}</dd>
                <dt>Edited in</dt><dd>{reason?.source ?? "Not recorded"}</dd>
                <dt>Edited by</dt><dd>{reason?.byRole ?? "Not recorded"}</dd>
              </dl>
              <p className="nl-label">An edit marks results built on it out of date.</p>
            </Card>
            <Card span={4} title="What is now out of date">
              <ul className="nl-progress">
                {["Defect estimate", "Limited search", "Explanation"].map((label) => <li key={label}><Status tone="warn">{label}</Status><span>Needs a new run</span></li>)}
                <li><Status tone="warn">Job card {rev}</Status><span>Replaced</span></li>
              </ul>
            </Card>
          </div>
        </div>
        <section className="card nl-confirm">
          <Button disabled>Approve {rev}</Button>
          <span className="nl-hint">Off. {rev} is replaced and cannot be approved.</span>
        </section>
      </>
    );
  }

  const decision: { label: string; note: string; tone: Tone }[] = [
    { label: "Draft saved", note: lotReadFailed ? "Not read back" : `${rev}, stored`, tone: lotReadFailed ? "warn" : "ok" },
    { label: "Supervisor review", note: approved ? "Done" : blocked ? "Held" : "Waiting for a decision", tone: approved ? "ok" : blocked ? "warn" : "active" },
    { label: "Approved", note: approved ? "Demo session, simulated" : "Not yet", tone: approved ? "ok" : "idle" },
    { label: "PDF stored", note: approved ? "Open the card to check it" : "Not yet", tone: approved ? "ok" : "idle" },
    { label: "Card checked", note: "Not recorded", tone: "idle" },
  ];
  const changes = sheet.changes.length;

  return (
    <>
      <div className="grid">
        <JobCard result={result} />
        <div className="nl-side">
          <Card span={4} title="Supervisor decision">
            <div className="nl-acting"><span className="nl-label">Acting as</span><b>Supervisor, demo session</b></div>
            <Steps rows={decision} />
            <p className="nl-label">Approving {rev}: {changes} {changes === 1 ? "change" : "changes"}.</p>
            {!approved && (
              <>
                {noExplanation && <p className="nl-note nl-note-warn">Approval is held while the explanation is missing.</p>}
                {held && <p className="nl-note nl-note-warn">This lot is held.</p>}
                <CheckRow checked={confirmed} onChange={setConfirmed}>I checked the job card against the order, conditions and settings.</CheckRow>
                <div className="nl-decision-actions">
                  <Button disabled={!confirmed || busy || blocked} onClick={approve}>{busy ? "Approving" : `Approve ${rev}`}</Button>
                  <Button variant="secondary" onClick={onKeepDraft}>Keep as draft</Button>
                </div>
                {error && <p className="nl-note nl-note-bad" role="alert">{error}</p>}
              </>
            )}
          </Card>
          <Card span={4} title="Approved PDF" meta={approved ? "Demo session, simulated" : "Not created yet"}>
            <p className="nl-label">Saves the PDF. Demo session only.</p>
            {approved
              ? <a className="button button-primary" href={`/jobs/${encodeURIComponent(sheet.jobId)}/card.pdf`} target="_blank" rel="noreferrer">Open job card (PDF)</a>
              : <div className="nl-pdf-empty"><Icon path="M6 3h8l4 4v14H6zM14 3v4h4" />Created on approval</div>}
          </Card>
        </div>
      </div>
      <section className="card nl-foot-band">
        <span className="nl-label">Modeled scrap</span>
        <span className="nl-figure nl-figure-small">{fixed(sheet.baseline.risk.totalScrapKg, 1)} <Icon path={arrow} /> {fixed(sheet.recommended.risk.totalScrapKg, 1)} <small>kg</small></span>
        <span className="nl-label">A model estimate, not a measured result.</span>
        <b className="nl-foot-warn"><Icon path="M12 3.5l9.5 16.5h-19zM12 10v5M12 17.6v.1" />If the proposal changes, approval is rejected.</b>
      </section>
    </>
  );
}
