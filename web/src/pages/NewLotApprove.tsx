import { useCallback, useEffect, useState } from "react";
import { Banner, Button, ButtonLink, Card, Chip, ProvenanceChip } from "../components/m";
import { call, type JobSheet, type PlanResult, type Revision } from "./newlot/api";
import { cardPdfHref, readJob, REPLACED_MESSAGE } from "./newlot/actions";
import { CardSettings, RouteOnCard, cardSummary } from "./newlot/card-view";
import { IdsBar, NewLotPage, StatusIcon, StatusRow, Toasts, kg, useToasts } from "./newlot/parts";
import { inputsChanged, markStale, updateLot, useLot, type LotState } from "./newlot/store";
import { NewLotStale } from "./NewLotStale";

type Stored = { jobSheet: JobSheet; revision?: Revision };

/** Guard codes that mean the reviewed draft is no longer the lot's current revision. */
const REPLACED = new Set(["REVISION_SUPERSEDED", "REVISION_NOT_REGISTERED", "REVISION_FINGERPRINT_MISMATCH"]);

function useStoredDraft(jobId: string | undefined) {
  const [state, setState] = useState<{ loading: boolean; stored?: Stored; error?: string }>({ loading: !!jobId });
  const load = useCallback(() => {
    if (!jobId) return () => {};
    let live = true;
    setState({ loading: true });
    // Reads the stored draft back (J1 step 10), so the page shows what the server holds, not the plan response.
    readJob(jobId).then((result) => {
      if (!live) return;
      setState(result.ok ? { loading: false, stored: result.data } : { loading: false, error: result.message });
    });
    return () => { live = false; };
  }, [jobId]);
  useEffect(() => load(), [load]);
  return { ...state, reload: load };
}

