/**
 * Resumable task runs in `arc_task_runs/{taskRunId}` (design 2.6).
 *
 * A run is written with a create-only precondition and changed only by a save
 * that pins the version it read, so two instances cannot both advance the same
 * step. Refusals are returned as values; a Firestore fault or a stored run
 * that fails its schema throws SERVICE_UNAVAILABLE and the caller fails closed.
 */

import { z } from "zod";
import { createArcFirestore } from "./firestore-arc-client.js";
import { ArcTaskRunDocSchema, BASE_TIMESTAMP_FIELDS, STATE_SCHEMA_VERSION } from "../state-schemas.js";

export const ARC_TASK_RUN_COLLECTION = "arc_task_runs";
// Design 2.0: 30 days after creation; each step's lease is checked in code.
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const RunIdSchema = z.string().uuid();

export function createFirestoreArcTaskRunStore({
  projectId, database = "(default)", fetchImpl = fetch, tokenProvider, now = Date.now, timeoutMs = 5000,
} = {}) {
  if (typeof now !== "function") throw new TypeError("A clock is required.");
  const db = createArcFirestore({ projectId, database, fetchImpl, tokenProvider, timeoutMs });
  const iso = (instant) => new Date(instant).toISOString();
  const pathOf = (taskRunId) => `${ARC_TASK_RUN_COLLECTION}/${taskRunId}`;
  const read = (taskRunId, signal) => db.read(pathOf(taskRunId), ArcTaskRunDocSchema, { signal });

  return Object.freeze({
    /** Returns the stored run, or null when a run with this ID already exists. */
    async create({ taskRunId, sessionId, kind, lotId, status, steps }, { signal } = {}) {
      const instant = now();
      const run = {
        schemaVersion: STATE_SCHEMA_VERSION,
        createdAt: iso(instant),
        updatedAt: iso(instant),
        expiresAt: iso(instant + RETENTION_MS),
        taskRunId, sessionId, kind, lotId, status, steps,
        version: 0,
      };
      const created = await db.create(pathOf(taskRunId), ArcTaskRunDocSchema, run, { timestamps: BASE_TIMESTAMP_FIELDS, signal });
      return created ? run : null;
    },

    /** Null when the run is absent, malformed or past its expiry (TTL deletes later). The caller checks ownership. */
    async get(taskRunId, { signal } = {}) {
      if (!RunIdSchema.safeParse(taskRunId).success) return null;
      const stored = await read(taskRunId, signal);
      return stored && Date.parse(stored.doc.expiresAt) > now() ? stored.doc : null;
    },

    /** Writes `run` over the stored version it was read at. A stale `run.version` is VERSION_CONFLICT. */
    async save(run, { signal } = {}) {
      if (!RunIdSchema.safeParse(run?.taskRunId).success) throw new TypeError("The task run ID is invalid.");
      const stored = await read(run.taskRunId, signal);
      if (stored === null) return { ok: false, code: "NOT_FOUND" };
      if (stored.doc.sessionId !== run.sessionId) return { ok: false, code: "SESSION_MISMATCH" };
      if (stored.doc.version !== run.version) return { ok: false, code: "VERSION_CONFLICT" };
      const next = { ...run, createdAt: stored.doc.createdAt, expiresAt: stored.doc.expiresAt, updatedAt: iso(now()), version: run.version + 1 };
      const written = await db.replace(pathOf(run.taskRunId), ArcTaskRunDocSchema, next, stored.updateTime,
        { timestamps: BASE_TIMESTAMP_FIELDS, signal });
      if (!written) return { ok: false, code: "VERSION_CONFLICT" };
      return { ok: true, run: next };
    },
  });
}
