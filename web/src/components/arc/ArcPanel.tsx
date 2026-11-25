import { useEffect, useRef, useState, type KeyboardEvent, type Ref } from "react";
import { arcWords, listTurns, type TurnListItem, type TurnOutcome } from "../../lib/arc";
import { ArcMark, Icon, IdleMark, NotConnected, PATHS } from "../m";
import { AnswerView, type Ask } from "./AnswerView";
import type { ArcConversation, Exchange } from "./useArcConversation";

const MAX_TEXT = 1000;

// The four Arc-Start rows. Each sends its own title as a typed turn.
const STARTERS = [
  { title: "New lot", sub: "Read an order and prepare a job card.", icon: PATHS.newLot },
  { title: "Check a defect", sub: "Search past lots or review an approved photo.", icon: PATHS.photo },
  { title: "Ask about the data", sub: "Conditions, risks, models and approvals.", icon: PATHS.insights },
  { title: "Open a job card", sub: "Review or retrieve a stored card.", icon: PATHS.jobCard },
];

const NOT_CONNECTED = "Arc is not switched on for this deployment, so it cannot read or run anything. The dashboard pages still work.";

export function ArcLauncher({ open, onToggle, ref }: { open: boolean; onToggle: () => void; ref?: Ref<HTMLButtonElement> }) {
  return (
    <button ref={ref} type="button" className={`arc${open ? " on" : ""}`} onClick={onToggle}
      aria-label={open ? "Close Arc by Momentum" : "Open Arc by Momentum"} aria-expanded={open} aria-controls="arc-panel">
      <ArcMark size={30} />
      <span className="at"><b>Arc</b><span>Tell Arc what you need</span></span>
      <span className="go">{open ? "Close" : "Open"}</span>
    </button>
  );
}

function Outcome({ outcome, ask, busy }: { outcome: TurnOutcome; ask: Ask; busy: boolean }) {
  switch (outcome.kind) {
    case "answer":
      return outcome.turn.answer
        ? <AnswerView answer={outcome.turn.answer} ask={ask} busy={busy} />
        : <Problem words={arcWords(outcome.turn.errorCode ?? "UNKNOWN")} />;
    case "not_connected":
      return <NotConnected title="Arc is not connected" missing={NOT_CONNECTED} />;
    case "stopped":
    case "error":
      return <Problem words={outcome.words} />;
  }
}

function Problem({ words }: { words: string }) {
  return (
    <section className="cd" role="alert">
      <span className="sx wn" style={{ fontSize: 15, whiteSpace: "normal", alignItems: "flex-start", lineHeight: 1.45 }}>
        <Icon name="warn" /><span style={{ color: "var(--tx)" }}>{words}</span>
      </span>
    </section>
  );
}

function ExchangeView({ exchange, ask, busy }: { exchange: Exchange; ask: Ask; busy: boolean }) {
  return (
    <article className="stl" style={{ gap: 16 }} aria-label={`You asked: ${exchange.asked}`}>
      <div className="rqh"><small>You asked</small><h2>{exchange.asked}</h2></div>
      {exchange.outcome
        ? <Outcome outcome={exchange.outcome} ask={ask} busy={busy} />
        : <div className="sx id" role="status" style={{ fontSize: 15 }}><IdleMark />{exchange.step ?? "Arc is working on this"}</div>}
    </article>
  );
}

function Start({ send, disabled }: { send: (text: string) => void; disabled: boolean }) {
  return (
    <>
      <div>
        <h2 className="h1a">What do you need done?</h2>
        <p className="lb" style={{ margin: "6px 0 0", fontSize: 15 }}>Run the work, or ask about it. You approve every decision.</p>
      </div>
      <NotConnected title="Next for you" missing="The next step for a lot in progress is not connected to Arc yet." />
      <div>
        <h3 className="sh2">Or start something</h3>
        <section className="cd" style={{ padding: "4px 20px" }}>
          {STARTERS.map((starter) => (
            <button key={starter.title} type="button" className="ar" disabled={disabled} onClick={() => send(starter.title)}>
              <span className="gx"><svg viewBox="0 0 24 24" aria-hidden="true"><path d={starter.icon} /></svg></span>
              <span><b>{starter.title}</b><span className="s">{starter.sub}</span></span>
              <Icon name="chevron" className="ac2" />
            </button>
          ))}
        </section>
      </div>
    </>
  );
}

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

function askedText(turn: TurnListItem) {
  return turn.input.kind === "text" ? turn.input.text : turn.input.actionId.replace(/_/g, " ");
}

