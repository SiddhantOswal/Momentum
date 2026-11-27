/**
 * Durable copy of job-preparation traces (design 2.3): the head at
 * `traces/{runId}` and each event at `traces/{runId}/trace_events/{sequence}`.
 * The subcollection is not called `events` because a TTL policy covers every
 * collection with that ID, and the live feed already owns a top-level `events`.
 *
 * Every document is checked against its state schema on write and on read.
 * A document that fails its schema, or a gap in the event sequence, is
 * reported as SERVICE_UNAVAILABLE, never as an absent run.
 */

import { z } from "zod";
import { createCloudRunAccessTokenProvider } from "./bigquery-read-client.js";
import {
  createFirestoreRestClient,
  encodeDocument,
  FirestoreRestError,
  isPreconditionFailure,
  parseDocument,
  readJson,
} from "./firestore-rest.js";
import {
  BASE_TIMESTAMP_FIELDS,
  STATE_SCHEMA_VERSION,
  TraceEventDocSchema,
  TraceHeadDocSchema,
} from "../state-schemas.js";
import { TraceEventSchema } from "../trace-registry.js";

const TRACE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const RunIdSchema = z.string().uuid();
const EVENT_FIELDS = Object.keys(TraceEventSchema.shape);

function unavailable(message) {
  return new FirestoreRestError("SERVICE_UNAVAILABLE", message);
}

function retentionFields(createdAt, updatedAt = createdAt) {
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    createdAt,
    updatedAt,
    expiresAt: new Date(Date.parse(createdAt) + TRACE_RETENTION_MS).toISOString(),
  };
}

function eventFromDocument(document) {
  return Object.fromEntries(EVENT_FIELDS
    .filter((field) => document[field] !== undefined)
    .map((field) => [field, document[field]]));
}

export function createFirestoreTraceStore({
  projectId,
  database = "(default)",
  fetchImpl = fetch,
  tokenProvider,
  now = () => Date.now(),
  timeoutMs = 5000,
  pageSize = 300,
} = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10000 ||
      !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 500) {
    throw new TypeError("Trace store timeout and page size must be bounded positive integers.");
  }
  const firestore = createFirestoreRestClient({ projectId, database, fetchImpl });
  const provideToken = tokenProvider ?? createCloudRunAccessTokenProvider({ fetchImpl });
  const { databaseName, documentsUrl } = firestore;

  function boundedSignal(signal) {
    return signal
      ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
      : AbortSignal.timeout(timeoutMs);
  }

  async function token(signal) {
    let value;
    try {
      value = await provideToken({ signal });
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      value = undefined;
    }
    if (typeof value !== "string" || value.length === 0) {
      throw new FirestoreRestError("CLOUD_IDENTITY_UNAVAILABLE", "Cloud Run workload identity is unavailable.");
    }
    return value;
  }

  async function send(url, options = {}) {
    const signal = boundedSignal(options.signal);
    return firestore.send(url, { ...options, token: await token(signal), signal });
  }

  function headUrl(runId) {
    return `${documentsUrl}/traces/${runId}`;
  }

  return Object.freeze({
    /** Create-only, so a retried write leaves the stored event untouched. */
    async appendEvent(event, { signal } = {}) {
      const parsed = TraceEventSchema.safeParse(event);
      if (!parsed.success) throw unavailable("The trace event does not match its schema and was not written.");
      const fields = encodeDocument(TraceEventDocSchema, {
        ...parsed.data,
        ...retentionFields(parsed.data.occurredAt),
      }, { timestamps: BASE_TIMESTAMP_FIELDS });
      const url = `${headUrl(parsed.data.runId)}/trace_events/${parsed.data.sequence}?currentDocument.exists=false`;
      const response = await send(url, { method: "PATCH", body: { fields }, signal });
      if (response.ok) return;
      if (await isPreconditionFailure(response)) return;
      throw unavailable("Firestore did not store the trace event.");
    },

    /** Only the instance that runs a trace writes its head, one write at a time. */
    async writeHead({ runId, ownerSessionId, status, lastSequence, createdAt }, { signal } = {}) {
      const fields = encodeDocument(TraceHeadDocSchema, {
        ...retentionFields(createdAt, new Date(now()).toISOString()),
        runId,
        ownerSessionId,
        kind: "job_preparation",
        status,
        lastSequence,
        // Budget reservations per run arrive with budget-v2 (ARC-M1-08).
        geminiAttempts: 0,
      }, { timestamps: BASE_TIMESTAMP_FIELDS });
      const response = await send(headUrl(runId), { method: "PATCH", body: { fields }, signal });
      if (!response.ok) throw unavailable("Firestore did not store the trace head.");
    },

    async readHead(runId, { signal } = {}) {
      if (!RunIdSchema.safeParse(runId).success) return null;
      const response = await send(headUrl(runId), { signal });
      if (response.status === 404) return null;
      if (!response.ok) throw unavailable("Firestore did not return the trace head.");
      const payload = await readJson(response);
      if (payload?.name !== `${databaseName}/documents/traces/${runId}`) {
        throw unavailable("Firestore returned a different trace head.");
      }
      const head = parseDocument(TraceHeadDocSchema, payload);
      if (head.runId !== runId) throw unavailable("Firestore returned a different trace head.");
      return head.kind === "job_preparation" ? head : null;
    },

    async readEventsAfter(runId, sequence = 0, { signal } = {}) {
      if (!RunIdSchema.safeParse(runId).success || !Number.isSafeInteger(sequence) || sequence < 0) {
        throw new TypeError("A run ID and a non-negative cursor are required.");
      }
      const events = [];
      let cursor = sequence;
      for (;;) {
        const response = await send(`${headUrl(runId)}:runQuery`, {
          method: "POST",
          body: {
            structuredQuery: {
              from: [{ collectionId: "trace_events" }],
              where: {
                fieldFilter: {
                  field: { fieldPath: "sequence" },
                  op: "GREATER_THAN",
                  value: { integerValue: String(cursor) },
                },
              },
              orderBy: [{ field: { fieldPath: "sequence" }, direction: "ASCENDING" }],
              limit: pageSize,
            },
          },
          signal,
        });
        const payload = await readJson(response);
        if (!response.ok || !Array.isArray(payload)) throw unavailable("Firestore did not return the trace events.");
        const page = payload.filter((entry) => entry?.document);
        for (const { document } of page) {
          const stored = parseDocument(TraceEventDocSchema, document);
          if (stored.runId !== runId || stored.sequence !== cursor + 1 ||
              document.name !== `${databaseName}/documents/traces/${runId}/trace_events/${stored.sequence}`) {
            throw unavailable("Stored trace events are out of order or incomplete.");
          }
          events.push(eventFromDocument(stored));
          cursor = stored.sequence;
        }
        if (page.length < pageSize) return events;
      }
    },
  });
}
