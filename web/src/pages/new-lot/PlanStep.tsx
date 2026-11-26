import { useState } from "react";
import { Alert, Button, Card, Chip, NotConnected, TableRow } from "../../ui/components";
import { Icon } from "../../ui/icons";
import { DEFECTS, formatMoney } from "../../lib/api";
import { LEVERS, type JobResult } from "../../lib/session";
import { ActionBand, CheckLine } from "./parts";
import { changeCount, fixed, hasExplanation, leverText, unchangedCount } from "./model";

const lever = (key: string) => LEVERS.find((entry) => entry.key === key);
const unit = (key: string) => { const found = lever(key); return found && "unit" in found ? ` ${found.unit}` : ""; };
const arrow = "M5 12h14M13 6l6 6-6 6";

function Kg({ value }: { value: number }) { return <>{fixed(value, 1)} <small>kg</small></>; }

function ScrapCard({ result }: { result: JobResult }) {
  const { baseline, recommended } = result.jobSheet;
  const currency = recommended.risk.currency;
  return (
    <Card span={4} kraft title="Scrap for this lot" meta={<Chip kind="modeled">Model estimate</Chip>}>
      <div className="nl-figure"><Kg value={baseline.risk.totalScrapKg} /> <Icon path={arrow} /> <Kg value={recommended.risk.totalScrapKg} /></div>
      <p className="nl-sentence"><b>{fixed(Math.max(0, result.jobSheet.savings.kg), 1)} kg</b> and <b>{formatMoney(Math.max(0, result.jobSheet.savings.inr), currency)}</b> lower, modeled</p>
      <div className="nl-rows">
        <div><span>Entered plan</span><b>{fixed(baseline.risk.totalScrapKg, 1)} kg</b><b>{formatMoney(baseline.risk.scrapCost, baseline.risk.currency)}</b></div>
        <div><span>Recommended</span><b>{fixed(recommended.risk.totalScrapKg, 1)} kg</b><b>{formatMoney(recommended.risk.scrapCost, currency)}</b></div>
      </div>
    </Card>
  );
}

function ChangesCard({ result, explain }: { result: JobResult; explain?: () => void }) {
  const cols = "1.4fr 1fr 1.6fr";
  const { changes } = result.jobSheet;
  return (
    <Card span={8} title={`${changeCount(result)} of ${LEVERS.length} settings change`} meta="Compared with the plan you entered">
      <TableRow columns={cols} head><span>Setting</span><span>Entered</span><span>Recommended</span></TableRow>
      {changes.map((change) => (
        <TableRow key={change.lever} columns={cols}>
          <span className="nl-strong">{lever(change.lever)?.label ?? change.lever}</span>
          <span className="nl-muted">{leverText(change.lever, change.from)}{unit(change.lever)}</span>
          <span className="nl-rec"><b>{leverText(change.lever, change.to)}{unit(change.lever)}</b><Chip kind="accent">Changed</Chip></span>
        </TableRow>
      ))}
      {changes.length === 0 && <p className="nl-label nl-foot">The entered plan is already the best one found.</p>}
      <div className="nl-card-foot"><span className="nl-label">{unchangedCount(result)} settings unchanged</span>{explain && <Button variant="secondary" size="small" onClick={explain}>Explain</Button>}</div>
    </Card>
  );
}

export function PlanStep({ result, onReview }: { result: JobResult; onReview: () => void }) {
  const [explaining, setExplaining] = useState(false);
  const [keepNote, setKeepNote] = useState(false);
  const { baseline, recommended } = result.jobSheet;
  return (
    <div className="grid">
      {!hasExplanation(result) && <div className="span-12"><Alert tone="warn" title="Approval is held while the explanation is missing." /></div>}
      <ScrapCard result={result} />
      <ChangesCard result={result} explain={hasExplanation(result) ? () => setExplaining(!explaining) : undefined} />
      {explaining && (
        <Card span={12} title="Why these settings">
          <p className="nl-explanation">{result.jobSheet.explanation}</p>
        </Card>
      )}
      <Card span={7} title="Constraints for this comparison">
        <NotConnected title="Constraints are not connected yet.">Plant rules still apply to every recommendation.</NotConnected>
      </Card>
      <Card span={5} title="Trade-off and choice">
        <ul className="nl-tradeoff">
          {DEFECTS.map((defect) => (
            <li key={defect.key}><span>{defect.label}</span><b>{fixed(baseline.risk.ratesPct[defect.key], 2)}% <Icon path={arrow} /> {fixed(recommended.risk.ratesPct[defect.key], 2)}%</b></li>
          ))}
        </ul>
        <p className="nl-label">Predicted scrap rate by defect, entered plan to recommended.</p>
        <div className="nl-choice">
          <Button onClick={onReview}>Review job card<Icon path={arrow} /></Button>
          <Button variant="secondary" onClick={() => setKeepNote(true)}>Keep entered plan</Button>
          {keepNote && <NotConnected title="Approving the entered plan is not connected yet.">Review the recommended job card instead.</NotConnected>}
        </div>
      </Card>
      <Card span={12} title="How far to trust this">
        <NotConnected title="Model scores are not connected yet.">{result.confidence === "reduced" ? "The server marked this result as reduced confidence." : "The server returned no pass levels for this lot."}</NotConnected>
      </Card>
    </div>
  );
}

