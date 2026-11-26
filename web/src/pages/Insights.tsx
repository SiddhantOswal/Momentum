import { useState } from "react";
import { Card, Chip, NotConnected, PageHeader, Status } from "../ui/components";
import { Icon } from "../ui/icons";
import { formatMoney, formatNumber, type Defect } from "../lib/api";
import { useResource } from "../lib/useApp";
import { ROUTES } from "../routes";
import { ConveyorScene } from "./insights/ConveyorScene";
import { LOW_CONFIDENCE, REFERENCE, SAVING, THROUGHPUT } from "./insights/reference";
import "./insights.css";

const planning = ROUTES.find((route) => route.key === "planning")!;
const kg = (value: number) => value.toFixed(1);
const minus = (value: number) => value.toFixed(2).replace("-", "−");

const MODELS: { defect: Defect; label: string }[] = [
  { defect: "WARP", label: "Warp" }, { defect: "DELAM", label: "Delamination" },
  { defect: "STRENGTH", label: "Strength" }, { defect: "PRINT", label: "Print" }, { defect: "CRACK", label: "Crack" },
];
const DEFECT_TABS = ["Warp", "Delam", "Strength", "Print", "Crack"];

type Acceptance = { models?: { defect: Defect; r2: number | null; sampleCount: number | null }[] };

function Tile({ label, value, unit, tone, note, chip }: {
  label: string; value: string; unit?: string; tone?: "ok"; note: string; chip: React.ReactNode;
}) {
  return (
    <Card span={3}>
      <div className="in-label">{label}</div>
      <div className={`in-figure in-tile-value${tone === "ok" ? " in-ok" : ""}`}>{value}{unit && <small>{unit}</small>}</div>
      <div className="in-tile-note">{note}</div>
      {chip}
    </Card>
  );
}

function Bar({ label, value, text, of, accent }: { label: string; value: number; text: string; of: number; accent?: boolean }) {
  return (
    <div className="in-bar">
      <span className="in-bar-label">{label}</span>
      <div className="in-bar-track">
        <div className={`in-bar-fill${accent ? " in-bar-accent" : ""}`} style={{ width: `${(value / of) * 100}%` }}>
          <span className="in-figure">{text}</span>
        </div>
      </div>
    </div>
  );
}

function ReferenceLot() {
  const { scrapKg, scrapCost } = REFERENCE;
  return (
    <>
      <Card span={8} title={`Reference lot, ${REFERENCE.lot}`}>
        <div className="in-pair">
          <div>
            <div className="in-label">Scrap</div>
            <Bar label="Entered plan" value={scrapKg.entered} of={scrapKg.entered} text={`${kg(scrapKg.entered)} kg`} />
            <Bar label="Recommended plan" value={scrapKg.recommended} of={scrapKg.entered} text={`${kg(scrapKg.recommended)} kg`} accent />
          </div>
          <div>
            <div className="in-label">Scrap cost</div>
            <Bar label="Entered plan" value={scrapCost.entered} of={scrapCost.entered} text={formatMoney(scrapCost.entered)} />
            <Bar label="Recommended plan" value={scrapCost.recommended} of={scrapCost.entered} text={formatMoney(scrapCost.recommended)} accent />
          </div>
        </div>
        <div className="in-foot">Model estimates for one lot. Not measured savings. Awaiting sign-off.</div>
      </Card>
      <Card span={4} kraft title="Three settings, no trade-off">
        {REFERENCE.settings.map((setting) => (
          <div key={setting.name} className="in-setting">
            <span>{setting.name}</span>
            <b className="in-figure">{setting.from} &rarr; {setting.to}{setting.unit}</b>
          </div>
        ))}
        <div className="in-setting-note"><Status tone="ok">All five modeled risks fall.</Status></div>
      </Card>
    </>
  );
}

const X0 = 140;
const SCALE = 500;
const ROW = 52;

