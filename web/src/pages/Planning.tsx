import { Card, Chip, IdleMark, PageHeader } from "../components/m";
import { STAGES, VALIDATION, VALIDATION_LABEL, type Label } from "./planning/roadmap";
import "./planning/planning.css";

const LabelChip = ({ label }: { label: Label }) => <Chip tone={label.tone}>{label.text}</Chip>;

/** Where Momentum stands and what has to be true before the next stage. One screen: the longer
 * list of research ideas, interfaces and the scheduling concept left this page on 2026-11-26. */
export function Planning() {
  return (
    <div className="pl-page">
      <PageHeader title="Planning" sub="The next phase of Momentum. A roadmap, not live features." actions={<Chip tone="example">Future, not live</Chip>} />
      <div className="g">
        <Card span={12} title="Four stages" meta="Each stage needs the one before it. No dates.">
          <ol className="ev">
            {STAGES.map((stage) => (
              <li key={stage.title} className={stage.now ? "now" : undefined} {...(stage.now ? {} : { "data-roadmap-item": stage.title })}>
                <small>{stage.when}</small>
                <h3>{stage.title}</h3>
                <p>{stage.text}</p>
                <LabelChip label={stage.label} />
                <div className="nf"><span>Needs first</span><b>{stage.needs}</b></div>
              </li>
            ))}
          </ol>
        </Card>

        <section className="cd c12" aria-labelledby="validation-title" data-roadmap-item="Real plant validation">
          <div className="ct"><h2 className="t" id="validation-title">Real plant validation</h2><LabelChip label={VALIDATION_LABEL} /></div>
          <ol className="vs">
            {VALIDATION.map((step, index) => <li key={step.name}><div className="no" aria-hidden="true">{index + 1}</div><b>{step.name}</b><span>{step.text}</span></li>)}
          </ol>
          <div style={{ display: "flex", marginTop: 18 }}><span className="sx id wrap"><IdleMark />Not validated in the plant yet.</span></div>
        </section>
      </div>
    </div>
  );
}
