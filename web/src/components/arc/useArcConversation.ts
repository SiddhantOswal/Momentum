import { useCallback, useRef, useState } from "react";
import { arcWords, askArc, geminiCallsLeftToday, getArcSession, getTurn, newTurnId, type TurnInput, type TurnOutcome } from "../../lib/arc";

export type Exchange = {
  id: string;
  asked: string;
  /** The latest step label the server sent while the turn runs (G1). */
  step: string | null;
  outcome: TurnOutcome | null;
};

export type Connection = "unknown" | "connected" | "not_connected";

/**
 * Conversation state lives above the panel so closing and reopening Arc keeps the
 * messages. Only one turn runs at a time.
 */
export function useArcConversation() {
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [connection, setConnection] = useState<Connection>("unknown");
  const [callsLeft, setCallsLeft] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const update = (id: string, patch: Partial<Exchange>) =>
    setExchanges((list) => list.map((exchange) => (exchange.id === id ? { ...exchange, ...patch } : exchange)));

  const refreshBudget = useCallback(() => { void geminiCallsLeftToday().then(setCallsLeft); }, []);

  // Checked each time the panel opens, never polled (contract section 7).
  const checkConnection = useCallback(async () => {
    const session = await getArcSession();
    setConnection(!session.ok && session.code === "ARC_NOT_ENABLED" ? "not_connected" : "connected");
    refreshBudget();
  }, [refreshBudget]);

  const send = useCallback(async (input: TurnInput, asked: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const id = newTurnId();
    setExchanges((list) => [...list, { id, asked, step: null, outcome: null }]);
    try {
      const outcome = await askArc(input, (step) => update(id, { step }), id);
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

  /** Shows a stored turn from past work, read again from the server. */
  const showPast = useCallback(async (clientTurnId: string, asked: string) => {
    if (exchanges.some((exchange) => exchange.id === clientTurnId)) return;
    setExchanges((list) => [...list, { id: clientTurnId, asked, step: null, outcome: null }]);
    const turn = await getTurn(clientTurnId);
    let outcome: TurnOutcome;
    if (!turn.ok) outcome = turn.code === "ARC_NOT_ENABLED" ? { kind: "not_connected" } : { kind: "error", code: turn.code, words: arcWords(turn.code) };
    else if (turn.data.status === "complete") outcome = { kind: "answer", turn: turn.data };
    else if (turn.data.status === "failed") outcome = { kind: "stopped", code: turn.data.errorCode ?? "UNKNOWN", words: arcWords(turn.data.errorCode ?? "UNKNOWN") };
    else outcome = { kind: "error", code: "IN_PROGRESS", words: arcWords("TURN_STILL_RUNNING") };
    update(clientTurnId, { outcome });
  }, [exchanges]);

  return { exchanges, connection, callsLeft, busy, send, showPast, checkConnection };
}

export type ArcConversation = ReturnType<typeof useArcConversation>;
