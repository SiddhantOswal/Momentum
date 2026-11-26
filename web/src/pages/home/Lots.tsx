import type { ReactNode } from "react";
import { Card, Icon, IdleMark, Table } from "../../components/m";
import { formatNumber, type Result } from "../../lib/api";
import { timeAgo, type LiveEvent, type LiveLot } from "../../lib/live";
import { href } from "../../lib/routes";
import { DEFECT_NAME, STATUS_VIEW, leverChange, leverLabel, sheetFor, type JobResponse } from "./data";

const ReadyMark = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2.6" fill="currentColor" /></svg>
);

function Status({ status }: { status: LiveLot["status"] }) {
  const view = STATUS_VIEW[status];
  const icon = view.tone === "ok" ? <Icon name="ok" /> : view.tone === "bd" ? <Icon name="bad" /> : <ReadyMark />;
  return <span className={`sx ${view.tone}`}>{icon}{view.text}</span>;
}

function ModelFlag({ lot }: { lot: LiveLot }) {
  const flagged = lot.lowConfidence ?? [];
  if (flagged.length === 0) return <span className="lb">–</span>;
  return (
    <span className="sx bd" style={{ whiteSpace: "normal" }}>
      <Icon name="bad" />{flagged.map((defect) => DEFECT_NAME[defect]).join(", ")}: low confidence
    </span>
  );
}

/** Stored lots, newest first, from /api/lots and the live stream. Lot heads cannot be listed
 * yet, so the stage column shows a dash rather than a guessed stage. */
export function SampleOrders({ lots, job }: { lots: LiveLot[]; job?: Result<JobResponse> }) {
  const sheet = sheetFor(job, lots[0]);
  const rows = lots.slice(0, 5).map((lot) => ({
    key: lot.lotId,
    cells: [
      <div key="lot"><div style={{ fontWeight: 600, fontSize: 16 }}>{lot.itemCode}</div><div className="lb" style={{ fontSize: 13, overflowWrap: "anywhere" }}>{lot.orderId}</div></div>,
      <span key="stage" className="lb">–<span className="sr-only">Stage not recorded</span></span>,
      <ModelFlag key="flag" lot={lot} />,
      <Status key="status" status={lot.status} />,
    ],
  }));
  return (
    <Card title="Approved sample orders" span={8} className="hm-orders">
      <div className="hm-cont">
        <span style={{ fontSize: 15, fontWeight: 600 }}>Continue review</span>
        <span className="lb">Open reviews are not listed here yet.</span>
      </div>
      <Table label="Lots from approved sample orders" rowHeight={56}
        columns={[{ label: "Lot", width: "170px" }, { label: "Stage", width: "150px" }, { label: "Model flag", width: "184px" }, { label: "Status", width: "1fr" }]}
        rows={rows} empty="No lots yet. Try a sample order to start one." />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, borderTop: "1px solid var(--ln)", paddingTop: 14, marginTop: 2 }}>
        <span className="lb" style={{ fontSize: 14, color: "var(--tx)" }}>
          {sheet && `Humidity ${formatNumber(sheet.conditions.ambientRhPct, 1)}% ${sheet.conditions.supervisorConfirmed ? "confirmed" : "entered"}. Paper moisture ${formatNumber(sheet.conditions.paperMoisturePct, 1)}%.`}
        </span>
        <a className="lk" href={href("new-lot/conditions")}>Edit conditions</a>
      </div>
    </Card>
  );
}

const PAPER: Record<string, string> = { RECYCLED: "Recycled", VIRGIN: "Virgin", MIXED: "Mixed" };

/** The kraft job card: the newest draft that waits for a supervisor. */
export function JobCardSummary({ lot, job }: { lot?: LiveLot; job?: Result<JobResponse> }) {
  const order = sheetFor(job, lot)?.order;
  return (
    <section className="cd kr c4" aria-labelledby="hm-card-title" style={{ display: "flex", flexDirection: "column", padding: 22 }}>
      <h2 id="hm-card-title" style={{ margin: 0, font: "700 13px 'Inter',sans-serif", letterSpacing: ".16em", textTransform: "uppercase" }}>Job card</h2>
      {lot
        ? (
          <>
            <div className="d" style={{ fontSize: 32, lineHeight: "38px", fontWeight: 700, marginTop: 14, letterSpacing: "-.5px" }}>{lot.itemCode}</div>
            <div style={{ fontSize: 15, color: "var(--mu)" }}>
              {order && `${PAPER[order.paperType] ?? order.paperType} ${order.ply}-ply ${order.fluteProfile}, `}{formatNumber(lot.quantity)} boxes
            </div>
            <div style={{ marginTop: 16 }}>
              {(lot.changes ?? []).map((change) => (
                <div key={change.lever} className="hm-card-row">
                  <span style={{ fontSize: 14, color: "var(--mu)" }}>{leverLabel(change.lever)}</span>
                  <span className="n">{leverChange(change)}</span>
                </div>
              ))}
              {(lot.changes ?? []).length === 0 && <div className="hm-card-row"><span style={{ fontSize: 14, color: "var(--mu)" }}>No setting changes</span></div>}
            </div>
            <div style={{ flex: 1, minHeight: 10 }} />
            <div style={{ fontSize: 14, color: "var(--mu)", marginBottom: 10 }}>Draft. A supervisor approves it.</div>
            <a className="bt hm-open" href={href("new-lot/approve")}>Open job card<Icon name="arrow" /></a>
          </>
        )
        : (
          <>
            <div style={{ fontSize: 15, color: "var(--mu)", marginTop: 14 }}>No draft is waiting for approval.</div>
            <div style={{ flex: 1, minHeight: 10 }} />
            <a className="bt hm-open" href={href("new-lot/order")}>Try a sample order<Icon name="arrow" /></a>
          </>
        )}
    </section>
  );
}

