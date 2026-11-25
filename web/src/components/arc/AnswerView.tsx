import type { ReactNode } from "react";
import type { AnswerBlock, AnswerBlockKind, AnswerView as Answer, ResultRef, Suggestion } from "../../lib/arc";
import { Icon, IdleMark, LabelChip, ProvenanceChip } from "../m";

export type Ask = (suggestion: Suggestion) => void;
export type BlockProps<K extends AnswerBlockKind> = { block: Extract<AnswerBlock, { kind: K }>; answer: Answer; ask: Ask; busy: boolean };
type Renderers = { [K in AnswerBlockKind]: (props: BlockProps<K>) => ReactNode };

const GEMINI = <ProvenanceChip kind="generated-by-gemini" />;

function Labels({ labels, gemini }: { labels: string[]; gemini?: boolean }) {
  if (!labels.length && !gemini) return null;
  return <span className="chips">{labels.map((label) => <LabelChip key={label} label={label} />)}{gemini && GEMINI}</span>;
}

function SuggestionRows({ title, suggestions, ask, busy }: { title: string; suggestions: Suggestion[]; ask: Ask; busy: boolean }) {
  if (!suggestions.length) return null;
  return (
    <div>
      <div className="sh2">{title}</div>
      <section className="cd" style={{ padding: "2px 20px" }}>
        {suggestions.map((suggestion) => (
          <button key={suggestion.actionId} type="button" className="ar plain" disabled={busy} onClick={() => ask(suggestion)}>
            <b>{suggestion.label}</b><Icon name="chevron" className="ac2" />
          </button>
        ))}
      </section>
    </div>
  );
}

// The fixed refusal and no-data replies lead with one short sentence, which the designs set large.
function splitLead(text: string | null): [string, string] {
  if (!text) return ["", ""];
  const end = text.search(/[.?!]\s/);
  return end === -1 ? [text, ""] : [text.slice(0, end + 1), text.slice(end + 2)];
}

const REF_NAMES: Record<ResultRef["kind"], string> = {
  po_review: "Order review", job: "Job card", lot: "Lot", trace: "Run record", card: "Job card PDF", turn: "Arc answer", metric: "Figure", photo: "Approved photo",
};

/**
 * One renderer per block kind. The lot cards for New Lot (ARC-M6-03) and the answer, chart and
 * defect screens (ARC-M6-04, M6-05) replace entries here; the panel needs no other change.
 */
