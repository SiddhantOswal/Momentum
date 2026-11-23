# M1 durable state and quota fixes

Design: `04-technical-design.md` sections 2 to 5; ADR-0002, ADR-0003, ADR-0004. Order follows the migration table in design section 3.5. Every behaviour change ships behind its flag, and turning the flag off restores today's behaviour.

### ARC-M1-01 Extract command functions (P0)
- Goal: move the inline logic of the `index.mjs` handlers into `src/commands/*.js`, so the routes and Arc tools call the same functions (design 1.2).
- AC: `authorize`, `read-order`, `plan-lot`, `get-job`, `approve-job`, `get-card`, `read-weather`, `photos`, `history` and `status` exist with signature `(input, { principal, signal })`. Routes become parse plus call. Every existing test passes with no assertion changed. A parity test calls each command through HTTP and in process and compares the results field by field.
- Depends on: M0-02. Owner: backend engineer.
- Test plan: `npm test`, `npm run test:acceptance`, the new `test/command-parity.test.js`. The code reviewer checks that no logic was copied rather than moved.

### ARC-M1-02 Shared Firestore REST helper and state schemas (P0)
- Goal: one helper for value codecs, transactions and preconditions; zod schemas for every new document (design 2).
- AC: `src/google-cloud/firestore-rest.js`, extracted from the two existing adapters with no new npm package. `src/state-schemas.js` holds the schemas in design 2.1 to 2.8. Existing adapter tests stay green, and each schema has accept and reject tests.
- Depends on: M1-01. Owner: backend engineer.
- Test plan: unit tests with a fake fetch, including the timestamp codec and a parse failure mapped to `SERVICE_UNAVAILABLE`.

### ARC-M1-03 Fix the job fingerprint and optimizer default (P0)
- Goal: `createJobRequestIdentity` includes conditions and run date (design E6), and `readOptimizerQueryBudget` defaults to 100 MiB (E8).
- AC: two `/jobs` requests that differ only in moisture get different fingerprints and job IDs without an `Idempotency-Key`. Identical requests still replay. A test fails if the optimizer default is below the bytes billed by the recorded PKBX0041 run.
- Depends on: M1-01. Owner: backend engineer.
- Test plan: new cases in `test/job-idempotency.test.js` and `test/runtime-config.test.js`; each assertion is shown failing before the fix.

### ARC-M1-04 Firestore TTL policies (P0, cloud change)
- Goal: TTL on `expiresAt` for the new collections before their first write.
- AC: a change record in `changes/` gives the command, reason, cost and rollback, written before the commands run. `gcloud firestore fields ttls list` shows the policies.
- Depends on: M0-01. Owner: backend engineer, with the release manager approving.
- Test plan: the read-back command output in the change record.

### ARC-M1-05 Durable idempotency for `/jobs` (P0)
- Goal: wire `firestore-idempotency-store.js` behind `USTAAD_ENABLE_FIRESTORE_IDEMPOTENCY` (design 3.2).
- AC: `/api/status` reports `durableIdempotencyConfigured: true` when the flag is on. A retry after a simulated restart returns the stored job and spends no Gemini attempt. Two concurrent submissions with the same key produce one BigQuery row, so no `JOB_SHEET_NOT_UNIQUE`. A lease that expires mid-run is fenced.
- Depends on: M1-02, M1-03, M1-04. Owner: backend engineer.
- Test plan: unit tests with a fake Firestore and the concurrency case; an integration run against the Firestore emulator or a test collection prefix on a tagged no-traffic revision.

### ARC-M1-06 Durable PO reviews (P0)
- Goal: replace the in-memory Map (`purchase-order-review.js:45`) with `po_reviews` behind `USTAAD_ENABLE_DURABLE_PO_REVIEWS`.
- AC: a review created on instance A is usable on instance B. It expires after 30 minutes and is usable only by its own session. A changed fingerprint is still rejected. The 256 KiB document limit is enforced.
- Depends on: M1-02, M1-04. Owner: backend engineer.
- Test plan: unit tests with two service instances sharing one fake store; AC1.21 from the spec.

### ARC-M1-07 Durable traces and trace ownership (P1)
- Goal: write-through of the trace registry to `traces/`, and an owner check read from Firestore instead of `demoTraceOwners` (behind `USTAAD_ENABLE_DURABLE_TRACES`).
- AC: a run's events can be read from a second instance with the same `Last-Event-ID` cursor; another session gets 404.
- Depends on: M1-02, M1-04. Owner: backend engineer.
- Test plan: extend `test/trace-*.test.js`.

### ARC-M1-08 Configurable Gemini budget (P0)
- Goal: `firestore-budget-store.js` with `reserve` and `peek` (design 5.2), behind `USTAAD_GEMINI_BUDGET_POLICY=budget-v2`, with day, session, minute and session-minute limits and the pitch reserve read from `GEMINI_BUDGET_LIMITS`.
- AC: every Gemini call still passes through `withDailyGeminiCallCap`. The same idempotency key is charged once. Each limit returns its own code. Different limits on two callers no longer lock each other out (E7). An invalid policy blocks Gemini. `/api/status` shows what remains.
- Depends on: M1-02, M1-04, founder decision F1 and F2. Owner: backend engineer.
- Test plan: unit tests for each limit, the reserve window, the pitch-session allowlist, replay, and a concurrent reserve on the last unit.

