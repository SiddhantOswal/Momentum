# Parked items

Work that is deliberately not done yet. Each item names the unit it came from, what is missing and what unblocks it. Add to this file instead of leaving notes in code. Remove an item only when it is done and its evidence is in `progress.json`.

## Live verification (needs a backend with Google Cloud access)

| Unit | Item | Needs |
|---|---|---|
| U03 | Run the six New Lot states against a real backend: `/orders/extract` for PO1 to PO5, `/conditions/current`, `/jobs`, `/lots/:lotId`, `PUT /lots/:lotId/conditions`, `/jobs/:id/approve`, `card.pdf` | Backend with Gemini, BigQuery and Firestore; lot guard on (DR-008) |
| U03 | Confirm the stale path: edit a condition after planning, reopen the old revision, check it is blocked | Same, plus the lot store flag |
| U03 | Force an explanation failure to see the Recovery state for real | A way to fail the explanation step on purpose |
| U04 | Plant Explorer against a lot in progress | DR-011, ticket ARC-M6-12 |
| U05 | Preparation Flow against a real planned lot from /api/lots and /api/live | Backend with the live store flag on (USTAAD_ENABLE_LIVE_STORE) |
| U07 | Photo Diagnosis against a real backend: load the ten approved photos, run `/evidence/classify-photo`, capture the loaded and result states in both themes | Backend with Gemini on Vertex AI and the approved-photo bucket |

Approving a draft writes production data. It needs the founders' approval and a written command, reason, cost and rollback (`CLAUDE.md` section 7).

## Missing backend routes or data (screens show the not-connected state today)

| Unit | Item | Decision |
|---|---|---|
| U03 | Constraints for this comparison | PD-21 |
| U03 | "How far to trust this" pass levels in the job response | PD-21 |
| U03 | Board, box style and size from the catalog | PD-20 |
| U03 | Retry the explanation alone | PD-21 |
| U03 | Approve the entered plan ("Keep entered plan") | PD-21 |
| U03 | "Card checked" status after approval | none yet |
| U03 | Paper type and supplier for PO2 to PO5 and uploads (only PO1 is known) | PD-20 |
| U03 | Client call to `/conditions/weather` (the server falls back to it today) | none yet |
| U05 | Held and partial states from stored data, and any lot that is not planned (approved, running, done, blocked) | DR-006, DR-037: durable step record, ticket ARC-M6-11 |
| U05 | Candidate count (the design's 8,640) from the backend; the API does not return it | none yet |
| U05 | Bell badge and "Prototype data, not live" chip in the shared shell | none yet |
| U05 | Shared toast component (New Lot and Preparation Flow each carry their own styles) | none yet |
| U06 | Where `GET /impact/summary` (September holdout impact, monthly cost, seasonal defects) appears; the design has no tile for it | PD-23, DR-004, DR-005 |
| U06 | "What moved the Warp estimate": attribution on the current m2_* models (`sql/explain.sql` was not run on them) | none yet |
| U06 | Software checks, Photo diagnosis and Approved job card tiles: a stored evidence record | DR-010 |
| U06 | Defect intelligence trend: lot history by month | DR-005, DR-009 (no live adapter for `/insights/summary`) |
| U06 | Delivery timeline, Throughput and Capacity: dispatch feed, production log, machine and workforce data | none yet |
| U06 | Crack low-confidence flag is hard-coded; it needs a rule from the model-acceptance record | PD-23 |
| U06 | Bell count in the shared shell (the design shows 1 on this screen) | same as U05 bell item |
| U07 | Approved photo images: the route returns ids and labels only; the stage shows the not-connected state | an image route for the ten photos, none yet |
| U07 | "7 of 10 labels matched": a stored evaluation run over the ten photos | ARC-M6-14 |
| U07 | "What it looked at" and "Suggested follow-up" after a run: `classify-photo` returns a label only | none yet |
| U07 | Upload diagnosis (`/evidence/diagnose-photo`) and past cases (`/evidence/seen-before`): no design for either | PD-04, DR-024 (G14) |
| U07 | "Other photo" advances to the next approved photo; confirm that is the intended meaning | none yet |

## Open decisions that touch built screens

PD-04, PD-12, PD-20, PD-21, PD-22, PD-23 in `11-product-decisions.md`.

## Not tested

- Light theme at 1440x900 for Conditions and Recovery was captured but not viewed.
- Screens at 1280x800 and 1024x768 were only partly viewed (see CHK-U03-VISUAL).
- U07 at 1024x768 and the mobile sizes were rendered but not viewed; its loaded and result states were not captured.
- The primary MacBook viewport is still pending (execution contract, viewport matrix).
- U05: Prep-Flow light at 1440x900 and Prep-Flow-Partial dark after the last spacing fix were captured but not viewed (see CHK-U05-VISUAL).
- U05: 768x1024 and 390x844 were not captured.
- U06: Light theme at 1440x900 and dark at 1280x800 were captured but not viewed (see CHK-U06-VISUAL); 1024x768 was checked only for overflow by the browser spec, not by eye.
- U06: No mutation check on the Insights specs.
- U08: 1024x768 was checked only for overflow by the browser spec, not by eye; 768x1024 and 390x844 were not captured.
- U08: The explorer's seven non-default detail panels were checked by the browser spec for title and row labels, not by eye.
- U08: No mutation check on the Planning spec.
