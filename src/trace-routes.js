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

export function createTraceRoutes(registry) {
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
        await stream.writeSSE({
          event: "stream.error",
          data: JSON.stringify({
            ok: false,
            error: {
              code: "TRACE_STREAM_FAILED",
              message: "Trace stream ended unexpectedly.",
            },
          }),
        });
      } finally {
        cleanup();
      }
    });
  });

  return routes;
}