export function RecoveryStep({ result, held, onRetry, onContinue, onHold }: {
  result: JobResult; held: boolean; onRetry: () => void; onContinue: () => void; onHold: () => void;
}) {
  const [retryNote, setRetryNote] = useState(false);
  const { baseline, recommended, changes } = result.jobSheet;
  const cols = "1.4fr 1fr 1fr";
  return (
    <>
      <ActionBand tone="warn" title="The explanation is not available." text={held ? "This lot is held. Nothing is approved." : `The comparison is saved for ${result.revision ? `Rev ${result.revision.number}` : "this lot"}. Approval is held.`}>
        <Button onClick={() => { setRetryNote(true); onRetry(); }}>Retry explanation</Button>
        <Button variant="secondary" onClick={onContinue}>Continue with saved numbers</Button>
        <Button variant="secondary" onClick={onHold}>Hold this lot</Button>
      </ActionBand>
      {retryNote && <NotConnected title="Retrying the explanation alone is not connected yet.">The saved numbers stay as they are.</NotConnected>}
      <div className="grid nl-gap-top">
        <Card span={8} kraft title="What finished" meta={<Chip>Saved with this lot</Chip>}>
          <CheckLine ok>Defect estimate<span className="nl-trail">Done</span></CheckLine>
          <CheckLine ok>Limited search<span className="nl-trail">Done</span></CheckLine>
          <CheckLine ok={false}>Explanation<span className="nl-trail">Not available</span></CheckLine>
          <p className="nl-small-caps">Saved comparison</p>
          <TableRow columns={cols} head><span>Setting</span><span>Entered</span><span>Recommended</span></TableRow>
          {changes.map((change) => (
            <TableRow key={change.lever} columns={cols}>
              <span className="nl-strong">{lever(change.lever)?.label ?? change.lever}</span>
              <span className="nl-muted">{leverText(change.lever, change.from)}{unit(change.lever)}</span>
              <span className="nl-rec"><b>{leverText(change.lever, change.to)}{unit(change.lever)}</b></span>
            </TableRow>
          ))}
          <div className="nl-card-foot">
            <span className="nl-label">Scrap</span>
            <span className="nl-figure nl-figure-small"><Kg value={baseline.risk.totalScrapKg} /> <Icon path={arrow} /> <Kg value={recommended.risk.totalScrapKg} /></span>
            <Chip kind="modeled">Model estimate</Chip>
          </div>
        </Card>
        <Card span={4} title="What each choice does">
          <dl className="nl-choices">
            <dt>Retry explanation</dt><dd>Runs again on the same revision. Saved numbers stay.</dd>
            <dt>Continue with saved numbers</dt><dd>Only if plant rules allow.</dd>
            <dt>Hold this lot</dt><dd>Keeps the revision and the reason. Nothing is approved.</dd>
          </dl>
        </Card>
      </div>
      <details className="card nl-tech">
        <summary>Technical details<span>Reference and diagnostics</span></summary>
        <dl>
          <dt>Run</dt><dd>{result.runId ?? "Not recorded"}</dd>
          <dt>Confidence</dt><dd>{result.confidence ?? "Not recorded"}</dd>
          <dt>Notes</dt><dd>{result.conditionNotes?.join(" ") || "Not recorded"}</dd>
        </dl>
      </details>
      <section className="card nl-foot-band"><Icon path="M12 3.5l9.5 16.5h-19zM12 10v5M12 17.6v.1" /><b>Approval is held while the explanation is missing.</b><span>If an input changes, the saved comparison is marked out of date.</span></section>
    </>
  );
}
