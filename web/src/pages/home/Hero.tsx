import machine from "./machine.html?raw";
import { ButtonLink, IdleMark } from "../../components/m";
import { href } from "../../lib/routes";
import type { LiveLot } from "../../lib/live";
import type { Result } from "../../lib/api";
import { sheetFor, type JobResponse } from "./data";

const kg = (value: number) => new Intl.NumberFormat("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);

/** The reference line under the buttons: scrap for the newest stored plan, from its job record. */
function RunLine({ lot, job }: { lot?: LiveLot; job?: Result<JobResponse> }) {
  if (!lot) {
    return <div className="lb" style={{ fontSize: 15 }}>No prepared run yet. Try a sample order to make one.</div>;
  }
  const sheet = sheetFor(job, lot);
  return (
    <div>
      <div className="lb" style={{ fontSize: 13 }}>Latest prepared run, {lot.itemCode}</div>
      {sheet
        ? (
          <div className="n" style={{ fontSize: 22, lineHeight: "28px", fontWeight: 600, whiteSpace: "nowrap" }}>
            {kg(sheet.baseline.risk.totalScrapKg)} → {kg(sheet.recommended.risk.totalScrapKg)}{" "}
            <span style={{ fontSize: 15, color: "var(--mu)", fontWeight: 500 }}>kg modeled scrap</span>
          </div>
        )
        : <div style={{ fontSize: 15, color: "var(--mu)", marginTop: 2 }}>{job ? "Its scrap figures open in the session that planned it." : "Reading the job record…"}</div>}
    </div>
  );
}

export function Hero({ lots, job }: { lots: LiveLot[]; job?: Result<JobResponse> }) {
  const latest = lots[0];
  const waiting = lots.some((lot) => lot.status === "planned");
  return (
    <section className="cd flush c12 hm-hero" aria-labelledby="hm-hero-title">
      <div className="hm-copy">
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          {waiting
            ? <span className="sx ac" style={{ fontSize: 14, fontWeight: 600 }}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2.6" fill="currentColor" /></svg>Draft waiting for approval</span>
            : <span className="sx id" style={{ fontSize: 14, fontWeight: 600 }}><IdleMark />No review in progress</span>}
        </div>
        <h2 id="hm-hero-title" className="d" style={{ margin: "14px 0 6px", fontSize: 36, lineHeight: "42px", fontWeight: 600, letterSpacing: "-.8px" }}>Start with a sample order.</h2>
        <div style={{ fontSize: 16, color: "var(--mu)", maxWidth: 520 }}>Open a sample order and prepare a job card.</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 22 }}>
          <ButtonLink href={href("new-lot/order")} arrow>Try a sample order</ButtonLink>
          <ButtonLink href={href("prep-flow")} variant="secondary">Open reference run</ButtonLink>
        </div>
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 14, marginTop: 22, paddingTop: 16, borderTop: "1px solid var(--ln)" }}>
          <RunLine lot={latest} job={job} />
        </div>
      </div>
      <div className="hm-art">
        <div className="hm-h3" role="img"
          aria-label="3D view: stacks of board stop at two stations while four arms close on them, then move on. A schematic, not a view of your line."
          // Static markup copied from the approved design; it holds no data and no user input.
          dangerouslySetInnerHTML={{ __html: machine }} />
      </div>
    </section>
  );
}

