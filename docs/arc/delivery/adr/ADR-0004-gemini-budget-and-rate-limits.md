# ADR-0004: Gemini budget and rate limits

Status: Proposed
Date: 2026-11-23 (amended the same day for the M0 gate, round 1: BL-SE-1, SH-EV-S7, SH-SE-5, SH-CR-11)
Author role: solutions architect
Branch: `arc/m0-discovery`
Design: `04-technical-design.md` sections 2.4 and 5

## Context

- Gemini use is a hard daily attempt cap per IST day, held in `gemini_daily_usage/<day>`: 300 on `momentum`, 100 on `prepagent` (`src/daily-gemini-call-cap.js`, `firestore-gemini-attempt-store.js`). Failed attempts count. Rehearsals and the pitch share it, and it resets at 02:30 Singapore time.
- **Lockout bug (design E7).** `decodeCount` rejects a day document whose stored `configuredCap` differs from the caller's limit. Since the caps differ, the first service to call Gemini on a day locks the other out until midnight IST. Not yet observed live, because no day document exists since the change.
- There is no per-session or per-minute limit, so one person typing quickly can spend the whole day's budget.
- **Minted sessions (M0 gate BL-SE-1).** `POST /api/auth/demo-session` issues a new signed session to any same-origin request without a valid cookie (`index.mjs:562-569`). A per-session limit alone can therefore be reset by clearing the cookie, and a pitch reserve keyed on a session ID can be targeted by anyone who learns or guesses which session holds it.
- The per-IP limiter (60 per minute per instance, in memory) keys on the socket address (`request-guardrails.js:47-54`). On Cloud Run that address is the serving infrastructure, not the browser. Logs cannot confirm which value it used, because it has not fired in 14 days (design E1, E2). At the venue every judge may share one NAT address.
- Live eval suites need about 283 attempts per gate run (`05-ai-design.md` section 7), close to the whole `momentum` day cap.
- The optimizer byte limit defaults to 80 MiB while each run bills about 90 MiB (`service-ports.js:72-76`). Production works only through an env override.
- The weather fallback inside the condition guard is uncached (audit M7).

## Decision

