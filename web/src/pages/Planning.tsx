import { useState } from "react";
import { Card, Chip, PageHeader, Status } from "../ui/components";
import { Icon } from "../ui/icons";
import {
  CAPABILITIES, CAPTURE, CHAIN, LADDER, NEXT_INTERFACES, PREFLIGHT_STEPS, SCHEDULE_NEEDS, STAGES, VALIDATION,
  WEEK_DAYS, WEEK_LINES, type Tag,
} from "./planning/content";
import "./planning.css";

const DASHED_RING = <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" strokeDasharray="3 3" /></svg>;

const CURVE = "M40 194.0 L50 194.0 L60 193.9 L70 193.7 L80 193.4 L90 193.1 L100 192.6 L110 192.1 L120 191.5 L130 190.8 L140 190.0 L150 189.1 L160 188.1 L170 187.0 L180 185.9 L190 184.6 L200 183.2 L210 181.8 L220 180.2 L230 178.5 L240 176.8 L250 174.9 L260 173.0 L270 170.9 L280 168.8 L290 166.5 L300 164.1 L310 161.7 L320 159.1 L330 156.4 L340 153.7 L350 150.8 L360 147.8 L370 144.7 L380 141.6 L390 138.3 L400 134.9 L410 131.4 L420 127.8 L430 124.0 L440 120.2 L450 116.3 L460 112.3 L470 108.1 L480 103.9 L490 99.5 L500 95.1 L510 90.5 L520 85.8 L530 81.0 L540 76.1 L550 71.1 L560 66.0";

const chip = (tag: Tag) => <Chip key={tag.label} kind={tag.kind}>{tag.label}</Chip>;

function Section({ title, note }: { title: string; note: string }) {
  return <div className="pl-section"><h2>{title}</h2><p>{note}</p></div>;
}

function RiskSketch() {
  return (
    <div className="pl-sketch">
      <div className="pl-sketch-head"><b>What Preflight looks for</b><span>Illustration. Not real results.</span></div>
      <svg viewBox="0 0 580 262" role="img"
        aria-label="Illustration: risk rises as a condition changes. Preflight searches the region past the entered conditions for where the plan stops holding.">
        <rect x="40" y="44" width="260" height="174" style={{ fill: "var(--ok)", fillOpacity: .13 }} />
        <rect x="300" y="44" width="130" height="174" style={{ fill: "var(--wn)", fillOpacity: .16 }} />
        <rect x="430" y="44" width="130" height="174" style={{ fill: "var(--bd)", fillOpacity: .16 }} />
        <path d="M40 44V218H560" style={{ fill: "none", stroke: "var(--ln2)", strokeWidth: 1.5 }} />
        <path d={CURVE} style={{ fill: "none", stroke: "var(--tx)", strokeWidth: 2.5, strokeLinejoin: "round" }} />
        <path d="M430 44V218" style={{ fill: "none", stroke: "var(--bd)", strokeWidth: 1.5, strokeDasharray: "5 4" }} />
        <path d="M170 195V218" style={{ fill: "none", stroke: "var(--ac)", strokeWidth: 1.5, strokeDasharray: "2 4" }} />
        <circle cx="170" cy="187" r="7" style={{ fill: "var(--ac)", stroke: "var(--bg)", strokeWidth: 3 }} />
        <path d="M300 20V28H560V20" style={{ fill: "none", stroke: "var(--mu)", strokeWidth: 1.5 }} />
        <text x="430" y="14" textAnchor="middle" fontSize="14" fontWeight="600" style={{ fill: "var(--tx)" }}>Preflight searches here</text>
        <text x="170" y="68" textAnchor="middle" fontSize="14" style={{ fill: "var(--mu)" }}>Holds</text>
        <text x="365" y="68" textAnchor="middle" fontSize="14" style={{ fill: "var(--mu)" }}>Uncertain</text>
        <text x="495" y="68" textAnchor="middle" fontSize="14" style={{ fill: "var(--mu)" }}>Breaks</text>
        <text x="170" y="240" textAnchor="middle" fontSize="14" fontWeight="600" style={{ fill: "var(--tx)" }}>Entered conditions</text>
        <text x="430" y="240" textAnchor="middle" fontSize="14" fontWeight="600" style={{ fill: "var(--tx)" }}>Hard limit</text>
        <text x="46" y="38" fontSize="13" style={{ fill: "var(--dim)" }}>Risk</text>
        <text x="560" y="258" textAnchor="end" fontSize="13" style={{ fill: "var(--dim)" }}>A condition changes, such as humidity</text>
      </svg>
    </div>
  );
}

function Explorer() {
  const [selected, setSelected] = useState(0);
  const item = CAPABILITIES[selected];
  return (
    <Card span={12} title="Capability explorer" meta="Pick one. This only changes what you read.">
      <div className="pl-explorer">
        <div className="pl-rail" role="group" aria-label="Capabilities">
          {CAPABILITIES.map((capability, index) => (
            <button key={capability.name} type="button" className="pl-rail-item" aria-pressed={index === selected} onClick={() => setSelected(index)}>
              <b>{capability.name}</b>
              <span>{capability.tags[0].label}</span>
            </button>
          ))}
        </div>
        <div className="pl-detail" aria-live="polite">
          <div className="pl-detail-top">
            <div><h3>{item.name}</h3><p>{item.headline}</p></div>
            <div className="pl-chips">{item.tags.map(chip)}</div>
          </div>
          <dl style={{ margin: 0 }}>
            {item.rows.map(([label, text]) => <div className="pl-row" key={label}><dt>{label}</dt><dd>{text}</dd></div>)}
            <div className="pl-row pl-row-today"><dt>Today</dt><dd>{item.today}</dd></div>
          </dl>
        </div>
      </div>
      <div className="pl-chain">
        <span>How they connect</span>
        {CHAIN.map((link, index) => (
          <span key={link.label} style={{ display: "contents" }}>
            {index > 0 && <u aria-hidden="true">&rsaquo;</u>}
            <i className={link.gap ? "pl-gap" : undefined}>{link.label}</i>
          </span>
        ))}
      </div>
    </Card>
  );
}

