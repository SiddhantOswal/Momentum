import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button, Card, NotConnected, PageHeader } from "../../ui/components";
import { Icon } from "../../ui/icons";
import { useLive } from "../../lib/live";
import { ROUTES } from "../../routes";
import { buildFlow, flowFromLot, type EdgeView, type Flow, type FlowInput, type Mark, type StepView } from "./model";
import "./prep-flow.css";

const newLot = ROUTES.find((route) => route.key === "new-lot")!;
const ARROW = "M5 12h14M13 6l6 6-6 6";
const CLOSE = "M6 6l12 12M18 6L6 18";

// Glyphs from the approved design: circle with tick, ringed dot, triangle, diamond, dashed circle.
const GLYPH: Record<Mark, { label: string; node: ReactNode }> = {
  done: { label: "Done", node: <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l3 3 5-6" /></> },
  needs: { label: "Needs a person", node: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2.6" fill="currentColor" /></> },
  held: { label: "Held", node: <><path d="M12 3.5l9.5 16.5h-19z" /><path d="M12 10v5M12 17.6v.1" /></> },
  attention: { label: "Needs attention", node: <><path d="M12 2.8l9.2 9.2-9.2 9.2L2.8 12z" /><path d="M12 8v5M12 15.6v.1" /></> },
  idle: { label: "Not reached", node: <circle cx="12" cy="12" r="9" strokeDasharray="3 3" /> },
};

function Mark({ mark, text }: { mark: Mark; text?: string }) {
  return (
    <span className={`pf-sx pf-sx-${mark}`}>
      <svg viewBox="0 0 24 24" aria-hidden="true">{GLYPH[mark].node}</svg>
      {text}
    </span>
  );
}

const NODE: Record<number, { x: number; y: number; w: number; h: number }> = {
  1: { x: 14, y: 60, w: 140, h: 124 }, 2: { x: 186, y: 60, w: 140, h: 124 }, 3: { x: 186, y: 208, w: 140, h: 124 },
  4: { x: 394, y: 186, w: 170, h: 168 }, 5: { x: 592, y: 208, w: 140, h: 124 }, 6: { x: 592, y: 60, w: 140, h: 124 },
  7: { x: 802, y: 60, w: 140, h: 124 }, 8: { x: 974, y: 60, w: 140, h: 124 }, 9: { x: 974, y: 208, w: 140, h: 124 },
};
const ZONES = [{ x: 0, w: 340 }, { x: 380, w: 368 }, { x: 788, w: 340 }];
const ARROWS = ["M154 122 H186", "M256 184 V208", "M326 270 H394", "M564 270 H592", "M662 208 V184", "M732 122 H802", "M942 122 H974", "M1044 184 V208"];
const EDGE_COLOUR: Record<EdgeView["tone"], string> = { done: "var(--g1)", needs: "#E8664F", held: "#E3A340", attention: "#F0707A", idle: "var(--g2)" };
const PILLS = [["Warp", "wn"], ["Delam", "wn"], ["Strength", "wn"], ["Print", "ok"], ["Crack", "bd"]] as const;

function Node({ view, pills }: { view: StepView; pills: boolean }) {
  const { step, mark, text, current } = view;
  const box = NODE[step.n];
  const cls = ["pf-node", current && "pf-node-current", current && mark !== "needs" && `pf-node-${mark}`, mark === "idle" && "pf-node-pending"].filter(Boolean).join(" ");
  return (
    <li className={cls} style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
      aria-current={current ? "step" : undefined}>
      <div className="pf-node-row"><span>{step.n}</span><Mark mark={mark} /><span className="pf-sr">{GLYPH[mark].label}</span></div>
      <div className="pf-node-title">{step.title}</div>
      <div className="pf-node-text">{text}</div>
      {step.source && <div className="pf-node-source">{step.source}</div>}
      {pills && (
        <div className="pf-pills">
          {PILLS.map(([name, tone]) => <span key={name} className="pf-pill"><i style={{ background: `var(--${tone})` }} />{name}</span>)}
        </div>
      )}
    </li>
  );
}

const DRAWING = { width: 1128, height: 440 };
const MIN_SCALE = 0.8;

// The drawing is a fixed size. Narrower cards shrink it down to MIN_SCALE; below that it scrolls
// instead of making the labels too small to read.
function Fit({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const measure = () => setScale(Math.max(MIN_SCALE, Math.min(1, element.clientWidth / DRAWING.width)));
    measure();
    // When the drawing scrolls, start with the step that needs attention in view.
    const current = element.querySelector<HTMLElement>('[aria-current="step"]');
    if (current) {
      const box = current.getBoundingClientRect();
      const frame = element.getBoundingClientRect();
      if (box.right > frame.right || box.left < frame.left) element.scrollLeft += box.left - frame.left - (frame.width - box.width) / 2;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={box} className="pf-scroll" tabIndex={0} role="region" aria-label="Preparation flow diagram">
      <div style={{ width: DRAWING.width * scale, height: DRAWING.height * scale }}>
        <div className="pf-fit" style={{ transform: `scale(${scale})` }}>{children}</div>
      </div>
    </div>
  );
}

function Diagram({ flow }: { flow: Flow }) {
  return (
    <div className="pf-diagram">
      {flow.zones.map((zone, i) => (
        <div key={zone.key} className="pf-zone" style={{ left: ZONES[i].x, width: ZONES[i].w }}>
          <div className="pf-zone-head"><b>{zone.name}</b><Mark mark={zone.mark} text={zone.label} /></div>
          <div className="pf-zone-foot">{zone.foot}</div>
        </div>
      ))}
      <svg className="pf-edges" width="1128" height="440" aria-hidden="true">
        <defs>
          {Object.entries(EDGE_COLOUR).map(([tone, fill]) => (
            <marker key={tone} id={`pf-arrow-${tone}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z" fill={fill} /></marker>
          ))}
        </defs>
        {flow.edges.map((edge, i) => (
          <path key={i} d={ARROWS[i]} fill="none" stroke={EDGE_COLOUR[edge.tone]} strokeWidth="1.8"
            strokeDasharray={edge.tone === "done" || edge.tone === "needs" ? undefined : "5 4"} markerEnd={`url(#pf-arrow-${edge.tone})`} />
        ))}
      </svg>
      <ol className="pf-nodes">{flow.steps.map((view) => <Node key={view.step.n} view={view} pills={view.step.n === 4} />)}</ol>
    </div>
  );
}

function Toast({ toast, onDismiss }: { toast: NonNullable<Flow["toast"]>; onDismiss: () => void }) {
  const path = toast.tone === "warn" ? "M12 3.5l9.5 16.5h-19z M12 10v5M12 17.6v.1" : "M12 2.8l9.2 9.2-9.2 9.2L2.8 12z M12 8v5M12 15.6v.1";
  return (
    <div className="pf-toasts" aria-live="polite">
      <div className={`pf-toast pf-toast-${toast.tone}`} role="alert">
        <Icon path={path} />
        <div><b>{toast.title}</b><span>{toast.text}</span></div>
        <button type="button" className="pf-toast-close" aria-label="Dismiss" onClick={onDismiss}><Icon path={CLOSE} /></button>
      </div>
    </div>
  );
}

/** The designed page for one lot. Callers supply a flow input; the page does no data fetching. */
export function FlowView({ input }: { input: FlowInput }) {
  const flow = buildFlow(input);
  const [dismissed, setDismissed] = useState(false);
  const [ticked, setTicked] = useState<boolean[]>([]);
  const panel = flow.panel;
  return (
    <div className="pf-page">
      {flow.toast && !dismissed && <Toast toast={flow.toast} onDismiss={() => setDismissed(true)} />}
      <PageHeader title="Preparation flow" subtitle={flow.subtitle}
        actions={<Button variant="secondary" onClick={() => { location.hash = newLot.path; }}>Open New Lot</Button>} />
      <div className="grid">
        <Card span={12} kraft>
          <div className="pf-hero">
            {flow.hero.map((cell) => (
              <div key={cell.label}><div className="pf-hero-label">{cell.label}</div><div className="pf-hero-value">{cell.value}</div><div className="pf-hero-label">{cell.note}</div></div>
            ))}
          </div>
        </Card>
        <Card span={12}>
          <div className="pf-flow-head">
            <h2 className="card-title">{flow.heading}</h2>
            <div className="pf-legend">{flow.legend.map((mark) => <Mark key={mark} mark={mark} text={GLYPH[mark].label} />)}</div>
          </div>
          <Fit><Diagram flow={flow} /></Fit>
          <div className="pf-foot">Software steps, not a factory network.</div>
        </Card>
        <Card span={6} title={panel.title} meta={<span className="pf-chip"><i />{panel.chip}</span>}>
          <p className="pf-lead">{panel.lead}</p>
          {panel.groups.map((group) => (
            <div key={group.heading}>
              <div className="pf-heading">{group.heading}</div>
              <ul className="pf-list">{group.items.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          ))}
          <button type="button" className="button button-primary pf-action" onClick={() => { location.hash = newLot.path; }}>
            {panel.action}<svg viewBox="0 0 24 24" aria-hidden="true"><path d={ARROW} /></svg>
          </button>
        </Card>
        <Card span={6} title={panel.decisionTitle}>
          <div className="pf-checks" role="group" aria-label={panel.decisionTitle}>
            {panel.decisions.map((item, i) => (
              <label key={item} className="pf-check">
                <input type="checkbox" checked={ticked[i] ?? false} onChange={(event) => setTicked((prev) => { const next = [...prev]; next[i] = event.target.checked; return next; })} />
                <span className="pf-box" aria-hidden="true" />{item}
              </label>
            ))}
          </div>
          <p className="pf-note">{panel.decisionNote}</p>
        </Card>
      </div>
    </div>
  );
}

/** Reads the most recently updated lot from the live store. Per-step history is not recorded yet. */
export function PreparationFlow() {
  const live = useLive();
  const lot = [...live.view.lots].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];
  const input = lot ? flowFromLot(lot) : null;
  if (input) return <FlowView key={input.lotId} input={input} />;
  return (
    <>
      <PageHeader title="Preparation flow" subtitle="Purchase order to approved job card, step by step."
        actions={<Button variant="secondary" onClick={() => { location.hash = newLot.path; }}>Open New Lot</Button>} />
      <NotConnected title={!live.loaded && live.status !== "offline" ? "Checking for a lot." : lot ? "Step status is not recorded for this lot yet." : "No lot to show yet."}>
        {live.status === "offline"
          ? "Momentum cannot reach the lot store right now."
          : lot
            ? `${lot.lotId} is ${lot.status}. Step by step history is not stored, so only a planned lot waiting on a supervisor can be drawn.`
            : "Plan a lot in New Lot and it appears here."}
      </NotConnected>
    </>
  );
}
