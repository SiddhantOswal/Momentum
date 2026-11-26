# Parked items

Work that is deliberately not done yet. Each item names the unit it came from, what is missing and what unblocks it. Add to this file instead of leaving notes in code. Remove an item only when it is done and its evidence is in `progress.json`.

## Live verification (needs a backend with Google Cloud access)

| Unit | Item | Needs |
|---|---|---|
| U03 | Run the six New Lot states against a real backend: `/orders/extract` for PO1 to PO5, `/conditions/current`, `/jobs`, `/lots/:lotId`, `PUT /lots/:lotId/conditions`, `/jobs/:id/approve`, `card.pdf` | Backend with Gemini, BigQuery and Firestore; lot guard on (DR-008) |
| U03 | Confirm the stale path: edit a condition after planning, reopen the old revision, check it is blocked | Same, plus the lot store flag |
| U03 | Force an explanation failure to see the Recovery state for real | A way to fail the explanation step on purpose |
| U04 | Plant Explorer against a lot in progress | DR-011, ticket ARC-M6-12 |

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

## Open decisions that touch built screens

PD-04, PD-12, PD-20, PD-21, PD-22 in `11-product-decisions.md`.

## Not tested

- Light theme at 1440x900 for Conditions and Recovery was captured but not viewed.
- Screens at 1280x800 and 1024x768 were only partly viewed (see CHK-U03-VISUAL).
- The primary MacBook viewport is still pending (execution contract, viewport matrix).
