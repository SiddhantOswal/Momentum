import { useState } from "react";
import { Card, Chip, NotConnected, PageHeader } from "../ui/components";
import { ROUTES } from "../routes";
import "./plant-explorer.css";

// The page has no lot in progress to read from, so it shows the PKBX0041 reference run. Figures come
// from the final m2 re-run (docs/arc/delivery/data/PKBX0041-m2-rerun.md, 18.5 C and 42% RH) and are a
// model estimate awaiting sign-off, not a measured result. The design's October figures are retired
// (docs/arc/delivery/data/stale-claims.md).
const STAGES = ["Unwind", "Corrugate", "Glue", "Dry", "Cut"] as const;

// Marker positions in the 768 x 512 image, as the design places them.
const MARKERS = [
  { x: 120, y: 360 }, { x: 295, y: 235 }, { x: 395, y: 150 }, { x: 530, y: 150 }, { x: 720, y: 105 },
];
const IMAGE = { width: 768, height: 512 };
const pct = (value: number, of: number) => `${(value / of) * 100}%`;

const EVIDENCE_DEFECTS = ["Warp", "Delamination", "Strength", "Print", "Crack"];

const insights = ROUTES.find((route) => route.key === "insights")!;

function Readouts() {
  return (
    <div className="px-readouts">
      <div className="arc-glass px-readout px-readout-roll">
        <div className="px-readout-label">Roll temperature</div>
        <div className="px-figure px-readout-value">162 &rarr; 170 <small>&deg;C</small></div>
      </div>
      <div className="arc-glass px-readout px-readout-gum">
        <div className="px-readout-label">Gum application</div>
        <div className="px-figure px-readout-value">HIGH &rarr; MEDIUM</div>
      </div>
      <div className="arc-glass px-readout px-readout-floor">
        <div className="px-readout-label">Floor conditions</div>
        <div className="px-figure px-readout-value">42% humidity</div>
      </div>
    </div>
  );
}

function Stage({ stage, onSelect }: { stage: number; onSelect: (index: number) => void }) {
  return (
    <Card span={8} flush>
      <div className="px-stage">
        <div className="px-stage-head">
          <Chip kind="example">Illustrative line, not a live view</Chip>
          <span className="card-meta">Stage {stage + 1} of 5, {STAGES[stage].toLowerCase()}</span>
        </div>
        <div className="px-canvas">
          <div className="px-image">
            <img src="/app/brand/home-machine.jpg" width={IMAGE.width} height={IMAGE.height}
              alt="Corrugator line with unwind, corrugate, glue, dry and cut stations" />
            <svg className="px-leaders" viewBox={`0 0 ${IMAGE.width} ${IMAGE.height}`} aria-hidden="true">
              <path d="M150 84 L295 235" /><circle cx="295" cy="235" r="4.5" />
              <path d="M353 84 L395 150" /><circle cx="395" cy="150" r="4.5" />
            </svg>
            {MARKERS.map((marker, index) => (
              <span key={index} aria-hidden="true" className={`px-marker${index === stage ? " px-marker-selected" : ""}`}
                style={{ left: pct(marker.x, IMAGE.width), top: pct(marker.y, IMAGE.height) }}>{index + 1}</span>
            ))}
          </div>
          <Readouts />
        </div>
        <div className="px-tabs" role="group" aria-label="Stage">
          {STAGES.map((name, index) => (
            <button key={name} type="button" className="px-tab" aria-pressed={index === stage}
              onClick={() => onSelect(index)}><b>{index + 1}</b>{name}</button>
          ))}
        </div>
      </div>
    </Card>
  );
}

function GlueCard({ onCompare }: { onCompare: () => void }) {
  return (
    <Card kraft title="Glue, stage 3" meta={<Chip kind="modeled">Model estimate</Chip>}>
      <div className="px-lever">
        <div><div className="px-lever-name">Gum application</div><div className="px-lever-was">was HIGH</div></div>
        <div className="px-figure px-lever-value">MEDIUM</div>
      </div>
      <div className="px-lever">
        <div><div className="px-lever-name">Gum viscosity</div><div className="px-lever-was">was 32 s</div></div>
        <div className="px-figure px-lever-value">45 s</div>
      </div>
      <div className="px-note">Reference lot PKBX0041, awaiting sign-off.</div>
      <div className="px-compare">
        <button type="button" className="button button-secondary button-small" onClick={onCompare}>Compare HIGH and MEDIUM</button>
        <div className="px-note">A comparison only. Changes go through New Lot.</div>
      </div>
    </Card>
  );
}

function WatchRow({ tone, name, children }: { tone: "bad" | "ok"; name: string; children: string }) {
  return (
    <div className="px-watch">
      <span className={`px-watch-icon status-${tone}`}>
        {tone === "bad"
          ? <svg viewBox="0 0 24 24"><path d="M12 2.8l9.2 9.2-9.2 9.2L2.8 12z" /><path d="M12 8v5M12 15.6v.1" /></svg>
          : <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M8 12.5l3 3 5-6" /></svg>}
      </span>
      <div><div className="px-lever-name">{name}</div><div className="px-lever-was">{children}</div></div>
    </div>
  );
}

export function PlantExplorer() {
  const [stage, setStage] = useState(2);
  const [compareRequested, setCompareRequested] = useState(false);
  return (
    <>
      <PageHeader title="Plant Explorer" subtitle="Stage by stage. Illustrative, no live readings." />
      <div className="grid px-grid">
        <Stage stage={stage} onSelect={setStage} />
        <div className="span-4 px-side">
          {stage === 2
            ? <GlueCard onCompare={() => setCompareRequested(true)} />
            : <Card title={`${STAGES[stage]}, stage ${stage + 1}`}><NotConnected title="No reference values for this stage." /></Card>}
          {compareRequested && stage === 2 && (
            <NotConnected title="Comparison is not connected yet.">It needs a lot in progress to compare against.</NotConnected>
          )}
          <Card title="Historical evidence" meta="Modeled lots">
            <div className="px-tags">
              {EVIDENCE_DEFECTS.map((name) => <span key={name} className="px-tag">{name}</span>)}
            </div>
            <div className="px-evidence-link">
              <a className="text-link" href={`#${insights.path}`}>Open Insights</a>
            </div>
          </Card>
          <Card title="Model watch">
            <WatchRow tone="bad" name="Crack">Low confidence. 0.11 on 219 test lots</WatchRow>
            <WatchRow tone="ok" name="Print">0.64 on 219 test lots</WatchRow>
          </Card>
        </div>
      </div>
    </>
  );
}
