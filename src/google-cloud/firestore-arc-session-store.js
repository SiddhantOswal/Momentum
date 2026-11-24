/**
 * Arc sessions and turn records (design 2.5 and 2.5a).
 *
 * `arc_sessions/{sessionId}` holds what a session needs to carry between
 * requests; `arc_sessions/{sessionId}/turns/{clientTurnId}` is each turn's
 * idempotency record, transcript entry and summary in one document. The
 * session ID always comes from the verified cookie, so a caller can only reach
 * its own documents.
 *
 * A turn record never holds tool results, prompts, PO file text or free text
 * from an order. Typed text is the user's own and is kept for 7 days; for an
 * action only a hash of its params is kept.
 *
 * Refusals are returned as values. A Firestore fault, or a stored document
 * that fails its schema, throws a FirestoreRestError with code
 * SERVICE_UNAVAILABLE, so the caller fails closed.
 */

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createArcFirestore } from "./firestore-arc-client.js";
import { FirestoreRestError } from "./firestore-rest.js";
import {
  ArcSessionDocSchema,
  ArcTurnDocSchema,
  BASE_TIMESTAMP_FIELDS,
  DemoJobIdSchema,
  LotIdSchema,
  SessionIdSchema,
  Sha256HexSchema,
  STATE_SCHEMA_VERSION,
} from "../state-schemas.js";
import { TimestampSchema } from "../schemas.js";

export const ARC_SESSION_COLLECTION = "arc_sessions";
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
// Longer than the 120 s Cloud Run request timeout (design 3.2).
export const TURN_LEASE_MS = 130_000;
const MAX_JOB_IDS = 20;
const MAX_ACTIVE_LOTS = 5;
const MAX_RECENT_TURNS = 4;
const SESSION_TIMESTAMPS = [...BASE_TIMESTAMP_FIELDS, "sessionExpiresAt"];
const TURN_TIMESTAMPS = [...BASE_TIMESTAMP_FIELDS, "leaseExpiresAt"];
const TurnIdSchema = z.string().uuid();
const CursorSchema = z.object({ createdAt: TimestampSchema, clientTurnId: TurnIdSchema }).strict();
const MIN_FORBIDDEN_LENGTH = 3;

export class ArcTranscriptError extends Error {
  constructor(message) {
    super(message);
    this.name = "ArcTranscriptError";
    this.code = "ORDER_TEXT_IN_TRANSCRIPT";
  }
}

function check(schema, value, what) {
  if (!schema.safeParse(value).success) throw new TypeError(`${what} is invalid.`);
}

function strings(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value !== null && typeof value === "object") return Object.entries(value).flatMap(([key, entry]) => [key, ...strings(entry)]);
  return [];
}

// Order-derived free text must not reach a transcript, whatever wrote it (design 2.5a).
function assertNoOrderText(forbiddenText, ...values) {
  const needles = forbiddenText.map((text) => text.trim().toLowerCase()).filter((text) => text.length >= MIN_FORBIDDEN_LENGTH);
  if (needles.length === 0) return;
  const haystack = values.flatMap(strings).join("\n").toLowerCase();
  if (needles.some((needle) => haystack.includes(needle))) {
    throw new ArcTranscriptError("The answer or summary contains text from the order and was not stored.");
  }
}

function encodeCursor(turn) {
  return Buffer.from(JSON.stringify({ createdAt: turn.createdAt, clientTurnId: turn.clientTurnId })).toString("base64url");
}

