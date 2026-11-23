/**
 * Gemini budget store `budget-v2` (design 2.4 and 5.2, ADR-0004).
 *
 * `reserve` charges one attempt in a single transaction over the day, session,
 * IP, minute and session-minute counters and writes a reservation document, so
 * a replayed key is charged once. Attempts are never refunded. The rupee spend
 * per IST day (founder decision F2) is a separate counter that `recordUsage`
 * adds to after each response; `reserve` refuses once it reaches the cap.
 *
 * This store uses only `budget_counters` and `budget_reservations`. It never
 * reads or writes the `gemini_daily_usage` document shared with `prepagent`
 * (founder decision F1).
 */

import { createHash, randomUUID } from "node:crypto";
import { createCloudRunAccessTokenProvider } from "./bigquery-read-client.js";
import {
  createFirestoreRestClient,
  currentDocumentPrecondition,
  encodeDocument,
  parseDocument,
} from "./firestore-rest.js";
import { attemptCostMicroInr, istWindows, windowActive } from "../gemini-budget-config.js";
import { isDemoPrincipal } from "../hackathon-demo-auth.js";
import { hasPitchReserveClaim } from "../pitch-claim.js";
import {
  BASE_TIMESTAMP_FIELDS,
  BudgetCounterDocSchema,
  BudgetPurposeSchema,
  BudgetReservationDocSchema,
  budgetCounterId,
  IpKeySchema,
  STATE_SCHEMA_VERSION,
} from "../state-schemas.js";

export const BUDGET_COUNTER_COLLECTION = "budget_counters";
export const BUDGET_RESERVATION_COLLECTION = "budget_reservations";
export const BUDGET_POLICY_VERSION = "budget-v2";

const DAY_MS = 24 * 60 * 60 * 1000;
// Retention from design 2.0: day counters 35 days past their window, minute counters 1 day.
const COUNTER_RETENTION_MS = { day: 36 * DAY_MS, minute: DAY_MS + 60 * 1000 };
const RESERVATION_RETENTION_MS = 7 * DAY_MS;
const MAX_UNITS = 10;
const RESERVATION_KEY = /^[\x21-\x7e]{1,256}$/;
const EVAL_SUITE = /^[a-z][a-z-]{2,31}$/;

class BudgetUnavailable extends Error {}

const microInr = (rupees) => Math.round(rupees * 1e6);
const secondsToNextMinute = (instant) => 60 - (Math.floor(instant / 1000) % 60);

