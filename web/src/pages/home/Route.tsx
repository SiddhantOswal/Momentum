import { useLayoutEffect, useRef, useState } from "react";
import { Card } from "../../components/m";
import type { LiveLot } from "../../lib/live";
import { STAGES, leverChange, leverLabel, leverStage } from "./data";

type Change = NonNullable<LiveLot["changes"]>[number];
type Callout = { stage: number; changes: Change[] };

// Callout widths from the design: 210 px for one setting, 330 px for two side by side.
const width = (count: number) => 90 + 120 * count;
const GAP = 12;

/** Places each callout over its stage, then nudges neighbours apart so none overlap. */
function place(callouts: Callout[], total: number) {
  const column = total / STAGES.length;
  const boxes = callouts.map((callout) => {
    const w = width(callout.changes.length);
    return { ...callout, w, left: Math.min(Math.max(0, column * (callout.stage + 0.5) - w / 2), Math.max(0, total - w)) };
  });
  for (let i = 1; i < boxes.length; i += 1) {
    boxes[i].left = Math.max(boxes[i].left, boxes[i - 1].left + boxes[i - 1].w + GAP);
  }
  for (let i = boxes.length - 1; i >= 0; i -= 1) {
    const limit = i === boxes.length - 1 ? total : boxes[i + 1].left - GAP;
    boxes[i].left = Math.max(0, Math.min(boxes[i].left, limit - boxes[i].w));
  }
  return boxes;
}

function stageWords(stages: string[]) {
  return stages.length <= 1 ? stages.join("") : `${stages.slice(0, -1).join(", ")} and ${stages.at(-1)}`;
}

/** The nine production stages with the setting changes of the newest stored plan above them. */
export function ProductionRoute({ lot }: { lot?: LiveLot }) {
  const changes = lot?.changes ?? [];
  const callouts: Callout[] = STAGES.map((_, stage) => ({ stage, changes: changes.filter((c) => leverStage(c.lever) === STAGES[stage]) }))
    .filter((callout) => callout.changes.length > 0);
  const changedStages = new Set(callouts.map((c) => c.stage));
  const ref = useRef<HTMLDivElement>(null);
  const [total, setTotal] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setTotal(element.clientWidth));
    observer.observe(element);
    setTotal(element.clientWidth);
    return () => observer.disconnect();
  }, []);

  const meta = !lot
    ? "No stored plan yet"
    : changes.length === 0
      ? "No setting changes in the latest plan"
      : `${changes.length} ${changes.length === 1 ? "setting changes" : "settings change"}, at ${stageWords(callouts.map((c) => STAGES[c.stage]))}`;

  return (
    <Card title="Production route" meta={meta} span={12} className="hm-route-card">
      <div className="hm-route" tabIndex={0} role="group" aria-label="Production stages">
        <div className="hm-stages" ref={ref}>
          <div className="hm-callouts">
            {total > 0 && place(callouts, total).map((box) => (
              <div key={box.stage} className="hm-callout" style={{ left: box.left, width: box.w }}>
                {box.changes.map((change) => (
                  <div key={change.lever}>
                    <div className="lb" style={{ fontSize: 13 }}>{leverLabel(change.lever)}</div>
                    <div className="n v">{leverChange(change)}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
          {STAGES.map((name, index) => {
            const on = changedStages.has(index);
            return (
              <div key={name} className="hm-stage">
                <div className="hm-stem">{on && <i />}</div>
                <div className="hm-dot"><span /><b className={on ? "on" : undefined} /></div>
                <div className={`hm-name${on ? " on" : ""}`}>{name}{on && <span className="sr-only">, settings change here</span>}</div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
