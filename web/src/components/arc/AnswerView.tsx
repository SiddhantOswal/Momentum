import type { ReactNode } from "react";
import { formatNumber } from "../../lib/api";
import { jobCardPdfPath, type AnswerBlock, type AnswerBlockKind, type AnswerView as Answer, type ResultRef, type Suggestion } from "../../lib/arc";
import { Icon, IdleMark, LabelChip, ProvenanceChip } from "../m";
import { PhotoResult } from "./DefectScreens";
import { JobFlow, LotConditions, LotReview } from "./LotScreens";

export type Ask = (suggestion: Suggestion) => void;
/** `text` is the answer text when this block carries it, as the value and chart designs do; otherwise null. */
export type BlockProps<K extends AnswerBlockKind> = { block: Extract<AnswerBlock, { kind: K }>; answer: Answer; text: string | null; ask: Ask; busy: boolean };
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

// The server writes "R2"; the designs set the superscript.
const r2 = (text: string) => text.replace(/\bR2\b/g, "R²");
const score = (value: number) => (value < 0 ? `−${Math.abs(value).toFixed(2)}` : value.toFixed(2));

const UNAVAILABLE_WORDS: Record<string, string> = {
  SOURCE_NOT_STORED: "Arc does not store this reading, so its card is not shown again. The answer above gives the value with its source.",
  SOURCE_UNAVAILABLE: "Its source could not be read, so Arc does not show it.",
};

/**
 * One renderer per block kind. Record references open the card for that record, read with the
 * dashboard route that serves it, so Arc and the dashboard show the same stored data.
 */
