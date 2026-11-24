import { currentGeminiCaller } from "./gemini-caller-context.js";

const CAP_ENV = Object.freeze({
  limit: "GEMINI_DAILY_ATTEMPT_CAP",
  timeZone: "GEMINI_DAILY_ATTEMPT_TIMEZONE",
});

const DEFAULT_CAP = 100;
const DEFAULT_TIME_ZONE = "Asia/Kolkata";
const REPLAY_MESSAGE = "This Gemini call was already reserved.";

export class GeminiDailyCallCapError extends Error {
  constructor() {
    super("Gemini daily call cap is exhausted for this instance.");
    this.name = "GeminiDailyCallCapError";
    this.code = "GEMINI_DAILY_CAP_EXCEEDED";
  }
}

const BUDGET_MESSAGES = Object.freeze({
  BUDGET_DAY_EXHAUSTED: "Today's Gemini attempts are used up. Try after midnight IST.",
  BUDGET_SESSION_EXHAUSTED: "This session has used its Gemini attempts for today.",
  BUDGET_IP_EXHAUSTED: "This network has used its Gemini attempts for today.",
  BUDGET_RATE_LIMITED: "Too many Gemini requests this minute. Try again in a minute.",
  BUDGET_SESSION_RATE_LIMITED: "This session sent too many Gemini requests this minute. Try again in a minute.",
  BUDGET_RESERVED_FOR_PITCH: "The Gemini attempts left today are held for the pitch.",
  BUDGET_COST_EXHAUSTED: "Today's Gemini spending limit is reached. Try after midnight IST.",
  BUDGET_WINDOW_BLOCKED: "Gemini eval runs are paused during the pitch window.",
});

export function geminiUsageFailure(error) {
  if (error?.code === "GEMINI_CALL_REPLAYED") return {
    ok: false, error: { code: "GEMINI_CALL_REPLAYED", message: REPLAY_MESSAGE },
  };
  if (error?.code === "GEMINI_DAILY_CAP_EXCEEDED" && Object.hasOwn(BUDGET_MESSAGES, error.budgetCode)) return {
    ok: false,
    error: {
      code: "GEMINI_DAILY_CAP_EXCEEDED",
      budgetCode: error.budgetCode,
      ...(Number.isSafeInteger(error.retryAfterSeconds) ? { retryAfterSeconds: error.retryAfterSeconds } : {}),
      message: BUDGET_MESSAGES[error.budgetCode],
    },
  };
  if (error?.code === "GEMINI_DAILY_CAP_EXCEEDED") return {
    ok: false, error: { code: "GEMINI_DAILY_CAP_EXCEEDED", message: "The daily Gemini attempt cap is exhausted. Try after midnight IST." },
  };
  if (["GEMINI_USAGE_UNAVAILABLE", "GEMINI_USAGE_POLICY_MISMATCH", "INVALID_GEMINI_USAGE_POLICY"].includes(error?.code)) return {
    ok: false, error: { code: "SERVICE_UNAVAILABLE", message: "Gemini usage accounting is unavailable or its policy differs from configuration. No provider call was issued." },
  };
  return undefined;
}

export function readDailyGeminiCallCapConfig(env = process.env) {
  const values = {
    limit: env[CAP_ENV.limit] ?? String(DEFAULT_CAP),
    timeZone: env[CAP_ENV.timeZone] ?? DEFAULT_TIME_ZONE,
  };
  const invalid = [];

  let limit;
  if (!/^[1-9]\d*$/.test(values.limit) || !Number.isSafeInteger(Number(values.limit))) {
    invalid.push(CAP_ENV.limit);
  } else {
    limit = Number(values.limit);
  }

  let timeZone;
  try {
    new Intl.DateTimeFormat("en", { timeZone: values.timeZone }).format(new Date(0));
    timeZone = values.timeZone;
  } catch {
    invalid.push(CAP_ENV.timeZone);
  }

  const configured = invalid.length === 0;
  return Object.freeze({
    configured,
    status: configured ? "configured" : invalid.length > 0 ? "invalid" : "missing",
    ...(configured ? {
      limit,
      timeZone,
      countingPolicy: "attempts",
      scope: "single-process",
      globalScopeEnforced: false,
    } : {}),
    missing: Object.freeze([]),
    invalid: Object.freeze(invalid),
  });
}

function validateConfiguration(configuration) {
  if (!configuration || configuration.configured !== true ||
      !Number.isSafeInteger(configuration.limit) || configuration.limit < 1 ||
      typeof configuration.timeZone !== "string" ||
      configuration.countingPolicy !== "attempts") {
    throw new TypeError("A valid daily attempted-call cap is required.");
  }
  try {
    new Intl.DateTimeFormat("en", { timeZone: configuration.timeZone }).format(new Date(0));
  } catch {
    throw new TypeError("A valid daily Gemini cap time zone is required.");
  }
}