function ApproveView({ lot, plan }: { lot: LotState; plan: PlanResult }) {
  const jobId = plan.jobSheet.jobId;
  const { loading, stored, error, reload } = useStoredDraft(jobId);
  const { toasts, show, dismiss } = useToasts();
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [approveError, setApproveError] = useState<string>();

  useEffect(() => {
    const read = stored?.revision;
    if (read?.status === "CURRENT") show({ id: "saved", tone: "ok", title: "Draft saved", text: `Rev ${read.number} is stored and read back.` });
    // The draft can be replaced from elsewhere, such as an edit made through Arc.
    if (read?.status === "SUPERSEDED") markStale({ jobId, number: read.number, message: REPLACED_MESSAGE });
  }, [stored, show, jobId]);

  const approved = lot.approved?.jobSheet.jobId === jobId ? lot.approved : stored?.jobSheet.status === "APPROVED" ? stored : undefined;
  const sheet = approved?.jobSheet ?? stored?.jobSheet ?? plan.jobSheet;
  // The guard checks the fingerprint the server reads back now, never the one the plan returned.
  const revision = stored?.revision;
  const unregistered = !!stored && !approved && (!revision || !revision.fingerprint);
  const number = revision?.number ?? plan.revision?.number;
  const rev = number === undefined ? "this draft" : `Rev ${number}`;
  const changed = inputsChanged(lot);
  const canApprove = !approved && !changed && revision?.status === "CURRENT" && !!revision.fingerprint;

  // This handler is the only caller of the approve route. Arc has no tool that reaches it.
  const approve = async () => {
    if (!reviewed || !canApprove || busy) return;
    setBusy(true); setApproveError(undefined);
    const result = await call<Stored>(`/jobs/${encodeURIComponent(jobId)}/approve?lang=en&currency=INR`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewConfirmed: true, revisionFingerprint: revision!.fingerprint }),
    });
    setBusy(false);
    if (result.ok) {
      updateLot({ approved: { jobSheet: result.data.jobSheet, revision: result.data.revision } });
      show({ id: "approved", tone: "ok", title: "Job card approved", text: "Demo session, simulated. The PDF is stored." });
      return;
    }
    if (result.status === 409 && result.code && REPLACED.has(result.code)) {
      markStale({ jobId, number, message: result.message });
      return;
    }
    setApproveError(result.message);
  };

  const status = approved ? "Approved, demo session" : loading ? "Reading the draft back" : "Draft, not approved";
  const next = approved ? "Operator: print the card" : "Supervisor approval";
  const steps: [Parameters<typeof StatusRow>[0]["kind"], string, string][] = [
    [stored ? "ok" : loading ? "now" : "bad", "Draft saved",
      !stored ? (loading ? "Reading it back" : "Not read back") : revision ? `Rev ${revision.number}, stored` : "Stored, no revision"],
    [approved ? "ok" : "now", "Supervisor review", approved ? "Done" : "Waiting for a decision"],
    [approved ? "ok" : "idle", "Approved", approved ? "Demo session, simulated" : "Not yet"],
    [approved?.jobSheet.cardUri ? "ok" : "idle", "PDF stored", approved?.jobSheet.cardUri ? "Stored" : "Not yet"],
    ["idle", "Card checked", "Not connected"],
  ];

  return (
    <NewLotPage step={4} sub="Review the job card. Approving issues it."
      ids={<IdsBar lot={lot} status={status} next={next} />} toasts={<Toasts toasts={toasts} dismiss={dismiss} />}>
      <div className="g">
        {error && (
          <Banner tone="bad" title="The draft could not be read back." actions={<Button small variant="secondary" onClick={reload}>Try again</Button>}>
            {error} Approval stays off until it is read back.
          </Banner>
        )}
        {unregistered && (
          <Banner tone="warn" title="This draft has no registered revision." actions={<ButtonLink small arrow href="#/new-lot/conditions">Plan this lot again</ButtonLink>}>
            The server did not return a revision for it, so it cannot be approved. Plan the lot again to approve it.
          </Banner>
        )}
        {changed && !approved && (
          <Banner tone="warn" title="Your inputs changed after this plan was made." actions={<ButtonLink small arrow href="#/new-lot/conditions">Plan this lot again</ButtonLink>}>
            Approval stays off until the lot is planned with the new values.
          </Banner>
        )}
        <section className="cd kr c8" aria-labelledby="nl-card">
          <div className="ct">
            <h2 className="t" id="nl-card">Job card, {sheet.order.itemCode}{number === undefined ? "" : `, Rev ${number}`}</h2>
            {approved ? <Chip>Approved</Chip> : <Chip tone="modeled">Draft, not approved</Chip>}
          </div>
          <div className="lb" style={{ margin: "-8px 0 10px" }}>{cardSummary(sheet, plan)}</div>
          <CardSettings sheet={sheet} columns="1fr 150px 130px 100px"
            trailing={(isChanged) => <span role="cell">{isChanged ? <Chip tone="accent">Changed</Chip> : <span className="lb">Unchanged</span>}</span>} />
          <div className="lb" style={{ fontSize: 13, padding: "10px 0 12px", borderTop: "1px solid var(--ln)" }}>The card shows every value with its unit.</div>
          <RouteOnCard sheet={sheet} />
        </section>
        <div className="c4" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card title="Supervisor decision">
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, paddingBottom: 8, gap: 12 }}><span className="lb">Acting as</span><b>Supervisor, demo session</b></div>
            {steps.map(([kind, name, state]) => <StatusRow key={name} kind={kind} name={name} state={state} />)}
            {approved ? (
              <div style={{ borderTop: "1px solid var(--ln)", marginTop: 4, paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                <ProvenanceChip kind="demo-session" />
                <span className="lb" style={{ lineHeight: 1.45 }}>A simulated approval in a demo session, not a named supervisor. No machine setting changes until someone acts on the card.</span>
              </div>
            ) : (
              <>
                <div style={{ borderTop: "1px solid var(--ln)", marginTop: 4, paddingTop: 12, fontSize: 14, lineHeight: 1.45, color: "var(--mu)" }}>
                  Approving {rev}: {sheet.changes.length} {sheet.changes.length === 1 ? "change" : "changes"}.
                </div>
                <label className="ck" style={{ marginTop: 12, fontSize: 15 }}>
                  <input type="checkbox" checked={reviewed} disabled={!canApprove} onChange={(event) => setReviewed(event.target.checked)} />
                  I reviewed the settings and limits on this card.
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 14 }}>
                  <Button style={{ flex: 1 }} disabled={!reviewed || !canApprove || busy} onClick={approve} aria-describedby="nl-approve-note">
                    {busy ? "Approving" : `Approve ${rev}`}
                  </Button>
                  <ButtonLink variant="secondary" href="#/home">Keep as draft</ButtonLink>
                </div>
                <p className="lb" id="nl-approve-note" style={{ fontSize: 13, margin: "10px 0 0", lineHeight: 1.45 }}>
                  <ProvenanceChip kind="demo-session" /> The approval is recorded as a simulated demo-session approval.
                </p>
                {approveError && <p className="err" role="alert">{approveError}</p>}
              </>
            )}
          </Card>
          <section className="cd" style={{ flex: 1, display: "flex", flexDirection: "column" }} aria-labelledby="nl-pdf">
            <div className="ct"><h2 className="t" id="nl-pdf">Approved PDF</h2><span className="mt">{approved?.jobSheet.cardUri ? "Stored" : "Not created yet"}</span></div>
            <div className="lb" style={{ lineHeight: 1.5 }}>Saves the PDF. Demo session only.</div>
            <div style={{ flex: 1, marginTop: 14, minHeight: 110, border: "1.5px dashed var(--ln2)", borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: "var(--mu)", padding: 12 }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3h8l4 4v14H6zM14 3v4h4" /></svg>
              {approved?.jobSheet.cardUri
                ? <a className="lk" href={cardPdfHref(jobId)} target="_blank" rel="noreferrer">Open the job card PDF</a>
                : <span className="lb">Created on approval</span>}
            </div>
          </section>
        </div>
        <section className="cd c12 bar" style={{ display: "flex", gap: 24, alignItems: "center", padding: "14px 20px", flexWrap: "wrap" }}>
          <span className="lb">Modeled scrap</span>
          <span className="n" style={{ fontSize: 24, fontWeight: 600, whiteSpace: "nowrap" }}>
            {kg(sheet.baseline.risk.totalScrapKg)} &rarr; {kg(sheet.recommended.risk.totalScrapKg)} <small style={{ fontSize: 15, color: "var(--mu)", fontWeight: 500 }}>kg</small>
          </span>
          <span className="lb">Predicted by the model for this lot.</span>
          <span className="sx wn" style={{ marginLeft: "auto", whiteSpace: "normal" }}><StatusIcon kind="warn" />If the proposal changes, approval is rejected.</span>
        </section>
      </div>
    </NewLotPage>
  );
}

export function NewLotApprove() {
  const lot = useLot();
  const plan = lot.plan;
  if (!plan) {
    return (
      <NewLotPage step={4} sub="Review the job card. Approving issues it." ids={<IdsBar lot={lot} status="No draft yet" next="Operator: plan this lot" />}>
        <div className="g">
          <Card span={12} title="No draft yet">
            <p className="lb" style={{ margin: "0 0 14px", fontSize: 15 }}>Plan the lot first. The job card draft appears here for review.</p>
            <ButtonLink href={lot.partial ? "#/new-lot/settings" : "#/new-lot/conditions"} arrow>{lot.partial ? "Go to Settings and risk" : "Go to Conditions"}</ButtonLink>
          </Card>
        </div>
      </NewLotPage>
    );
  }
  if (lot.stale && lot.stale.jobId === plan.jobSheet.jobId) return <NewLotStale lot={lot} plan={plan} />;
  return <ApproveView lot={lot} plan={plan} />;
}
