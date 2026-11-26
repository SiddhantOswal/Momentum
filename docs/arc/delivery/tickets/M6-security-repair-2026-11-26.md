# M6 security repair: G-2 to G-5 before the production deploy (2026-11-26)

Om asked to deploy `v3` to `momentum-ai.cloud.run`, then chose to fix the M6 security blockers first (session of 2026-11-26). These tickets close G-2 to G-5 in `reviews/M6-review.md`. G-1 (the `arc/ui-vnext` branch) and G-6 (holdout figures, corrected on 2026-11-26) are not part of this packet.

One branch, `arc/ARC-M6-R-security-repair`, cut from `v3`, one commit per ticket (R1 to R3 touch `index.mjs`, so they are built in order, not in parallel). R4 is configuration and goes into the deploy change record.

Tier A: each ticket needs an independent QA lead and the security reviewer who raised the finding before it merges.

## ARC-M6-R1: key IPv6 clients on their /64 (G-2, SEC-1)
- Owner: backend engineer.
- Goal: one client cannot rotate past the per-IP limits by changing the low 64 bits of an IPv6 address, and requests with no usable address are visible.
- Change: in `src/request-guardrails.js`, the client key for an IPv6 address is its /64 prefix in one canonical text form (expanded or compressed the same way every time, so `2001:db8::1` and `2001:0db8:0:0::2` give the same key); an IPv4 address, or an IPv4-mapped IPv6 address, stays the full IPv4 address. The same key feeds the per-IP rate limit and `createIpKeyDeriver` (budget counters, plan limit, session mint, pitch claim). Requests that fall into `UNKNOWN_CLIENT_KEY` write one structured log line per instance per minute at most (severity WARNING, a stable `event` name, no address), so a log-based alert can be added later.
- Acceptance: two addresses in the same /64 share a key; addresses in different /64s do not; IPv4 and IPv4-mapped forms are unchanged; the unknown bucket logs and still limits; the existing rate-limit and budget tests pass.
- Test plan: unit tests in `test/request-guardrails.test.js` and `test/rate-limit-http.test.js`, including one that fails if the key is the full IPv6 address.
- Built: `clientKeyForAddress` in `src/request-guardrails.js`. An IPv6 key is the first four groups in lowercase hex without leading zeros, then `::/64` (`2001:db8::1` and `2001:0db8:0:0::2` both give `2001:db8:0:0::/64`); a zone suffix is dropped. IPv4 and IPv4-mapped IPv6 (dotted or hex tail) give the dotted IPv4 address, so IPv4 budget keys are unchanged across the deploy. IPv6 budget keys change once, so an IPv6 client's per-IP day counter starts again on the day of the deploy. The unknown bucket logs `{"severity":"WARNING","event":"client_key_unknown",...}` at most once a minute per instance, with no address.

## ARC-M6-R2: `/api/status` without detail for the public (G-3, SEC-2)
- Owner: backend engineer.
- Goal: an unauthenticated caller learns only whether the service is available, and repeated calls do not cost Firestore reads each time.
- Change: in `index.mjs` and `src/commands/status.js`, a request without a verified session cookie gets availability only (the fields the web app needs before a session exists; read `web/src/lib/api.ts`, `web/src/lib/arc.ts` and `web/src/pages/home/` to list them). The rupee cap, spend, reserve, limits and counters are never returned to a caller without a session; with a session, return only what the web app reads (the caller's own remaining Gemini count and the model scores), not the global cap or spend. The budget read behind the status is cached in-process for a short time (state the TTL and why in the ticket record), so one caller cannot turn status calls into Firestore reads.
- Acceptance: unauthenticated `/api/status` has no cap, spend, reserve or limit fields; the web app's Home, Insights and Arc still read what they need (browser suite); two status calls within the cache window cause one budget read.
- Test plan: unit tests on the status command and the HTTP route; the browser suite.

## ARC-M6-R3: bind session tokens to the service that issued them (G-4, SEC-12)
- Owner: backend engineer.
- Goal: a session cookie minted on one origin (a laptop run, another revision, another service) is refused on another, so a script cannot mint where limits are loose and spend where they are tight.
- Change: in `src/hackathon-demo-auth.js`, new tokens carry an audience claim equal to the service's public origin (`USTAAD_PUBLIC_ORIGIN`; on a laptop, the local origin the server already checks requests against). `verify` refuses a token whose audience is missing or different. Tokens issued before this change (no audience) are refused, so existing sessions re-mint once; say so in the ticket record. The audience is checked inside `verify`, before any grant or budget use. The signing secret stays the same Secret Manager secret.
- Acceptance: a token minted with one origin fails on another with the existing `DEMO_SESSION_REQUIRED` code; a token without an audience fails; a token for the right origin works for Arc, New Lot, approval and the pitch claim; the pitch claim re-issue keeps the audience.
- Test plan: unit tests in the auth, Arc route and pitch-claim tests, including a forged token with the right signature and the wrong audience.

## ARC-M6-R4: production Gemini limits and the pitch reserve (G-5, SEC-13)
- Owner: release manager, founders for the numbers.
- Goal: one client cannot use up the day's Gemini calls, and the pitch on 4 December has calls set aside.
- Change: the production `GEMINI_BUDGET_LIMITS` for the deploy, with `ipDayLimit` well below `dayLimit`, and a `reserve` block for 4 December (SGT) spendable only by a session holding the pitch claim. The pitch code is a new Secret Manager secret `arc-pitch-reserve-code` (ADR-0004 point 5); its value is never printed, committed or put in a URL. Numbers proposed in the deploy change record from ADR-0004 (day 300, session 40, IP 120 a day, minute 20, session-minute 6, reserve 80 on 4 December), confirmed by Om before the deploy.
- Acceptance: the revision's limits read back from Cloud Run match the record; `/api/status` with a session shows the caller's own remaining count; a pitch-claim attempt with a wrong code fails and is rate-limited.
- Test plan: config validation tests already cover the shape (`src/gemini-budget-config.js`); the live check in the change record covers the read-back.
