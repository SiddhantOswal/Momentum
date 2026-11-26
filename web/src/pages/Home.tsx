import { useEffect, useState } from "react";
import { Alert, Card, Chip, Status, type Tone } from "../ui/components";
import { Icon } from "../ui/icons";
import { getJson, type Defect } from "../lib/api";
import { useLive } from "../lib/live";
import { ROUTES } from "../routes";
import "./home.css";

// Reference run figures come from the m2 re-run of PKBX0041 (docs/arc/delivery/data/PKBX0041-m2-rerun.md):
// a model estimate awaiting sign-off, not a measured result. The design's October figures are retired.
const REFERENCE = {
  lot: "PKBX0041", description: "Recycled 5-ply BC, 1,300 boxes",
  scrapBefore: "62.9", scrapAfter: "55.1",
  roll: "162 → 170 °C", gum: "HIGH → MEDIUM", viscosity: "32 → 45 s",
};

const STATIONS = ["Printing", "Single facer", "Sheet cutting", "Pasting", "Drying", "Cut and crease", "Slotting", "Stitch and glue", "QC and bundling"];

const SAMPLE_ROWS = [
  { id: "PO2", note: "Multi-line sample" },
  { id: "PO3", note: "Sample with fitment" },
  { id: "PO4", note: "Ambiguous sample", flag: true },
  { id: "PO5", note: "Scanned image sample" },
];

const STEPS: { label: string; value: string; tone: Tone }[] = [
  { label: "Order read", value: "PO1, 1,300 boxes", tone: "ok" },
  { label: "Catalog matched", value: "PKBX0041", tone: "ok" },
  { label: "Conditions entered", value: "Humidity 42%", tone: "ok" },
  { label: "Settings compared", value: "8,640 combinations", tone: "ok" },
  { label: "Draft saved", value: "Next step", tone: "active" },
  { label: "Approved and stored", value: "Not yet", tone: "idle" },
];

const MODELS: { defect: Defect; label: string }[] = [
  { defect: "WARP", label: "Warp" }, { defect: "DELAM", label: "Delamination" },
  { defect: "STRENGTH", label: "Strength" }, { defect: "PRINT", label: "Print" }, { defect: "CRACK", label: "Crack" },
];

type Acceptance = { models?: { defect: Defect; r2: number | null; sampleCount: number | null }[] };
type ModelScores = { state: "loading" } | { state: "error" } | { state: "ready"; r2: Partial<Record<Defect, number | null>>; lots: number | null };

function useModelScores(): ModelScores {
  const [scores, setScores] = useState<ModelScores>({ state: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    getJson<{ modelAcceptance?: Acceptance }>("/api/status", controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      const models = result.ok ? result.data.modelAcceptance?.models : undefined;
      if (!models) { setScores({ state: "error" }); return; }
      setScores({
        state: "ready",
        r2: Object.fromEntries(models.map((model) => [model.defect, model.r2])),
        lots: models.find((model) => model.sampleCount != null)?.sampleCount ?? null,
      });
    });
    return () => controller.abort();
  }, []);
  return scores;
}

const hash = (key: string) => `#${ROUTES.find((route) => route.key === key)!.path}`;
const ARROW = "M5 12h14M13 6l6 6-6 6";
const minus = (value: number) => value.toFixed(2).replace("-", "−");

function Segments({ done, current }: { done: number; current?: boolean }) {
  return (
    <div className="hm-seg" aria-hidden="true">
      {[0, 1, 2, 3].map((index) => <i key={index} className={index < done ? "hm-seg-done" : index === done && current ? "hm-seg-now" : ""} />)}
    </div>
  );
}

function Hero() {
  return (
    <Card flush span={12}>
      <div className="hm-hero">
        <div className="hm-hero-copy">
          <div className="hm-hero-status">
            <Status tone="idle">No review in progress</Status>
            <Chip kind="example">Synthetic demonstration</Chip>
          </div>
          <h2 className="hm-hero-title">Start with a sample order.</h2>
          <p className="hm-hero-lead">Open a sample order and prepare a job card.</p>
          <div className="hm-hero-actions">
            <a className="button button-primary" href={hash("new-lot")}>Try a sample order<Icon path={ARROW} /></a>
            <a className="button button-secondary" href={hash("preparation-flow")}>Open reference run</a>
          </div>
          <div className="hm-hero-run">
            <div>
              <div className="hm-label">Prepared reference run, {REFERENCE.lot}</div>
              <div className="hm-hero-figure">{REFERENCE.scrapBefore} &rarr; {REFERENCE.scrapAfter} <small>kg modeled scrap</small></div>
            </div>
            <Chip kind="modeled">Model estimate, not measured</Chip>
          </div>
        </div>
        <div className="hm-hero-art" role="img"
          aria-label="Illustrative view of a corrugator line. A schematic, not a view of your line.">
          <img src="/app/brand/home-machine.jpg" alt="" />
          <span className="chip chip-example hm-hero-tag">Illustrative line</span>
        </div>
      </div>
    </Card>
  );
}