1. **Budget store `budget-v2`** in `budget_counters`, one Firestore transaction per reservation over five counters: day (IST), session per day, IP address per day, global per minute, and session per minute. It also writes a `budget_reservations` document keyed by the reservation key (design 3.3), so a replayed key counts nothing. Attempts are counted and never refunded. Counter IDs are `<pool>_<scope>_<subject>_<window>`, with underscores only and no colons (design 2.4).
2. **API** (design 5.2): `reserve({ principal, ipKey, purpose, units, reservationKey, evalSuite, signal })` returns `ok` with the remaining units, or one of `BUDGET_DAY_EXHAUSTED`, `BUDGET_SESSION_EXHAUSTED`, `BUDGET_IP_EXHAUSTED`, `BUDGET_RATE_LIMITED`, `BUDGET_RESERVED_FOR_PITCH` or `BUDGET_UNAVAILABLE`. The session ID and any grant come from the verified cookie principal, never from a request field. `peek` is read-only. `withDailyGeminiCallCap` stays the single wrapper around Gemini; its store adapter calls `reserve`. HTTP mapping keeps the existing 429 `GEMINI_DAILY_CAP_EXCEEDED` shape and adds the specific code.
3. **Limits** in one validated JSON env var, `GEMINI_BUDGET_LIMITS`, distinct from the store flag `USTAAD_GEMINI_BUDGET_POLICY=budget-v2`. The stored limit is informational, not a precondition, which removes the lockout for any service on `budget-v2`. Proposed numbers (founder decision F2): day 300, session 40, IP address 120 a day, minute 20, session-minute 6, reserve 80 on 4 December.
4. **Session issuance limit.** `POST /api/auth/demo-session` counts each new session per IP address per hour in Firestore before issuing it (proposed 30), and otherwise returns 429 `DEMO_SESSION_RATE_LIMITED` with no cookie. A request with a valid cookie reuses it and counts nothing. IP addresses are stored only as a 16-hex HMAC key.
5. **Pitch reserve on a server credential.** One new Secret Manager secret, `arc-pitch-reserve-code`. The pitch laptop sends the code once to a new `POST /api/auth/pitch-claim` (same-origin, valid cookie, at most 5 attempts per IP address per hour, constant-time compare). On a match the server re-issues the cookie with a signed `pitch_reserve` grant. Inside the reserve window only a session with that grant can spend the reserved units; it gets its own session limit (proposed 120) and is not counted against the IP limit. The grant changes the budget only: no approval, no tool, and the identity label stays "Demo session, simulated". The code never appears in a URL, a response, a log or the repository. The session ID list in the first draft is removed.
6. **Eval pool.** Live eval suites run in a local process with `"pool": "eval"`, which writes `eval_*` counters and never touches the `live` pool. Config validation rejects the eval pool on Cloud Run (`K_SERVICE` set). Proposed eval limits: 350 a day, 10 a minute, blocked during the pitch reserve window. Every eval reservation carries its suite name, which is stored on the reservation and logged, so the gate report can list attempts per suite.
7. **Rate limit key.** On Cloud Run, key on the `X-Forwarded-For` entry at position `length - RATE_LIMIT_TRUSTED_HOPS` (default 1, the entry Google's front end appends), and add a per-session key from the demo cookie. Limits are 300 per minute per IP and 60 per minute per session, per instance, in memory. Before the first load rehearsal, verify the key on a tagged no-traffic revision by logging hashed values only. If a load balancer is added later, `RATE_LIMIT_TRUSTED_HOPS` must be raised; unit tests cover 1 and 2 hops, spoofed leading entries and a missing header, and the preflight fails if a serverless network endpoint group points at the service while the setting is 1 (design 5.4).
8. **Caching.** One shared weather cache (`weather_cache/pune`, 10 min) for every caller. Button-path answers that need no Gemini call get a per-session cache keyed on intent, parameters and source version (5 min). Answers are never cached on question text alone.
9. **Optimizer default** becomes 100 MiB, with a test tied to the recorded billed bytes and a preflight line.
10. **`prepagent`.** It keeps the old counter until the founders decide F1. The recommendation is to turn its Gemini off until after 4 December.

## Consequences

- Rehearsals can no longer spend the pitch's units, and neither can a judge's phone in the hall, because the reserve needs the grant, not a session ID. Clearing cookies no longer resets what one address can spend: the IP day limit bounds it, and the day limit bounds everything.
- At the venue, judges behind one NAT address share the IP day limit and the issuance limit. The pitch laptop does not depend on either once it holds the grant. If booth traffic on 3 December exceeds the proposed numbers, a founder raises them by env change with a change record.
- Live gate runs no longer compete with rehearsals or the pitch for attempts. They still share the project's Vertex AI per-minute quota, which is why the eval pool's minute limit is half the live one.
- The Arc cap-reached state (G2) can show exact remaining units from `peek`.
- Moving `momentum` to `budget-v2` ends the shared count with `prepagent`. The two services' Gemini spend is then capped separately: 300 plus 100 a day at most, plus at most 350 eval attempts on a gate day.
- Each reservation is a transaction over 6 documents, about 20 to 60 ms added latency per Gemini call (NOT MEASURED), and 6 writes. Issuing a session adds 1 write. At about 150 attempts a day this stays inside the Firestore free tier (NOT VERIFIED against the pricing page).
- **Failure modes:** Firestore down blocks Gemini with `BUDGET_UNAVAILABLE`, with no provider call, the same as today's counter, and blocks issuing new sessions (503); existing sessions keep working on paths without Gemini. A wrong limits JSON blocks Gemini at start. A missing or unreadable pitch secret makes `pitch-claim` return 503 and leaves the reserve unused, while the rest of the day limit still works. Preflight checks all three before traffic moves.
- **Retry:** ABORTED transactions retry up to 3 times, as today. Ambiguous commits count as spent, as today. A re-run after a lease expiry is a new reservation, because it makes a new provider call.
- **Quota:** The Vertex AI per-minute quota for `gemini-3.5-flash` in `asia-south1` was not read for this ADR (NOT RUN). ADR-0008 must confirm it is at least 30 per minute (live 20 plus eval 10).
- **Cost:** the limits cap Gemini spend at the day limit times the price per attempt; per-attempt estimates are in `05-ai-design.md` section 3. A typical gate run is about $1.09 (estimate). Firestore is about ₹0. The new secret is one active version with a few accesses a day, under ₹1 a day (NOT VERIFIED).
- **Rollback:** unset `USTAAD_GEMINI_BUDGET_POLICY`. The old cap code path is unchanged and resumes, with the lockout bug, until F1 is settled. The issuance limit and the pitch claim are behind the same flag. After 5 December, disable the secret version and remove `reserve` from the limits.

## Alternatives rejected

1. **Raise the daily cap again.** Rejected. It does not separate rehearsal from pitch, does not stop one session from draining the day, and does not fix the lockout.
2. **Vertex AI project quota as the only control.** Rejected. It limits requests per minute but cannot be set per session or reserved for a time slot. Lowering it also affects every service in the project.
3. **Budget counters in memory per instance.** Rejected. The real limit would become N times the configured one, and counters would reset on every restart.
4. **Billing budget with automatic disable.** Rejected for the finals. A budget alert that disables billing stops every service mid-pitch. The ₹5,000 alert stays an alert (C11).
5. **Trust the first `X-Forwarded-For` entry.** Rejected. The client controls it and could spread requests across fake addresses.
6. **Pitch reserve keyed on a list of session IDs (this ADR's first draft).** Rejected at the M0 gate. A session ID is set only after the laptop's session exists, lasts 2 hours, has to be copied into config by hand on the day, and is a bearer value in a cookie rather than a server-held secret.
7. **A separate Cloud Run revision or service for the pitch, with its own counter.** Rejected. Its tagged URL is as reachable as the main one, so it still needs a credential; it also doubles the deploy and preflight work on the day, and the pitch would no longer run on the revision the judges can open.
8. **Per-IP issuance limit in memory.** Rejected. Each instance would allow its own quota, so the real limit would grow with the instance count.
