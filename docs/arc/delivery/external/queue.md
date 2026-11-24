# Work queue for outside agents

Order follows `00-plan.md` and the ticket files. P0 tickets first; P1 and P2 tickets wait until the P0 work of their milestone is merged. The release candidate is due 30 November 2026. The orchestrator updates this file after each merge. A ticket moves from "Ready" to "Building" to "In QA" to "Merged" in STATUS, not here.

Status on 2026-11-24, `arc/main` at 1a802e8 or later: M0 closed (GO). M1 merged except the items below. M1 gate: eight reviews, six reported CONDITIONAL GO, two (QA, verification audit) interrupted by the usage limit and to be re-run.

## Step 0: finish the M1 gate (orchestrator)

Re-run the QA and verification-audit reviews, collect `reviews/M1-review.md`, then dispatch the repair packet for the conditions (backend and AI builders): in-memory idempotency store reachable outside demo mode (CR-1), stale idempotency comment (CR-2), STATUS and ticket records out of date (CE-1, CE-2, CE-9), PDF wording (CE-5, CE-6), `/api/status` exposure and IPv6 /64 keying before the budget flags go live (SEC-1, SEC-2), weather failure caching, stream caps and free-text maximum lengths before the M2 gate (SEC-3 to SEC-5), the PO retention note, the TTL change record read-back, a change record for the pitch secret (ARC-M1-17), an owner and ticket for the unassigned eval thresholds (EV-6) and the `model-config` suite (EV-2).

## Lane 1: frontend (Codex, running now)

| Order | Ticket | State and notes |
|---|---|---|
| 1 | ARC-M6-01 tokens and theme | Merged (`60b7035`) |
| 2 | ARC-M6-02 Arc panel shell | Disconnected shell now; typed client after the wire contract (`06-arc-wire-contract.md`) |
| 3 | ARC-M6-08 reproducible `/app` build | Dockerfile builds `web/`; needs a clean-checkout build |
| 4 | ARC-M6-06 every dashboard page, in the five groups of the ticket | One builder per group, in parallel worktrees; "not connected" states where the backend is missing |
| 5 | ARC-M6-03 J1 screens, ARC-M6-04 answer screens | Build against the contract and recorded events; wire to the real routes as M2 and M3 land |
| 6 | ARC-M6-18 missing states G1 to G17 | Needs a founder approval of each drafted screenshot (D4) |
| 7 | ARC-M6-19 design figures | After Om signs off the PKBX0041 reference (ARC-M0-04) |
| Later (P1 and P2) | M6-05, M6-07, M6-09, M6-10 to M6-17 | After the P0 pages; M6-10 to M6-13 need their backend tickets |

## Lane 2: backend and AI

| Order | Ticket | Depends on | Notes |
|---|---|---|---|
| 1 | ARC-M2-01 Arc routes and stores | M1-02, M1-05, wire contract | Merged (`21de95f`) |
| 2 | ARC-M2-02 tool registry | M2-01, M1-01 | Merged (`53e2f6b`) |
| 3 | ARC-M2-03 turn runner | M2-02, M1-08 | Merged (`bcbf47c`) |
| 4 | ARC-M2-04 router and scope rules, ARC-M2-05 answer rendering and checks | M2-03 | Router sees only enums, numbers and IDs, no free text |
| 5 | ARC-M2-06 event stream and resume | M2-01, M2-03, M1-07 | Two tabs reconnecting must not start a second run |
| 6 | ARC-M2-07 offline eval harness and `npm run eval:offline` | M2-02 | Needs an owner for T1, T2, T9, T12, T14 suites |
| 7 | ARC-M3-01 J1 task-run plan | M2-02, M2-03, M1-10 | Parity with the dashboard route for PO1 to PO5 |
| 8 | ARC-M3-02 conditions with provenance | M1-10, Om (ARC-M0-04) | Blocked on Om for the weather fairness answer |
| 9 | ARC-M4-01 `query_metric`, ARC-M4-03 insufficient data, ARC-M4-04 model trust and moisture | M2-02, M3-02, Q11 | Data engineer and AI engineer |
| 10 | ARC-M2-08 measure tokens, latency and attempts | M3-01 | Needs a tagged no-traffic revision |
| 11 | M7 (offline suites, live eval run, PO injection, load test, security pass, measured savings), M8 (scripted deploy, demo-day scaling, runbook, acceptance script, release gate) | M2 to M6 | M7-02 and M8 involve cloud changes run by the orchestrator |

## Lane 3: data

| Ticket | Notes |
|---|---|
| ARC-M1-21 stored model settings and explanation source | A new nullable column on `job_sheets`: needs a change record and founder approval before the cloud change |
| ARC-M4-02 labelled views P3 to P5 | Cloud change; change record first |
| ARC-M3-04 combinations count from the optimizer | P2 |
| ARC-M0-05 recover the lot generator | Blocked: `sid_pack.zip` location (founders) |
| ARC-M1-16 stale m_* fixtures and acceptance tool | GitHub Copilot, R² checks only until Om signs off |

## Deferred until the P0 work of the milestone is merged

M1-13 (needs Node 22), ARC-SETUP-02 (asks the founders before editing `scripts/quality/`; a condition of the M1 gate, so it is scheduled with the gate repairs), M1-23 to M1-27, M3-03, M3-05, M3-06, M4-05, M5-01 to M5-04, M6 P1 and P2 tickets, M7-04.

## Phase B (after the finals)

M9 to M14, `tickets/M9-M14-production-readiness.md`. Not started.

## Cloud steps the orchestrator will request

Each needs a change record with command, reason, cost and rollback, then a founder yes: the pitch secret (`arc-pitch-reserve-code`) and `GEMINI_BUDGET_LIMITS`, the `job_sheets` column (M1-21), the labelled views (M4-02), demo-day scaling and the billing budget (M8-02), and the deploy of the release candidate with `--no-traffic` (M8-01).