function PastWork({ onOpen }: { onOpen: (turn: TurnListItem) => void }) {
  const [state, setState] = useState<{ turns: TurnListItem[]; next: string | null; loading: boolean; problem: string | null; notConnected: boolean }>(
    { turns: [], next: null, loading: true, problem: null, notConnected: false });

  const load = async (before?: string) => {
    setState((current) => ({ ...current, loading: true }));
    const page = await listTurns({ limit: 10, before });
    setState((current) => page.ok
      ? { turns: [...(before ? current.turns : []), ...page.data.turns], next: page.data.nextBefore, loading: false, problem: null, notConnected: false }
      : { ...current, loading: false, notConnected: page.code === "ARC_NOT_ENABLED", problem: arcWords(page.code, page.retryAfterSeconds) });
  };
  useEffect(() => { void load(); }, []);

  if (state.notConnected) return <NotConnected title="Past work" missing={NOT_CONNECTED} />;
  return (
    <section aria-labelledby="arc-past-title" className="stl" style={{ gap: 12 }}>
      <h2 id="arc-past-title" className="h1a">Past work</h2>
      <p className="lb" style={{ margin: 0, fontSize: 15 }}>Messages from this demo session.</p>
      {state.problem && <Problem words={state.problem} />}
      {!state.problem && !state.loading && state.turns.length === 0 && <p className="lb" style={{ margin: 0 }}>No past work in this session yet.</p>}
      {state.turns.length > 0 && (
        <section className="cd" style={{ padding: "2px 20px" }}>
          {state.turns.map((turn) => (
            <button key={turn.clientTurnId} type="button" className="ar plain" onClick={() => onOpen(turn)}>
              <span style={{ minWidth: 0 }}>
                <b style={{ overflowWrap: "anywhere" }}>{askedText(turn)}</b>
                <span className="s">
                  {timeOf(turn.createdAt)}, {turn.status === "complete" ? "answered" : turn.status === "failed" ? "stopped" : "still running"}
                </span>
              </span>
              <Icon name="chevron" className="ac2" />
            </button>
          ))}
        </section>
      )}
      {state.loading && <div className="sx id" role="status" style={{ fontSize: 15 }}><IdleMark />Reading past work</div>}
      {state.next && !state.loading && <div><button type="button" className="bt s sm" onClick={() => load(state.next ?? undefined)}>Show older</button></div>}
    </section>
  );
}

export function ArcPanel({ hostName, conversation, onClose }: { hostName: string; conversation: ArcConversation; onClose: () => void }) {
  const { exchanges, connection, callsLeft, busy, send, showPast, checkConnection } = conversation;
  const [text, setText] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const notConnected = connection === "not_connected";

  useEffect(() => {
    void checkConnection();
    inputRef.current?.focus();
  }, [checkConnection]);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!showHistory) bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [exchanges, showHistory]);

  const sendText = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || busy || notConnected) return;
    setShowHistory(false);
    setText("");
    void send({ kind: "text", text: trimmed }, trimmed);
  };
  const ask: Ask = (suggestion) => {
    setShowHistory(false);
    void send({ kind: "action", actionId: suggestion.actionId }, suggestion.label);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      sendText(text);
    }
  };

  return (
    <aside id="arc-panel" className="arcp" role="dialog" aria-label="Arc by Momentum">
      <div className="ah">
        <ArcMark size={36} />
        <div className="nm"><b>Arc</b><span>by Momentum</span></div>
        {callsLeft !== null && <span className="bud">Gemini left today: {callsLeft} {callsLeft === 1 ? "call" : "calls"}</span>}
        <span className="cx"><i aria-hidden="true" />{hostName}</span>
        <button type="button" className="ib" aria-label="Past work" aria-pressed={showHistory} onClick={() => setShowHistory((on) => !on)}>
          <Icon name="history" />
        </button>
        <button type="button" className="ib" aria-label="Close Arc" onClick={onClose}><Icon name="close" /></button>
      </div>
      <div className="ab" ref={bodyRef}>
        {showHistory
          ? <PastWork onOpen={(turn) => { setShowHistory(false); void showPast(turn.clientTurnId, askedText(turn)); }} />
          : (
            <>
              {notConnected && exchanges.length === 0 && <NotConnected title="Arc is not connected" missing={NOT_CONNECTED} />}
              {exchanges.length === 0 && <Start send={sendText} disabled={busy || notConnected} />}
              {exchanges.length > 0 && (
                <div role="log" aria-label="Arc messages" aria-live="polite" className="stl" style={{ gap: 28 }}>
                  {exchanges.map((exchange) => <ExchangeView key={exchange.id} exchange={exchange} ask={ask} busy={busy} />)}
                </div>
              )}
            </>
          )}
      </div>
      <div className="cp">
        <form className="cb" onSubmit={(event) => { event.preventDefault(); sendText(text); }}>
          <textarea ref={inputRef} className="ti" rows={1} maxLength={MAX_TEXT} value={text} disabled={notConnected}
            placeholder={exchanges.length ? "Ask a follow-up" : "Tell Arc what you need"} aria-label="Message Arc"
            onChange={(event) => setText(event.target.value)} onKeyDown={onKeyDown} />
          {/* Voice comes later: the button is shown but stays disabled in code, with no handler. */}
          <button type="button" className="mic" disabled aria-label="Speak to Arc. Voice is not available yet.">
            <Icon name="mic" />
          </button>
          <button type="submit" className="snd" aria-label="Send" disabled={!text.trim() || busy || notConnected}>
            <Icon name="arrow" />
          </button>
        </form>
        <div className="cf">Answers use sample data until sensors are connected.</div>
      </div>
    </aside>
  );
}
