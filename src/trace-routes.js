import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { TraceRegistryError } from "./trace-registry.js";

const RunIdSchema = z.string().uuid();

function errorResponse(c, status, code, message) {
  return c.json({
    ok: false,
    error: { code, message },
  }, status);
}

function parseEventCursor(value, runId) {
  if (!value) return { ok: true, sequence: 0 };
  const match = /^([0-9a-f-]{36}):([1-9]\d*)$/i.exec(value);
  if (!match || match[1] !== runId || !Number.isSafeInteger(Number(match[2]))) {
    return { ok: false };
  }
  return { ok: true, sequence: Number(match[2]) };
}

function createEventQueue(maxQueuedEvents = 250) {
  const events = [];
  let resolveNext;
  let closed = false;
  let overflowed = false;
  return {
    push(event) {
      if (closed) return;
      if (resolveNext) {
        const resolve = resolveNext;
        resolveNext = undefined;
        resolve(event);
      } else if (events.length >= maxQueuedEvents) {
        overflowed = true;
        closed = true;
      } else {
        events.push(event);
      }
    },
    get overflowed() {
      return overflowed;
    },
    next() {
      if (events.length) return Promise.resolve(events.shift());
      if (closed) return Promise.resolve(undefined);
      return new Promise((resolve) => {
        resolveNext = resolve;
      });
    },
    close() {
      closed = true;
      if (resolveNext) {
        const resolve = resolveNext;
        resolveNext = undefined;
        resolve(undefined);
      }
    },
  };
}

function isTerminal(event) {
  return event.type.startsWith("run.") && event.type !== "run.started";
}

function streamFailure(stream) {
  return stream.writeSSE({
    event: "stream.error",
    data: JSON.stringify({
      ok: false,
      error: {
        code: "TRACE_STREAM_FAILED",
        message: "Trace stream ended unexpectedly.",
      },
    }),
  });
}

function streamIncomplete(stream) {
  return stream.writeSSE({
    event: "stream.error",
    data: JSON.stringify({
      ok: false,
      error: {
        code: "TRACE_INCOMPLETE",
        message: "The stored trace stops before the run ended.",
      },
    }),
  });
}

function pause(ms, signal) {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    }
    signal.addEventListener("abort", done, { once: true });
  });
}

/**
 * Serves a run this instance does not hold in memory from the durable store.
 * A run still going on another instance is followed by polling, because
 * instances share no event channel; the stream ends at the run's terminal
 * event or after maxStreamMs, and the client resumes with Last-Event-ID.
 * A head marked "incomplete" ends the stream with TRACE_INCOMPLETE once every
 * stored event is sent; the head is read before the events, so none is missed.
 */
async function streamFromStore(c, { store, runId, sequence, pollIntervalMs, maxStreamMs }) {
  let head;
  try {
    head = await store.readHead(runId, { signal: c.req.raw.signal });
  } catch {
    return errorResponse(c, 503, "SERVICE_UNAVAILABLE", "Trace store is unavailable.");
  }
  if (!head) {
    return errorResponse(c, 404, "TRACE_NOT_FOUND", "Trace run was not found or has expired.");
  }
  if (head.status !== "incomplete" && sequence > head.lastSequence) {
    return errorResponse(c, 400, "TRACE_INVALID_CURSOR", "Trace event cursor is invalid.");
  }

  return streamSSE(c, async (stream) => {
    const signal = c.req.raw.signal;
    const deadline = Date.now() + maxStreamMs;
    let lastSentSequence = sequence;
    try {
      while (!signal.aborted) {
        for (const event of await store.readEventsAfter(runId, lastSentSequence, { signal })) {
          await stream.writeSSE({
            id: event.id,
            event: event.type,
            data: JSON.stringify(event),
          });
          lastSentSequence = event.sequence;
          if (isTerminal(event)) return;
        }
        if (head.status === "incomplete") {
          await streamIncomplete(stream);
          return;
        }
        if (Date.now() + pollIntervalMs > deadline) return;
        await pause(pollIntervalMs, signal);
        head = await store.readHead(runId, { signal });
        if (!head) throw new Error("The trace head disappeared while streaming.");
      }
    } catch {
      if (!signal.aborted) await streamFailure(stream);
    }
  });
}