function Route() {
  const stations = STATIONS.map((name, index) => ({ name, changed: name === "Single facer" || name === "Pasting", index }));
  return (
    <Card span={12} title="Production route" meta="3 settings change, at Single facer and Pasting">
      <ol className="hm-route">
        {stations.map(({ name, changed }) => (
          <li key={name} className={changed ? "hm-station hm-station-on" : "hm-station"}>
            <div className="hm-callout-slot">
              {name === "Single facer" && <div className="hm-callout hm-callout-left"><Pair label="Roll temperature" value={REFERENCE.roll} /></div>}
              {name === "Pasting" && (
                <div className="hm-callout hm-callout-right">
                  <Pair label="Gum application" value={REFERENCE.gum} />
                  <Pair label="Gum viscosity" value={REFERENCE.viscosity} divided />
                </div>
              )}
            </div>
            <span className="hm-node" aria-hidden="true" />
            <span className="hm-station-name" aria-current={changed ? "true" : undefined}>{name}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function Pair({ label, value, divided }: { label: string; value: string; divided?: boolean }) {
  return <div className={divided ? "hm-pair hm-pair-divided" : "hm-pair"}><div className="hm-label">{label}</div><div className="hm-pair-value">{value}</div></div>;
}

function SampleOrders({ savedLots, lotsFailed }: { savedLots: number; lotsFailed: boolean }) {
  const cols = "minmax(150px, .9fr) 150px minmax(0, 1.3fr) minmax(130px, 1fr)";
  return (
    <Card span={8} title="Approved sample orders" meta="Open one to start a lot">
      <div className="hm-continue">
        <b>Continue review</b>
        <span className="hm-label">
          {lotsFailed ? "Saved reviews could not be loaded."
            : savedLots === 0 ? "No saved review yet."
            : `${savedLots} saved ${savedLots === 1 ? "lot" : "lots"}. Resuming a review is not connected yet.`}
        </span>
      </div>
      <div className="table-row table-head" style={{ gridTemplateColumns: cols }}>
        <span>Lot</span><span>Stage</span><span>Model flag</span><span>Status</span>
      </div>
      <div className="table-row hm-row" style={{ gridTemplateColumns: cols }}>
        <div><div className="hm-lot">{REFERENCE.lot}</div><div className="hm-label hm-small">Reference run</div></div>
        <div><Segments done={2} current /><div className="hm-label hm-small hm-stage">3 / 4 &middot; Settings and risk</div></div>
        <Status tone="bad">Crack: low confidence</Status>
        <Status tone="active">Ready for review</Status>
      </div>
      {SAMPLE_ROWS.map((row) => (
        <div key={row.id} className="table-row hm-row" style={{ gridTemplateColumns: cols }}>
          <div><div className="hm-lot">{row.id}</div><div className="hm-label hm-small">{row.note}</div></div>
          <div><Segments done={0} /><div className="hm-label hm-small hm-stage">0 / 4 &middot; Order</div></div>
          <span className="hm-label">&ndash;</span>
          {row.flag ? <Status tone="warn">Needs source review</Status> : <Status tone="idle">Not started</Status>}
        </div>
      ))}
      <div className="hm-foot">
        <span>Humidity 42%. Paper moisture 7.3% is an example.</span>
        <a className="text-link" href={hash("new-lot")}>Edit conditions</a>
      </div>
    </Card>
  );
}

function JobCard() {
  return (
    <Card kraft span={4}>
      <div className="hm-job">
        <div className="card-head">
          <span className="hm-job-kicker">Job card</span>
          <Chip kind="example">Sample, not approved</Chip>
        </div>
        <div className="hm-job-id">{REFERENCE.lot}</div>
        <div className="hm-job-desc">{REFERENCE.description}</div>
        <dl className="hm-job-list">
          {[["Roll temperature", REFERENCE.roll], ["Gum application", REFERENCE.gum], ["Gum viscosity", REFERENCE.viscosity]].map(([label, value]) => (
            <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
          ))}
        </dl>
        <div className="hm-job-note">Draft. A supervisor approves it.</div>
        <a className="button hm-job-open" href={hash("preparation-flow")}>Open job card<Icon path={ARROW} /></a>
      </div>
    </Card>
  );
}

function ModelTrust({ scores }: { scores: ModelScores }) {
  const lots = scores.state === "ready" && scores.lots != null ? scores.lots : null;
  return (
    <Card span={8} title="How far to trust each model" meta={lots != null ? `Fit score on ${lots} test lots.` : "Fit score on test lots."}>
      {scores.state === "error" ? (
        <Alert tone="bad" title="Model scores could not be loaded.">Check the connection and reload the page.</Alert>
      ) : (
        <div className="hm-models">
          {MODELS.map(({ defect, label }) => {
            const value = scores.state === "ready" ? scores.r2[defect] : undefined;
            return (
              <div key={defect} className="hm-model">
                <div className="hm-label">{label}</div>
                <div className="hm-model-value">{typeof value === "number" ? minus(value) : "Not recorded"}</div>
                {/* Crack stays labelled low confidence by owner decision D4-2026-11-20-OM, not by a score threshold. */}
                {defect === "CRACK" && typeof value === "number" && (
                  <Status tone="bad">Low confidence</Status>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="hm-foot hm-foot-note">A supervisor approves every plan.</div>
    </Card>
  );
}

function Steps() {
  return (
    <Card span={4} title="Reference run steps" meta={<Chip kind="modeled">Reference run</Chip>}>
      <ol className="hm-steps">
        {STEPS.map((step) => (
          <li key={step.label}><Status tone={step.tone}>{step.label}</Status><span className="hm-label hm-small">{step.value}</span></li>
        ))}
      </ol>
    </Card>
  );
}

export function Home() {
  const live = useLive();
  const scores = useModelScores();
  return (
    <div className="grid hm-grid">
      <h1 className="hm-sr-only">Home</h1>
      <Hero />
      <Route />
      <SampleOrders savedLots={live.view.lots.length} lotsFailed={live.status === "offline"} />
      <JobCard />
      <ModelTrust scores={scores} />
      <Steps />
    </div>
  );
}
