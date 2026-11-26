import { useState } from "react";
import conveyor from "./conveyor.svg.html?raw";
import { ButtonLink, Card, Chip, Icon, NotConnected, ProvenanceChip } from "../../components/m";
import type { Defect } from "../../lib/api";
import { href } from "../../lib/routes";
import { DEFECT_NAME, DEFECT_ORDER } from "../home/data";

/** Software checks, photo accuracy and the approved card (U3 to U5): no stored record exists yet,
 * so each shows what is missing instead of the design's figures (ARC-M6-14). */
export function EvidenceTiles() {
  return (
    <div className="c4" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <NotConnected title="Software checks" missing="No stored test-run summary yet. A release will write one; until then no count is shown." />
      <NotConnected title="Photo diagnosis" missing="No stored accuracy run over the ten approved photos yet, so no match count is shown." />
      <NotConnected title="Approved job card" missing="The card check does not return a page count or file size yet." />
    </div>
  );
}

export function ConveyorScene() {
  const [paused, setPaused] = useState(false);
  return (
    <section className={`cd c8 in-mo${paused ? " paused" : ""}`} aria-labelledby="in-scene-title">
      <svg className="in-stage" viewBox="0 0 768 612" preserveAspectRatio="xMidYMid slice" role="img"
        aria-label="Top view of a conveyor that stops at two stations while four robotic arms close on the stacks of board, then moves on. A schematic, not a view of your line."
        // Static markup copied from the approved design; it holds no data and no user input.
        dangerouslySetInnerHTML={{ __html: conveyor }} />
      <div className="in-scene-txt">
        <h2 className="t" id="in-scene-title" style={{ margin: 0 }}>From plain paper to engineered board</h2>
        <div className="lb" style={{ margin: "6px 0 16px", fontSize: 15, lineHeight: 1.5 }}>A schematic, not your line.</div>
        <button type="button" className="bt s sm" style={{ background: "var(--cd)" }} aria-pressed={paused} onClick={() => setPaused((p) => !p)}>Pause or resume</button>
      </div>
    </section>
  );
}

export function MeasuredSavings() {
  return (
    <section className="cd c12" aria-labelledby="in-measured" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", columnGap: 40, rowGap: 16, alignItems: "center" }}>
      <div>
        <h2 className="t" id="in-measured" style={{ margin: 0 }}>Measured savings are not on this page.</h2>
        <div className="lb" style={{ marginTop: 4, fontSize: 15 }}>Every figure is modeled, sample or from a software test.</div>
      </div>
      <div>
        <h3 className="th" style={{ margin: "0 0 4px" }}>What a plant trial needs</h3>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {["Plant outcomes recorded for each lot", "An approved comparison across similar production runs", "A line and a time window agreed with the plant"]
            .map((item) => <li key={item} className="in-ck"><i aria-hidden="true" />{item}</li>)}
        </ul>
      </div>
    </section>
  );
}

const MONTHS = ["May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov"];

/** U6: trend, delivery, throughput, capacity and planning have no source data. Each keeps the
 * designed empty, sample or not-connected look and shows no figure. */
