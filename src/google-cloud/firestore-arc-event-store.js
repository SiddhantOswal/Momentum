import { createArcFirestore, unavailable } from "./firestore-arc-client.js";
import { ArcEventDocSchema, BASE_TIMESTAMP_FIELDS, STATE_SCHEMA_VERSION, TraceHeadDocSchema } from "../state-schemas.js";
import { canonicalJson } from "../arc/canonical-json.js";

const headPath = (run) => `traces/${run.taskRunId}`;
const eventPath = (run, sequence) => `${headPath(run)}/trace_events/${sequence}`;

function eventFields({ sequence, type, clientTurnId, stepId = null, tool = null, errorCode = null,
  resultRef = null, waitingFor = null }) {
  return { sequence, type, clientTurnId, stepId, tool, errorCode, resultRef, waitingFor };
}

export function createArcEventStore({ now = Date.now, ...options } = {}) {
  const db = createArcFirestore(options);
  const instant = () => new Date(now()).toISOString();
  const base = (run) => ({
    schemaVersion: STATE_SCHEMA_VERSION, createdAt: run.createdAt, expiresAt: run.expiresAt, updatedAt: instant(),
  });
  const writeOptions = (signal) => ({ timestamps: BASE_TIMESTAMP_FIELDS, signal });

  async function readHead(run, signal) {
    const head = await db.read(headPath(run), TraceHeadDocSchema, { signal });
    if (head && (head.doc.runId !== run.taskRunId || head.doc.ownerSessionId !== run.sessionId || head.doc.kind !== "arc_task_run")) {
      throw unavailable("The Arc trace belongs to a different run.");
    }
    return head;
  }

  async function advanceHead(run, event, current, { signal, geminiAttempts }) {
    if ((current?.doc.lastSequence ?? 0) >= event.sequence) return;
    const status = event.type === "run.completed" ? "completed"
      : ["run.failed", "step.failed", "step.blocked"].includes(event.type) ? "failed" : "running";
    const head = {
      ...base(run), runId: run.taskRunId, ownerSessionId: run.sessionId, kind: "arc_task_run",
      lastSequence: event.sequence, status, geminiAttempts,
    };
    const write = writeOptions(signal);
    const saved = current
      ? await db.replace(headPath(run), TraceHeadDocSchema, head, current.updateTime, write)
      : await db.create(headPath(run), TraceHeadDocSchema, head, write);
    if (!saved) throw unavailable("The Arc trace head has changed.");
  }

  return Object.freeze({
    async append(run, event, { signal, geminiAttempts, deferHead = false } = {}) {
      const fields = eventFields(event);
      const path = eventPath(run, fields.sequence);
      const current = deferHead ? null : await readHead(run, signal);
      if (!deferHead && (current?.doc.lastSequence ?? 0) < fields.sequence - 1) {
        throw unavailable("The Arc trace has a gap.");
      }
      if (!await db.create(path, ArcEventDocSchema, { ...base(run), ...fields }, writeOptions(signal))) {
        const previous = await db.read(path, ArcEventDocSchema, { signal });
        if (!previous || canonicalJson(eventFields(previous.doc)) !== canonicalJson(fields)) {
          throw unavailable("The Arc trace event has changed.");
        }
      }
      if (!deferHead) await advanceHead(run, event, current, { signal, geminiAttempts });
    },

    async publish(run, event, { signal, geminiAttempts } = {}) {
      await advanceHead(run, event, await readHead(run, signal), { signal, geminiAttempts });
    },

    async lastSequence(run, { signal } = {}) {
      return (await readHead(run, signal))?.doc.lastSequence ?? 0;
    },

    async read(run, { first, last, signal }) {
      const events = [];
      for (let sequence = first; sequence <= last; sequence += 1) {
        const stored = await db.read(eventPath(run, sequence), ArcEventDocSchema, { signal });
        if (!stored || stored.doc.sequence !== sequence) throw unavailable("The Arc trace has a gap.");
        events.push(eventFields(stored.doc));
      }
      return events;
    },
  });
}
