# W6 Card on the operator phone

Units: U09,U14. Screens: Operator-Phone, Arc-Phone.

## Backend and services
GET /jobs/:id; receipts and mismatch endpoints MISSING

## Persistence
none exists

## AI operations
none

## Authorization and approvals
Opens the exact approved revision; replaced card cannot be acknowledged (design)

## Failure states
Backend absent: show not-connected

## Required verification
Contract and ADR first (PD-07)

## Cross-screen dependencies
See `pages/` for each unit. Discrepancies: grep `05-discrepancy-register.csv` for the unit's DR ids.