### ARC-M1-09 Rate-limit key behind Cloud Run (P1)
- Goal: on Cloud Run, key on the last `X-Forwarded-For` entry, and add a per-session limit (design 5.4).
- AC: earlier header entries set by a client are ignored. The limits are 300 per minute per IP and 60 per minute per session. A verification run on a tagged revision logs only hashes and passes the two-network check. The temporary log line is removed afterwards. A unit test checks the key with `RATE_LIMIT_TRUSTED_HOPS` set to 1 and to 2.
- Depends on: M1-01. Owner: backend engineer; security reviewer checks.
- Test plan: unit tests with forged headers; the two-network check recorded in the PR.
- M0 gate additions: the two-network check means two requests from two networks (laptop Wi-Fi and a phone hotspot) to a tagged no-traffic revision, logging only SHA-256 hashes of the socket address and of the last `X-Forwarded-For` entry. Pass: the socket hashes are equal and the header hashes differ. A unit test documents that the key must be worked out again if a load balancer or Cloud Armor is put in front (M11).

### ARC-M1-10 Lot heads, revisions and the approve guard (P0)
- Goal: `lot_heads` and `lot_revisions` (design 2.7), `PUT /lots/:lotId/conditions` and `GET /lots/:lotId`. Approve requires `{ reviewConfirmed: true, revisionFingerprint }` and rejects a superseded revision (ADR-0003). It ships in two steps: 7a is `USTAAD_ENABLE_LOT_REVISIONS`, 7b is `USTAAD_ENFORCE_APPROVE_GUARD`.
- AC: a changed condition supersedes the current draft in one transaction. Approving a superseded revision returns 409 `REVISION_SUPERSEDED`. A missing flag or a stale fingerprint returns 4xx. Both clients send the body before 7b is turned on.
- Depends on: M1-02, M1-05, founder Q8, Q9 and F5. Owner: backend engineer; frontend engineer for the client body.
- Test plan: unit tests for every guard branch, and an API test that the J8 sequence cannot approve Rev 1.
- M0 gate additions: a client test for each UI (`web/` and `src/ui/workflow.js`) asserts that the approve request body carries `reviewConfirmed: true` and `revisionFingerprint`. The guard flag 7b is switched on only after those tests pass on the live revision (see ARC-M8-05).

### ARC-M1-11 Replayed APPROVED job loses its approval status (P0)
- Goal: fix the failure in `test/job-draft-persistence.test.js:508`, "completed request replay retains the durable APPROVED lifecycle and audit". `createStoredJobReplayLoader` returns a job sheet whose `status` is `undefined` instead of `APPROVED`. A replayed request after approval must return the stored approved state and audit. Otherwise a retry can make an approved card look like a draft, which is saved work lost.
- AC: the test passes against the real `src/job-draft-persistence.js`, with its assertions unchanged. A new case covers a replay after approval that lands on a second instance, using the durable store from M1-05.
- Depends on: M1-01; tested again after M1-05. Owner: backend engineer.
- Test plan: run the test before the fix and record the failure output, fix the code, re-run the file and the full `npm test`. The QA lead confirms that no assertion changed.

### ARC-M1-12 Gemini request settings (P1)
- Goal: the Vertex client sends `systemInstruction`, a thinking setting and a configurable `functionCallingConfig` (it hard-codes mode `AUTO` today).
- AC: extraction, explanation and photo calls keep their outputs. The settings are versioned in `config/arc-models.json`. Prompts move to `prompts/` with a version recorded on each stored result.
- Depends on: M1-01, M1-15. Owner: AI engineer.
- Test plan: request-shape unit tests; one live smoke call per role on a tagged revision, counted against the budget.
- M0 gate additions: "keep their outputs" is tested with recorded model responses (fake client) asserting the same parsed fields and the same request body apart from the new settings, not by comparing live Gemini text.

### ARC-M1-13 Weather timeout test fails only in the full run (P1)
- Goal: find why the weather timeout test was cancelled in the full `npm test` run but passes when run on its own (`03-discovery-audit.md`, tests). Likely causes are a shared timer, a real network call or a leaked handle from an earlier file.
- AC: the test passes 10 full runs in a row, with no skip and no longer timeout used to hide the cause. The cause is written in the PR.
- Depends on: nothing. Owner: backend engineer; the QA lead verifies.
- Test plan: run on Node 22, as CI does (`.github/workflows/quality.yml`). The cancellation does not happen on Node 26.13.1 (M0 gate). First record a Node 22 run that reproduces it; if it cannot be reproduced in 10 full runs, record that and close the ticket as not reproducible. Then `for i in $(seq 10); do npm test; done` with the counts recorded, plus `node --test --test-concurrency=1` to separate an ordering cause from a timing cause.

