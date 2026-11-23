import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { z } from "zod";

export const AGENT_TOOLS = Object.freeze([
  "extractOrder",
  "getConditions",
  "predictRisk",
  "optimizeLevers",
  "findSimilarRuns",
  "explainRisk",
  "generateJobSheet",
]);

const TraceEventTypeSchema = z.enum([
  "run.started",
  "tool.started",
  "tool.succeeded",
  "tool.failed",
  "tool.unavailable",
  "run.completed",
  "run.failed",
  "run.cancelled",
]);

export const TraceEventSchema = z.object({
  id: z.string().regex(/^[0-9a-f-]{36}:[1-9]\d*$/i),
  runId: z.string().uuid(),
  sequence: z.number().int().positive(),
  occurredAt: z.iso.datetime({ offset: true }),
  type: TraceEventTypeSchema,
  tool: z.enum(AGENT_TOOLS).optional(),
  toolCallId: z.string().uuid().optional(),
  errorCode: z.enum([
    "TOOL_ERROR",
    "SERVICE_UNAVAILABLE",
    "VALIDATION_ERROR",
    "TIMEOUT",
    "CANCELLED",
  ]).optional(),
}).strict();

const TERMINAL_RUN_TYPES = new Set([
  "run.completed",
  "run.failed",
  "run.cancelled",
]);
const TOOL_OUTCOMES = Object.freeze({
  succeeded: "tool.succeeded",
  failed: "tool.failed",
  unavailable: "tool.unavailable",
});

export class TraceRegistryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "TraceRegistryError";
    this.code = code;
  }
}

