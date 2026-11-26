# 08 Implementation plan

## 0. Reality check (read first)
- Today is 2026-11-26. The finals release candidate is 2026-11-30 and the pitch is 2026-12-04 (`00-plan.md`, `CLAUDE.md`). That is four days to the RC.
- Fourteen units, 30 screens in two themes, plus Arc typed answers (M2-05), the event stream (M2-06) and the J1 task-run plan (M3-01) are not done. Lane 1 sessions already own part of this. Do not plan to finish everything. The plan below orders work so that a demo-complete subset exists at every checkpoint.
- Biggest schedule risk is not coding. It is (a) duplicate or colliding work with Lane 1 (DR-023), (b) design gaps G1 to G17 that engineers may not invent (DR-024), (c) Om's sign-off on figures (DR-019), (d) nothing has run live (Firestore, Vertex, BigQuery).

## 1. Priorities
- **P0** competition-critical: U01 shell and tokens/nav; U03 New Lot manual J1 (order, conditions, settings, approve, stale, recovery) wired to real routes; U11 Arc J1 once M2-05, M2-06 and M3-01 land; ARC-M6-08 build; flags on with live checks (ARC-M8-05); figures refresh (M6-19). Without these there is no demonstrable product.
- **P1** completeness: U02 Home, U06 Insights (honest tiles), U07 Photo Diagnosis, U10 start/refusal/no-data, U12 answers, U13 defect, U05 Prep Flow, U04 Plant Explorer.
- **P2**: U08 Planning (static), U09 and U14 phone views (no backend), G-gap states beyond the J1 failure set.

## 2. Sequence (maps to the requested stages A to S)
| Stage | Work | Units / tickets | Gate to proceed |
|---|---|---|---|
| A-C | Approve strategy (PD-01, PD-02, PD-08), revalidate, create worktree | OP-00 | founders' written go |
| D-E | Baseline branch and verification | 02b 4b | baseline numbers recorded |
| F | Tokens and theme: already merged (M6-01). Verify against design; add missing components | U01 part 1 | tokens match; theme toggle both modes |
| G | Shell to design, provenance chip, stepper, cards, not-connected state, build in Dockerfile | U01, ARC-M6-08 | `/app` serves from clean build; sidebar 232px, 7 items |
| H | Pilot screens: U02 Home and U03 NewLot-Order | | compare with PNG in both themes at 1440x900 and 1280x800; measure token cost per screen here before projecting |
| I | Pilot fidelity review by the owner | | owner sign-off on pilot |
| J | U03 rest, U07, U06, U05, U04 | | per-unit acceptance |
| K | Reconcile coverage: every design screen has a route/state or a recorded gap | `03` vs `progress.json` | 30 of 30 accounted |
| L | Wire workflows by journey, not by screen: W1, W2, W3, W4, W5 | `workflows/` | each workflow test passes |
| M | Approved missing backend only: receipts endpoint (if PD-07 yes), stage record, insights adapter | DR-006/007/009 | contract amendment first |
| N | AI and cloud: M2-05, M2-06, M3-01, M4 data answers, live runs | | evals T-series; live smoke |
| O | Resolve register items by severity | `05` | no critical or high without a decision |
| P | Security fixes SEC-1..5, evals, red team | M7 | reviewer GO |
| Q | Full regression incl. browser suite, a11y, visual matrix | `10` | all gates |
| R | Staging deploy with flags | M8 | release gate GO |
| S | Independent release review, rehearsal script, fallback demo path | | founders' go |

## 3. Implementation units (scope, deps and acceptance live in `pages/Uxx.md`)
U01 shell, tokens, chips, build (P0) · U02 Home (P1) · U03 New Lot, 6 states (P0) · U04 Plant Explorer (P1) · U05 Prep Flow, 3 states (P1) · U06 Insights (P1) · U07 Photo Diagnosis (P1) · U08 Planning (P2) · U09 Operator phone (P2) · U10 Arc start, refusal, no-data (P1) · U11 Arc new-lot journey (P0) · U12 Arc answers (P1) · U13 Arc defect (P1) · U14 Arc phone (P2).
Parallelism rule: U01 first and alone; then at most one session per unit and never two sessions on `Shell.tsx`, `App.tsx`, `useApp.ts`, `index.css`, `api.ts`, `index.mjs`, `package.json`.

## 4. Model and token strategy
- Default: Sonnet for unit work (one unit per session, reading `00`, the unit page and listed code only). A stronger model only for: lot revision and approve-guard integration, Arc turn runner and tool wiring, security fixes, merge-conflict resolution in contract files, eval design.
- Start a new session per unit. Keep tightly coupled units (U03 + U11 contract) together only when the same contract is being changed.
- Do not paste the PNGs repeatedly; read the HTML for measurements and open one PNG per state.
- Measure real token use on the pilot (stage H) before projecting totals. No saving percentage is promised.
- Suggested persistent files: root `CLAUDE.md` already exists (89 lines) and is binding; add a short pointer to `docs/migration/00-execution-contract.md` only if PD-02 approves editing it. Reusable skill candidates: `design-compare` (open PNG + screenshot, list differences), `contract-diff`, `unit-handoff`.

## 5. Competition-critical dependencies and fragile points
Gemini daily cap shared by two services (300 and 100); Vertex quotas; BigQuery dry-run approvals; Firestore flags untested live; pitch reserve secret not created; PKBX0041 figures awaiting Om; no named-supervisor flow (labelled simulated); mic is disabled. Do not demo anything that depends on an unverified live path without a recorded fallback.