export function createTraceRoutes(registry, {
  store,
  pollIntervalMs = 1000,
  maxStreamMs = 60_000,
} = {}) {
  if (store !== undefined && (typeof store.readHead !== "function" || typeof store.readEventsAfter !== "function")) {
    throw new TypeError("A durable trace store must read heads and events.");
  }
  if (!Number.isInteger(pollIntervalMs) || pollIntervalMs < 1 ||
      !Number.isInteger(maxStreamMs) || maxStreamMs < pollIntervalMs) {
    throw new RangeError("Trace polling limits must be positive.");
  }
  const routes = new Hono();

  routes.get("/:runId/events", (c) => {
    const parsedRunId = RunIdSchema.safeParse(c.req.param("runId"));
    if (!parsedRunId.success) {
      return errorResponse(c, 400, "VALIDATION_ERROR", "Run ID must be a UUID.");
    }
    const runId = parsedRunId.data;
    const cursor = parseEventCursor(c.req.header("Last-Event-ID"), runId);
    if (!cursor.ok) {
      return errorResponse(c, 400, "VALIDATION_ERROR", "Last-Event-ID must match this run and its sequence format.");
    }

    try {
      registry.getRun(runId);
      registry.getEventsAfter(runId, cursor.sequence);
    } catch (error) {
      if (store && error instanceof TraceRegistryError && error.code === "TRACE_NOT_FOUND") {
        return streamFromStore(c, { store, runId, sequence: cursor.sequence, pollIntervalMs, maxStreamMs });
      }
      if (error instanceof TraceRegistryError) {
        const status = error.code === "TRACE_NOT_FOUND" ? 404
          : error.code === "TRACE_REPLAY_UNAVAILABLE" ? 409
          : 400;
        return errorResponse(c, status, error.code, error.message);
      }
      return errorResponse(c, 500, "TRACE_LOOKUP_FAILED", "Trace subscription could not be established.");
    }

    return streamSSE(c, async (stream) => {
      const queue = createEventQueue();
      let unsubscribe = () => {};
      let cleaned = false;
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        unsubscribe();
        queue.close();
        c.req.raw.signal.removeEventListener("abort", cleanup);
      };

      try {
        unsubscribe = registry.subscribe(runId, (event) => queue.push(event));
        stream.onAbort(cleanup);
        c.req.raw.signal.addEventListener("abort", cleanup, { once: true });

        let lastSentSequence = cursor.sequence;
        const writeEvent = async (event) => {
          if (event.sequence <= lastSentSequence) return false;
          await stream.writeSSE({
            id: event.id,
            event: event.type,
            data: JSON.stringify(event),
          });
          lastSentSequence = event.sequence;
          return true;
        };

        const replay = registry.getEventsAfter(runId, cursor.sequence);
        for (const event of replay) {
          if (!await writeEvent(event)) continue;
          if (event.type.startsWith("run.") && event.type !== "run.started") {
            return;
          }
        }

        while (!cleaned) {
          const event = await queue.next();
          if (!event) {
            if (queue.overflowed) {
              await stream.writeSSE({
                event: "stream.error",
                data: JSON.stringify({
                  ok: false,
                  error: {
                    code: "TRACE_STREAM_OVERFLOW",
                    message: "Trace stream exceeded its bounded event queue.",
                  },
                }),
              });
            }
            return;
          }
          if (!await writeEvent(event)) continue;
          if (event.type.startsWith("run.") && event.type !== "run.started") {
            return;
          }
        }
      } catch {
        await streamFailure(stream);
      } finally {
        cleanup();
      }
    });
  });

  return routes;
}
