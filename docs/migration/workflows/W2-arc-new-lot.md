# W2 Same journey through Arc

Units: U10,U11. Screens: Arc-Start, Arc-Lot-*.

## Backend and services
POST /api/arc/turns (stream) using tools read_order, set_conditions, plan_lot, get_job_card; approve stays a human UI action

## Persistence
arc_sessions, arc_task_runs, event store; replay guard

## AI operations
Router (flash-lite), writer; at most 3 Gemini attempts per typed turn; chips 0

## Authorization and approvals
Arc cannot approve; "approve it for me" gets a short refusal (design gap G11)

## Failure states
Depends on M2-05, M2-06, M3-01 (not built). Reconnect via Last-Event-ID (planned)

## Required verification
Offline eval suite; J1 run with recorded model responses; budget counters; same outcome as W1 for same inputs

## Cross-screen dependencies
See `pages/` for each unit. Discrepancies: grep `05-discrepancy-register.csv` for the unit's DR ids.