export const BLOCK_RENDERERS: Renderers = {
  value: ({ block }) => (
    <section className="cd">
      <div className="ct2"><span className="t" style={{ fontSize: 15, color: "var(--mu)" }}>{block.title}</span><Labels labels={block.labels} /></div>
      {block.value === null
        ? <div style={{ fontSize: 20, color: "var(--mu)", fontWeight: 500 }}>Not recorded</div>
        : <div className="n" style={{ fontSize: 44, lineHeight: "50px", fontWeight: 600, letterSpacing: "-.8px" }}>{block.value}{block.unit && <span style={{ fontSize: 20, color: "var(--mu)", fontWeight: 500, marginLeft: 8 }}>{block.unit}</span>}</div>}
      {block.note && <div className="lb" style={{ marginTop: 4, fontSize: 15 }}>{block.note}</div>}
    </section>
  ),
  chart: ({ block }) => (
    <section className="cd">
      <div className="ct2"><span className="t" style={{ fontSize: 15 }}>{block.title}</span><Labels labels={block.labels} /></div>
      <div role="table" aria-label={block.title}>
        {block.series.map((point) => (
          <div key={point.name} role="row" className="tb" style={{ gridTemplateColumns: "1fr auto", minHeight: 50 }}>
            <span role="cell" style={{ fontSize: 16, fontWeight: 600 }}>{point.name}</span>
            <span role="cell" className="n" style={{ fontSize: 22, fontWeight: 600, textAlign: "right" }}>{point.value}{point.unit && ` ${point.unit}`}</span>
          </div>
        ))}
      </div>
      {block.note && <div className="lb" style={{ marginTop: 10, fontSize: 15 }}>{block.note}</div>}
    </section>
  ),
  no_data: ({ block, answer, ask, busy }) => {
    const [lead, rest] = splitLead(answer.text);
    return (
      <>
        <section className="cd">
          <div className="ct2">
            <span className="sx wn" style={{ fontSize: 15 }}><Icon name="warn" />Not enough data</span>
            <span className="chips"><ProvenanceChip kind="insufficient-data" />{answer.generatedByGemini && GEMINI}</span>
          </div>
          {lead && <div className="d" style={{ fontSize: 26, lineHeight: "32px", fontWeight: 600, letterSpacing: "-.3px" }}>{lead}</div>}
          {rest && <div className="lb" style={{ marginTop: 6, fontSize: 16, lineHeight: 1.5 }}>{rest}</div>}
          <div className="lb" style={{ marginTop: 6, fontSize: 16, lineHeight: 1.5 }}>{block.missing}</div>
        </section>
        <SuggestionRows title="What Arc can show instead" suggestions={block.alternatives} ask={ask} busy={busy} />
      </>
    );
  },
  refusal: ({ block, answer, ask, busy }) => {
    const [lead, rest] = splitLead(answer.text);
    return (
      <>
        <section className="cd">
          <div className="ct2">
            <span className="sx id" style={{ fontSize: 15 }}><IdleMark />Outside Arc</span>
            <span className="chips"><ProvenanceChip kind="out-of-scope" />{answer.generatedByGemini && GEMINI}</span>
          </div>
          {lead && <div className="d" style={{ fontSize: 26, lineHeight: "32px", fontWeight: 600, letterSpacing: "-.3px" }}>{lead}</div>}
          {rest && <div className="lb" style={{ marginTop: 6, fontSize: 16, lineHeight: 1.5 }}>{rest}</div>}
        </section>
        <SuggestionRows title="Try one of these" suggestions={block.suggestions} ask={ask} busy={busy} />
      </>
    );
  },
  follow_ups: ({ block, ask, busy }) => (
    <div className="fu">
      <span>Ask next</span>
      {block.suggestions.map((suggestion) => (
        <button key={suggestion.actionId} type="button" className="chp" disabled={busy} onClick={() => ask(suggestion)}>{suggestion.label}</button>
      ))}
    </div>
  ),
  reference: ({ block }) => (
    <section className="cd">
      <div className="ct2"><span className="t" style={{ fontSize: 15 }}>{REF_NAMES[block.ref.kind]}</span><Labels labels={block.labels} gemini={block.generatedByGemini} /></div>
      <div className="n" style={{ fontSize: 16, fontWeight: 600, overflowWrap: "anywhere" }}>{block.ref.id}</div>
    </section>
  ),
  unavailable: ({ block }) => (
    <section className="cd">
      <span className="sx id" style={{ fontSize: 15, whiteSpace: "normal" }}><IdleMark />{REF_NAMES[block.ref.kind]} not available</span>
      <div className="lb" style={{ marginTop: 6, fontSize: 15 }}>Its source record has expired or is not stored, so Arc does not show it again.</div>
    </section>
  ),
};

function renderBlock(block: AnswerBlock, answer: Answer, ask: Ask, busy: boolean) {
  const render = BLOCK_RENDERERS[block.kind] as (props: BlockProps<AnswerBlockKind>) => ReactNode;
  return <div key={block.blockId} className="stl">{render({ block, answer, ask, busy } as BlockProps<AnswerBlockKind>)}</div>;
}

/** The reply to one turn: the answer text with its chip, then each block. */
export function AnswerView({ answer, ask, busy }: { answer: Answer; ask: Ask; busy: boolean }) {
  // Refusal and no-data cards carry the reply text themselves, as their designs do.
  const textInBlock = answer.blocks.some((block) => block.kind === "refusal" || block.kind === "no_data");
  return (
    <>
      {answer.text && !textInBlock && (
        <section className="cd">
          <div className="ct2"><span className="t" style={{ fontSize: 15, color: "var(--mu)" }}>Answer</span>{answer.generatedByGemini && GEMINI}</div>
          <p className="ans">{answer.text}</p>
        </section>
      )}
      {answer.blocks.map((block) => renderBlock(block, answer, ask, busy))}
    </>
  );
}
