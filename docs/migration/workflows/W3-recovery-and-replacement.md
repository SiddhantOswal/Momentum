# W3 Stale or replaced draft and failure recovery

Units: U03,U11. Screens: NewLot-Stale, NewLot-Recovery, Arc-Lot-Replaced.

## Backend and services
GET /lots/:lotId; plan again; resume endpoint (planned)

## Persistence
lot_revisions with supersededReason

## AI operations
none new

## Authorization and approvals
Replaced revision has no Approve and no PDF

## Failure states
Defined in spec J11; undesigned notices G16

## Required verification
Edit conditions during planning then approve old draft must fail

## Cross-screen dependencies
See `pages/` for each unit. Discrepancies: grep `05-discrepancy-register.csv` for the unit's DR ids.