export function createTraceRegistry({
  maxRuns = 100,
  maxEventsPerRun = 250,
  maxSubscribersPerRun = 20,
  retentionMs = 30 * 60 * 1000,
  now = () => Date.now(),
  idFactory = randomUUID,
} = {}) {
  if (!Number.isInteger(maxRuns) || maxRuns < 1 ||
      !Number.isInteger(maxEventsPerRun) || maxEventsPerRun < 1 ||
      !Number.isInteger(maxSubscribersPerRun) || maxSubscribersPerRun < 1 ||
      !Number.isFinite(retentionMs) || retentionMs <= 0) {
    throw new RangeError("Trace retention limits must be positive.");
  }

  const runs = new Map();

  function expireRuns() {
    const cutoff = now() - retentionMs;
    for (const [runId, run] of runs) {
      if (run.status !== "running" && run.updatedAt <= cutoff) {
        runs.delete(runId);
      }
    }
  }

  function prune() {
    expireRuns();
    while (runs.size >= maxRuns) {
      const completedRun = [...runs].find(([, run]) => run.status !== "running");
      if (!completedRun) {
        throw new TraceRegistryError("TRACE_CAPACITY", "Trace registry has no capacity for another active run.");
      }
      runs.delete(completedRun[0]);
    }
  }

  function getRunOrThrow(runId) {
    expireRuns();
    const run = runs.get(runId);
    if (!run) {
      throw new TraceRegistryError("TRACE_NOT_FOUND", "Trace run was not found or has expired.");
    }
    return run;
  }

  function append(run, type, fields = {}) {
    const event = TraceEventSchema.parse({
      id: `${run.runId}:${run.lastSequence + 1}`,
      runId: run.runId,
      sequence: run.lastSequence + 1,
      occurredAt: new Date(now()).toISOString(),
      type,
      ...fields,
    });
    run.lastSequence = event.sequence;
    run.updatedAt = now();
    run.events.push(Object.freeze(event));
    if (run.events.length > maxEventsPerRun) {
      run.events.splice(0, run.events.length - maxEventsPerRun);
    }
    run.emitter.emit("event", event);
    return event;
  }

  function requireRunning(run) {
    if (run.status !== "running") {
      throw new TraceRegistryError("TRACE_RUN_TERMINAL", "Trace run is already terminal.");
    }
  }

  return Object.freeze({
    startRun() {
      prune();
      let runId = idFactory();
      while (runs.has(runId)) {
        runId = idFactory();
      }
      const run = {
        runId,
        status: "running",
        createdAt: now(),
        updatedAt: now(),
        lastSequence: 0,
        events: [],
        activeTools: new Map(),
        emitter: new EventEmitter(),
      };
      run.emitter.setMaxListeners(0);
      runs.set(runId, run);
      append(run, "run.started");
      return runId;
    },

    startTool(runId, tool) {
      const run = getRunOrThrow(runId);
      requireRunning(run);
      if (!AGENT_TOOLS.includes(tool)) {
        throw new TraceRegistryError("TRACE_INVALID_TOOL", "Tool name is not in the blueprint tool registry.");
      }
      let toolCallId = idFactory();
      while (run.activeTools.has(toolCallId)) {
        toolCallId = idFactory();
      }
      run.activeTools.set(toolCallId, tool);
      return append(run, "tool.started", { tool, toolCallId });
    },

    finishTool(runId, toolCallId, outcome, errorCode) {
      const run = getRunOrThrow(runId);
      requireRunning(run);
      const tool = run.activeTools.get(toolCallId);
      if (!tool) {
        throw new TraceRegistryError("TRACE_TOOL_CALL_NOT_FOUND", "Active tool call was not found.");
      }
      const type = TOOL_OUTCOMES[outcome];
      if (!type) {
        throw new TraceRegistryError("TRACE_INVALID_OUTCOME", "Tool outcome is not supported.");
      }
      if (type === "tool.failed" || type === "tool.unavailable") {
        const parsedCode = TraceEventSchema.shape.errorCode.safeParse(errorCode);
        if (!parsedCode.success) {
          throw new TraceRegistryError("TRACE_INVALID_ERROR_CODE", "A supported sanitized error code is required.");
        }
        errorCode = parsedCode.data;
      } else if (errorCode !== undefined) {
        throw new TraceRegistryError("TRACE_INVALID_ERROR_CODE", "Successful tool events cannot include an error code.");
      }

      run.activeTools.delete(toolCallId);
      return append(run, type, {
        tool,
        toolCallId,
        ...(errorCode ? { errorCode } : {}),
      });
    },

    finishRun(runId, outcome) {
      const run = getRunOrThrow(runId);
      requireRunning(run);
      if (!["completed", "failed", "cancelled"].includes(outcome)) {
        throw new TraceRegistryError("TRACE_INVALID_OUTCOME", "Run outcome is not supported.");
      }
      if (run.activeTools.size > 0) {
        throw new TraceRegistryError("TRACE_TOOLS_ACTIVE", "A run cannot finish while tool calls are active.");
      }
      run.status = outcome;
      const event = append(run, `run.${outcome}`);
      run.emitter.emit("terminal", event);
      return event;
    },

    getRun(runId) {
      const run = getRunOrThrow(runId);
      return Object.freeze({
        runId: run.runId,
        status: run.status,
        lastSequence: run.lastSequence,
        firstSequence: run.events[0]?.sequence ?? run.lastSequence + 1,
      });
    },

    getEventsAfter(runId, sequence = 0) {
      const run = getRunOrThrow(runId);
      if (!Number.isInteger(sequence) || sequence < 0 || sequence > run.lastSequence) {
        throw new TraceRegistryError("TRACE_INVALID_CURSOR", "Trace event cursor is invalid.");
      }
      const firstSequence = run.events[0]?.sequence ?? run.lastSequence + 1;
      if (sequence < firstSequence - 1) {
        throw new TraceRegistryError("TRACE_REPLAY_UNAVAILABLE", "Requested trace events have expired from the replay window.");
      }
      return run.events
        .filter((event) => event.sequence > sequence)
        .map((event) => ({ ...event }));
    },

    subscribe(runId, listener) {
      const run = getRunOrThrow(runId);
      if (run.emitter.listenerCount("event") >= maxSubscribersPerRun) {
        throw new TraceRegistryError("TRACE_SUBSCRIBER_CAPACITY", "Trace run has reached its subscriber limit.");
      }
      run.emitter.on("event", listener);
      return () => run.emitter.off("event", listener);
    },

    subscriberCount(runId) {
      return getRunOrThrow(runId).emitter.listenerCount("event");
    },
  });
}

export const traceRegistry = createTraceRegistry();

const RUN_STATUS_BY_EVENT = Object.freeze({
  "run.completed": "completed",
  "run.failed": "failed",
  "run.cancelled": "cancelled",
});

function logWriteFailure(record) {
  console.warn(JSON.stringify(record));
}

function boundedSet(map, key, value, limit) {
  while (map.size >= limit) map.delete(map.keys().next().value);
  map.set(key, value);
}

