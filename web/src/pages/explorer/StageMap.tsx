import { useRef, type KeyboardEvent } from "react";
import { Chip } from "../../components/m";
import line from "./line.jpg";
import { leverLabel, leverNumber, leverUnit, stageOf, STAGES, type PlanView, type StageId } from "./plan";

// Station markers on the 768 x 512 illustration, from the design.
const MARKERS: Record<StageId, [number, number]> = { 1: [120, 360], 2: [295, 235], 3: [395, 150], 4: [530, 150], 5: [720, 105] };
const ART = { width: 768, height: 512 };
// Callouts sit in a row along the top of the picture; their leader lines start under them.
const CALLOUT = { lefts: [16, 250, 484], width: 218, bottom: 84, lineFrom: 0.6 };

const pct = (value: number, of: number) => `${(value / of) * 100}%`;

/** The illustrated line with its five stations, the plan's changes as callouts and the stage tabs. */
export function StageMap({ plan, selected, onSelect }: { plan?: PlanView; selected: StageId; onSelect: (stage: StageId) => void }) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const changes = [...(plan?.changes ?? [])].sort((a, b) => stageOf(a.lever) - stageOf(b.lever));
  const stage = STAGES.find((s) => s.id === selected)!;
  const rh = plan?.rh;

  // Arrow keys move between stage tabs, as in the WAI-ARIA tabs pattern.
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    const jump = { Home: 0, End: STAGES.length - 1 }[event.key];
    if (step === undefined && jump === undefined) return;
    event.preventDefault();
    const next = jump ?? (index + step! + STAGES.length) % STAGES.length;
    onSelect(STAGES[next].id);
    tabs.current[next]?.focus();
  };

  return (
    <section className="cd flush c8 pe-map" aria-label="Stage map">
      <div className="pe-bar">
        <Chip tone="example">Illustrative line, not a live view</Chip>
        <span className="mt">
          {plan ? `${plan.itemCode}, stage` : "Stage"} {stage.id} of {STAGES.length}, {stage.name.toLowerCase()}
        </span>
      </div>
      <div className="pe-stage">
        <div className="pe-art">
          <img src={line} alt="Corrugator line with unwind, corrugate, glue, dry and cut stations" />
          <svg className="pe-lines" viewBox={`0 0 ${ART.width} ${ART.height}`} aria-hidden="true">
            {changes.map((change, index) => {
              const [x, y] = MARKERS[stageOf(change.lever)];
              const from = CALLOUT.lefts[index] + CALLOUT.width * CALLOUT.lineFrom;
              return (
                <g key={change.lever}>
                  <path d={`M${from} ${CALLOUT.bottom} L${x} ${y}`} fill="none" stroke="rgba(255,255,255,.6)" strokeWidth="1.5" strokeDasharray="4 5" />
                  <circle cx={x} cy={y} r="4.5" fill="#fff" />
                </g>
              );
            })}
          </svg>
          {STAGES.map((s) => (
            <div key={s.id} className={`pe-mk${s.id === selected ? " sel" : ""}`} aria-hidden="true"
              style={{ left: pct(MARKERS[s.id][0], ART.width), top: pct(MARKERS[s.id][1], ART.height) }}>{s.id}</div>
          ))}
        </div>
        <div className="pe-fill" />
        {plan && (
          <div className="pe-callouts">
            {changes.map((change, index) => {
              const unit = leverUnit(change.lever);
              return (
                <div key={change.lever} className={`gl pe-call${stageOf(change.lever) === selected ? " sel" : ""}`}
                  style={{ left: pct(CALLOUT.lefts[index], ART.width) }}>
                  <div className="lb">{leverLabel(change.lever)}</div>
                  <div className="n">
                    {leverNumber(change.from)} &rarr; {leverNumber(change.to)}{unit && <span> {unit}</span>}
                  </div>
                </div>
              );
            })}
            {rh && (
              <div className="gl pe-floor">
                <div className="lb">Floor conditions</div>
                <div className="n">{rh.value}% humidity{rh.confirmed && <span> confirmed</span>}</div>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="pe-tabs" role="tablist" aria-label="Stages">
        {STAGES.map((s, index) => (
          <button key={s.id} ref={(el) => { tabs.current[index] = el; }} type="button" role="tab" className="pe-tab"
            id={`pe-tab-${s.id}`} aria-controls="pe-stage-panel" aria-selected={s.id === selected} tabIndex={s.id === selected ? 0 : -1}
            onClick={() => onSelect(s.id)} onKeyDown={(event) => onKeyDown(event, index)}>
            <b aria-hidden="true">{s.id}</b>{s.name}
          </button>
        ))}
      </div>
    </section>
  );
}
