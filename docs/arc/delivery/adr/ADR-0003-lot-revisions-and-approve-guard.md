# ADR-0003: Lot revisions and the approve guard

Status: Proposed
Date: 2026-11-23
Author role: solutions architect
Branch: `arc/m0-discovery`
Design: `04-technical-design.md` sections 1.5, 2.7 and 4

## Context

- The designs rely on Rev 1, Rev 2 and a replaced revision (`Arc-Lot-Replaced.png`, `NewLot-Stale.png`). The backend has no revision record (spec C8).
- `POST /jobs/:id/approve` takes only the job ID (`index.mjs:1228`). Any DRAFT in the demo session can be approved, including one made out of date by an input change (C16). The checkbox exists only in the React client (`Lots.tsx`); the old dashboard has none (C9, Q9).
- "Next for you", J3 ("what is the moisture today") and conditions in progress have nowhere to live before `POST /jobs` (C17, data audit P2).
- Arc must not be able to approve (CLAUDE.md section 4; O4). Approval stays a demo-session approval labelled simulated.
- V5 asks for approval bound to an exact revision and for superseded cards to stay non-approvable. The founder brief keeps the checkbox plus Approve inside Arc and a demo session as identity. This ADR follows the brief.

## Decision

1. **Records.** `lot_heads/{lotId}` holds the lot in progress: owner session, review, order reference, draft conditions with provenance, current revision and job, and stage. `lot_revisions/{jobId}` holds one planned draft: number, status (`PENDING`, `CURRENT`, `SUPERSEDED`, `APPROVING`, `APPROVED`, `FAILED`), request fingerprint, revision fingerprint, frozen conditions, `supersededBy` and `supersededReason`. Lot IDs are `LOT-HACK-<sessionId>-<12 hex>`, scoped like demo job IDs.
2. **Writes.** `POST /jobs` (optional `lotId`) registers a PENDING revision before planning and makes it CURRENT after the DRAFT read-back, superseding the previous CURRENT one in the same transaction. NEW `PUT /lots/:lotId/conditions` saves conditions; if they differ from the CURRENT revision's frozen conditions, it marks that revision SUPERSEDED with the field, old and new values, source and session role. Both routes and Arc call the same command functions.
3. **Revision fingerprint.** SHA-256 of the canonical job ID, lot ID, revision number, request fingerprint, frozen conditions, baseline, recommended, changes and explanation, taken from the stored DRAFT. Returned in `POST /jobs` and `GET /jobs/:id`.
4. **Approve request.** Body `{ reviewConfirmed: true, revisionFingerprint }` (strict zod). The guard returns 400 `REVIEW_CONFIRMATION_REQUIRED`, or 409 with one of `REVISION_NOT_REGISTERED`, `REVISION_SUPERSEDED` (with the current revision), `REVISION_FINGERPRINT_MISMATCH` or `APPROVAL_IN_PROGRESS`. If the revision passes, it moves to `APPROVING` with a 130 s lease. Then the unchanged `approveJob` runs, and the revision becomes `APPROVED`, or returns to `CURRENT` on failure. BigQuery is the record when reconciling after a crash. A conditions edit cannot supersede an `APPROVING` revision.
5. **No model route.** Arc tools are in-process adapters under `src/arc/tools/`. None imports the approve command or `servicePorts.approveJob`, and tools have no generic HTTP. Tests enforce both, plus the tool-list check in AC1.5. The client renders the approval card from structured data; the button handler is the only caller.
6. **Rollout.** `USTAAD_ENABLE_LOT_REVISIONS` turns on writes, the `revision` block and the client body. `USTAAD_ENFORCE_APPROVE_GUARD` turns on rejection, only after both clients send the body. The old dashboard needs the checkbox first, so this waits on Q9.

## Consequences

- AC8.1 is testable at the API: a direct approve call for a replaced revision is rejected, and a disabled button is no longer the only control.
- `reviewConfirmed` is a client assertion, not proof that a person ticked a box. The protection against the model is structural: no tool, no import, no HTTP route from tools. Docs and the pitch must not describe the flag as proof of human review.
- Drafts created before the flag have no revision. With the guard on they return `REVISION_NOT_REGISTERED`. All 13 stored rows are TEST- records; 4 are DRAFT (founder decision F5).
- "Next for you", J3 and J8 read one lot head and at most a few revisions by key. No Firestore query or composite index is needed.
- **Failure modes:** Firestore down blocks approval (fail closed) while BigQuery and Storage are unaffected. A crash during `APPROVING` leaves an expired lease, which the next approve or read reconciles from BigQuery. Two tabs approving at once: one gets `APPROVAL_IN_PROGRESS`, then the idempotent approved result.
- **Cost:** about 4 extra Firestore writes per plan and 2 per approval; inside the free tier.
- **Rollback:** switch off `USTAAD_ENFORCE_APPROVE_GUARD` (approve behaves as today), then `USTAAD_ENABLE_LOT_REVISIONS`. Clients that send the body keep working, because today's route ignores the body.

## Alternatives rejected

1. **Revision columns on BigQuery `job_sheets`.** Rejected. Superseding needs an atomic read-and-update of two rows, which BigQuery DML cannot do under concurrency. It would also mean altering an existing table, which CLAUDE.md section 6 rules out.
2. **Client-only guard (disable the button).** Rejected. It fails AC8.1 and O4, because any direct call approves.
3. **Hide superseded drafts by deleting or overwriting them.** Rejected. It loses history ("Keep Rev 1 as history") and alters stored records.
4. **Model-visible approve tool that requires a confirmation token.** Rejected. It puts a path to approval inside the model's tool list, which is the exact bypass the evals test for. The brief keeps approval as a direct user action.
5. **Separate approval-request records with expiry (V5 review request).** Deferred, not rejected. Without named identities, a request record adds no control over a revision status plus fingerprint. Revisit with Google sign-in.
