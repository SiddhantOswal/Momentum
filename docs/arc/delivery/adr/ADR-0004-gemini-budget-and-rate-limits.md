# ADR-0004: Gemini budget and rate limits

Status: Proposed
Date: 2026-11-23
Author role: solutions architect
Branch: `arc/m0-discovery`
Design: `04-technical-design.md` section 5

## Context

- Gemini use is a hard daily attempt cap per IST day, held in `gemini_daily_usage/<day>`: 300 on `momentum`, 100 on `prepagent` (`src/daily-gemini-call-cap.js`, `firestore-gemini-attempt-store.js`). Failed attempts count. Rehearsals and the pitch share it, and it resets at 02:30 Singapore time.
- **Lockout bug (design E7).** `decodeCount` rejects a day document whose stored `configuredCap` differs from the caller's limit. Since the caps differ, the first service to call Gemini on a day locks the other out until midnight IST. Not yet observed live, because no day document exists since the change.
- There is no per-session or per-minute limit, so one person typing quickly can spend the whole day's budget.
- The per-IP limiter (60 per minute per instance, in memory) keys on the socket address (`request-guardrails.js:47-54`). On Cloud Run that address is the serving infrastructure, not the browser. Logs cannot confirm which value it used, because it has not fired in 14 days (design E1, E2). At the venue every judge may share one NAT address.
- The optimizer byte limit defaults to 80 MiB while each run bills about 90 MiB (`service-ports.js:72-76`). Production works only through an env override.
- The weather fallback inside the condition guard is uncached (audit M7).

## Decision

1. **Budget store `budget-v2`** in `budget_counters`, one Firestore transaction per reservation over four counters: day (IST), session per day, global per minute, and session per minute. It also writes a reservation document keyed by the idempotency key, so a replayed key counts nothing. Attempts are counted and never refunded.
2. **API** (design 5.2): `reserve({ sessionId, purpose, units, idempotencyKey, signal })` returns `ok` with the remaining units, or one of `BUDGET_DAY_EXHAUSTED`, `BUDGET_SESSION_EXHAUSTED`, `BUDGET_RATE_LIMITED`, `BUDGET_RESERVED_FOR_PITCH` or `BUDGET_UNAVAILABLE`. `peek({ sessionId })` is read-only. `withDailyGeminiCallCap` stays the single wrapper around Gemini; its store adapter calls `reserve`. HTTP mapping keeps the existing 429 `GEMINI_DAILY_CAP_EXCEEDED` shape and adds the specific code.
3. **Policy** in one validated env var, `GEMINI_BUDGET_POLICY`, which sets the limits and a pitch reserve. The reserve has units, a time window, and optionally the session IDs allowed to use it. Outside the window, usable day units are the day limit minus the reserve. The stored limit is informational, not a precondition, which removes the lockout for any service on `budget-v2`. Proposed numbers (founder decision F2): day 300, session 40, minute 20, session-minute 6, reserve 80 on 4 December.
4. **Rate limit key.** On Cloud Run, key on the last `X-Forwarded-For` entry, and add a per-session key from the demo cookie. Limits are 300 per minute per IP and 60 per minute per session, per instance, in memory. Before the first load rehearsal, verify the key on a tagged no-traffic revision by logging hashed values only (design 5.4).
5. **Caching.** One shared weather cache (`weather_cache/pune`, 10 min) for every caller. Button-path answers that need no Gemini call get a per-session cache keyed on intent, parameters and source version (5 min). Answers are never cached on question text alone.
6. **Optimizer default** becomes 100 MiB, with a test tied to the recorded billed bytes and a preflight line.
7. **`prepagent`.** It keeps the old counter until the founders decide F1. The recommendation is to turn its Gemini off until after 4 December.

## Consequences

- Rehearsals can no longer spend the pitch's units, and a single session cannot drain the day.
- The Arc cap-reached state (G2) can show exact remaining units from `peek`.
- Moving `momentum` to `budget-v2` ends the shared count with `prepagent`. The two services' Gemini spend is then capped separately: 300 plus 100 a day at most.
- Each reservation is a transaction over 4 to 5 documents, about 20 to 60 ms added latency per Gemini call (NOT MEASURED), and about 6 writes. At about 150 attempts a day this stays inside the free tier.
- **Failure modes:** Firestore down blocks Gemini with `BUDGET_UNAVAILABLE`, no provider call, same as today's counter. A wrong policy JSON blocks Gemini at start. Preflight catches both before traffic moves.
- **Retry:** ABORTED transactions retry up to 3 times, as today. Ambiguous commits count as spent, as today.
- **Quota:** The Vertex AI per-minute quota for `gemini-3.5-flash` in `asia-south1` was not read for this ADR (NOT RUN). The AI architect should confirm it is above 20 per minute in ADR-0008.
- **Cost:** the budget caps Gemini spend at day limit × price per attempt. Per-attempt price and tokens per turn: [AI architect to fill, ADR-0008]. Firestore cost is about ₹0.
- **Rollback:** unset `GEMINI_BUDGET_POLICY`. The old cap code path is unchanged and resumes, with the lockout bug, until F1 is settled.

## Alternatives rejected

1. **Raise the daily cap again.** Rejected. It does not separate rehearsal from pitch, does not stop one session from draining the day, and does not fix the lockout.
2. **Vertex AI project quota as the only control.** Rejected. It limits requests per minute but cannot be set per session or reserved for a time slot. Lowering it also affects every service in the project.
3. **Budget counters in memory per instance.** Rejected. The real limit would become N times the configured one, and counters would reset on every restart.
4. **Billing budget with automatic disable.** Rejected for the finals. A budget alert that disables billing stops every service mid-pitch. The ₹5,000 alert stays an alert (C11).
5. **Trust the first `X-Forwarded-For` entry.** Rejected. The client controls it and could spread requests across fake addresses.