export const BLOCK_RENDERERS: Renderers = {
  value: ({ block, answer, text }) => (
    <section className="cd">
      <div className="ct2"><span className="t" style={{ fontSize: 15, color: "var(--mu)" }}>{text ? "Answer" : block.title}</span><Labels labels={block.labels} gemini={Boolean(text) && answer.generatedByGemini} /></div>
      {text && <div className="lb" style={{ fontSize: 15, marginBottom: 6 }}>{block.title}</div>}
      {block.value === null
        ? <div style={{ fontSize: 20, color: "var(--mu)", fontWeight: 500 }}>Not recorded</div>
        : (
          <div className="n" style={{ fontSize: 44, lineHeight: "50px", fontWeight: 600, letterSpacing: "-.8px", overflowWrap: "anywhere" }}>
            {typeof block.value === "number" ? formatNumber(block.value, 2) : block.value}
            {block.unit && <span style={{ fontSize: 20, color: "var(--mu)", fontWeight: 500, marginLeft: 8 }}>{block.unit}</span>}
          </div>
        )}
      {block.note && !text?.includes(block.note) && <div className="lb" style={{ marginTop: 4, fontSize: 15 }}>{block.note}</div>}
      {text && <p className="ans" style={{ marginTop: 12 }}>{text}</p>}
    </section>
  ),
  chart: ({ block, answer, text }) => {
    const isR2 = /\bR2\b|R²/.test(block.title);
    return (
      <section className="cd">
        <div className="ct2"><span className="t" style={{ fontSize: 15, color: "var(--mu)" }}>{text ? "Answer" : r2(block.title)}</span><Labels labels={block.labels} gemini={Boolean(text) && answer.generatedByGemini} /></div>
        {text && <p className="ans">{r2(text)}</p>}
        <div role="table" aria-label={r2(block.title)} style={{ marginTop: 14, borderTop: "1px solid var(--ln)" }}>
          {block.series.map((point) => (
            <div key={point.name} role="row" className="tb" style={{ gridTemplateColumns: "112px 1fr 72px", minHeight: 46 }}>
              <span role="cell" style={{ fontWeight: 600, fontSize: 15 }}>{point.name}</span>
              <span role="cell" aria-hidden="true" className="bar"><i style={{ width: `${Math.min(100, Math.max(0, point.value * 100)).toFixed(1)}%` }} /></span>
              <span role="cell" className="n" style={{ textAlign: "right" }}>
                <b style={{ fontSize: 17 }}>{isR2 ? score(point.value) : formatNumber(point.value, 2)}</b>{point.unit && <span className="lb"> {point.unit}</span>}
              </span>
            </div>
          ))}
        </div>
        <div className="df">
          <span>Measure <b>{isR2 ? "R² on held-out lots" : r2(block.title)}</b></span>
          {isR2 && <span>Not an accuracy percentage</span>}
        </div>
        {block.note && !text?.includes(block.note) && <div className="lb" style={{ marginTop: 10, fontSize: 15 }}>{block.note}</div>}
      </section>
    );
  },
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
          {block.missing !== answer.text && <div className="lb" style={{ marginTop: 6, fontSize: 16, lineHeight: 1.5 }}>{block.missing}</div>}
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
  reference: ({ block }) => {
    switch (block.ref.kind) {
      case "job": return <JobFlow jobId={block.ref.id} />;
      case "po_review": return <LotReview />;
      case "lot": return <LotConditions lotId={block.ref.id} />;
      case "photo": return <PhotoResult photoId={block.ref.id} />;
      case "card": return (
        <section className="cd">
          <div className="ct2"><span className="t" style={{ fontSize: 15 }}>Job card PDF</span><Labels labels={block.labels} gemini={block.generatedByGemini} /></div>
          <a className="bt s sm" href={jobCardPdfPath(block.ref.id)} target="_blank" rel="noopener">Open PDF</a>
        </section>
      );
      default: return (
        <section className="cd">
          <div className="ct2"><span className="t" style={{ fontSize: 15 }}>{REF_NAMES[block.ref.kind]}</span><Labels labels={block.labels} gemini={block.generatedByGemini} /></div>
          <div className="n" style={{ fontSize: 16, fontWeight: 600, overflowWrap: "anywhere" }}>{block.ref.id}</div>
        </section>
      );
    }
  },
  unavailable: ({ block }) => (
    <section className="cd">
      <span className="sx id" style={{ fontSize: 15, whiteSpace: "normal" }}><IdleMark />{REF_NAMES[block.ref.kind]} not shown again</span>
      <div className="lb" style={{ marginTop: 6, fontSize: 15 }}>
        {UNAVAILABLE_WORDS[block.errorCode] ?? "Its source record has expired or cannot be read, so Arc does not show it again."}
      </div>
    </section>
  ),
};

function renderBlock(block: AnswerBlock, answer: Answer, text: string | null, ask: Ask, busy: boolean) {
  const render = BLOCK_RENDERERS[block.kind] as (props: BlockProps<AnswerBlockKind>) => ReactNode;
  return <div key={block.blockId} className="stl">{render({ block, answer, text, ask, busy } as BlockProps<AnswerBlockKind>)}</div>;
}

/**
 * The reply to one turn. The value and chart designs put the answer text inside the card, so a
 * leading value or chart block carries it; refusal and no-data cards carry it as their headline.
 * Any other answer shows the text in its own card first. The Gemini chip goes with the text.
 */
export function AnswerView({ answer, ask, busy }: { answer: Answer; ask: Ask; busy: boolean }) {
  const textInBlock = answer.blocks.some((block) => block.kind === "refusal" || block.kind === "no_data");
  const first = answer.blocks[0];
  const carried = !textInBlock && Boolean(answer.text) && (first?.kind === "value" || first?.kind === "chart");
  return (
    <>
      {answer.text && !textInBlock && !carried && (
        <section className="cd">
          <div className="ct2"><span className="t" style={{ fontSize: 15, color: "var(--mu)" }}>Answer</span>{answer.generatedByGemini && GEMINI}</div>
          <p className="ans">{answer.text}</p>
        </section>
      )}
      {answer.blocks.map((block, index) => renderBlock(block, answer, carried && index === 0 ? answer.text : null, ask, busy))}
    </>
  );
}
