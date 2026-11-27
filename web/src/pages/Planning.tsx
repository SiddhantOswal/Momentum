import { useRef, useState, type KeyboardEvent } from "react";
import { Card, Icon, IdleMark, PageHeader } from "../components/m";
import {
  CAPABILITIES, CHAIN, DAYS, INTERFACES, LADDER, LINES, PREFLIGHT_CAVEAT, PREFLIGHT_STEPS, SCHEDULE_NEEDS, STAGES, VALIDATION, WORN,
} from "./planning/roadmap";
import "./planning/planning.css";

function SectionHead({ title, note }: { title: string; note: string }) {
  return <div className="sh"><h2>{title}</h2><p>{note}</p></div>;
}

// The curve is the design's illustration of risk against one changing condition; it plots no data.
const CURVE = "M40 194.0 L50 194.0 L60 193.9 L70 193.7 L80 193.4 L90 193.1 L100 192.6 L110 192.1 L120 191.5 L130 190.8 L140 190.0 L150 189.1 L160 188.1 L170 187.0 L180 185.9 L190 184.6 L200 183.2 L210 181.8 L220 180.2 L230 178.5 L240 176.8 L250 174.9 L260 173.0 L270 170.9 L280 168.8 L290 166.5 L300 164.1 L310 161.7 L320 159.1 L330 156.4 L340 153.7 L350 150.8 L360 147.8 L370 144.7 L380 141.6 L390 138.3 L400 134.9 L410 131.4 L420 127.8 L430 124.0 L440 120.2 L450 116.3 L460 112.3 L470 108.1 L480 103.9 L490 99.5 L500 95.1 L510 90.5 L520 85.8 L530 81.0 L540 76.1 L550 71.1 L560 66.0";

function PreflightSketch() {
  return (
    <svg viewBox="0 0 580 262" role="img" aria-label="Illustration: risk rises as a condition changes. Preflight searches the region past the entered conditions for where the plan stops holding.">
      <rect x="40" y="44" width="260" height="174" style={{ fill: "var(--ok)", fillOpacity: .13 }} />
      <rect x="300" y="44" width="130" height="174" style={{ fill: "var(--wn)", fillOpacity: .16 }} />
      <rect x="430" y="44" width="130" height="174" style={{ fill: "var(--bd)", fillOpacity: .16 }} />
      <path d="M40 44V218H560" style={{ fill: "none", stroke: "var(--ln2)", strokeWidth: 1.5 }} />
      <path d={CURVE} style={{ fill: "none", stroke: "var(--tx)", strokeWidth: 2.5, strokeLinejoin: "round" }} />
      <path d="M430 44V218" style={{ fill: "none", stroke: "var(--bd)", strokeWidth: 1.5, strokeDasharray: "5 4" }} />
      <path d="M170 195V218" style={{ fill: "none", stroke: "var(--ac)", strokeWidth: 1.5, strokeDasharray: "2 4" }} />
      <circle cx="170" cy="187.0" r="7" style={{ fill: "var(--ac)", stroke: "var(--bg)", strokeWidth: 3 }} />
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
  );
}

