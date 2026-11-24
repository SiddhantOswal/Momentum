# Work queue for outside agents

Order follows `00-plan.md` and the ticket files. P0 tickets first; P1 and P2 tickets wait until the P0 work of their milestone is merged. The release candidate is due 30 November 2026. The orchestrator updates this file after each merge; STATUS.md is the record. Procedure: `external/ORCHESTRATOR.md`. Defaults for open items: `external/decisions-and-defaults.md`.

State on 2026-11-24 (evening): `arc/main` passes `npm test` 1104 of 1104 and `npm run test:ui` 42 of 42 (as of the M6-01 merge). M0 and M1 gates closed (CONDITIONAL GO, `reviews/M0-review.md`, `reviews/M1-review.md`). Merged in M2 so far: M2-01, M2-02, M2-03, M2-04. The M2 gate runs after M2-08 (or at the end of M2-07 if M2-08 waits for a tagged revision).

## Step 0: M1 gate conditions still open (backend and AI builders, one small packet each)

- Before the budget flags go live: SEC-1 (key IPv6 on the /64 prefix; alert on the "unknown" bucket) and SEC-2 (`/api/status` shows only availability without a verified session; cache it).
- Before the M2 gate: SEC-3 (cache weather failures; share concurrent calls), SEC-4 (cap concurrent trace streams; scope `/api/live` and `/api/lots`), SEC-5 (maximum lengths on free-text fields), CR-3 to CR-6 (the shared transaction loop ARC-M1-25; the repeated Zod mapping; `demoMode` labelling inside a shared command; the lot-ID prefix constant), EV-2 (the `model-config` suite), EV-6 (owners for the T1, T2, T9, T12, T14 suites: assign in ARC-M2-07), RAI-3 (confirm the `/pdf` preview can never be shown as an approved card), a retention note for stored PO reviews (24 hours), a change record for the pitch secret, the TTL record read-back (13 policies ACTIVE on 2026-11-24).
- Records and wording: see `reviews/M1-review.md` (CE-5, CE-6 PDF wording; CE-7, CE-8, CE-10; QA-3).
- ARC-SETUP-02 (the quality-script follow-ups; edits to `scripts/quality/` ask the founders first).

## Lane 1: frontend (Codex, the founders' own sessions)

| Order | Ticket | State and notes |
|---|---|---|
| 1 | ARC-M6-01 tokens and theme | Merged (`60b7035`) |
| 2 | ARC-M6-02 Arc panel shell | Built (disconnected shell, 2 commits on `arc/ARC-M6-02-panel-shell`) on the old M6-01 commits: rebase onto `arc/main`, then a QA (a Tier B batch is acceptable: it has no backend). Then the typed client from `06-arc-wire-contract.md` |
| 3 | ARC-M6-08 reproducible `/app` build | Dockerfile builds `web/`; needs a clean-checkout build |
| 4 | ARC-M6-06 every dashboard page, in the five groups of the ticket | One builder per group in parallel worktrees; "not connected" states where the backend is missing |
| 5 | ARC-M6-03 J1 screens, ARC-M6-04 answer, refusal and no-data screens | Build against the contract and recorded events; wire to the real routes as M2 and M3 land |
| 6 | ARC-M6-18 missing states G1 to G17 | Needs founder approval of each drafted screenshot (D4); do not merge a state before |
| 7 | ARC-M6-19 design figures | After Om signs off the PKBX0041 reference |
| Later | M6-05, M6-07, M6-09, M6-10 to M6-17 | After the P0 pages; M6-10 to M6-13 need their backend tickets |

## Lane 2: backend and AI

| Order | Ticket | Depends on | State and notes |
|---|---|---|---|
| 1 to 4 | ARC-M2-01 routes and stores, M2-02 registry, M2-03 turn runner, M2-04 router and scope rules | | Merged |
| 5 | ARC-M2-05 answer writing and output checks | M2-03, M2-04 | Next. Carries: error table and user copy for `GEMINI_CALL_REPLAYED`, `BUDGET_TURN_EXHAUSTED` and `GEMINI_SAFETY_BLOCKED` (the safety-block wording needs one choice from the spec); refusal suggestions rebuilt from `config/arc-scope.json`; the typed job-card path (no writer); the writer wired into `index.mjs`; Hindi coverage needs a reviewer |
| 6 | ARC-M2-06 event stream and resume, plus the durable effect store | M2-01, M2-03, M1-07 | Amends `04` 3.4 and `05` 2 (restart rule); two tabs must not create a second run |
| 7 | ARC-M2-07 offline eval harness and `npm run eval:offline` | M2-02 | Can start now. Owns the T1, T2, T9, T12, T14 suites (EV-6) and the `model-config` suite (EV-2) |
| 8 | ARC-M3-01 J1 task-run plan | M2-05, M2-06, M1-10 | `read_order` and `set_conditions` need durable replay (M2-06) |
| 9 | ARC-M3-02 conditions with provenance | M1-10, Om | Blocked on Om for the weather fairness answer |
| 10 | ARC-M4-03 insufficient-data answers, ARC-M4-04 model trust and moisture | M4-01, M3-02 | M4-01 merged |
| 11 | ARC-M2-08 measure tokens, latency and attempts | M3-01 | Needs a tagged no-traffic revision (cloud) |
| 12 | M7 (offline suites, live eval run, PO injection, load test, security pass, measured savings), M8 (scripted deploy, demo-day scaling, runbook, acceptance script, release gate) | M2 to M6 | Cloud steps run by the orchestrator |

## Lane 3: data

| Ticket | Notes |
|---|---|
| ARC-M4-01 metric dictionary | Merged (`c68bc1d`). Live dry-runs NOT RUN, waiting for a founder yes |
| ARC-M1-21 stored model settings and explanation source | A nullable column on `job_sheets`: change record and founder approval first |
| ARC-M4-02 labelled views P3 to P5 | Cloud change; change record first |
| ARC-M4-06 answers with no owner (Q2, Q16, Q19) | P1 |
| ARC-M3-04 combinations count | P2 |
| ARC-M0-05 recover the lot generator | Blocked: `sid_pack.zip` location (default in `decisions-and-defaults.md`) |
| ARC-M1-16 stale m_* fixtures and acceptance tool | Copilot; R² checks only until Om signs off |

## Deferred until the P0 work of the milestone is merged

M1-13 (needs Node 22; default: skip), M1-23 to M1-28 (M1-28 is the live integration run in the ARC-M8-01 preflight), M2-09, M3-03, M3-05, M3-06, M4-05, M5-01 to M5-04, the M6 P1 and P2 tickets, M7-04.

## Phase B (after the finals)

M9 to M14, `tickets/M9-M14-production-readiness.md`. Not started.

## Cloud steps the orchestrator will request (one at a time, each with a change record)

The pitch secret (`arc-pitch-reserve-code`) and `GEMINI_BUDGET_LIMITS`; the `job_sheets` column (M1-21); the labelled views (M4-02); the ARC-M4-01 BigQuery dry-runs; the tagged no-traffic revision for the live integration run, the token and latency measurement and the Vertex smoke call; demo-day scaling and the billing budget (M8-02); the release candidate deploy with `--no-traffic` (M8-01).