### ARC-M1-14 Explicit Vertex `safetySettings` on every Gemini call (P0)
- Goal: `src/google-cloud/vertex-gemini-client.js` sends no `safetySettings` today, so every call runs on the platform defaults. Every request (extraction, explanation, photo, router, answer writer) sends explicit settings from `config/arc-models.json`, and the result records which settings version was used (RAI-5).
- AC: a request-shape test fails if any call is sent without `safetySettings`. A blocked response maps to a defined error code and a designed UI state, never to an empty answer. It also reads the Vertex AI per-minute request quota for `gemini-3.5-flash` and `gemini-3.5-flash-lite` in `asia-south1` (read-only `gcloud` quota describe or the console) and records it in `data/vertex-safety-reference.md`, before the founders sign F2 (ADR-0008).
- Merge condition (QA, ARC-M1-15): `safetySettings` and `toolConfig` with `ANY` and `allowedFunctionNames` are confirmed by the docs but NOT CONFIRMED live, because `countTokens` rejects both fields. This ticket does not merge until a `generateContent` smoke call on a tagged no-traffic revision returns 200 with these exact names, recorded in `data/vertex-safety-reference.md`.
- Depends on: M1-15. Owner: AI engineer; the responsible-AI reviewer checks.
- Test plan: unit tests on the request body and on blocked-response handling; one live call per role on a tagged revision.

### ARC-M1-15 Check safety category and field names against current Vertex AI docs (P0)
- Goal: before M1-14 is built, read the current Vertex AI reference for `generateContent` on `gemini-3.5-flash` and `gemini-3.5-flash-lite`. Record in `docs/arc/delivery/data/vertex-safety-reference.md` the exact harm category names, the threshold values, the `systemInstruction`, thinking and `toolConfig.functionCallingConfig` field names, and which settings these models support. Give the URL and the date read.
- AC: every name that M1-12 and M1-14 use appears in that record with its source. Anything the docs do not confirm is marked NOT CONFIRMED, and the code does not use it.
- Depends on: nothing. Owner: AI engineer; the verification auditor checks the record against the source.
- Test plan: one live smoke call on a tagged revision using the recorded names. A validation error means the record is wrong.

### ARC-M1-16 Stale m_* fixtures and acceptance tool (P1)
- Goal: `tools/validate-optimizer-acceptance.mjs` and the m_* fixtures and mocks move to the m2_* evidence (`data/stale-claims.md`).
- AC: the tool checks against the final PKBX0041 reference once Om signs it off (M0-04). Until then it checks only the m2 R² values.
- Depends on: M1-01, M0-04. Owner: data engineer.
- Test plan: run the tool and record its output in the PR.

### ARC-M1-17 Limit demo session issuance and protect the pitch reserve (P0)
- Goal: close M0 gate finding BL-SE-1. Anyone can mint demo sessions with `POST /api/auth/demo-session` (`index.mjs:563-567`), which gets around the per-session Gemini budget and, on 4 Dec, the pitch reserve. Session issuance is rate-limited per client IP (ARC-M1-09 key). The pitch reserve is usable only with a pitch claim: a Secret Manager value exchanged for a signed cookie claim. Session IDs no longer play any part in it (ADR-0004 as amended at the M0 gate).
- AC: 20 sessions minted from one IP cannot spend more than the day limit minus the reserve. Reserve units cannot be spent without the pitch claim. The pitch claim cannot be forged or replayed after it expires, and the secret is never logged.
- Depends on: M1-08, M1-09. Owner: backend engineer; the security reviewer checks.
- Test plan: unit tests for issuance limits and the claim, plus a scripted run against a tagged no-traffic revision.

### ARC-M1-18 Job card PDF wording: estimate and demo labels (P0)
- Goal: close M0 gate findings BL-RA-3 and SH-RA-S1. The PDF heading "Savings estimate (not observed)" (`src/job-sheet-pdf.js:169-170`) becomes "Model estimate: scrap reduction against the entered plan". The demo note says "Demo session, simulated" and "This approval came from a demo session. It is simulated." on every card approved through a demo session, whatever the job ID pattern (`src/job-sheet-pdf.js:262`, `src/hackathon-demo-auth.js:4`).
- AC: a PDF test fails if the PDF contains "Savings estimate" (spec AC1.22). It also fails if a demo-session approval's PDF lacks either "Demo session, simulated" or "This approval came from a demo session. It is simulated." (spec AC1.24), including a job ID that does not match `JOB-HACK-`. The PDF "Explanation" heading carries "Generated by Gemini" (spec AC1.23), and drops it when the checked attribution summary replaces the Gemini explanation; a test covers both cases. The copy editor checks the text.
- Depends on: M1-01. Owner: backend engineer.
- Test plan: PDF text extraction tests that fail before the change and pass after.