/**
 * Copies every event of the in-memory registry to a durable trace store, in
 * sequence order, without making the run wait for or fail on the store. A
 * failed write is logged with its error code only and stops later writes for
 * that run, so the stored copy is always a gap-free prefix of the run.
 */
export function createWriteThroughTraceRegistry({
  registry,
  store,
  log = logWriteFailure,
  maxTrackedRuns = 1000,
} = {}) {
  if (!registry || typeof registry.startRun !== "function" ||
      !store || typeof store.appendEvent !== "function" ||
      typeof store.writeHead !== "function" || typeof store.readHead !== "function" ||
      typeof log !== "function" || !Number.isInteger(maxTrackedRuns) || maxTrackedRuns < 1) {
    throw new TypeError("A trace registry, a trace store and a logger are required.");
  }

  const runs = new Map();

  function report(operation, error) {
    const code = /^[A-Z_]{1,64}$/.test(error?.code ?? "") ? error.code : "UNEXPECTED_ERROR";
    log({ event: "trace_store_write_failed", operation, code });
  }

  function head(runId, run, snapshot) {
    return {
      runId,
      ownerSessionId: snapshot.owner,
      status: snapshot.status,
      lastSequence: snapshot.lastSequence,
      createdAt: run.createdAt,
    };
  }

  function enqueue(run, operation, write) {
    run.chain = run.chain.then(async () => {
      if (run.failed) return;
      try {
        await write();
      } catch (error) {
        run.failed = true;
        report(operation, error);
      }
    });
    return run.chain;
  }

  function persist(event) {
    const run = runs.get(event.runId);
    if (!run) return;
    run.lastSequence = event.sequence;
    run.status = RUN_STATUS_BY_EVENT[event.type] ?? run.status;
    // Taken now, not when the write runs: an owner claimed later writes its own head.
    const snapshot = { owner: run.owner, status: run.status, lastSequence: run.lastSequence };
    enqueue(run, "event", async () => {
      await store.appendEvent(event);
      if (snapshot.owner) await store.writeHead(head(event.runId, run, snapshot));
    });
  }

  const wrapped = Object.freeze({
    ...registry,

    startRun() {
      const runId = registry.startRun();
      const [started] = registry.getEventsAfter(runId, 0);
      boundedSet(runs, runId, {
        createdAt: started.occurredAt,
        chain: Promise.resolve(),
        failed: false,
        owner: undefined,
        status: "running",
        lastSequence: 0,
      }, maxTrackedRuns);
      persist(started);
      return runId;
    },

    startTool(runId, tool) {
      const event = registry.startTool(runId, tool);
      persist(event);
      return event;
    },

    finishTool(runId, toolCallId, outcome, errorCode) {
      const event = registry.finishTool(runId, toolCallId, outcome, errorCode);
      persist(event);
      return event;
    },

    finishRun(runId, outcome) {
      const event = registry.finishRun(runId, outcome);
      persist(event);
      return event;
    },
  });

  return Object.freeze({
    registry: wrapped,

    /**
     * Records the session that owns a run this instance started, after every
     * event queued so far. Never rejects: the request that produced the run
     * answers whether or not the store took the write.
     */
    async claimOwner(runId, ownerSessionId) {
      const run = runs.get(runId);
      if (!run) return;
      run.owner = ownerSessionId;
      const snapshot = { owner: ownerSessionId, status: run.status, lastSequence: run.lastSequence };
      await enqueue(run, "head", () => store.writeHead(head(runId, run, snapshot)));
    },

    async flush(runId) {
      await runs.get(runId)?.chain;
    },

    /** Rejects when the store cannot answer, so callers can fail closed. */
    async ownerOf(runId) {
      const local = runs.get(runId)?.owner;
      if (local) return local;
      const stored = await store.readHead(runId);
      return stored?.ownerSessionId ?? null;
    },
  });
}

export function configureDurableTraces({ env, registry, createStore, log } = {}) {
  if (env?.USTAAD_ENABLE_DURABLE_TRACES !== "true") {
    return { registry, store: undefined, claimOwner: undefined, ownerOf: undefined };
  }
  const store = createStore();
  const durable = createWriteThroughTraceRegistry({ registry, store, ...(log ? { log } : {}) });
  return {
    registry: durable.registry,
    store,
    claimOwner: durable.claimOwner,
    ownerOf: durable.ownerOf,
  };
}