/**
 * Wrap every runtime Gemini operation in attempted-call accounting. The local
 * fallback is for an isolated process; Cloud Run requires the shared store.
 */
export function withDailyGeminiCallCap(client, configuration, { now = () => Date.now(), store } = {}) {
  validateConfiguration(configuration);
  if (!client || typeof client.generateContent !== "function" ||
      typeof client.generateJson !== "function" || typeof now !== "function" ||
      (store !== undefined && (typeof store.reserveAttempt !== "function" || store.scope !== "shared-firestore-transaction"))) {
    throw new TypeError("A Gemini client and clock are required for daily call capping.");
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: configuration.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const counters = new Map();

  function currentDay() {
    const instant = new Date(now());
    if (Number.isNaN(instant.getTime())) throw new TypeError("The daily cap clock returned an invalid time.");
    const parts = Object.fromEntries(formatter.formatToParts(instant)
      .filter((part) => ["year", "month", "day"].includes(part.type))
      .map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function counterFor(day) {
    for (const key of counters.keys()) if (key !== day) counters.delete(key);
    let entry = counters.get(day);
    if (!entry) {
      entry = { calls: 0 };
      counters.set(day, entry);
    }
    return entry;
  }

  async function call(method, args) {
    if (store) {
      const dayKey = currentDay();
      const caller = currentGeminiCaller();
      const reservationKey = caller?.nextReservationKey?.();
      const reservation = await store.reserveAttempt({
        dayKey, timeZone: configuration.timeZone, limit: configuration.limit, signal: args?.signal,
        role: args?.role,
        budget: caller ? {
          principal: caller.principal, ipKey: caller.ipKey, ...args?.budget,
          ...(reservationKey === undefined ? {} : {
            reservationKey, principal: caller.principal, ipKey: caller.ipKey,
          }),
        } : args?.budget,
      });
      // A disconnect after commit still consumes the attempt, but must not
      // start a provider call on behalf of an already cancelled request.
      args?.signal?.throwIfAborted();
      if (reservation?.replayed === true) {
        throw Object.assign(new Error(REPLAY_MESSAGE), { code: "GEMINI_CALL_REPLAYED" });
      }
      if (currentDay() !== dayKey) {
        // Do not issue today's request against yesterday's reservation. Keep
        // the consumed slot and require a fresh request under today's key.
        const error = new Error("The Gemini usage day changed during reservation. Retry the request.");
        error.code = "GEMINI_USAGE_UNAVAILABLE";
        throw error;
      }
      if (typeof store.recordUsage !== "function") return client[method](args);
      const { budget: _budget, onUsage, ...providerArgs } = args ?? {};
      let usage;
      try {
        return await client[method]({
          ...providerArgs,
          onUsage: (reported) => { usage = reported; onUsage?.(reported); },
        });
      } finally {
        // A response that reported usage was billed, whether or not the caller could use it.
        if (usage) await store.recordUsage({ role: args?.role, usage, reservation });
      }
    }
    const entry = counterFor(currentDay());
    if (entry.calls >= configuration.limit) throw new GeminiDailyCallCapError();

    // Charge immediately before starting the provider request. A rejected
    // request or ambiguous timeout still consumes the reservation.
    entry.calls += 1;
    return client[method](args);
  }

  return Object.freeze({
    generateContent: (args) => call("generateContent", args),
    generateJson: (args) => call("generateJson", args),
    getDailyCapStatus() {
      if (store) return Object.freeze({
        configured: true, limit: configuration.limit, calls: null, remaining: null,
        countingPolicy: "attempts", timeZone: configuration.timeZone,
        scope: store.scope, globalScopeEnforced: true, liveConnectivityVerified: false,
        reset: "midnight-in-configured-time-zone",
      });
      const day = currentDay();
      const entry = counterFor(day);
      return Object.freeze({
        configured: true,
        limit: configuration.limit,
        calls: entry.calls,
        inFlight: 0,
        remaining: Math.max(0, configuration.limit - entry.calls),
        countingPolicy: "attempts",
        timeZone: configuration.timeZone,
        scope: "single-process",
        globalScopeEnforced: false,
        reset: "midnight-in-configured-time-zone",
      });
    },
  });
}

export const DAILY_GEMINI_CAP_ENVIRONMENT = Object.freeze({
  ...CAP_ENV,
  defaultLimit: DEFAULT_CAP,
  defaultTimeZone: DEFAULT_TIME_ZONE,
  countingPolicy: "attempts",
});