export function NotConnectedYet() {
  return (
    <>
      <div className="c12" style={{ paddingTop: 8 }}>
        <h2 className="t" style={{ margin: 0 }}>Not connected yet</h2>
        <div className="lb" style={{ fontSize: 14, marginTop: 2 }}>Sketches only. They need plant data.</div>
      </div>
      <Card span={8} title="Defect intelligence" meta={<Chip tone="example">Empty until lot history is connected</Chip>}>
        <div className="in-chips" style={{ marginBottom: 10 }}>
          {DEFECT_ORDER.map((defect, index) => (
            <span key={defect} className="in-chip" aria-disabled="true" style={index === 0 ? { borderColor: "var(--tx)", color: "var(--inv)", background: "var(--tx)" } : undefined}>
              {defect === "DELAM" ? "Delam" : DEFECT_NAME[defect as Defect]}
            </span>
          ))}
          <span className="mt" style={{ marginLeft: "auto" }}>Share of lots with the defect, by month</span>
        </div>
        <svg viewBox="0 0 726 256" width="100%" style={{ display: "block" }} role="img" aria-label="No lot history connected yet. The trend appears when real lot outcomes are recorded.">
          {[20, 80, 140, 200].map((y) => <line key={y} x1="0" y1={y} x2="726" y2={y} stroke="var(--ln)" strokeDasharray="3 5" />)}
          <line x1="0" y1="230" x2="726" y2="230" stroke="var(--ln2)" />
          {MONTHS.map((month, index) => <text key={month} x={40 + index * 108} y="246" fontFamily="'Inter',sans-serif" fontSize="12" fill="var(--dim)" textAnchor="middle">{month}</text>)}
          <rect x="143" y="86" width="440" height="76" rx="8" fill="var(--bg)" stroke="var(--ln2)" strokeDasharray="4 4" />
          <text x="363" y="118" textAnchor="middle" fontFamily="'Inter Tight','Inter',sans-serif" fontSize="17" fontWeight="600" fill="var(--tx)">No lot history connected yet</text>
          <text x="363" y="142" textAnchor="middle" fontFamily="'Inter',sans-serif" fontSize="13" fill="var(--mu)">The trend appears when real lot outcomes are recorded.</text>
        </svg>
      </Card>
      <Card span={4} title="Delivery timeline" meta={<ProvenanceChip kind="sample" />}>
        <ol style={{ listStyle: "none", margin: "6px 0 0", padding: 0 }}>
          {[
            ["Lot review completed", "Recorded reference case", true],
            ["Supervisor job card", "Approval pending", false],
            ["Scheduled dispatch", "Needs a dispatch feed, not connected", false],
          ].map(([title, sub, done]) => (
            <li key={title as string} className={`in-tl${done ? " ok" : ""}`}><i aria-hidden="true" /><div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div><div className="lb" style={{ fontSize: 13 }}>{sub}</div></li>
          ))}
        </ol>
        <div className="lb" style={{ fontSize: 13, lineHeight: 1.45 }}>Only step one is a recorded case.</div>
      </Card>
      <Card span={4} title="Throughput" meta={<ProvenanceChip kind="sample" />}>
        <div aria-hidden="true" style={{ display: "flex", gap: 10, height: 150, alignItems: "flex-end", paddingTop: 10 }}>
          {[["M", 46], ["T", 70], ["W", 90], ["T", 120], ["F", 76], ["S", 60], ["S", 98]].map(([day, height], index) => (
            <div key={index} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
              <div style={{ width: "100%", height: height as number, border: "1.5px dashed var(--ln2)", borderRadius: "6px 4px 0 0" }} />
              <span className="lb" style={{ fontSize: 12.5 }}>{day}</span>
            </div>
          ))}
        </div>
        <div className="lb" style={{ fontSize: 13, marginTop: 12, lineHeight: 1.45 }}>Shape only. Needs a production log.</div>
      </Card>
      <Card span={4} title="Capacity" meta={<ProvenanceChip kind="not-connected" />}>
        {["Machine availability", "Operator capacity", "Production schedule"].map((name) => (
          <div key={name} style={{ marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span style={{ fontWeight: 600 }}>{name}</span><span className="lb">No feed</span></div>
            <div className="ncbar" aria-hidden="true" />
          </div>
        ))}
        <div className="lb" style={{ fontSize: 13, marginTop: 14, lineHeight: 1.45 }}>No machine or workforce data is read today.</div>
      </Card>
      <section className="cd c4" aria-labelledby="in-planning" style={{ display: "flex", flexDirection: "column" }}>
        <div className="ct"><h2 className="t" id="in-planning" style={{ margin: 0 }}>Production planning</h2><Chip tone="example">Future</Chip></div>
        <div style={{ fontSize: 15, lineHeight: 1.5, color: "var(--mu)" }}>Needs plant schedule data. Concept only.</div>
        <div style={{ marginTop: "auto", paddingTop: 16 }}><ButtonLink href={href("planning")} variant="secondary">Open Planning</ButtonLink></div>
      </section>
    </>
  );
}

/** The design's warning toast for each model the server marks low confidence. */
export function LowConfidenceNotice({ defects }: { defects: Set<Defect> }) {
  const [dismissed, setDismissed] = useState<Set<Defect>>(new Set());
  const shown = DEFECT_ORDER.filter((defect) => defects.has(defect) && !dismissed.has(defect));
  if (shown.length === 0) return null;
  return (
    <div className="in-tsts" aria-live="polite">
      {shown.map((defect) => (
        <div key={defect} className="in-tst" role="status">
          <Icon name="warn" />
          <div><b>{DEFECT_NAME[defect]} model: low confidence</b><span>Supervised use only.</span></div>
          <button type="button" aria-label={`Dismiss ${DEFECT_NAME[defect]} notice`} onClick={() => setDismissed((set) => new Set(set).add(defect))}><Icon name="close" /></button>
        </div>
      ))}
    </div>
  );
}