function decodeCursor(value) {
  try {
    const parsed = CursorSchema.safeParse(JSON.parse(Buffer.from(String(value), "base64url").toString("utf8")));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function createFirestoreArcSessionStore({
  projectId, database = "(default)", fetchImpl = fetch, tokenProvider,
  now = Date.now, maxAttempts = 3, timeoutMs = 5000,
} = {}) {
  if (typeof now !== "function" || !Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 5) {
    throw new TypeError("A clock and a bounded number of attempts are required.");
  }
  const db = createArcFirestore({ projectId, database, fetchImpl, tokenProvider, timeoutMs });
  const iso = (instant) => new Date(instant).toISOString();
  const sessionPath = (sessionId) => `${ARC_SESSION_COLLECTION}/${sessionId}`;
  const turnPath = (sessionId, clientTurnId) => `${sessionPath(sessionId)}/turns/${clientTurnId}`;
  const readSession = (sessionId, signal) => db.read(sessionPath(sessionId), ArcSessionDocSchema, { signal });
  const readTurn = (sessionId, clientTurnId, signal) => db.read(turnPath(sessionId, clientTurnId), ArcTurnDocSchema, { signal });
  const isLive = (turn, instant) => Date.parse(turn.expiresAt) > instant;

  /** Re-reads and retries when another instance changed the session first; it never overwrites. */
  async function mutateSession(sessionId, change, signal) {
    for (let round = 0; round < maxAttempts; round += 1) {
      const read = await readSession(sessionId, signal);
      if (read === null) throw new TypeError("The session has not been started.");
      const instant = now();
      const next = { ...change(read.doc), version: read.doc.version + 1, updatedAt: iso(instant) };
      if (await db.replace(sessionPath(sessionId), ArcSessionDocSchema, next, read.updateTime,
        { timestamps: SESSION_TIMESTAMPS, signal })) return next;
    }
    throw new FirestoreRestError("SERVICE_UNAVAILABLE", "The session record kept changing; try again.");
  }

  function newTurn({ sessionId, clientTurnId, input, inputFingerprint }, instant) {
    return {
      schemaVersion: STATE_SCHEMA_VERSION,
      createdAt: iso(instant),
      updatedAt: iso(instant),
      expiresAt: iso(instant + RETENTION_MS),
      clientTurnId,
      sessionId,
      taskRunId: null,
      recordStatus: "in_progress",
      ownerToken: randomUUID(),
      leaseExpiresAt: iso(instant + TURN_LEASE_MS),
      inputFingerprint,
      input,
      answerText: null,
      summary: null,
      eventRange: null,
      errorCode: null,
    };
  }

  /** Fenced by the owner token, so a request that lost its lease cannot write over the retry that took it. */
  async function finishTurn({ sessionId, clientTurnId, ownerToken, signal }, change) {
    check(SessionIdSchema, sessionId, "The session ID");
    check(TurnIdSchema, clientTurnId, "The turn ID");
    for (let round = 0; round < maxAttempts; round += 1) {
      const read = await readTurn(sessionId, clientTurnId, signal);
      if (read === null || read.doc.recordStatus !== "in_progress" || read.doc.ownerToken !== ownerToken) {
        return { ok: false, code: "TURN_NOT_OWNED" };
      }
      const next = { ...read.doc, ...change(read.doc), updatedAt: iso(now()) };
      if (await db.replace(turnPath(sessionId, clientTurnId), ArcTurnDocSchema, next, read.updateTime,
        { timestamps: TURN_TIMESTAMPS, signal })) return { ok: true, turn: next };
    }
    throw new FirestoreRestError("SERVICE_UNAVAILABLE", "The turn record kept changing; try again.");
  }

  return Object.freeze({
    /** The session record, created on first use. Safe to call repeatedly. */
    async getOrCreate({ sessionId, sessionExpiresAt, signal } = {}) {
      check(SessionIdSchema, sessionId, "The session ID");
      check(TimestampSchema, sessionExpiresAt, "The session expiry");
      const existing = await readSession(sessionId, signal);
      if (existing) return existing.doc;
      const instant = now();
      const session = {
        schemaVersion: STATE_SCHEMA_VERSION,
        createdAt: iso(instant),
        updatedAt: iso(instant),
        expiresAt: iso(Date.parse(sessionExpiresAt) + RETENTION_MS),
        sessionId,
        authorizationMode: "HACKATHON_DEMO",
        identityLabel: "Demo session, simulated",
        sessionExpiresAt,
        activeLotIds: [],
        jobIds: [],
        activeTaskRunId: null,
        recentTurnIds: [],
        turnCount: 0,
        version: 0,
      };
      if (await db.create(sessionPath(sessionId), ArcSessionDocSchema, session, { timestamps: SESSION_TIMESTAMPS, signal })) {
        return session;
      }
      // Another request created it between the read and the create.
      const raced = await readSession(sessionId, signal);
      if (!raced) throw new FirestoreRestError("SERVICE_UNAVAILABLE", "Firestore did not return the Arc session.");
      return raced.doc;
    },

    async get(sessionId, { signal } = {}) {
      check(SessionIdSchema, sessionId, "The session ID");
      return (await readSession(sessionId, signal))?.doc ?? null;
    },

    /** Newest last, oldest dropped, so "open my last approved card" needs no collection query. */
    async recordJob({ sessionId, jobId, signal } = {}) {
      check(SessionIdSchema, sessionId, "The session ID");
      check(DemoJobIdSchema, jobId, "The job ID");
      if (!jobId.startsWith(`JOB-HACK-${sessionId}-`)) throw new TypeError("The job belongs to another session.");
      return mutateSession(sessionId, (session) => ({
        ...session,
        jobIds: [...session.jobIds.filter((id) => id !== jobId), jobId].slice(-MAX_JOB_IDS),
      }), signal);
    },

    async recordLot({ sessionId, lotId, signal } = {}) {
      check(SessionIdSchema, sessionId, "The session ID");
      check(LotIdSchema, lotId, "The lot ID");
      if (!lotId.startsWith(`LOT-HACK-${sessionId}-`)) throw new TypeError("The lot belongs to another session.");
      return mutateSession(sessionId, (session) => ({
        ...session,
        activeLotIds: [...session.activeLotIds.filter((id) => id !== lotId), lotId].slice(-MAX_ACTIVE_LOTS),
      }), signal);
    },

    async setActiveTaskRun({ sessionId, taskRunId, signal } = {}) {
      check(SessionIdSchema, sessionId, "The session ID");
      check(TurnIdSchema.nullable(), taskRunId, "The task run ID");
      return mutateSession(sessionId, (session) => ({ ...session, activeTaskRunId: taskRunId }), signal);
    },

    /**
     * Creates the turn record with an exists-false precondition and returns what to do with it:
     * claimed (new), takeover (the earlier owner's lease expired), replay (finished, same input),
     * in_progress (a live owner holds it) or conflict (the ID was used with other input).
     * With `createIfAbsent: false` an unknown turn is `absent` and nothing is written.
     */
    async claimTurn({ sessionId, clientTurnId, input, inputFingerprint, createIfAbsent = true, signal } = {}) {
      check(SessionIdSchema, sessionId, "The session ID");
      check(TurnIdSchema, clientTurnId, "The turn ID");
      check(Sha256HexSchema, inputFingerprint, "The input fingerprint");
      const request = { sessionId, clientTurnId, input, inputFingerprint };
      for (let round = 0; round < maxAttempts; round += 1) {
        const instant = now();
        const read = await readTurn(sessionId, clientTurnId, signal);
        if (read === null) {
          if (!createIfAbsent) return { outcome: "absent" };
          const fresh = newTurn(request, instant);
          if (!await db.create(turnPath(sessionId, clientTurnId), ArcTurnDocSchema, fresh, { timestamps: TURN_TIMESTAMPS, signal })) continue;
          try {
            await mutateSession(sessionId, (session) => ({
              ...session,
              turnCount: session.turnCount + 1,
              recentTurnIds: [...session.recentTurnIds, clientTurnId].slice(-MAX_RECENT_TURNS),
            }), signal);
          } catch (error) {
            // Without this the retry would find a live in-progress record nobody is running.
            await db.remove(turnPath(sessionId, clientTurnId)).catch(() => undefined);
            throw error;
          }
          return { outcome: "claimed", turn: fresh };
        }
        const { doc } = read;
        if (doc.inputFingerprint !== inputFingerprint) return { outcome: "conflict", turn: doc };
        if (doc.recordStatus !== "in_progress") return { outcome: "replay", turn: doc };
        if (Date.parse(doc.leaseExpiresAt) > instant) return { outcome: "in_progress", turn: doc };
        const taken = {
          ...doc,
          reservationOwnerToken: doc.reservationOwnerToken ?? doc.ownerToken,
          ownerToken: randomUUID(),
          leaseExpiresAt: iso(instant + TURN_LEASE_MS),
          updatedAt: iso(instant),
        };
        if (await db.replace(turnPath(sessionId, clientTurnId), ArcTurnDocSchema, taken, read.updateTime,
          { timestamps: TURN_TIMESTAMPS, signal })) return { outcome: "takeover", turn: taken };
      }
      throw new FirestoreRestError("SERVICE_UNAVAILABLE", "The turn record kept changing; try again.");
    },

    /** `forbiddenText` lists the order-derived strings of this session's review; none may appear in what is stored. */
    async completeTurn({ sessionId, clientTurnId, ownerToken, taskRunId, answerText, summary, eventRange, forbiddenText = [], signal } = {}) {
      assertNoOrderText(forbiddenText, answerText, summary);
      return finishTurn({ sessionId, clientTurnId, ownerToken, signal }, () => ({
        recordStatus: "complete", taskRunId, answerText, summary, eventRange, errorCode: null,
      }));
    },

    async failTurn({ sessionId, clientTurnId, ownerToken, errorCode, taskRunId = null, eventRange = null, signal } = {}) {
      return finishTurn({ sessionId, clientTurnId, ownerToken, signal }, () => ({
        recordStatus: "failed", taskRunId, eventRange, errorCode,
      }));
    },

    /** Null when the turn is absent, expired or another session's. */
    async getTurn(sessionId, clientTurnId, { signal } = {}) {
      check(SessionIdSchema, sessionId, "The session ID");
      if (!TurnIdSchema.safeParse(clientTurnId).success) return null;
      const read = await readTurn(sessionId, clientTurnId, signal);
      return read && isLive(read.doc, now()) ? read.doc : null;
    },

    /** Newest first by creation time, then turn ID. `nextBefore` is null on the last page. */
    async listTurns({ sessionId, limit = 10, before, signal } = {}) {
      check(SessionIdSchema, sessionId, "The session ID");
      if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new TypeError("The page size must be 1 to 20.");
      const cursor = before === undefined ? undefined : decodeCursor(before);
      if (cursor === null) return { ok: false, code: "INVALID_CURSOR" };
      const results = await db.query(sessionPath(sessionId), {
        from: [{ collectionId: "turns" }],
        orderBy: [
          { field: { fieldPath: "createdAt" }, direction: "DESCENDING" },
          { field: { fieldPath: "__name__" }, direction: "DESCENDING" },
        ],
        ...(cursor ? {
          startAt: {
            values: [
              { timestampValue: cursor.createdAt },
              { referenceValue: db.documentName(turnPath(sessionId, cursor.clientTurnId)) },
            ],
            before: false,
          },
        } : {}),
        limit: limit + 1,
      }, ArcTurnDocSchema, { signal });
      const instant = now();
      const live = results.map(({ doc }) => doc).filter((turn) => isLive(turn, instant));
      const page = live.slice(0, limit);
      return { turns: page, nextBefore: live.length > limit ? encodeCursor(page.at(-1)) : null };
    },
  });
}
