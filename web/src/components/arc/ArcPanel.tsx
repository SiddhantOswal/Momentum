import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { arcWords, listTurns, type ArcSession, type LotStage, type TurnInput, type TurnListItem, type TurnOutcome } from "../../lib/arc";
import { href, type RouteId } from "../../lib/routes";
import { ArcMark, ButtonLink, Icon, NotConnected, PATHS } from "../m";
import { AnswerView, type Ask } from "./AnswerView";
import { DefectCheck } from "./DefectScreens";
import { JobFlow, LotConditions, LotReview, LotSource, PlanStopped, type StepProblem } from "./LotScreens";
import { ArcScreenContext, Loading, Problem, type ArcScreen } from "./parts";
import type { ArcConversation, Exchange } from "./useArcConversation";

const MAX_TEXT = 1000;

// The four Arc-Start rows. A row with a fixed plan in config/arc.json sends that action, which
// needs no Gemini call; the others send their title as a typed turn.
const STARTERS: { title: string; sub: string; icon: string; input: TurnInput }[] = [
  { title: "New lot", sub: "Read an order and prepare a job card.", icon: PATHS.newLot, input: { kind: "action", actionId: "list_samples" } },
  { title: "Check a defect", sub: "Search past lots or review an approved photo.", icon: PATHS.photo, input: { kind: "action", actionId: "list_approved_photos" } },
  { title: "Ask about the data", sub: "Conditions, risks, models and approvals.", icon: PATHS.insights, input: { kind: "text", text: "Ask about the data" } },
  { title: "Open a job card", sub: "Review or retrieve a stored card.", icon: PATHS.jobCard, input: { kind: "text", text: "Open a job card" } },
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

/**
 * The card a turn calls for, from the last step the server reported. J1 and defect turns get
 * their designed screen; any other turn shows its answer. A stopped step keeps its screen and
 * shows the reason on it, with Try again only as the stopped outcome allows (lib/arc.ts Retry).
 */
function problemOf(exchange: Exchange, retry: (exchange: Exchange) => void): StepProblem | undefined {
  const { outcome, input } = exchange;
  if (outcome?.kind !== "stopped") return undefined;
  return { words: outcome.words, onRetry: outcome.retry && input ? () => retry(exchange) : undefined, retryAt: outcome.retry?.at };
}

const refOf = (steps: Exchange["steps"], tool: string, kind: string) =>
  steps.find((step) => step.tool === tool && step.resultRef?.kind === kind)?.resultRef?.id ?? null;
const paramOf = (exchange: Exchange, name: string) =>
  exchange.input?.kind === "action" && typeof exchange.input.params?.[name] === "string" ? exchange.input.params[name] as string : null;
// The conditions card names what to fix; the general words are for a message Arc could not route.
const CONDITIONS_INVALID = "Check the values. One is outside the plant's recorded range or is not a valid value.";

/**
 * `latest` is false once a later exchange is in the panel, so an old review card cannot open a
 * second lot by mistake. A conditions card always names its own lot, so it stays usable.
 */
function screenFor(exchange: Exchange, retry: (exchange: Exchange) => void, latest: boolean): ReactNode | null {
  const { outcome, steps } = exchange;
  const last = steps.at(-1);
  if (!outcome || !last || outcome.kind === "not_connected" || outcome.kind === "error") return null;
  const problem = problemOf(exchange, retry);
  const ref = last.resultRef;
  const params = exchange.input?.kind === "action" ? exchange.input.params : undefined;
  if (last.status === "WAITING_FOR_USER") {
    switch (last.waitingFor) {
      case "confirm_order": return <LotReview reviewId={refOf(steps, "read_order", "po_review")} closed={!latest} />;
      case "confirm_conditions": return <LotConditions lotId={refOf(steps, "confirm_order", "lot")} />;
      case "approve": {
        const jobId = refOf(steps, "plan_lot", "job");
        return jobId ? <JobFlow jobId={jobId} /> : <PlanStopped problem={problem} />;
      }
      default: return null;
    }
  }
  switch (last.tool) {
    case "list_samples": return last.status === "SUCCEEDED" ? <LotSource /> : null;
    case "read_order": return last.status === "SUCCEEDED" && ref?.kind === "po_review"
      ? <LotReview reviewId={ref.id} problem={problem} closed={!latest} /> : <LotSource problem={problem} />;
    case "confirm_order": return <LotReview reviewId={paramOf(exchange, "reviewId")} problem={problem} closed={!latest} />;
    case "confirm_conditions": return (
      <LotConditions lotId={paramOf(exchange, "lotId")} initial={params}
        problem={problem && last.errorCode === "VALIDATION_ERROR" ? { ...problem, words: CONDITIONS_INVALID } : problem} />
    );
    case "set_conditions": return <LotConditions lotId={ref?.kind === "lot" ? ref.id : null} problem={problem} />;
    case "plan_lot": return ref?.kind === "job" ? <JobFlow jobId={ref.id} /> : <PlanStopped problem={problem} />;
    case "list_approved_photos": return last.status === "SUCCEEDED" ? <DefectCheck /> : null;
    default: return null;
  }
}

function Outcome({ exchange, ask, busy, retry }: { exchange: Exchange; ask: Ask; busy: boolean; retry: (exchange: Exchange) => void }) {
  const outcome = exchange.outcome as TurnOutcome;
  switch (outcome.kind) {
    case "answer":
      return outcome.turn.answer
        ? <AnswerView answer={outcome.turn.answer} ask={ask} busy={busy} />
        : <Problem words={arcWords(outcome.turn.errorCode ?? "UNKNOWN")} />;
    case "not_connected":
      return <NotConnected title="Arc is not connected" missing={NOT_CONNECTED} />;
    case "stopped":
      return <Problem {...problemOf(exchange, retry) as StepProblem} />;
    case "error":
      return <Problem words={outcome.words} />;
  }
}

function ExchangeView({ exchange, ask, busy, retry, latest }: {
  exchange: Exchange; ask: Ask; busy: boolean; retry: (exchange: Exchange) => void; latest: boolean;
}) {
  const screen = screenFor(exchange, retry, latest);
  if (screen) return <article className="stl" style={{ gap: 16 }} aria-label={`You asked: ${exchange.asked}`}>{screen}</article>;
  return (
    <article className="stl" style={{ gap: 16 }} aria-label={`You asked: ${exchange.asked}`}>
      <div className="rqh"><small>You asked</small><h2>{exchange.asked}</h2></div>
      {exchange.outcome
        ? <Outcome exchange={exchange} ask={ask} busy={busy} retry={retry} />
        : <Loading>{exchange.step ?? "Arc is working on this"}</Loading>}
    </article>
  );
}

// "Next for you" by the stage the lot head records (04 section 2.7). Each leads to the page that does that step.
const NEXT_STEP: Record<LotStage, { title: string; sub: string; action: string; route: RouteId }> = {
  order_review: { title: "Confirm the order", sub: "Planning waits until the order is confirmed.", action: "Confirm the order", route: "new-lot/order" },
  conditions: { title: "Confirm the conditions", sub: "Planning stays blocked until they are confirmed.", action: "Confirm conditions", route: "new-lot/conditions" },
  planning: { title: "Plan the lot", sub: "Enter the planned settings to get a draft.", action: "Plan the lot", route: "new-lot/settings" },
  draft_review: { title: "Review the draft", sub: "The job card stays a draft until you approve it.", action: "Review the draft", route: "new-lot/approve" },
  approval_pending: { title: "Approve the job card", sub: "Only you can approve it.", action: "Review and approve", route: "new-lot/approve" },
  approved: { title: "Job card approved", sub: "Nothing is waiting on this lot.", action: "Open Preparation Flow", route: "prep-flow" },
  held: { title: "Planning is held", sub: "A defect estimate is missing, so no card can be issued.", action: "Open Preparation Flow", route: "prep-flow" },
};

function NextForYou({ session }: { session: ArcSession | null }) {
  const lot = session?.activeLots.at(-1);
  if (!lot) return <NotConnected title="Next for you" missing="Arc does not track lots in progress yet, so it cannot suggest the next step." />;
  const next = NEXT_STEP[lot.stage];
  return (
    <section className="cd kr" aria-labelledby="arc-next-title">
      <div className="ct" style={{ marginBottom: 10 }}>
        <h3 className="t" id="arc-next-title" style={{ fontSize: 15 }}>Next for you</h3>
        <span className="pv"><i aria-hidden="true" />{lot.currentRevision > 0 ? `Rev ${lot.currentRevision}` : "Not planned yet"}</span>
      </div>
      <div className="d" style={{ fontSize: 26, lineHeight: "32px", fontWeight: 600, letterSpacing: "-.3px" }}>{next.title}</div>
      <div className="lb" style={{ marginTop: 4, fontSize: 15 }}>{next.sub}</div>
      <div style={{ display: "flex", gap: 18, marginTop: 16, alignItems: "center" }}>
        <ButtonLink arrow href={href(next.route)}>{next.action}</ButtonLink>
      </div>
    </section>
  );
}

function Start({ send, disabled, session }: { send: (input: TurnInput, asked: string) => void; disabled: boolean; session: ArcSession | null }) {
  return (
    <>
      <div>
        <h2 className="h1a">What do you need done?</h2>
        <p className="lb" style={{ margin: "6px 0 0", fontSize: 15 }}>Run the work, or ask about it. You approve every decision.</p>
      </div>
      <NextForYou session={session} />
      <div>
        <h3 className="sh2">Or start something</h3>
        <section className="cd" style={{ padding: "4px 20px" }}>
          {STARTERS.map((starter) => (
            <button key={starter.title} type="button" className="ar" disabled={disabled} onClick={() => send(starter.input, starter.title)}>
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
      <p className="lb" style={{ margin: 0, fontSize: 15 }}>Messages from this session.</p>
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
      {state.loading && <Loading>Reading past work</Loading>}
      {state.next && !state.loading && <div><button type="button" className="bt s sm" onClick={() => load(state.next ?? undefined)}>Show older</button></div>}
    </section>
  );
}

const LOT_TOOLS = new Set(["list_samples", "read_order", "confirm_order", "confirm_conditions", "set_conditions", "plan_lot"]);

export function ArcPanel({ hostName, conversation, onClose }: { hostName: string; conversation: ArcConversation; onClose: () => void }) {
  const { exchanges, connection, session, callsLeft, busy, workingOn, setWorkingOn, send, retry, showPast, checkConnection } = conversation;
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

  // A button that sends a turn is often removed or disabled by that turn (a starter row, Read this
  // order, Try again). Focus then lands on the page body, so it is brought back to the message box.
  useEffect(() => {
    if (!busy) return;
    const active = document.activeElement;
    const panel = inputRef.current?.closest("#arc-panel");
    if (!panel?.contains(active) || (active as HTMLButtonElement | null)?.disabled) inputRef.current?.focus();
  }, [busy]);

  const screen: ArcScreen = useMemo(() => ({
    send: (input, asked) => { setShowHistory(false); void send(input, asked); },
    busy, setWorkingOn,
  }), [send, busy, setWorkingOn]);

  const sendText = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || busy || notConnected) return;
    setText("");
    screen.send({ kind: "text", text: trimmed }, trimmed);
  };
  const ask: Ask = (suggestion) => screen.send({ kind: "action", actionId: suggestion.actionId }, suggestion.label);
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      sendText(text);
    }
  };

  const latest = exchanges.at(-1);
  // An approved card has nothing left to change, so the receipt asks for the next task, as its design does.
  const onLot = Boolean(latest?.steps.some((step) => LOT_TOOLS.has(step.tool)));
  const onDefect = Boolean(latest?.steps.some((step) => step.tool === "list_approved_photos"));
  const placeholder = !exchanges.length || (onLot && workingOn?.stage === "Approved") ? "Tell Arc what you need"
    : onLot || onDefect ? "Tell Arc what to change" : "Ask a follow-up";

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
      <ArcScreenContext.Provider value={screen}>
        <div className="ab" ref={bodyRef}>
          {showHistory
            ? <PastWork onOpen={(turn) => { setShowHistory(false); void showPast(turn.clientTurnId, askedText(turn)); }} />
            : (
              <>
                {notConnected && exchanges.length === 0 && <NotConnected title="Arc is not connected" missing={NOT_CONNECTED} />}
                {exchanges.length === 0 && <Start send={screen.send} disabled={busy || notConnected} session={session} />}
                {exchanges.length > 0 && (
                  <div role="log" aria-label="Arc messages" aria-live="polite" className="stl" style={{ gap: 28 }}>
                    {exchanges.map((exchange, index) => (
                      <ExchangeView key={exchange.id} exchange={exchange} ask={ask} busy={busy} retry={retry} latest={index === exchanges.length - 1} />
                    ))}
                  </div>
                )}
              </>
            )}
        </div>
      </ArcScreenContext.Provider>
      <div className="cp">
        {workingOn && exchanges.length > 0 && (
          <div className="cl"><span className="k">Working on</span><span className="chp">{workingOn.label}</span><span className="chp">{workingOn.stage}</span></div>
        )}
        <form className="cb" onSubmit={(event) => { event.preventDefault(); sendText(text); }}>
          <textarea ref={inputRef} className="ti" rows={1} maxLength={MAX_TEXT} value={text} disabled={notConnected}
            placeholder={placeholder} aria-label="Message Arc"
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
