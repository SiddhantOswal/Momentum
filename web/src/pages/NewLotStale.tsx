import { useEffect, useState } from "react";
import { Banner, Button, ButtonLink, Card, LabelChip } from "../components/m";
import type { LotRecord, PlanResult } from "./newlot/api";
import { readLotRecord } from "./newlot/actions";
import { CardSettings } from "./newlot/card-view";
import { IdsBar, NewLotPage, StatusRow, Toasts, useToasts } from "./newlot/parts";
import { CONDITION_FIELDS, type LotState } from "./newlot/store";

const PROVENANCE_LABEL: Record<string, string> = { operator_entry: "Entered by operator", synthetic_example: "Example value" };

/** What the lot record says replaced this revision, read from GET /lots/:lotId. */
function WhatChanged({ lotId, jobId }: { lotId?: string; jobId: string }) {
  const [record, setRecord] = useState<LotRecord | "missing">();
  useEffect(() => {
    if (!lotId) { setRecord("missing"); return; }
    let live = true;
    readLotRecord(lotId).then((result) => { if (live) setRecord(result.ok ? result.data : "missing"); });
    return () => { live = false; };
  }, [lotId]);

  const revision = record && record !== "missing" ? record.revision : null;
  const reason = revision?.jobId === jobId ? revision.supersededReason : null;
  const newer = record && record !== "missing" && revision && revision.jobId !== jobId ? revision.number : undefined;
  const field = reason ? CONDITION_FIELDS.find((entry) => entry.key === reason.field)?.label ?? reason.field : undefined;
  const label = reason?.provenance ? PROVENANCE_LABEL[reason.provenance] : undefined;

  return (
    <section className="cd kr" aria-labelledby="nl-changed">
      <div className="ct"><h2 className="t" id="nl-changed">What changed</h2>{label && <LabelChip label={label} />}</div>
      {record === undefined ? <p className="lb" style={{ margin: 0 }}>Reading the lot record.</p>
        : reason ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, padding: "6px 0", gap: 12 }}><span className="lb">Input</span><b>{field}</b></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, padding: "6px 0", gap: 12 }}><span className="lb">Edited in</span><b>Conditions</b></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, padding: "6px 0", gap: 12 }}><span className="lb">Edited by</span><b>{reason.byRole ?? "Not recorded"}</b></div>
          </>
        ) : newer !== undefined ? (
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, padding: "6px 0", gap: 12 }}><span className="lb">Replaced by</span><b>Rev {newer}</b></div>
        ) : <p className="lb" style={{ margin: 0 }}>The lot record does not say which input changed.</p>}
      <div className="lb" style={{ fontSize: 13.5, lineHeight: 1.45, marginTop: 8 }}>An edit marks results built on it out of date.</div>
    </section>
  );
}

export function NewLotStale({ lot, plan }: { lot: LotState; plan: PlanResult }) {
  const sheet = plan.jobSheet;
  const number = lot.stale?.number ?? plan.revision?.number;
  const rev = number === undefined ? "This draft" : `Rev ${number}`;
  const { toasts, dismiss } = useToasts([{ id: "blocked", tone: "bd", title: "Approval blocked", text: `${rev} was replaced. Plan the lot again.` }]);
  return (
    <NewLotPage step={4} sub="Out of date. Nothing has been approved."
      ids={<IdsBar lot={lot} status="Out of date, approval blocked" next="Operator: plan this lot again" replaced />}
      toasts={<Toasts toasts={toasts} dismiss={dismiss} />}>
      <div className="g">
        <Banner tone="warn" title={`An input changed after ${number === undefined ? "this draft" : `Rev ${number}`} was prepared.`}
          actions={<>
            <ButtonLink arrow href="#/new-lot/conditions">Plan this lot again</ButtonLink>
            <ButtonLink variant="secondary" href="#/home">Keep {rev} as history</ButtonLink>
          </>}>
          A replaced revision cannot be approved. Plan the lot again.
        </Banner>
        <Card span={8} title={`Job card, ${sheet.order.itemCode}${number === undefined ? "" : `, Rev ${number}`}`} meta={<LabelChip label="Replaced, read only" />}>
          <div className="lb" style={{ margin: "-8px 0 10px" }}>These values no longer match the lot.</div>
          <CardSettings sheet={sheet} columns="1fr 150px 130px" dim trailing={() => null} />
        </Card>
        <div className="c4" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <WhatChanged lotId={lot.lotId ?? plan.revision?.lotId} jobId={sheet.jobId} />
          <Card title="What is now out of date">
            <StatusRow kind="warn" name="Defect estimate" state="Needs a new run" />
            <StatusRow kind="warn" name="Limited search" state="Needs a new run" />
            <StatusRow kind="warn" name="Explanation" state="Needs a new run" />
            <StatusRow kind="warn" name={`Job card ${rev}`} state="Replaced" />
          </Card>
        </div>
        <section className="cd c12 bar" style={{ display: "flex", gap: 20, alignItems: "center", padding: "14px 20px", flexWrap: "wrap" }}>
          <Button disabled aria-describedby="nl-stale-note">Approve {rev}</Button>
          <span className="lb" id="nl-stale-note" style={{ fontSize: 14 }}>Off. {rev} is replaced and cannot be approved.</span>
        </section>
      </div>
    </NewLotPage>
  );
}
