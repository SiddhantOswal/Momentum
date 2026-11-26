// Client for /api/arc/*. Shapes follow docs/arc/delivery/06-arc-wire-contract.md sections 4 and 5.
import { ensureSession, getJson, type Result } from "./api";

export type LotStage = "order_review" | "conditions" | "planning" | "draft_review" | "approval_pending" | "approved" | "held";

export type ArcSession = {
  identityLabel: string;
  activeLots: { lotId: string; stage: LotStage; currentJobId: string | null; currentRevision: number }[];
  turnCount: number;
};

export type Suggestion = { actionId: string; label: string };
export type AnswerBlock = { blockId: string } & (
  | { kind: "value"; title: string; value: string | number | null; unit: string | null; labels: string[]; note: string | null }
  | { kind: "chart"; title: string; series: { name: string; value: number; unit: string | null; labels: string[] }[]; labels: string[]; note: string | null }
  | { kind: "no_data"; missing: string; alternatives: Suggestion[] }
  | { kind: "refusal"; suggestions: Suggestion[] }
  | { kind: "follow_ups"; suggestions: Suggestion[] }
  | { kind: "reference" | "unavailable"; ref: { kind: string; id: string } }
);
export type TurnView = {
  clientTurnId: string;
  status: "in_progress" | "complete" | "failed";
  createdAt: string;
  input: { kind: "text"; text: string } | { kind: "action"; actionId: string };
  answer: { text: string | null; generatedByGemini: boolean; blocks?: AnswerBlock[] } | null;
  errorCode: string | null;
};

export type TurnInput = { kind: "text"; text: string } | { kind: "action"; actionId: string };

export const getArcSession = async (signal?: AbortSignal): Promise<Result<ArcSession>> => {
  const result = await getJson<{ session: ArcSession }>("/api/arc/session", signal);
  return result.ok ? { ok: true, data: result.data.session } : result;
};

export const getArcTurn = async (id: string, signal?: AbortSignal): Promise<Result<TurnView>> => {
  const result = await getJson<{ turn: TurnView }>(`/api/arc/turns/${encodeURIComponent(id)}`, signal);
  return result.ok ? { ok: true, data: result.data.turn } : result;
};

export const listArcTurns = async (signal?: AbortSignal): Promise<Result<TurnView[]>> => {
  const result = await getJson<{ turns: TurnView[] }>("/api/arc/turns?limit=10", signal);
  return result.ok ? { ok: true, data: result.data.turns } : result;
};

// Event types that end a turn (wire contract 3.3). Only the last one matters to the panel: the
// answer text and blocks are read from the stored turn, never from the stream.
type StreamEnd = { ok: true; last: string | null } | { ok: false; error: string; status?: number };

export async function postArcTurn(clientTurnId: string, input: TurnInput, signal?: AbortSignal): Promise<StreamEnd> {
  await ensureSession();
  try {
    const response = await fetch("/api/arc/turns", {
      method: "POST",
      credentials: "same-origin",
      headers: { Accept: "text/event-stream", "Content-Type": "application/json" },
      body: JSON.stringify({ clientTurnId, input }),
      signal,
    });
    if (!response.ok || !response.body) {
      const body = await response.json().catch(() => undefined);
      return { ok: false, status: response.status, error: body?.error?.message ?? `Request failed (${response.status})` };
    }
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    let last: string | null = null;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += value;
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const type = /^event: (.+)$/m.exec(frame)?.[1];
        if (type) last = type;
      }
    }
    return { ok: true, last };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return { ok: false, error: "Stopped." };
    return { ok: false, error: "Can't reach Momentum. Check the connection and try again." };
  }
}
