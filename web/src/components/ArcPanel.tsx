import { useEffect, useRef, useState, type Ref } from "react";
import { getArcSession, getArcTurn, listArcTurns, postArcTurn, type AnswerBlock, type ArcSession, type Suggestion, type TurnInput, type TurnView } from "../lib/arc";
import type { RouteKey } from "../routes";

// Start actions from the design. actionId is the server action each row posts; a row with no server
// action stays disabled and says so.
const STARTS: { label: string; hint: string; icon: string; actionId: string | null }[] = [
  { label: "New lot", hint: "Read an order and prepare a job card.", icon: "M6 3h8l4 4v14H6zM14 3v4h4M12 11v6M9 14h6", actionId: "list_samples" },
  { label: "Check a defect", hint: "Search past lots or review an approved photo.", icon: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4", actionId: "list_approved_photos" },
  { label: "Ask about the data", hint: "Conditions, risks, models and approvals.", icon: "M5 20V11M12 20V5M19 20v-7", actionId: "get_status" },
  { label: "Open a job card", hint: "Review or retrieve a stored card.", icon: "M6 3h12v18H6zM9 8h6M9 12h6M9 16h4", actionId: null },
];

function ArcMark({ size }: { size: number }) {
  return (
    <svg className="arc-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="var(--ac)" />
      <path d="M6.8 21.6A9.2 9.2 0 0 1 22.2 14.6" fill="none" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" />
      <path d="M17.6 21.4l3 3 5.6-6.4" fill="none" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6.8" cy="21.6" r="2.5" fill="currentColor" />
    </svg>
  );
}

function ArcGlyph({ path }: { path: string }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={path} /></svg>;
}

export function ArcLauncher({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="arc-launcher" aria-label={open ? "Close Arc by Momentum" : "Open Arc by Momentum"}
      aria-haspopup="dialog" aria-controls="arc-panel" aria-expanded={open} onClick={onToggle}>
      <ArcMark size={30} />
      <span className="arc-launcher-copy"><strong>Arc</strong><span>Tell Arc what you need</span></span>
      <span className="arc-launcher-action">{open ? "Close" : "Open"}</span>
    </button>
  );
}

type Exchange = { id: string; text: string; state: "running" | "done" | "error"; turn?: TurnView; error?: string };
type Connection = "checking" | "connected" | "off" | "error";

// The server answers with one sentence for the heading and the rest as the line under it.
function splitAnswer(text: string | null) {
  const match = text ? /^(.+?[.!?])\s+(.+)$/s.exec(text) : null;
  return match ? { title: match[1], body: match[2] } : { title: text ?? "", body: "" };
}

const newId = () => crypto.randomUUID();

function Chevron() {
  return <ArcGlyph path="M9 6l6 6-6 6" />;
}

function SuggestionButtons({ items, onPick, variant }: { items: Suggestion[]; onPick: (item: Suggestion) => void; variant: "buttons" | "rows" }) {
  if (variant === "rows") {
    return (
      <div className="arc-list">
        {items.map(item => (
          <button type="button" className="arc-row" key={item.actionId} onClick={() => onPick(item)}>
            <span>{item.label}</span><Chevron />
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="arc-actions">
      {items.map((item, index) => (
        <button type="button" key={item.actionId} className={`button ${index === 0 ? "button-primary" : "button-secondary"}`} onClick={() => onPick(item)}>{item.label}</button>
      ))}
    </div>
  );
}

function Answer({ turn, onPick }: { turn: TurnView; onPick: (item: Suggestion) => void }) {
  const blocks = turn.answer?.blocks ?? [];
  const refusal = blocks.find((block): block is Extract<AnswerBlock, { kind: "refusal" }> => block.kind === "refusal");
  const noData = blocks.find((block): block is Extract<AnswerBlock, { kind: "no_data" }> => block.kind === "no_data");
  const values = blocks.filter((block): block is Extract<AnswerBlock, { kind: "value" }> => block.kind === "value");
  const followUps = blocks.find((block): block is Extract<AnswerBlock, { kind: "follow_ups" }> => block.kind === "follow_ups");
  const { title, body } = splitAnswer(turn.answer?.text ?? null);

  if (turn.status === "failed" || !turn.answer) {
    return <div className="arc-card" role="alert"><h3>Arc could not answer this one.</h3><p>Try again in a moment.</p></div>;
  }
  return (
    <>
      <section className="arc-card">
        <div className="arc-card-top">
          {refusal ? <span className="arc-card-kind">Outside Arc</span> : noData ? <span className="arc-card-kind arc-warn">Not enough data</span> : <span className="arc-card-kind">Answer</span>}
          {refusal && <span className="chip"><i />Out of scope</span>}
          {noData && <span className="chip"><i />Insufficient data</span>}
          {turn.answer.generatedByGemini && <span className="chip chip-accent"><i />Generated by Gemini</span>}
        </div>
        <h3>{title}</h3>
        <p>{noData ? noData.missing : body}</p>
      </section>
      {values.length > 0 && (
        <>
          <h4 className="arc-subhead">What Arc can show instead</h4>
          <div className="arc-list arc-values">
            {values.map(block => (
              <div className="arc-value" key={block.blockId}>
                <span>{block.title}</span>
                <b>{block.value ?? "Not recorded"}{block.value !== null && block.unit ? ` ${block.unit}` : ""}</b>
                {block.labels.map(label => <span className="chip" key={label}><i />{label}</span>)}
              </div>
            ))}
          </div>
        </>
      )}
      {noData && noData.alternatives.length > 0 && <SuggestionButtons items={noData.alternatives} onPick={onPick} variant="buttons" />}
      {refusal && refusal.suggestions.length > 0 && (
        <>
          <h4 className="arc-subhead">Try one of these</h4>
          <SuggestionButtons items={refusal.suggestions} onPick={onPick} variant="rows" />
        </>
      )}
      {followUps && <SuggestionButtons items={followUps.suggestions} onPick={onPick} variant="buttons" />}
    </>
  );
}

type ArcPanelProps = {
  ref?: Ref<HTMLDialogElement>;
  open: boolean;
  hostTitle: string;
  showHistory: boolean;
  onToggleHistory: () => void;
  onClose: () => void;
  onNavigate: (key: RouteKey) => void;
};

export function ArcPanel({ ref, open, hostTitle, showHistory, onToggleHistory, onClose, onNavigate }: ArcPanelProps) {
  const [connection, setConnection] = useState<Connection>("checking");
  const [session, setSession] = useState<ArcSession | null>(null);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [history, setHistory] = useState<{ state: "loading" | "error" | "ready"; turns: TurnView[] }>({ state: "loading", turns: [] });
  const [draft, setDraft] = useState("");
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setConnection("checking");
    getArcSession(controller.signal).then(result => {
      if (controller.signal.aborted) return;
      if (result.ok) { setSession(result.data); setConnection("connected"); }
      else setConnection(result.status === 404 ? "off" : "error");
    });
    return () => controller.abort();
  }, [open]);

  useEffect(() => {
    if (!open || !showHistory || connection !== "connected") return;
    const controller = new AbortController();
    setHistory({ state: "loading", turns: [] });
    listArcTurns(controller.signal).then(result => {
      if (!controller.signal.aborted) setHistory(result.ok ? { state: "ready", turns: result.data } : { state: "error", turns: [] });
    });
    return () => controller.abort();
  }, [open, showHistory, connection]);

  useEffect(() => { if (!open) abort.current?.abort(); }, [open]);

  const busy = exchanges.some(exchange => exchange.state === "running");
  const ready = connection === "connected";
  const patch = (id: string, change: Partial<Exchange>) => setExchanges(list => list.map(item => item.id === id ? { ...item, ...change } : item));

  async function send(input: TurnInput, shown: string) {
    if (!ready || busy) return;
    const id = newId();
    const controller = new AbortController();
    abort.current = controller;
    setExchanges(list => [...list, { id, text: shown, state: "running" }]);
    const ended = await postArcTurn(id, input, controller.signal);
    if (controller.signal.aborted) return;
    if (!ended.ok) { patch(id, { state: "error", error: ended.error }); return; }
    const turn = await getArcTurn(id, controller.signal);
    if (controller.signal.aborted) return;
    if (turn.ok) patch(id, { state: "done", turn: turn.data });
    else patch(id, { state: "error", error: turn.error });
  }

  const pick = (item: Suggestion) => void send({ kind: "action", actionId: item.actionId }, item.label);
  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    void send({ kind: "text", text }, text);
  };
  const next = session?.activeLots.find(lot => lot.stage === "conditions");
  const latest = exchanges.at(-1);

  return (
    <dialog ref={ref} id="arc-panel" className="arc-dialog" aria-label="Arc by Momentum" onClose={onClose}>
      <header className="arc-panel-header">
        <ArcMark size={36} />
        <div className="arc-panel-name"><strong>Arc</strong><span>by Momentum</span></div>
        <span className="arc-panel-host"><i aria-hidden="true" />{hostTitle}</span>
        <button type="button" className="arc-icon-button arc-history-button" aria-label="Past work"
          aria-pressed={showHistory} aria-controls="arc-activity" onClick={onToggleHistory}>
          <ArcGlyph path="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2" />
        </button>
        <form method="dialog">
          <button type="submit" className="arc-icon-button" aria-label="Close Arc">
            <ArcGlyph path="M6 6l12 12M18 6L6 18" />
          </button>
        </form>
      </header>
      <div className="arc-panel-body">
        {showHistory ? <h2 className="arc-panel-heading">Past work</h2> : !latest && <h2 className="arc-panel-heading">What do you need done?</h2>}
        <div id="arc-activity" role={showHistory ? "region" : "log"} aria-label={showHistory ? "Past work" : "Arc messages"} aria-live={showHistory ? undefined : "polite"}>
          {!ready ? (
            <span className="arc-connection-state"><i aria-hidden="true" />{connection === "checking" ? "Connecting" : connection === "error" ? "Can't reach Arc" : "Not connected"}</span>
          ) : showHistory ? (
            history.state === "loading" ? <span className="arc-connection-state"><i aria-hidden="true" />Loading</span>
              : history.state === "error" ? <span className="arc-connection-state"><i aria-hidden="true" />Can't load past work</span>
              : history.turns.length === 0 ? <span className="arc-connection-state"><i aria-hidden="true" />Not recorded</span>
              : <div className="arc-list">{history.turns.map(turn => (
                  <div className="arc-row" key={turn.clientTurnId}>
                    <span>{turn.input.kind === "text" ? turn.input.text : turn.answer?.text ?? turn.input.actionId}</span>
                  </div>))}</div>
          ) : (
            exchanges.map(exchange => (
              <div className="arc-exchange" key={exchange.id}>
                <span className="arc-asked">You asked</span>
                <h2 className="arc-question">{exchange.text}</h2>
                {exchange.state === "running" && <span className="arc-connection-state"><i aria-hidden="true" />Reading the data</span>}
                {exchange.state === "error" && <div className="arc-card" role="alert"><h3>{exchange.error}</h3></div>}
                {exchange.turn && <Answer turn={exchange.turn} onPick={pick} />}
              </div>
            ))
          )}
        </div>
        {ready && !showHistory && !latest && (
          <>
            <p className="arc-lede">Run the work, or ask about it. You approve every decision.</p>
            {next && (
              <section className="arc-next card-kraft">
                <div className="arc-card-top"><span>Next for you</span><span className="chip"><i />Rev {next.currentRevision}</span></div>
                <h3>Confirm conditions</h3>
                <p>Planning stays blocked until they are confirmed.</p>
                <button type="button" className="button button-primary" onClick={() => { onNavigate("new-lot"); onClose(); }}>Confirm conditions<ArcGlyph path="M5 12h14M13 6l6 6-6 6" /></button>
              </section>
            )}
            <div className="arc-suggestions" role="group" aria-labelledby="arc-suggestions-title">
              <h3 id="arc-suggestions-title">Or start something</h3>
              <div className="arc-list">
                {STARTS.map(start => (
                  <button type="button" className="arc-start" key={start.label} disabled={!start.actionId}
                    onClick={() => start.actionId && pick({ actionId: start.actionId, label: start.label })}>
                    <span className="arc-start-icon"><ArcGlyph path={start.icon} /></span>
                    <span className="arc-start-copy"><strong>{start.label}</strong><span>{start.hint}</span></span>
                    {start.actionId ? <Chevron /> : <span className="arc-connection-state"><i aria-hidden="true" />Not connected</span>}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      <footer className="arc-composer">
        <div className="arc-composer-box">
          <textarea rows={1} aria-label="Message Arc" placeholder={latest ? "Ask a follow-up" : "Tell Arc what you need"}
            value={draft} maxLength={1000} disabled={!ready || busy}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(); } }} />
          <button type="button" className="arc-icon-button" aria-label="Speak to Arc"
            aria-describedby="arc-voice-status" disabled>
            <ArcGlyph path="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4" />
          </button>
          <span id="arc-voice-status" className="sr-only">Voice input is unavailable.</span>
          <button type="button" className="arc-icon-button arc-send" aria-label="Send" disabled={!ready || busy || !draft.trim()} onClick={submit}>
            <ArcGlyph path="M5 12h14M13 6l6 6-6 6" />
          </button>
        </div>
        <p className="arc-footnote">Answers use sample data until sensors are connected.</p>
      </footer>
    </dialog>
  );
}