export function Planning() {
  return (
    <>
      <PageHeader title="Planning" subtitle="The next phase of Momentum. A roadmap, not live features."
        actions={<Chip kind="example">Future, not live</Chip>} />
      <div className="grid pl-grid">
        <Card span={12} title="Four stages" meta="Each stage needs the one before it. No dates.">
          <div className="pl-stages">
            {STAGES.map((stage) => (
              <div key={stage.title} className={`pl-stage${stage.today ? " pl-stage-now" : ""}`}>
                <small>{stage.when}</small>
                <h3>{stage.title}</h3>
                <p>{stage.text}</p>
                {chip(stage.tag)}
                <div className="pl-needs"><span>Needs first</span><b>{stage.needs}</b></div>
              </div>
            ))}
          </div>
        </Card>

        <Card span={12}>
          <div className="pl-preflight">
            <div>
              <div className="pl-chips"><Chip kind="example">Conceptual scenario</Chip><Chip kind="example">Research direction</Chip></div>
              <h2>Challenge the plan before production does.</h2>
              <p className="pl-lead">Find where a plan breaks, before anyone signs it.</p>
              <ol className="pl-steps">
                {PREFLIGHT_STEPS.map((step, index) => <li key={step}><span className="pl-no">{index + 1}</span>{step}</li>)}
              </ol>
            </div>
            <div className="pl-side">
              <RiskSketch />
              <div className="pl-notes">
                <Status tone="warn">Crack is low confidence. Preflight cannot hide that.</Status>
                <span className="status status-idle">{DASHED_RING}A supervisor decides. Nothing is released.</span>
              </div>
            </div>
          </div>
        </Card>

        <Section title="Eight ideas to test" note="Research directions. None are built." />
        <Explorer />

        <Section title="Next interfaces" note="They extend Arc and Insights. They are not new products." />
        {NEXT_INTERFACES.map((entry) => (
          <Card key={entry.title} span={6}>
            <div className="pl-next">
              <div className="pl-next-head">
                <div className="pl-glyph" aria-hidden="true"><Icon path={entry.glyph} /></div>
                <h3>{entry.title}</h3>
                {chip(entry.tag)}
              </div>
              <p className="pl-lead">{entry.lead}</p>
              <dl style={{ margin: 0 }}>
                <div className="pl-pair"><dt>Needs</dt><dd>{entry.needs}</dd></div>
                <div className="pl-pair"><dt>Limit</dt><dd>{entry.limit}</dd></div>
              </dl>
            </div>
          </Card>
        ))}

        <Section title="Connected factory" note="Long term. Hardware, consent and safety review come first." />
        <Card span={7} title="How far connection goes" meta="Momentum stops before control.">
          <ol className="pl-ladder">
            {LADDER.map((rung, index) => (
              <li key={rung.title} className={`pl-rung${rung.today ? " pl-rung-today" : ""}${rung.out ? " pl-rung-out" : ""}`}
                aria-current={rung.today ? "step" : undefined}>
                <span className="pl-no">{index + 1}</span>
                <div><b>{rung.title}</b><span className="pl-sub">{rung.text}</span></div>
                {chip(rung.tag)}
              </li>
            ))}
          </ol>
        </Card>
        <Card span={5} title="Worn and camera capture" meta={chip({ kind: "missing", label: "Requires hardware" })}>
          {CAPTURE.map((entry) => <div className="pl-capture" key={entry.title}><div><b>{entry.title}</b><span className="pl-sub">{entry.text}</span></div></div>)}
          <div className="pl-capture"><Status tone="warn">Consent, privacy and safety come first.</Status></div>
        </Card>

        <Section title="Validation" note="The plant is a real corrugation line. Testing has not started." />
        <Card span={12} title="Real plant validation" meta={<Chip kind="example">Planned, not done</Chip>}>
          <ol className="pl-validation">
            {VALIDATION.map((step, index) => (
              <li key={step.title}><div className="pl-no">{index + 1}</div><b>{step.title}</b><span className="pl-sub">{step.text}</span></li>
            ))}
          </ol>
          <div className="pl-foot"><span className="status status-idle">{DASHED_RING}Not validated in the plant yet.</span></div>
        </Card>

        <Section title="Production scheduling" note="Scheduling comes later. This screen is a concept." />
        <Card span={8} title="Week view" meta="Example lot. Nothing here is from your plant.">
          <div className="pl-week" role="presentation">
            <div />
            {WEEK_DAYS.map((day) => <div className="pl-day" key={day}>{day}</div>)}
            {WEEK_LINES.map((line, lineIndex) => (
              <span key={line} style={{ display: "contents" }}>
                <div className="pl-line">{line}</div>
                {WEEK_DAYS.map((day) => (
                  <div className="pl-slot" key={day}>
                    {lineIndex === 0 && day === "Tue" && (
                      <div className="pl-example"><b>PKBX0041</b><span>1,300 boxes<br />Example</span></div>
                    )}
                  </div>
                ))}
              </span>
            ))}
          </div>
        </Card>
        <div className="span-4 pl-needs-first">
          <Card title="What it needs first">
            {SCHEDULE_NEEDS.map((need) => <div className="pl-need" key={need}><i />{need}</div>)}
          </Card>
        </div>
      </div>
    </>
  );
}