export function createFirestoreBudgetStore({
  projectId, database = "(default)", fetchImpl = fetch, tokenProvider, limits,
  now = Date.now, hasPitchClaim = hasPitchReserveClaim, maxAttempts = 3, timeoutMs = 5000,
} = {}) {
  if (database !== "(default)" || typeof now !== "function" || typeof hasPitchClaim !== "function" ||
      !limits || !["live", "eval"].includes(limits.pool) || !Number.isSafeInteger(limits.dayLimit) ||
      typeof limits.dayCostCapInr !== "number" ||
      !Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 3 ||
      !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10000) {
    throw new TypeError("Validated budget limits, the default Firestore database and bounded settings are required.");
  }
  const firestore = createFirestoreRestClient({ projectId, database, fetchImpl });
  const provideToken = tokenProvider ?? createCloudRunAccessTokenProvider({ fetchImpl });
  const { databaseName, documentsUrl } = firestore;
  const { pool } = limits;
  const reserveUnits = limits.reserve?.units ?? 0;
  const costCapMicroInr = microInr(limits.dayCostCapInr);
  const documentName = (collection, id) => `${databaseName}/documents/${collection}/${id}`;

  /** Who is charged and against which caps, for one instant. */
  function plan(principal, ipKey, instant) {
    const windows = istWindows(instant);
    const reserveWindowActive = limits.reserve !== undefined &&
      windowActive({ start: limits.reserve.windowStart, end: limits.reserve.windowEnd }, instant);
    // Only a verified demo principal names a session; a plain object cannot pick one.
    const sessionId = isDemoPrincipal(principal) ? principal.sessionId : null;
    const pitch = reserveWindowActive && sessionId !== null && hasPitchClaim(principal) === true;
    const caps = {
      day: pitch ? limits.dayLimit : limits.dayLimit - reserveUnits,
      session: pitch ? limits.reserve.sessionDayLimit : limits.sessionDayLimit,
      ip: limits.ipDayLimit,
      minute: limits.minuteLimit,
      sessionMinute: limits.sessionMinuteLimit,
    };
    const counter = (key, scope, subject, window, limit, kind) => ({
      key, kind, limit, id: budgetCounterId({ pool, scope, subject, window }), scope, subject, window,
    });
    const counters = [
      counter("day", "day", "all", windows.day, limits.dayLimit, "day"),
      ...(sessionId ? [counter("session", "session_day", sessionId, windows.day, caps.session, "day")] : []),
      // The pitch laptop is not charged to the shared venue address (ADR-0004 decision 5).
      ...(ipKey && !pitch ? [counter("ip", "ip_day", ipKey, windows.day, limits.ipDayLimit, "day")] : []),
      counter("minute", "minute", "all", windows.minute, limits.minuteLimit, "minute"),
      ...(sessionId ? [counter("sessionMinute", "session_minute", sessionId, windows.minute, limits.sessionMinuteLimit, "minute")] : []),
    ];
    const cost = counter("cost", "cost_day", "all", windows.day, costCapMicroInr, "day");
    return { windows, reserveWindowActive, sessionId, pitch, caps, counters, cost };
  }

  function remainingFor(current, { caps, sessionId, counters }) {
    const has = (key) => counters.some((counter) => counter.key === key);
    const left = (key) => (has(key) ? Math.max(0, caps[key] - (current[key] ?? 0)) : null);
    return {
      day: left("day"),
      session: sessionId ? left("session") : null,
      ip: left("ip"),
      minute: left("minute"),
      sessionMinute: sessionId ? left("sessionMinute") : null,
      costInr: Math.max(0, costCapMicroInr - (current.cost ?? 0)) / 1e6,
    };
  }

  function refusal({ units, current, planned, instant }) {
    const { caps, sessionId, reserveWindowActive, pitch, counters } = planned;
    const used = (key) => current[key] ?? 0;
    const has = (key) => counters.some((counter) => counter.key === key);
    if (used("cost") >= costCapMicroInr) return { code: "BUDGET_COST_EXHAUSTED" };
    if (used("day") + units > caps.day) {
      return reserveWindowActive && !pitch && used("day") + units <= limits.dayLimit
        ? { code: "BUDGET_RESERVED_FOR_PITCH" }
        : { code: "BUDGET_DAY_EXHAUSTED" };
    }
    if (sessionId && used("session") + units > caps.session) return { code: "BUDGET_SESSION_EXHAUSTED" };
    if (has("ip") && used("ip") + units > caps.ip) return { code: "BUDGET_IP_EXHAUSTED" };
    if (used("minute") + units > caps.minute) {
      return { code: "BUDGET_RATE_LIMITED", retryAfterSeconds: secondsToNextMinute(instant) };
    }
    if (sessionId && used("sessionMinute") + units > caps.sessionMinute) {
      return { code: "BUDGET_SESSION_RATE_LIMITED", retryAfterSeconds: secondsToNextMinute(instant) };
    }
    return undefined;
  }

  async function withToken(signal, work) {
    const bounded = signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs);
    let token;
    try {
      token = await provideToken({ signal: bounded });
    } catch {
      throw new BudgetUnavailable();
    }
    if (typeof token !== "string" || token.length === 0 || bounded.aborted) throw new BudgetUnavailable();
    return work({ token, signal: bounded });
  }

  async function readDoc(collection, id, schema, { token, signal, transaction }) {
    const query = transaction ? `?transaction=${encodeURIComponent(transaction)}` : "";
    const read = await firestore.request(`${documentsUrl}/${collection}/${id}${query}`, { token, signal });
    if (read.status === 404) return null;
    if (!read.ok || read.payload?.name !== documentName(collection, id) ||
        typeof read.payload.updateTime !== "string" || read.payload.updateTime.length === 0) {
      throw new BudgetUnavailable();
    }
    return { doc: parseDocument(schema, read.payload), updateTime: read.payload.updateTime };
  }

  async function readCounters(list, context) {
    const reads = await Promise.all(list.map((counter) => readDoc(BUDGET_COUNTER_COLLECTION, counter.id, BudgetCounterDocSchema, context)));
    return list.map((counter, index) => {
      const read = reads[index];
      if (read && (read.doc.counterId !== counter.id || read.doc.policyVersion !== BUDGET_POLICY_VERSION)) {
        throw new BudgetUnavailable();
      }
      return { counter, read };
    });
  }

  function counterWrite({ counter, read }, units, nowIso, instant) {
    const doc = {
      schemaVersion: STATE_SCHEMA_VERSION,
      createdAt: read?.doc.createdAt ?? nowIso,
      updatedAt: nowIso,
      expiresAt: read?.doc.expiresAt ?? new Date(instant + COUNTER_RETENTION_MS[counter.kind]).toISOString(),
      counterId: counter.id,
      pool,
      scope: counter.scope,
      subject: counter.subject,
      window: counter.window,
      units: (read?.doc.units ?? 0) + units,
      limit: counter.limit,
      policyVersion: BUDGET_POLICY_VERSION,
    };
    return {
      update: {
        name: documentName(BUDGET_COUNTER_COLLECTION, counter.id),
        fields: encodeDocument(BudgetCounterDocSchema, doc, { timestamps: BASE_TIMESTAMP_FIELDS }),
      },
      currentDocument: currentDocumentPrecondition(read ? read.updateTime : null),
    };
  }

  /**
   * Runs `attempt` in a read-write transaction, retrying a definite non-commit
   * (ABORTED or a failed precondition). Any other commit failure may have been
   * applied, so it is reported as unavailable and never retried or refunded.
   */
  async function transact(context, attempt) {
    for (let round = 0; round < maxAttempts; round += 1) {
      let transaction;
      let commitIssued = false;
      try {
        transaction = await firestore.beginTransaction(context);
        const step = await attempt(transaction);
        if (step.writes === undefined) {
          await firestore.rollback({ transaction, ...context }).catch(() => false);
          return step.result;
        }
        commitIssued = true;
        const committed = await firestore.commit({ transaction, writes: step.writes, ...context });
        if (committed.aborted || committed.preconditionFailed) continue;
        if (!committed.ok || !Array.isArray(committed.payload?.writeResults) ||
            committed.payload.writeResults.length !== step.writes.length ||
            typeof committed.payload.commitTime !== "string") {
          throw new BudgetUnavailable();
        }
        return step.result;
      } catch (error) {
        if (transaction && !commitIssued && !context.signal.aborted) {
          // A failed rollback grants nothing; the transaction expires on its own.
          await firestore.rollback({ transaction, ...context }).catch(() => false);
        }
        throw error;
      }
    }
    throw new BudgetUnavailable();
  }

  function validateReserve({ ipKey, purpose, units, reservationKey, evalSuite }) {
    if (!BudgetPurposeSchema.safeParse(purpose).success || !Number.isInteger(units) || units < 1 || units > MAX_UNITS ||
        typeof reservationKey !== "string" || !RESERVATION_KEY.test(reservationKey) ||
        (ipKey !== null && !IpKeySchema.safeParse(ipKey).success) ||
        (pool === "eval" ? typeof evalSuite !== "string" || !EVAL_SUITE.test(evalSuite) : evalSuite !== null)) {
      throw new TypeError("A budget purpose, a reservation key, 1 to 10 units, a valid IP key and an eval suite only in the eval pool are required.");
    }
  }

  function unavailable(signal) {
    if (signal?.aborted) throw signal.reason;
    return Object.freeze({ ok: false, code: "BUDGET_UNAVAILABLE" });
  }

  return Object.freeze({
    pool,
    policyVersion: BUDGET_POLICY_VERSION,

    async reserve({ principal, ipKey = null, purpose, units = 1, reservationKey, evalSuite = null, signal } = {}) {
      validateReserve({ ipKey, purpose, units, reservationKey, evalSuite });
      const instant = now();
      if (!Number.isFinite(instant)) return unavailable(signal);
      if ((limits.blockedWindows ?? []).some((window) => windowActive(window, instant))) {
        return Object.freeze({ ok: false, code: "BUDGET_WINDOW_BLOCKED" });
      }
      const planned = plan(principal, ipKey, instant);
      const keyHash = createHash("sha256")
        .update(JSON.stringify([BUDGET_POLICY_VERSION, pool, planned.sessionId, reservationKey]))
        .digest("hex");
      const nowIso = new Date(instant).toISOString();
      try {
        return await withToken(signal, (context) => transact(context, async (transaction) => {
          const scoped = { ...context, transaction };
          const [reservation, counters, cost] = await Promise.all([
            readDoc(BUDGET_RESERVATION_COLLECTION, keyHash, BudgetReservationDocSchema, scoped),
            readCounters(planned.counters, scoped),
            readCounters([planned.cost], scoped),
          ]);
          const current = Object.fromEntries([...counters, ...cost]
            .map(({ counter, read }) => [counter.key, read?.doc.units ?? 0]));
          const base = { reserveWindowActive: planned.reserveWindowActive };
          if (reservation) {
            if (reservation.doc.keyHash !== keyHash || reservation.doc.pool !== pool) throw new BudgetUnavailable();
            return { result: Object.freeze({
              ok: true, reservationId: keyHash, replayed: true, usedPitchReserve: reservation.doc.usedPitchReserve,
              dayWindow: reservation.doc.dayWindow, remaining: remainingFor(current, planned), ...base,
            }) };
          }
          const refused = refusal({ units, current, planned, instant });
          if (refused) {
            return { result: Object.freeze({ ok: false, ...refused, remaining: remainingFor(current, planned), ...base }) };
          }
          const usedPitchReserve = planned.pitch && current.day + units > limits.dayLimit - reserveUnits;
          const reservationDoc = {
            schemaVersion: STATE_SCHEMA_VERSION, createdAt: nowIso, updatedAt: nowIso,
            expiresAt: new Date(instant + RESERVATION_RETENTION_MS).toISOString(),
            keyHash, pool, sessionId: planned.sessionId, ipKey, purpose,
            dayWindow: planned.windows.day, units, usedPitchReserve, evalSuite,
          };
          const after = { ...current };
          for (const { counter } of counters) after[counter.key] = (after[counter.key] ?? 0) + units;
          return {
            writes: [
              ...counters.map((entry) => counterWrite(entry, units, nowIso, instant)),
              {
                update: {
                  name: documentName(BUDGET_RESERVATION_COLLECTION, keyHash),
                  fields: encodeDocument(BudgetReservationDocSchema, reservationDoc, { timestamps: BASE_TIMESTAMP_FIELDS }),
                },
                currentDocument: currentDocumentPrecondition(null),
              },
            ],
            result: Object.freeze({
              ok: true, reservationId: keyHash, replayed: false, usedPitchReserve,
              dayWindow: planned.windows.day, remaining: remainingFor(after, planned), ...base,
            }),
          };
        }));
      } catch {
        return unavailable(signal);
      }
    },

    /** Read-only: what remains for this principal, for /api/status and the Arc cap-reached state. */
    async peek({ principal, ipKey = null, signal } = {}) {
      if (ipKey !== null && !IpKeySchema.safeParse(ipKey).success) throw new TypeError("A valid IP key is required.");
      const instant = now();
      if (!Number.isFinite(instant)) return unavailable(signal);
      const planned = plan(principal, ipKey, instant);
      try {
        const counters = await withToken(signal, (context) => readCounters([...planned.counters, planned.cost], context));
        const current = Object.fromEntries(counters.map(({ counter, read }) => [counter.key, read?.doc.units ?? 0]));
        return Object.freeze({
          ok: true, pool, ...remainingFor(current, planned), reserveWindowActive: planned.reserveWindowActive,
          limits: {
            dayLimit: limits.dayLimit, usableDayLimit: planned.caps.day, sessionDayLimit: planned.caps.session,
            ipDayLimit: limits.ipDayLimit, minuteLimit: limits.minuteLimit, sessionMinuteLimit: limits.sessionMinuteLimit,
            dayCostCapInr: limits.dayCostCapInr, reserveUnits,
          },
        });
      } catch {
        return unavailable(signal);
      }
    },

    /** Adds the rupee cost of one response to the day's spend. Called once per provider response. */
    async recordUsage({ dayWindow, costMicroInr, signal } = {}) {
      if (typeof dayWindow !== "string" || !/^\d{8}$/.test(dayWindow) ||
          !Number.isSafeInteger(costMicroInr) || costMicroInr < 0) {
        throw new TypeError("An IST day window and a non-negative cost in micro-rupees are required.");
      }
      if (costMicroInr === 0) return Object.freeze({ ok: true, recordedMicroInr: 0 });
      const instant = now();
      const cost = {
        key: "cost", kind: "day", limit: costCapMicroInr, scope: "cost_day", subject: "all", window: dayWindow,
        id: budgetCounterId({ pool, scope: "cost_day", subject: "all", window: dayWindow }),
      };
      try {
        return await withToken(signal, (context) => transact(context, async (transaction) => {
          const [entry] = await readCounters([cost], { ...context, transaction });
          return {
            writes: [counterWrite(entry, costMicroInr, new Date(instant).toISOString(), instant)],
            result: Object.freeze({ ok: true, recordedMicroInr: costMicroInr }),
          };
        }));
      } catch {
        return unavailable(signal);
      }
    },
  });
}