/** "Pick one. This only changes what you read." Arrow keys move along the rail. */
function CapabilityExplorer() {
  const [picked, setPicked] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const capability = CAPABILITIES[picked];
  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const next = (picked + step + CAPABILITIES.length) % CAPABILITIES.length;
    setPicked(next);
    buttons.current[next]?.focus();
  }
  return (
    <Card span={12} title="Capability explorer" meta="Pick one. This only changes what you read.">
      <div className="xp">
        <div className="rail" role="group" aria-label="Capabilities" onKeyDown={onKey}>
          {CAPABILITIES.map((item, index) => (
            <button key={item.name} ref={(node) => { buttons.current[index] = node; }} type="button"
              className={`rl${index === picked ? " on" : ""}`} aria-pressed={index === picked} aria-controls="capability-detail"
              data-roadmap-item={item.name} onClick={() => setPicked(index)}>
              <b>{item.name}</b>
            </button>
          ))}
        </div>
        <div className="dw" id="capability-detail" aria-live="polite">
          <div className="dp" data-roadmap-item={capability.name}>
            <div className="top2">
              <div><h3>{capability.name}</h3><p className="hl">{capability.headline}</p></div>
            </div>
            <dl style={{ margin: 0 }}>
              {capability.rows.map(([term, text]) => <div key={term} className="dr2"><dt>{term}</dt><dd>{text}</dd></div>)}
              <div className="dr2 td"><dt>Today</dt><dd>{capability.today}</dd></div>
            </dl>
          </div>
        </div>
      </div>
      <ol className="chain" aria-label="How they connect">
        <li className="lbl" aria-hidden="true">How they connect</li>
        {CHAIN.map((link, index) => (
          <li key={link.name} style={{ display: "contents" }}>
            {index > 0 && <u aria-hidden="true">&rsaquo;</u>}
            <i className={link.dashed ? "dz" : undefined}>{link.name}</i>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function Planning() {
  return (
    <div className="pl-page">
      <PageHeader title="Planning" sub="The next phase of Momentum: what comes after preparation." />
      <div className="g">
        <Card span={12} title="Four stages" meta="Each stage needs the one before it. No dates.">
          <ol className="ev">
            {STAGES.map((stage) => (
              <li key={stage.title} className={stage.now ? "now" : undefined} {...(stage.now ? {} : { "data-roadmap-item": stage.title })}>
                <small>{stage.when}</small>
                <h3>{stage.title}</h3>
                <p>{stage.text}</p>
                <div className="nf"><span>Needs first</span><b>{stage.needs}</b></div>
              </li>
            ))}
          </ol>
        </Card>

        <section className="cd c12" aria-labelledby="preflight-title" data-roadmap-item="Production Preflight scenario">
          <div className="fs">
            <div>
              <h2 id="preflight-title">Challenge the plan before production does.</h2>
              <p className="lead">Find where a plan breaks, before anyone signs it.</p>
              <ol className="sqs">{PREFLIGHT_STEPS.map((step, index) => <li key={step} className="sq"><b aria-hidden="true">{index + 1}</b>{step}</li>)}</ol>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
              <div className="sch">
                <div className="ct"><h3 className="t">What Preflight looks for</h3></div>
                <PreflightSketch />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span className="sx wn wrap"><Icon name="warn" />{PREFLIGHT_CAVEAT}</span>
                <span className="sx id wrap"><IdleMark />A supervisor decides. Nothing is released.</span>
              </div>
            </div>
          </div>
        </section>

        <SectionHead title="Eight ideas to test" note="Research directions. None are built." />
        <CapabilityExplorer />

        <SectionHead title="Next interfaces" note="They extend Arc and Insights. They are not new products." />
        {INTERFACES.map((item) => (
          <section key={item.name} className="cd c6 nx" aria-labelledby={`nx-${item.name}`} data-roadmap-item={item.name}>
            <div className="hd">
              <div className="gx"><svg viewBox="0 0 24 24" aria-hidden="true"><path d={item.icon} /></svg></div>
              <h3 id={`nx-${item.name}`}>{item.name}</h3>
            </div>
            <p className="lead">{item.lead}</p>
            <dl>
              <div className="r2"><dt>Needs</dt><dd>{item.needs}</dd></div>
              <div className="r2"><dt>Limit</dt><dd>{item.limit}</dd></div>
            </dl>
          </section>
        ))}

        <SectionHead title="Connected factory" note="Long term. Hardware, consent and safety review come first." />
        <Card span={7} title="How far connection goes" meta="Momentum stops before control.">
          <ol className="lad">
            {LADDER.map((rung) => (
              <li key={rung.name} className={`lr${rung.today ? " td" : ""}${rung.out ? " out" : ""}`} {...(rung.today ? {} : { "data-roadmap-item": rung.name })}>
                <div className="no" aria-hidden="true">{rung.n}</div>
                <div><b>{rung.name}</b><span className="s">{rung.text}</span></div>
              </li>
            ))}
          </ol>
        </Card>
        <section className="cd c5" aria-labelledby="worn-title" data-roadmap-item="Worn and camera capture">
          <div className="ct"><h2 className="t" id="worn-title">Worn and camera capture</h2></div>
          <ul className="hzs">
            {WORN.map((item) => <li key={item.name} className="hz"><div><b>{item.name}</b><span className="s">{item.text}</span></div></li>)}
            <li className="hz" style={{ minHeight: 52 }}><span className="sx wn wrap"><Icon name="warn" />Consent, privacy and safety come first.</span></li>
          </ul>
        </section>

        <SectionHead title="Validation" note="The plant is a real corrugation line. Testing has not started." />
        <section className="cd c12" aria-labelledby="validation-title" data-roadmap-item="Real plant validation">
          <div className="ct"><h2 className="t" id="validation-title">Real plant validation</h2></div>
          <ol className="vs">
            {VALIDATION.map((step, index) => <li key={step.name}><div className="no" aria-hidden="true">{index + 1}</div><b>{step.name}</b><span>{step.text}</span></li>)}
          </ol>
          <div style={{ display: "flex", marginTop: 18 }}><span className="sx id wrap"><IdleMark />Not validated in the plant yet.</span></div>
        </section>

        <SectionHead title="Production scheduling" note="Scheduling comes later. This screen is a concept." />
        <section className="cd c8" aria-labelledby="week-title">
          <div className="ct"><h2 className="t" id="week-title">Week view</h2></div>
          <div className="wkw"><div className="wk" role="presentation">
            <div className="wk0" />
            {DAYS.map((day) => <div key={day} className="th wd">{day}</div>)}
            {LINES.map((line, row) => (
              <div key={line} style={{ display: "contents" }}>
                <div className="wl">{line}</div>
                {DAYS.map((day, column) => (
                  <div key={day} className="wc">
                    <span className="wdn" aria-hidden="true">{day}</span>
                    {row === 0 && column === 1 && <div className="wx"><div>PKBX0041</div></div>}
                  </div>
                ))}
              </div>
            ))}
          </div></div>
        </section>
        <div className="c4" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section className="cd" style={{ flex: 1 }} aria-labelledby="needs-title">
            <div className="ct"><h2 className="t" id="needs-title">What it needs first</h2></div>
            <ul className="cks">{SCHEDULE_NEEDS.map((need) => <li key={need} className="ck"><i aria-hidden="true" />{need}</li>)}</ul>
          </section>
        </div>
      </div>
    </div>
  );
}
