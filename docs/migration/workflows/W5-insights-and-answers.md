# W5 Insights tiles and Arc data answers

Units: U06,U12. Screens: Insights, Arc-Answer-*, Arc-No-Data, Arc-Out-Of-Scope.

## Backend and services
GET /impact/summary; query_metric (4 metrics); /api/status modelAcceptance

## Persistence
BigQuery read-only SQL, 50 MiB cap

## AI operations
Writer composes from tool results only; refusal rules deterministic

## Authorization and approvals
Questions outside Momentum are refused with in-scope suggestions

## Failure states
Insufficient-data answers name what is missing (Q17 has no source)

## Required verification
Every number has source label; dry-runs NOT RUN; no figure without provenance

## Cross-screen dependencies
See `pages/` for each unit. Discrepancies: grep `05-discrepancy-register.csv` for the unit's DR ids.
