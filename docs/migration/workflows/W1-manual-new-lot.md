# W1 Purchase order to approved job card (manual route)

Units: U03. Screens: NewLot-*.

## Backend and services
POST /orders/extract -> GET /conditions/current|weather -> PUT /lots/:lotId/conditions -> POST /jobs (Idempotency-Key) -> GET /jobs/:id -> POST /jobs/:id/approve {reviewConfirmed, revisionFingerprint} -> GET /jobs/:id/card.pdf

## Persistence
PO review (in-memory unless durable flag), lot_heads/lot_revisions and idempotency in Firestore behind flags, job card in BigQuery/Storage

## AI operations
Gemini: PO read, explanation (budgeted, capped daily). Deterministic: constraints, optimizer, cost

## Authorization and approvals
Human tick plus Approve; server guard 409 REVISION_SUPERSEDED when flag on; demo-session approval labelled simulated

## Failure states
Gemini failure, daily cap reached, BigQuery timeout, instance restart (stale review), superseded revision (NewLot-Recovery, NewLot-Stale; G1-G3 undesigned variants)

## Required verification
Playwright J1 on test revision; stale-draft test; approve impossible without checkbox; fingerprint mismatch gives 409

## Cross-screen dependencies
See `pages/` for each unit. Discrepancies: grep `05-discrepancy-register.csv` for the unit's DR ids.