function FitChart({ scores }: { scores: Partial<Record<Defect, number | null>> }) {
  const height = 60 + ROW * (MODELS.length - 1) + 50;
  return (
    <svg viewBox={`0 0 726 ${height}`} className="in-fit" role="img"
      aria-label={`Test fit for the five models: ${MODELS.map(({ defect, label }) => {
        const value = scores[defect];
        return `${label} ${typeof value === "number" ? minus(value) : "not recorded"}`;
      }).join(", ")}`}>
      <circle cx="8" cy="12" r="6" fill="var(--mu)" />
      <text x="22" y="17" className="in-svg-note">Test lots</text>
      {MODELS.map(({ defect, label }, index) => {
        const y = 60 + ROW * index;
        const value = scores[defect];
        const known = typeof value === "number";
        const x = known ? X0 + Math.min(Math.max(value, 0), 0.8) * SCALE : 0;
        return (
          <g key={defect}>
            <text x="0" y={y + 5} className="in-svg-name">{label}</text>
            <line x1={X0} y1={y} x2={X0 + 0.8 * SCALE} y2={y} stroke="var(--ln2)" strokeWidth="6" strokeLinecap="round" />
            {known && <circle cx={x} cy={y} r="8" fill={LOW_CONFIDENCE.has(defect) ? "var(--bd)" : "var(--tx)"} />}
            <text x="618" textAnchor="end" y={y + 6} className="in-svg-value">{known ? minus(value) : "Not recorded"}</text>
          </g>
        );
      })}
      {[0, 0.2, 0.4, 0.6, 0.8].map((tick) => (
        <text key={tick} x={X0 + tick * SCALE} y={height - 18} textAnchor="middle" className="in-svg-axis">{tick.toFixed(1)}</text>
      ))}
    </svg>
  );
}

function ModelTrust() {
  const status = useResource<{ modelAcceptance?: Acceptance }>("/api/status");
  const models = status.result?.ok ? status.result.data.modelAcceptance?.models : undefined;
  const scores = Object.fromEntries((models ?? []).map((model) => [model.defect, model.r2])) as Partial<Record<Defect, number | null>>;
  const lots = models?.find((model) => model.sampleCount != null)?.sampleCount;
  const crack = scores.CRACK;
  return (
    <>
      <Card span={8} title="How well the five models hold up" meta={lots != null ? `${formatNumber(lots)} test lots, September 2026` : undefined}>
        {models ? <FitChart scores={scores} />
          : status.loading ? <div className="in-loading" aria-busy="true">Loading model scores</div>
          : <NotConnected title="Model scores are unavailable.">{status.result && !status.result.ok ? status.result.error : "The server returned no model scores."}</NotConnected>}
      </Card>
      <Card span={4} title="Reading this chart">
        <ul className="in-notes">
          <li>Fit score: 1 is perfect, below 0 is poor.</li>
          <li>September 2026 was not used to train these models.</li>
          {typeof crack === "number" && <li>Crack is {minus(crack)}. Low confidence.</li>}
        </ul>
      </Card>
    </>
  );
}

function Attribution() {
  return (
    <>
      <Card span={8} title="What moved the Warp estimate" meta="Reference lot, percentage points">
        <NotConnected title="Attribution is not connected yet.">It needs an explanation run on the current models.</NotConnected>
      </Card>
      <Card span={4} title="Reading attribution">
        <ul className="in-notes">
          <li>What the model used, not what caused it.</li>
          <li>Negative lowers modeled risk.</li>
        </ul>
      </Card>
    </>
  );
}

function Evidence() {
  const items = [
    { title: "Software checks", text: "Needs a stored test record." },
    { title: "Photo diagnosis", text: "Needs a stored evaluation record." },
    { title: "Approved job card", text: "Needs a stored job card from a test order." },
  ];
  return (
    <div className="span-4 in-stack">
      {items.map((item) => (
        <Card key={item.title} title={item.title}>
          <Chip kind="missing">Not connected</Chip>
          <p className="in-evidence-text">{item.text}</p>
        </Card>
      ))}
    </div>
  );
}

function Scene() {
  const [paused, setPaused] = useState(false);
  return (
    <Card span={8} flush>
      <div className={`in-scene${paused ? " in-paused" : ""}`}>
        <ConveyorScene />
        <div className="in-scene-text">
          <h2 className="card-title">From plain paper to engineered board</h2>
          <p>A schematic, not your line.</p>
          <button type="button" className="button button-secondary button-small" aria-pressed={paused}
            onClick={() => setPaused((value) => !value)}>Pause or resume</button>
        </div>
        <div className="in-scene-chip"><Chip kind="example">Illustrative animation</Chip></div>
      </div>
    </Card>
  );
}

function TrialNeeds() {
  return (
    <Card span={12}>
      <div className="in-trial">
        <div>
          <h2 className="card-title">Measured savings are not on this page.</h2>
          <p className="in-sub">Every figure is modeled, sample or from a software test.</p>
        </div>
        <div>
          <div className="in-label">What a plant trial needs</div>
          <ul className="in-needs">
            {["Plant outcomes recorded for each lot", "An approved comparison across similar production runs", "A line and a time window agreed with the plant"]
              .map((text) => <li key={text}><i aria-hidden="true" />{text}</li>)}
          </ul>
        </div>
      </div>
    </Card>
  );
}

