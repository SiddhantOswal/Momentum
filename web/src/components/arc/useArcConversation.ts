import { useCallback, useRef, useState } from "react";
import {
  arcWords, askArc, geminiCallsLeftToday, getArcSession, getRun, getTurn, newTurnId, stepsFromEvents, stepsFromRun,
  type ArcEvent, type ArcSession, type StepState, type TurnInput, type TurnOutcome,
} from "../../lib/arc";

export type Exchange = {
  id: string;
  asked: string;
  /** What was sent, so a retry-safe failure can be sent again as a new turn. Null for past work. */
  input: TurnInput | null;
  /** The latest step label the server sent while the turn runs (G1). */
  step: string | null;
  /** Steps that started, from the stream or, for past work, from the run read. */
  steps: StepState[];
  taskRunId: string | null;
  outcome: TurnOutcome | null;
};

export type Connection = "unknown" | "connected" | "not_connected";

/** The lot a screen is showing, for the "Working on" line above the message box. */
export type WorkingOn = { label: string; stage: string };

/**
 * Conversation state lives above the panel so closing and reopening Arc keeps the
 * messages. Only one turn runs at a time.
 */
export function useArcConversation() {
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [connection, setConnection] = useState<Connection>("unknown");
  const [session, setSession] = useState<ArcSession | null>(null);
  const [callsLeft, setCallsLeft] = useState<number | null>(null);
  const [workingOn, setWorkingOn] = useState<WorkingOn | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const update = (id: string, patch: Partial<Exchange> | ((exchange: Exchange) => Partial<Exchange>)) =>
    setExchanges((list) => list.map((exchange) => (exchange.id === id
      ? { ...exchange, ...(typeof patch === "function" ? patch(exchange) : patch) } : exchange)));

  const refreshBudget = useCallback(() => { void geminiCallsLeftToday().then(setCallsLeft); }, []);

  // Checked each time the panel opens, never polled (contract section 7).
  const checkConnection = useCallback(async () => {
    const read = await getArcSession();
    setConnection(!read.ok && read.code === "ARC_NOT_ENABLED" ? "not_connected" : "connected");
    setSession(read.ok ? read.data : null);
    refreshBudget();
  }, [refreshBudget]);

  /** Posts one turn and follows it. `id` is new for a new turn, or an existing exchange's own ID to re-post it. */
  const run = useCallback(async (id: string, input: TurnInput, asked: string, existing: boolean) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const events: ArcEvent[] = [];
    const fresh: Exchange = { id, asked, input, step: null, steps: [], taskRunId: null, outcome: null };
    setExchanges((list) => existing ? list.map((exchange) => exchange.id === id ? fresh : exchange) : [...list, fresh]);
    const onEvent = (event: ArcEvent) => {
      events.push(event);
      const patch: Partial<Exchange> = { steps: stepsFromEvents(events) };
      if (event.type === "step.started") patch.step = event.label;
      if (event.type === "run.started") patch.taskRunId = event.taskRunId;
      update(id, patch);
    };
    try {
      const outcome = await askArc(input, onEvent, id);
      update(id, { outcome });
      if (outcome.kind === "not_connected") setConnection("not_connected");
    } catch {
      update(id, { outcome: { kind: "error", code: "UNKNOWN", words: arcWords("UNKNOWN") } });
    } finally {
      busyRef.current = false;
      setBusy(false);
      refreshBudget();
    }
  }, [refreshBudget]);

  const send = useCallback((input: TurnInput, asked: string) => run(newTurnId(), input, asked, false), [run]);

  /** Shows a stored turn from past work, read again from the server, with its run's steps. */
  const showPast = useCallback(async (clientTurnId: string, asked: string) => {
    if (exchanges.some((exchange) => exchange.id === clientTurnId)) return;
    setExchanges((list) => [...list, { id: clientTurnId, asked, input: null, step: null, steps: [], taskRunId: null, outcome: null }]);
    const turn = await getTurn(clientTurnId);
    let outcome: TurnOutcome;
    if (!turn.ok) outcome = turn.code === "ARC_NOT_ENABLED" ? { kind: "not_connected" } : { kind: "error", code: turn.code, words: arcWords(turn.code) };
    else if (turn.data.status === "complete") outcome = { kind: "answer", turn: turn.data };
    else if (turn.data.status === "failed") {
      const code = turn.data.errorCode ?? "UNKNOWN";
      outcome = { kind: "stopped", code, words: arcWords(code), retry: null };
    } else outcome = { kind: "error", code: "IN_PROGRESS", words: arcWords("TURN_STILL_RUNNING") };
    const taskRunId = turn.ok ? turn.data.taskRunId : null;
    const run = taskRunId ? await getRun(taskRunId) : null;
    update(clientTurnId, { outcome, taskRunId, steps: run?.ok ? stepsFromRun(run.data) : [] });
  }, [exchanges]);

  /**
   * Try again, as the stopped outcome allows: a new turn after a step the server marked safe to
   * repeat, or the same clientTurnId after the stream ended early, so the server replays or takes
   * the turn over instead of running it twice (contract sections 3.4, 4.4 and 6).
   */
  const retry = useCallback((exchange: Exchange) => {
    const { outcome, input } = exchange;
    if (!input || outcome?.kind !== "stopped" || !outcome.retry) return;
    if (outcome.retry.at !== undefined && outcome.retry.at > Date.now()) return;
    void (outcome.retry.mode === "same_turn" ? run(exchange.id, input, exchange.asked, true) : send(input, exchange.asked));
  }, [run, send]);

  return { exchanges, connection, session, callsLeft, busy, workingOn, setWorkingOn, send, retry, showPast, checkConnection };
}

export type ArcConversation = ReturnType<typeof useArcConversation>;
