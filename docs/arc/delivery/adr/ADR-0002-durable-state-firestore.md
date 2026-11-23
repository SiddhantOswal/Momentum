# ADR-0002: Durable state in Firestore for reviews, idempotency, traces, sessions and task runs

Status: Proposed
Date: 2026-11-23 (amended the same day for the M0 gate, round 1)
Author role: solutions architect
Original branch: `arc/m0-discovery` (now on `arc/main`)
Design: `04-technical-design.md` sections 2 and 3

## Context

- PO reviews (`src/purchase-order-review.js:45`), `/jobs` idempotency (`index.mjs:120-122`, `InMemoryIdempotencyStore`), run traces (`src/trace-registry.js:77`) and trace ownership (`index.mjs:84`) live in process memory (audit M1 to M4). `momentum` runs more than one instance; session affinity is best-effort. A review lost to another instance blocks `/jobs` and costs another Gemini attempt to re-read.
- A Firestore idempotency adapter with set-if-absent claims and tests exists (`src/google-cloud/firestore-idempotency-store.js`) but was never wired, and `/api/status` hard-codes `durableIdempotencyConfigured: false`.
- With a 30 s lease and a `/jobs` request that can run up to 60 s, a retry can re-claim while the first owner is still running, and two concurrent BigQuery MERGEs can both insert. Later reads then fail with `JOB_SHEET_NOT_UNIQUE` (`job-sheet-repository.js:135-137`).
- The request fingerprint in `createJobRequestIdentity` ignores conditions (design E6), so a moisture-only change replays the earlier job when no key is sent.
- Arc adds multi-step task runs that must continue after an instance restart, on any instance. Cloud Run throttles CPU outside requests, so there is no background worker.
- Firestore `(default)` (Native, asia-south1) already holds the Gemini counter and the live feed, and the runtime account has `roles/datastore.user` (audit R4). No TTL policies exist (design E4).

## Decision

1. Keep all live workflow state in Firestore `(default)`, collections `po_reviews`, `idempotency`, `traces` (with a `trace_events` subcollection), `arc_sessions` (with a `turns` subcollection), `arc_task_runs`, plus `lot_heads` and `lot_revisions` (ADR-0003), `budget_counters` and `budget_reservations` (ADR-0004), and `weather_observations` and `weather_cache` (ADR-0005). Schemas are in design section 2, and the interface decisions in design 3.0. BigQuery `job_sheets` stays the record of DRAFT and APPROVED JobSheet records.
2. Use the Firestore REST API with workload identity, as the two existing adapters do. Extract their shared code into `src/google-cloud/firestore-rest.js`. No new npm package.
3. Wire `firestore-idempotency-store.js` for `/jobs` behind `USTAAD_ENABLE_FIRESTORE_IDEMPOTENCY`, collection `idempotency`, lease 130 s, with an owner fencing check before the BigQuery write. Add `scope` and the base fields (`schemaVersion`, `createdAt`, `updatedAt`, `expiresAt`) to its records.
4. Fix the request fingerprint to include run date, the three condition values, their provenance and `lotId`, under a new `ustaad-jobs:v2:` prefix.
5. Rules: external calls never run inside a transaction; transactions record intent and outcome only. Every effect carries an idempotency key; every Arc write tool, and every tool step that spends a Gemini attempt, uses the derived key `arc1.<taskRunId>.<stepId>.<attempt>.<argsHash16>` (design 3.3), so a resumed step replays. Versioned documents use update-time preconditions. With a durable flag on, Firestore errors fail closed.
6. Expiry: each document has `expiresAt` for a TTL policy, and code also checks a logical expiry field. TTLs (full table in design 2.0): reviews 24 h (logical 30 min), idempotency 7 days, traces and task runs 30 days, sessions 7 days after cookie expiry, turns 7 days.
7. **Turns and transcript.** One record per turn, `arc_sessions/{sessionId}/turns/{clientTurnId}`, is the turn's idempotency claim, its transcript entry and its summary. It holds the typed text, the shown answer text and the summary, and never tool results, prompts, PO text or order-derived strings (design 2.5a). The session ID comes only from the signed cookie.
8. Task runs advance only inside requests. Steps hold 130 s leases. `POST /api/arc/runs/:taskRunId/resume` (also called on Arc open) resets expired RUNNING steps and replays them with the same key.
9. Migration order and flags follow design 3.5. Each flag off restores today's behaviour.

## Consequences

- Reviews, claims, traces and Arc runs survive restarts and work across instances (AC1.21). Session affinity is no longer needed for correctness.
- `JOB_SHEET_NOT_UNIQUE` can now occur only if a BigQuery job outlives a cancelled request by more than 130 s. The release preflight runs a read-only duplicate check. Existing duplicates are reported, never deleted.
- A retry after a crash mid-plan re-runs the coordinator and spends one more explanation attempt. This is today's behaviour; the budget counts it.
- Firestore becomes a hard dependency for planning and Arc. If it is down, those paths return `SERVICE_UNAVAILABLE`, and read paths that do not use it keep working.
- PO extraction results (synthetic fixtures today) are now stored for up to 24 h. When real POs are accepted, this needs a privacy review.
- Typed Arc messages are stored for 7 days so the transcript survives a reload. A user can paste order text into the message box; the transcript retention ticket (SH-SE-3) decides whether typed text is cleared when the session ends.
- Point-in-time recovery and delete protection stay off. Losing these documents loses work in progress, not records: approved JobSheet records are in BigQuery and job card PDFs in Storage. Turning PITR on is a separate change with its own cost.
- **Cost:** at the demo load in design 5.7 (about 5,000 writes and 3,000 reads a day), Firestore stays inside the daily free tier, so about ₹0. Each Gemini attempt adds about 6 writes for budget counters.
- **Quotas:** Firestore's guidance of about one sustained write per second per document is far above demo load. The busiest document is the day budget counter.
- **Rollback:** switch the flag off on a new revision, or move traffic back to the previous revision. Documents left behind expire by TTL. TTL policies can be disabled per collection group.

## Alternatives rejected

1. **Keep memory plus session affinity, or run one instance.** Rejected. Affinity is best-effort, and a restart or new revision still drops everything. One instance is the saturation seen on 20 November (64 platform 429s at max 2, design E1).
2. **BigQuery for claims and reviews.** Rejected. BigQuery has no row locking or unique keys: concurrent MERGEs can both insert, which is the bug being fixed. DML latency of seconds per statement would also sit on every Arc step.
3. **Memorystore (Redis).** Rejected. It needs a new paid service, a VPC connector and an ADR for each, at about ₹3,000 or more a month for the smallest instance. Firestore already gives transactions and TTL at about ₹0 for this load.
4. **firebase-admin SDK transactions.** Rejected for these stores. The SDK is already a dependency (`live-store.js`), but its transaction callback can rerun, which makes "no external calls inside" easier to break by accident. The REST pattern is already tested in two adapters. This can be revisited after the pitch.
5. **Cloud SQL (Postgres).** Rejected for the reasons in ADR-0001, row 15: a new service, no gain over Firestore for key-value workflow state.