function DefectIntelligence() {
  return (
    <Card span={8} title="Defect intelligence" meta={<Chip kind="example">Empty until lot history is connected</Chip>}>
      <div className="in-tabs">
        {DEFECT_TABS.map((name, index) => <span key={name} className={`in-tab${index === 0 ? " in-tab-on" : ""}`}>{name}</span>)}
        <span className="card-meta in-tabs-note">Share of lots with the defect, by month</span>
      </div>
      <div className="in-empty-chart">
        <div className="in-empty-box">
          <strong>No lot history connected yet</strong>
          <span>The trend appears when real lot outcomes are recorded.</span>
        </div>
        <div className="in-months" aria-hidden="true">{["May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov"].map((month) => <span key={month}>{month}</span>)}</div>
      </div>
    </Card>
  );
}

function Timeline() {
  const steps = [
    { done: true, title: "Lot review completed", text: "Recorded reference case" },
    { done: false, title: "Supervisor job card", text: "Approval pending" },
    { done: false, title: "Scheduled dispatch", text: "Needs a dispatch feed, not connected" },
  ];
  return (
    <Card span={4} title="Delivery timeline" meta={<Chip kind="example">Sample</Chip>}>
      <ol className="in-timeline">
        {steps.map((step) => (
          <li key={step.title} className={step.done ? "in-done" : undefined}>
            <i aria-hidden="true" /><b>{step.title}</b><span>{step.text}</span>
          </li>
        ))}
      </ol>
      <div className="in-foot">Only step one is a recorded case.</div>
    </Card>
  );
}

function Future() {
  return (
    <>
      <Card span={4} title="Throughput" meta={<Chip kind="example">Sample</Chip>}>
        <div className="in-throughput" aria-hidden="true">
          {THROUGHPUT.map((bar, index) => (
            <div key={index}><i style={{ height: bar.height }} /><span>{bar.day}</span></div>
          ))}
        </div>
        <div className="in-foot">Shape only. Needs a production log.</div>
      </Card>
      <Card span={4} title="Capacity" meta={<Chip kind="missing">Not connected</Chip>}>
        {["Machine availability", "Operator capacity", "Production schedule"].map((name) => (
          <div key={name} className="in-feed">
            <div><b>{name}</b><span>No feed</span></div>
            <i aria-hidden="true" />
          </div>
        ))}
        <div className="in-foot">No machine or workforce data is read today.</div>
      </Card>
      <Card span={4} title="Production planning" meta={<Chip kind="example">Future</Chip>}>
        <p className="in-sub">Needs plant schedule data. Concept only.</p>
        <div className="in-planning-link">
          <a className="button button-secondary" href={`#${planning.path}`}>Open Planning</a>
        </div>
      </Card>
    </>
  );
}

function CrackToast({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="in-toast" role="alert">
      <Icon path="M12 3.5l9.5 16.5h-19zM12 10v5M12 17.6v.1" />
      <div><b>Crack model: low confidence</b><span>Supervised use only.</span></div>
      <button type="button" aria-label="Dismiss" onClick={onDismiss}><Icon path="M6 6l12 12M18 6L6 18" /></button>
    </div>
  );
}

export function Insights() {
  const [toastOpen, setToastOpen] = useState(true);
  return (
    <div className="in-page">
      <PageHeader title="Insights" subtitle="Quality, impact and next steps. Every view is labelled." />
      {toastOpen && <CrackToast onDismiss={() => setToastOpen(false)} />}
      <div className="grid">
        <Tile label="Planned lot" value={formatNumber(REFERENCE.boxes)} unit="boxes" note={`Reference lot ${REFERENCE.lot}`}
          chip={<Chip kind="example">Sample order</Chip>} />
        <Tile label="Modeled scrap" tone="ok" value={kg(REFERENCE.scrapKg.recommended)} unit="kg" note={`Down from ${kg(REFERENCE.scrapKg.entered)} kg`}
          chip={<Chip kind="modeled">Model estimate</Chip>} />
        <Tile label="Modeled saving" tone="ok" value={formatMoney(SAVING)} note="Not a measured saving"
          chip={<Chip kind="modeled">Model estimate</Chip>} />
        <Tile label="Changed settings" value={String(REFERENCE.changedSettings)} unit={`of ${REFERENCE.totalSettings}`} note="Inside the allowed limit"
          chip={<Chip>Checked by the search</Chip>} />
        <ReferenceLot />
        <ModelTrust />
        <Attribution />
        <Evidence />
        <Scene />
        <TrialNeeds />
        <div className="span-12 in-section">
          <h2 className="card-title">Not connected yet</h2>
          <p className="in-sub">Sketches only. They need plant data.</p>
        </div>
        <DefectIntelligence />
        <Timeline />
        <Future />
      </div>
    </div>
  );
}