type Step = { name: string; state: "done" | "next" | "idle"; detail: string };

function steps(lot: LiveLot | undefined, job: Result<JobResponse> | undefined): Step[] {
  if (!lot) {
    return ["Order read", "Catalog matched", "Conditions confirmed", "Settings compared", "Draft saved", "Approved and stored"]
      .map((name, index) => ({ name, state: index === 0 ? "next" : "idle", detail: index === 0 ? "Next step" : "Not yet" }));
  }
  const sheet = sheetFor(job, lot);
  const changed = lot.changes?.length ?? 0;
  const approved = lot.status !== "planned" && lot.status !== "blocked";
  // Only the job record says whether a supervisor confirmed the conditions; the lot list does not.
  const conditions: Step = !sheet
    ? { name: "Conditions confirmed", state: "idle", detail: "Not known here" }
    : sheet.conditions.supervisorConfirmed
      ? { name: "Conditions confirmed", state: "done", detail: `Humidity ${formatNumber(sheet.conditions.ambientRhPct, 1)}%` }
      : { name: "Conditions confirmed", state: "idle", detail: "Entered, not confirmed" };
  return [
    { name: "Order read", state: "done", detail: `${formatNumber(lot.quantity)} boxes` },
    { name: "Catalog matched", state: "done", detail: lot.itemCode },
    conditions,
    { name: "Settings compared", state: "done", detail: changed === 1 ? "1 setting changed" : `${changed} settings changed` },
    { name: "Draft saved", state: "done", detail: "Saved" },
    approved
      ? { name: "Approved and stored", state: "done", detail: "Approved" }
      : { name: "Approved and stored", state: "next", detail: "Next step" },
  ];
}

const STEP_MARK: Record<Step["state"], ReactNode> = {
  done: <span className="sx ok"><Icon name="ok" /><span className="sr-only">Done: </span></span>,
  next: <span className="sx ac"><ReadyMark /><span className="sr-only">Next: </span></span>,
  idle: <span className="sx id"><IdleMark /><span className="sr-only">Not done: </span></span>,
};

/** The steps of the newest stored lot, each from what that lot record holds. */
export function RunSteps({ lot, job }: { lot?: LiveLot; job?: Result<JobResponse> }) {
  const list = steps(lot, job);
  return (
    <Card title="Latest run steps" meta={lot ? `Updated ${timeAgo(lot.updatedAt)}` : "No stored lot yet"} span={4}>
      <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {list.map((step, index) => (
          <li key={step.name} className="hm-step">
            {STEP_MARK[step.state]}
            {index < list.length - 1 && <i aria-hidden="true" />}
            <span style={{ fontSize: 15, color: step.state === "idle" ? "var(--mu)" : undefined }}>{step.name}</span>
            <span className="lb" style={{ fontSize: 13, textAlign: "right" }}>{step.detail}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

/** Floor events from /api/live (B9). The approved Main screen has no activity list yet. */
export function Activity({ events }: { events: LiveEvent[] }) {
  return (
    <Card title="Activity" span={12} className="hm-activity">
      <Table label="Recent activity" columns={[{ label: "When", width: "120px" }, { label: "What happened", width: "1fr" }, { label: "By", width: "200px" }]}
        rows={events.slice(0, 8).map((event, index) => ({
          key: `${event.at}-${index}`,
          cells: [<span key="at" className="lb">{timeAgo(event.at)}</span>, <span key="text" style={{ overflowWrap: "anywhere" }}>{event.text}</span>, <span key="by" className="lb">{event.actor ?? "–"}</span>],
        }))}
        empty="No activity recorded yet." />
    </Card>
  );
}