// Model roles in config/arc-models.json and the reservation purpose each is charged as.
// The agent role has no purpose of its own, so its callers must name one.
const ROLE_PURPOSE = Object.freeze({
  extraction: "order_extraction",
  explanation: "explanation",
  photo: "photo_diagnosis",
  router: "arc_router",
  writer: "arc_answer_writer",
});

function usageError(code, message, extra = {}) {
  return Object.assign(new Error(message), { name: "GeminiBudgetError", code, ...extra });
}

/**
 * Adapts the budget store to the `store` that withDailyGeminiCallCap expects,
 * so every Gemini call keeps passing through that one wrapper (design 5.2).
 * A refusal keeps the existing GEMINI_DAILY_CAP_EXCEEDED code for current
 * clients and adds the specific budget code.
 */
export function budgetCapStore(store, { costOf = attemptCostMicroInr, log = console.error } = {}) {
  if (!store || typeof store.reserve !== "function" || typeof store.peek !== "function" ||
      typeof store.recordUsage !== "function" || typeof costOf !== "function" || typeof log !== "function") {
    throw new TypeError("A budget store with reserve, peek and recordUsage is required.");
  }
  return Object.freeze({
    scope: "shared-firestore-transaction",
    policyVersion: BUDGET_POLICY_VERSION,
    peek: (args) => store.peek(args),

    async reserveAttempt({ role, budget = {}, signal } = {}) {
      const purpose = budget.purpose ?? ROLE_PURPOSE[role];
      let result;
      try {
        result = await store.reserve({
          principal: budget.principal,
          ipKey: budget.ipKey ?? null,
          purpose,
          units: budget.units ?? 1,
          // Without a caller key every call is its own attempt, which is what a provider call costs.
          reservationKey: budget.reservationKey ?? `attempt.${randomUUID()}`,
          evalSuite: budget.evalSuite ?? null,
          signal,
        });
      } catch (error) {
        if (signal?.aborted) throw error;
        throw usageError("GEMINI_USAGE_UNAVAILABLE", "The Gemini budget request is invalid. No provider request was issued.");
      }
      if (result.ok) return result;
      if (result.code === "BUDGET_UNAVAILABLE") {
        throw usageError("GEMINI_USAGE_UNAVAILABLE", "Gemini usage could not be reserved. No provider request was issued.");
      }
      throw usageError("GEMINI_DAILY_CAP_EXCEEDED", "The Gemini budget does not allow this call.", {
        budgetCode: result.code,
        ...(result.retryAfterSeconds === undefined ? {} : { retryAfterSeconds: result.retryAfterSeconds }),
      });
    },

    /** Never fails the caller: the response already exists, so a lost cost record is logged instead. */
    async recordUsage({ role, usage, reservation } = {}) {
      let code;
      try {
        const recorded = await store.recordUsage({ dayWindow: reservation.dayWindow, costMicroInr: costOf(role, usage) });
        if (recorded.ok) return;
        code = recorded.code;
      } catch {
        code = "BUDGET_COST_UNPRICED";
      }
      log(JSON.stringify({ event: "gemini_budget_cost_unrecorded", role: ROLE_PURPOSE[role] ? role : "other", code }));
    },
  });
}
