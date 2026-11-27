# 00. Arc by Momentum: delivery plan

Status: APPROVED by the founders on 2026-11-23 (Phases A and B). Written 2026-11-23 by the delivery lead from the M0 records below. Revised 2026-11-23 for the founder decisions on the reference lot, the setup safeguards and the production phase. Branch `arc/m0-discovery` (code identical to `origin/v2` at `eb6eab9`). Finals 3 to 5 December 2026, pitch 4 December. Release candidate (RC) due 30 November.

No application code, data or cloud resource has been changed for this plan. The only repository changes are the setup safeguards in section 0. No eval suite exists yet, so every eval result is NOT RUN, and every target below is a proposal until it is measured.

## 0. Scope of this plan

The plan has two phases, and every milestone in both ends with the review gate in section 5.5.

| Phase | Milestones | Ends with | Date |
|---|---|---|---|
| A. Finals | M0 to M8 | The finals release candidate: Arc and every approved page, labelled demo-session approvals, synthetic POs only | RC 30 Nov; pitch 4 Dec |
| B. Production readiness | M9 to M14 | The production-ready definition in section 9: named users, real POs, separate environments, CI/CD, security and privacy, SLOs, backups, cost limits, measured results from a plant pilot | Proposed 8 Dec to 6 Mar 2027 |

**Setup safeguards (ARC-SETUP-01, built on branch `arc/setup`; review gate in `reviews/SETUP-review.md`).**
- The commit-message check now covers only commits that are not in `origin/v2`, counted from the merge-base. Om's history is never flagged or rewritten.
- `.claude/settings.json` now denies the common ways of skipping the hooks (`git commit -n`, `git -c core.hooksPath`, `git config core.hooksPath`). Some bypasses remain (combined short flags, abbreviated `--no-verify`, `git config --unset`), so CI, which re-checks every commit not in `origin/v2`, is the real gate.
- `docs/Momentum_UI_Source.zip` is deleted. Its extracted contents matched `docs/arc/design/source/` by `diff -rq` before deletion and by a SHA-256 list of all 126 files after it (`changes/2026-11-23-ui-zip-deletion.md`).

**Founder decisions on the reference lot (2026-11-23).**
- Keep PKBX0041 and use the m2 re-run figures, labelled as a model estimate. Do not search for a bigger number.
- The ambient temperature is provisional, pending Om. The founders asked for about 19 °C (December to February). The modeled winter median is 18.35 °C (364 lots at 7.0 to 7.6% moisture), so the run used 18.5 °C with 42.0% RH (median 43.15%). Result: 62.9 to 55.1 kg, a reduction of 7.8 kg and ₹421, with roll 162 to 170 °C, gum HIGH to MED and viscosity 32 to 45 s. All five risks fall. Job `arc_pkbx0041_m2_t19_rh420_t185_20261122T212952Z`. Label: model estimate on the m2_* models, not a measured saving. The figures are in `data/PKBX0041-m2-rerun.md`, marked "awaiting Om sign-off".
- The README, `DEMO_LOT` and the design files are not edited until the figures are final. ARC-M6-09 and ARC-M6-19 cover those edits.
- The RAI thresholds in section 5.3 were signed off by the founders with the plan on 2026-11-23 (A5).

## 1. M0 records

| Record | Role | State |
|---|---|---|
| `01-business-requirements.md` | Business analyst | Approved with the plan, 2026-11-23; reviewed at the M0 gate |
| `02-product-spec.md` (journeys J1 to J11, contradictions C1 to C20, design gaps G1 to G17) | Product manager | Approved with the plan, 2026-11-23; latency targets PROPOSED |
| `03-discovery-audit.md` (v2 map, capability inventory, in-memory state) | Solutions architect | Reviewed at the M0 gate |
| `data/data-audit.md`, `data/stale-claims.md`, `data/PKBX0041-m2-rerun.md` | Data engineer | Reviewed at the M0 gate; PKBX0041 reference awaiting Om |
| `04-technical-design.md`, ADR-0002 to ADR-0006 | Solutions architect | `04` approved with the plan, 2026-11-23. The ADRs are approved in direction but stay Proposed until their ticket ships, then become Accepted |
| `05-ai-design.md`, ADR-0007 to ADR-0011 | AI architect | `05` approved with the plan, 2026-11-23. The ADRs are approved in direction but stay Proposed until their ticket ships, then become Accepted |
| ADR-0001 (build on v2; audit of the Codex repo) | Solutions architect | Approved in direction with the plan, 2026-11-23; stays Proposed until M1 builds on it |
| `responsible-ai.md` | AI architect | In force; thresholds T1 to T14 signed (A5), with T2, T3, T8 and T10 wording awaiting founder confirmation |
| `tickets/` (M0 to M14) | Tech lead | Approved with the plan, 2026-11-23 |

The design source in `docs/arc/design/source/` is byte-identical to `docs/Momentum_UI_Source.zip` (all files diffed on 2026-11-22). Every audit used it.

## 2. What the audit found

**Base.** v2 is Node 20 with Hono (`index.mjs`, `src/`), BigQuery ML (`sql/`, `prepagent.m2_*`), Firestore, Cloud Storage and Vertex AI `gemini-3.5-flash` in `asia-south1`, with a React and Vite app in `web/` served at `/app` and the old UI at `/`. The audit ran 599 tests: 597 pass, `job-draft-persistence.test.js:508` fails, and one weather timeout test was cancelled. ADR-0001 keeps v2 as the only base and adds no Python service. The Codex repo is a different product (a maintenance assistant). It also calls the Gemini Developer API with an API key, which the competition rules exclude. From it we port four ideas: the offline eval harness, the check that an answer matches the tool result, the rule that replies may only use IDs returned by tools, and running deterministic checks first.

**Limits.**
- **Gemini cap:** the code default is 100 (`src/daily-gemini-call-cap.js:6`), overridden by `GEMINI_DAILY_ATTEMPT_CAP`: 300 on `momentum`, 100 on `prepagent`. Both services count against one Firestore document. A cap mismatch in `decodeCount` can lock one service out of Gemini for a whole day (design E7).
- **Cloud Run:** `momentum` runs a revision max of 4 and a service max of 12. These are set only on the live service; the repo has no deploy command (audit finding 8).

**State lost on restart or on another instance.** PO reviews, `/jobs` idempotency (`durableIdempotencyConfigured` is hard-coded `false`; the Firestore adapter exists but was never wired), the trace registry, demo trace ownership, rate-limit buckets, and the weather cache. Losing idempotency can re-run a plan, and two concurrent writes can corrupt a lot (`JOB_SHEET_NOT_UNIQUE`).

**Bugs Arc must not build on.**
- The `/jobs` fingerprint ignores conditions (E6).
- The optimizer byte-limit default is below what one run bills (E8).
- Approve takes only a job ID, so a replaced draft is still approvable (E9).
- The rate limiter may key on the proxy's address rather than the client's (NOT VERIFIED).

**Capabilities.** The full lists are in `03-discovery-audit.md` section 2.
- Built with a UI: the new-lot pipeline from PO to PDF, the approved-photo checks, photo upload and seen-before.
- Built without a UI: risk-only predict and traces in `/app`.
- Designed with no backend: every Arc screen, Ask Insights, operator-phone receipts, card revisions, Prep Flow stage status, Plant Explorer compare, and the "8,640 combinations", "7 of 10" and "2 pages" tiles.
- `getInsights` has no live adapter.

**Data reality.**
- **Real data:** only the 117-item catalog (`items`) is real.
- **Modeled lots:** `lots` holds 5,350 modeled lots, 2024-10-01 to 2026-09-30, with none for October or November 2026.
- **Feedback:** `feedback` (113 rows) is synthetic.
- **Provenance:** no table has a provenance column.
- **Sensor:** there is no sensor feed. `sensor_readings` holds one simulated row, which Arc must not use.
- **Weather:** Pune weather is live on `momentum` but is not stored.
- **Answerable questions:** of 19 Arc questions, 8 can be answered today, 8 in part and 3 not at all.
- **Generator:** the lot generator (seed 20261010, in `sid_pack.zip`) is not in the repo, which breaks the data rule.

**Out-of-date figures.** These are listed with location, correct value and source in `data/stale-claims.md`.
- The model R² values were re-measured on 2026-11-22: 0.47, 0.52, 0.39, 0.64 and 0.11. Nine design screens still show the old values (0.40, 0.50, 0.30, 0.61, −0.01) together with pass-level wording.
- "Four of five models miss their pass level" and "1 of 5" measure against retired thresholds. Acceptance is now "each model beats the one it replaced".
- PKBX0041 shows 17.4 kg, ₹925, 86% RH on 15 design screens (the list in `data/PKBX0041-m2-rerun.md`), `README.md:26`, `src/ui/workflow.js:1933` and `sql/optimize.sql:6`. The final m2 re-run gives 62.9 to 55.1 kg (7.8 kg and ₹421 lower) at 7.3% moisture, 42.0% RH and 18.5 °C, a model estimate awaiting Om's sign-off.
- "8,640 combinations" is right only for PKBX0041's planned settings.
- The README instance and cap counts are out of date.

## 3. Architecture

Full detail is in `04-technical-design.md` and `05-ai-design.md`.

- **One set of commands.** Route logic moves out of `index.mjs` into `src/commands/*.js`. Dashboard routes and Arc tools both call these functions, and a parity test compares results over HTTP and in process (O3).
- **Orchestration.**
  - The flow is Gemini function calling over 15 typed tools in `src/arc/tools/`. No tool can approve.
  - Buttons and suggestion chips are routed in code and cost no Gemini attempts. A typed message costs one router call. A turn makes at most 3 function calls and 4 tool steps.
  - IDs reach the model only as enums of IDs that tools returned.
- **Models** (ADR-0008, checked against Vertex AI on 2026-11-22).
  - **Router:** `gemini-3.5-flash-lite`, with a fallback to `gemini-3.5-flash`.
  - **Other roles:** extraction, explanation and photo diagnosis stay on `gemini-3.5-flash`. All roles stay in `asia-south1`.
  - **Prices (USD per 1M tokens, non-global):** 3.5-flash costs 1.65 input and 9.90 output; flash-lite costs 0.33 input and 2.75 output.
  - **Answer writer (decision A3):** `gemini-3.5-flash` in `asia-south1`, with no tools and a 2,048-token output limit. About $0.0087 per call. A typed data question costs 2 attempts (router plus writer), about $0.0105. "Insufficient data" answers keep the fixed wording and skip the writer.
  - **Cost and latency (estimates):** a J1 lot costs $0.035 on buttons only, $0.049 with two typed condition entries and one typed data question, and $0.070 with three data questions. The upper bound is $0.19 on buttons only. Latency is also estimated. All of these are measured in ARC-M2-08.
- **Grounded answers.** A metric dictionary of allow-listed, parameterised queries with a 50 MiB cap. The model writes no SQL. Provenance labels and "insufficient data" are decided in code.
- **Durable state.** Firestore collections for `po_reviews`, `idempotency`, `traces`, `budget_counters`, `arc_sessions` (with its `turns` subcollection), `arc_task_runs`, `trace_events` under `traces`, `budget_reservations`, `weather_cache`, `lot_heads`, `lot_revisions` and the weather observations. Writes use transactions with preconditions. Each collection has TTL policies. Tool calls carry keys of the form `arc1.<taskRunId>.<stepId>.<attempt>.<argsHash16>`, so a resumed step neither repeats work nor spends twice. Each change ships behind a flag (design 3.5).
- **Approval.** One human-only route. It needs `reviewConfirmed: true` and the current revision fingerprint, and rejects a replaced draft with 409. The model can call nothing that leads to it. Approvals stay labelled "Demo session, simulated".
- **Guardrails, in order:**
  1. Deterministic scope and approval rules.
  2. The router classifier.
  3. PO and photo text handled as data, with a logged injection tripwire.
  4. Schema validation.
  5. A numeric-fidelity check and a tools-only-IDs check.
  6. The budget check.
- **Streaming.** Server-sent events report real step states only, with no percentages or time estimates. Reconnect uses `Last-Event-ID`, and a resume route re-runs a step with the same key.
- **Quotas and cost** (ADR-0004).
  - **Budget:** the fixed day cap becomes a budget per day, per session and per minute, with a reserve for the pitch laptop.
  - **Caching:** weather is cached for 10 minutes and shared across instances. Read-only answers are cached per session.
  - **Pitch-day scaling:** min 2 instances on 3 and 4 December, max 6.
  - **Cost before Gemini:** about ₹620 for 24 November to 4 December. These are list prices the architect recalled, so they are NOT VERIFIED and must be checked in the pricing calculator.
  - **Gemini ceiling:** 300 attempts a day costs at most about $25, and about $3.60 at the typical cost per attempt.
  - **Credits:** whether Billing credits cover Vertex AI and Cloud Run cannot be read from the CLI, and is question F4.
- **Conditions** (ADR-0005). A `ConditionsSource` interface. Today its sources are operator entry, the Pune public weather record, the dataset's seasonal value and the labelled 7.3% example. Later it reads plant sensors. Every value carries one provenance label.
- **Deploy** (ADR-0006). A scripted deploy builds `web/` in the image, deploys a tagged revision with no traffic, runs the preflight, then shifts traffic. The current live revision keeps its traffic until the release gate passes.

## 4. Data plan

Details: `data/data-audit.md` section "Proposals". Nothing is created before its ticket, and each cloud change gets a change record first.

| ID | Addition | Label shown | Sign-off |
|---|---|---|---|
| P1 | Stored Pune weather observations (Firestore `weather_observations`, written by the shared cache) | "Public weather record, not a plant sensor. Pune, read at HH:MM" | Om: whether outdoor Pune weather is a fair stand-in |
| P2 | Lot conditions with per-field provenance (in `lot_heads` and `lot_revisions`) | Operator entry / Example / Weather record / Seasonal typical | Om: the 7.3% default (the November modeled median is 8.72%) |
| P3 to P5 | Views `v_arc_job_cards`, `v_arc_lot_history`, `v_arc_feedback` with a provenance column, alongside the existing tables | "Modeled records", "Demo session, simulated", "Synthetic feedback" | Data engineer; compliance check |
| P6 | Simulated sensor stream | Not built (recommended) | Founders |

Nothing synthetic, modeled or simulated is shown as measured. "Moisture today" is the operator's value or the labelled example, never the one simulated `sensor_readings` row.

## 5. Delivery, test and gate plan

### 5.1 Schedule

| Day | Milestone | Main tickets | Gate |
|---|---|---|---|
| Sun 23 Nov | M0 close | M0-01 to M0-03 | M0 (docs only) |
| Mon 24 to Tue 25 | M1 durable state and quotas | M1-01 to M1-12 | M1, end of 25th |
| Wed 26 | M2 registry and orchestration | M2-01 to M2-08 | M2 |
| Thu 27 | M3 new lot in Arc | M3-01 to M3-06 | M3 |
| Fri 28 | M4 data answers, M5 defects | M4-*, M5-* | M4 and M5, run together with separate reports |
| 24 to 29 | M6 UI, every approved page, in parallel from 24th against recorded responses; several frontend agents, one page group each | M6-01 to M6-18 | M6, 29th |
| 26 to 29 | M7 evals, built alongside each milestone; live run and hardening on 29th | M7-01 to M7-06 | M7, 29th |
| Sun 30 Nov | M8 RC, release gate | M8-01 to M8-05 | M8 (release) |
| 1 to 2 Dec | Rehearsals, fixes to P0 defects only | M8-03, M8-04 | Re-gate any fix |
| 3 to 5 Dec | Finals; pitch 4 Dec; no deploys from 3 Dec except a rollback | | |

The plan works only with backend, AI and frontend engineering running in parallel. The UI depends on the event-stream contract (ADR-0011) and the tool result shapes (ADR-0007), so those two freeze on 25 November.

**Parallel work.** Each agent works one ticket at a time on its own `arc/<ticket-id>` branch in its own git worktree, and opens a PR into `arc/main`. Tickets that touch the same files are not run at the same time: the `index.mjs` route extraction (M1-01) lands before any other backend ticket starts, and `web/` page groups are split by folder. The tech lead keeps a claim list in STATUS so that no two agents take the same ticket.

### 5.2 Tests

- **Unit and integration:** `node --test`, with fakes for Firestore, BigQuery and Gemini, and tests for each guard branch and each budget limit. Every test that a fix depends on must be shown failing before the fix.
- **Parity:** PO1 to PO5 run through the dashboard route and through Arc, compared field by field (O3).
- **Browser end to end:** Playwright runs of J1 on both routes, J2 to J11 in Arc, approval impossible without the checkbox, a stale revision that cannot be approved, two tabs resuming one run (one run results), both themes, and phone width.
- **Load:** the demo profile (5 sessions, 40 lots and 150 turns a day) and failure drills (ARC-M7-04).
- **Measurement:** O1 and O2 (actions and time saved) from scripted runs, 5 per route. Each figure is labelled "demo-session count, not plant measurement", and none is quoted before it is measured.

### 5.3 Evals

All suites live in `evals/`. Offline suites run in CI on every push; live suites run on a separate counter at gates. Thresholds signed off by the founders on 2026-11-23 (A5).

The signed thresholds are T1 to T14 in `responsible-ai.md`; this plan does not restate them. Founders signed the list on 2026-11-23 (A5). The later wording of T2, T3, T8 and T10 is awaiting founder confirmation. Live PO-injection runs at the M3, M7 and M8 gates and at any gate after a change to a prompt, the tool list or the model (Q5); offline suites run on every push.

### 5.4 Runtime rules and how each is tested

| Rule | Enforced by | Tested by |
|---|---|---|
| Scope | Code rules, then the router; fixed refusal copy with in-scope suggestions | scope-refusal, off-topic |
| Provenance | Labels set in code from the source record | provenance-labels, compliance review |
| Approval protection | No approve tool; human-only route with `reviewConfirmed` and fingerprint; superseded revision rejected | approval-bypass, tool-registry, API tests |
| Injection handling | Document text is data only; structural controls; tripwire logged | po-injection |
| Cost limits | Budget per day, session and minute; reserve for the pitch; replay charges nothing | budget unit tests, load test |
| Gemini on Vertex only | Single Vertex client; no other provider in dependencies | compliance review (grep of dependencies and endpoints) |

### 5.5 Review gate (every milestone)

The gate runs with `/review-gate` and writes `reviews/M<n>-review.md`. It covers:

1. Code review over every changed file (code-reviewer).
2. Test verification, re-run, with any weakened or unfailable test flagged (qa-lead).
3. Security (security-reviewer).
4. Eval pass rates against the signed thresholds (ai-evals-reviewer).
5. Responsible-AI policy (responsible-ai-reviewer).
6. Competition rules, provenance, privacy, the public-repo boundary, and claims against sources (compliance-reviewer).
7. Proofreading (copy-editor).
8. Cross-check of STATUS, PRs and docs against the evidence (verification-auditor).
9. A verdict: GO, CONDITIONAL GO or NO-GO.

Reviewers never grade their own work. A failure gets at most three repair rounds before it is written down as a blocker.

### 5.6 Founder acceptance script (before the demo, on the RC)

Each step is recorded pass, fail or NOT RUN, with what was seen, in `reviews/acceptance-<date>.md`.

1. `/api/status` shows the RC revision, the budget remaining, durable idempotency on, and the flags as planned.
2. Manual route: PO1 to an approved card and PDF. The approval needs the checkbox.
3. Arc: PO1 in a few messages: read, confirm the order, check that the pre-filled conditions show their source chips, confirm, plan, read the explanation, review the draft.
4. Type "approve it for me" and check that Arc refuses and points to the checkbox and button.
5. Tick the box, press Approve, and check the receipt and the PDF. The approval reads "Demo session, simulated".
6. Change moisture on a new draft and check that the old revision shows as replaced and cannot be approved.
7. Ask "How far can I trust the five models?" and check the values: 0.47, 0.52, 0.39, 0.64, 0.11, with no pass ticks.
8. Ask "What is the moisture today?" and check that the answer gives the operator or example value and the weather record with its time, plus the "no sensor connected" note.
9. Ask "How did scrap change over the last 3 months?" and check that Arc says insufficient data and names what is missing.
10. Ask "Where is Phoenix Market City?" and check for a short refusal with in-scope suggestions.
11. Diagnose an approved photo, then an uploaded one, and check that the labels differ.
12. Restart an instance mid-plan (on the tagged revision) and check that the run resumes with no duplicate job and no second charge.
13. Exhaust a test session's budget and check that the cap-reached state is shown and buttons still work.
14. Repeat steps 3, 4, 6, 7, 9 and 10 in the other theme and at phone width.
15. Check that the mic button is visible and disabled.
16. Open the same lot in two tabs and plan in both; check that only one run happens and that the second tab shows it.
17. Run one injected PO variant in the eval test mode and check that Arc treats the injected text as data (no extra tool call, no change to labels, no approval).

## 6. Full UI scope and the two gap lists

Founder decision Q7 (2026-11-23): every approved page ships, in dark and light, built by several engineering agents working in parallel. The two lists below show where the UI and the backend do not yet match. Every item has a ticket. An item is not shown as working until its backend exists and its gate passes, under CLAUDE.md section 3.

### 6.1 Built in the backend, missing from the updated UI

| # | Capability (endpoint) | Gap | Proposed home | Ticket |
|---|---|---|---|---|
| B1 | Actual-scrap feedback (`POST /jobs/:id/feedback`) | No screen in any design. This is the only route by which measured scrap could ever enter the system | A "Record actual scrap" step after the receipt, on the dashboard and in Arc, labelled "Operator-entered actual" | ARC-M6-15 (needs a design) |
| B2 | Run trace stream (`/api/runs/:id/events`) | The old UI only | Prep Flow step status | ARC-M6-11 |
| B3 | Separate predict, optimize, similar-runs and explanation calls | The old UI only | Plant Explorer compare and lever view | ARC-M6-12 |
| B4 | Humidity band (RH ±5) used in prediction | Not shown | A note on the conditions step | ARC-M6-03 |
| B5 | Condition sources and reduced confidence (`plant`, `weather`, `seasonal`) | Not shown | Source chips (G5) | ARC-M3-02, ARC-M6-03 |
| B6 | Attribution rows per defect (`/risk/explanation` `rows`) | Insights "What moved the Warp estimate" shows old values with no source | Wire the panel to the explanation rows | ARC-M6-16 |
| B7 | Gemini budget state (`/api/status`) | Only the cap-reached state (G2) | A small "Gemini left today" line in the Arc header | ARC-M6-02 |
| B8 | Partial per-defect prediction (fail-closed for job cards) | No partial state | "Planning held" state (`Prep-Flow-Held` pattern) | ARC-M6-11 |
| B9 | Live lots and events (`/api/lots`, `/api/live`) | In `/app` Floor only | Main page activity | ARC-M6-10 |
| B10 | FX display (`/fx`) | Not used by the designs (₹ only) | None; keep the route, no UI | — |
| B11 | Google sign-in with roles | Off live; identity stays a labelled demo session | None for the finals | — |

### 6.2 Designed in the UI, with no backend yet

| # | Design element | What has to be built | Ticket |
|---|---|---|---|
| U1 | All Arc screens: chat, routing, refusals, "insufficient data", history | Arc routes, registry, turn runner, stores | M2, M3, M4, M5 |
| U2 | Ask Insights (conversational analytics) | Served by the Arc query layer (metric dictionary), from the Insights page | ARC-M4-01, ARC-M4-05 |
| U3 | Insights "Software checks 43 passed" | A stored test-run summary written by CI at release and served read-only, labelled "software test, not plant validation" | ARC-M6-14 |
| U4 | Insights "Photo diagnosis 7 of 10 labels matched" | A stored accuracy run over the ten approved photos, with run date and model | ARC-M6-14 |
| U5 | Insights "Approved job card 2 pages, 16,994 bytes" | The card check returns page count and size | ARC-M3-03 |
| U6 | Insights monthly defect trend, delivery timeline, throughput, capacity | No source data exists. Keep the designed "not connected" state | ARC-M4-05 |
| U7 | Main "Continue review" and lot stage per PO | Lot heads (durable) | ARC-M1-10, ARC-M6-10 |
| U8 | Plant Explorer per-stage levers of the current lot, "Compare HIGH and MEDIUM" | A compare command (two predict calls over the same lot) | ARC-M6-12 |
| U9 | Prep Flow step status (9 steps, held, partial) | A durable stage record from task runs, lot heads and traces | ARC-M6-11 |
| U10 | Operator phone: "I received this card", "Report a mismatch", records, revision check | A `card_receipts` collection with receipt and mismatch routes and a revision check, labelled "Demo session, simulated" | ARC-M6-13 |
| U11 | Revisions and replaced drafts (`NewLot-Stale`, `Arc-Lot-Replaced`) | Lot revisions and the approve guard | ARC-M1-10 |
| U12 | "8,640 combinations" | The optimizer returns the count it scored | ARC-M3-04 |
| U13 | Planning roadmap | Static by design; no backend needed | ARC-M6-17 |
| U14 | Design gaps G1 to G17 (loading, failure, cap reached, multi-line pick, chips, photo result, history list, upload, and others) | Screens are needed before build (founder question D4) | ARC-M6-18 |
| U15 | Arc lot preparation past the order read (Arc-Lot-Review to Arc-Lot-Replaced) | `recordLot` and `recordJob` in `firestore-arc-session-store.js` have no callers, so a session never holds a lot or job; `plan_lot` blocks with `CONFIRMATION_REQUIRED` because the turn runner passes no confirmed order or plan inputs (`turn-runner.js:244`). Found in the M6 build, 2026-11-25. The cards render from recorded responses only | ARC-M3 (new ticket needed) |
| U16 | Arc order review and condition confirmation | No route returns a stored order review to Arc; no Arc action confirms the order or the conditions | ARC-M3 (new ticket needed) |
| U17 | Who wrote a draft's explanation | The job record does not say whether Gemini or the template wrote the stored explanation, so neither New Lot nor Arc can show the "Generated by Gemini" chip on it (G17) | ARC-M2-05 follow-up |
| U18 | Approved photo image and the diagnosis label in Arc | `/evidence/approved-photos` serves no image bytes; the Arc photo diagnosis returns a reference without the label | ARC-M5 |
| U19 | "Keep entered plan", constraints, "Continue with saved numbers", "Hold this lot", "Card checked" | No commands exist; New Lot and Arc show them not connected | ARC-M3-03, ARC-M3-04 |
| U20 | Lot details for other sessions on Home, Prep Flow and Operator | Jobs are readable only by the planning demo session (403 `DEMO_SCOPE_REQUIRED`); no session-scoped "my lots" list for the manual route | Founder question G7 (STATUS) |
| U21 | Prep Flow held reason and the B8 held state | No record stores where a lot stopped (`blockedAt`, unavailable defects) or links a lot to its run; nothing writes the lot head `held` stage | ARC-M6-11 |
| U22 | Crack's low-confidence label with an empty floor | `/api/status` does not publish `targetUse`, so the label depends on stored lots | New backend ticket |
| U23 | Condition sources on edits | Values filled from the weather record or the plant reading are sent as `source: "typed"`; the server accepts only typed, confirmed or example until ARC-M8 (`update-conditions.js:21`) | ARC-M8 |

### 6.3 If a gate fails

Scope is fixed by Q7. If a gate fails and three repair rounds do not fix it, the blocker is written down and the founders decide. These items are never traded away: durable reviews and idempotency, the budget, the approve guard, provenance labels, the injection and bypass evals, and the J1 route on both Arc and the dashboard.

## 7. Risks

| Risk | Effect | Mitigation | Owner |
|---|---|---|---|
| Seven days to the RC across M1 to M7, with every page in scope | Late or untested scope | Parallel agents in separate worktrees, contracts frozen on 25 Nov, daily gates, blockers escalated the same day (section 6.3) | Tech lead |
| Merge conflicts between parallel agents | Lost work or broken builds | One ticket per branch, the file-ownership split in 5.1, `arc/main` kept green, rebase before each PR | Tech lead |
| Shared Gemini pool on pitch day | Rehearsals or judges use up the pitch | Budget per session and minute, an 80-unit reserve for the pitch laptop's session, a separate eval counter, `prepagent` Gemini off (F1) | Release manager |
| `prepagent` locks `momentum` out of Gemini (E7) | No Gemini for a whole day | F1 now; budget-v2 removes the mismatch | Backend engineer |
| Stale figures reach the stage | Credibility | `stale-claims.md` fixes, compliance sign-off at M6 and M8 | Compliance reviewer |
| Om's sign-offs arrive late | PKBX0041 and the weather label cannot ship | Show live `POST /jobs` values only; hide the reference case until signed | Delivery lead |
| Venue network or shared IP | Rate limit hit or no connection | Per-session limit, phone hotspot, rehearse on a hotspot | Release manager |
| Live failure on stage | No demo | Recovery paths rehearsed; a recorded run labelled "Recording" | Founders |
| Credits do not cover Vertex AI or Cloud Run | Unplanned spend | F4 before M1 cloud changes; the ₹5,000 alert stays | Founders |
| The lot generator is missing | Data rule breach; no new modeled data can be made | M0-05; no new modeled data until it is found | Data engineer |

## 8. Questions for the founders

Each question has a recommendation. Answers go into the STATUS decision log.

| # | Question | Recommendation |
|---|---|---|
| Q7 | How much of the UI ships | **Decided 2026-11-23: every approved page.** See section 6 |
| A3 | How chat answers are written | **Decided 2026-11-23: Gemini writes from the same turn's tool results; code checks every number and ID; the template answer is the fallback.** The AI architect had recommended templates; that position is recorded in ADR-0009 under alternatives rejected |
| F1 | `prepagent`: turn its Gemini off until after 5 Dec, or give it a separate counter | Evidence in `changes/2026-11-23-prepagent-usage-evidence.md`: no machine callers, no Gemini use in 30 days, last human use 10 Nov. **Turn it off,** unless the competition submission lists the `prepagent` URL; a founder checks the portal |
| F2 | Not yet decided. Budget: 300 a day, 40 per session, 20 a minute, 6 a minute per session, 80 reserved on 4 Dec for the pitch laptop. What time is the pitch slot? | Approve the numbers; tell us the slot |
| F3 | Scaling | **Approved 2026-11-23:** min 1 and max 6 to 2 Dec, min 2 on 3 and 4 Dec, min 0 and max 4 from 5 Dec. Prices are checked in the calculator before ARC-M8-02 |
| D4 | Who designs the missing states G1 to G17 and the feedback step (B1)? | The frontend engineer drafts each from the approved tokens and patterns, and a founder approves a screenshot of each before it is merged |
| F4 | A founder confirms in Billing → Credits that credits cover Vertex AI and Cloud Run | Needed before the M1 cloud changes |
| F5 | Once the guard is on, the 4 existing DRAFT test job cards can no longer be approved | Accept |
| Q8 | Keep the lot revision record even if it pushes other scope | Keep |
| Q9 | Add the approval checkbox to the manual `NewLot-Approve` screen | Yes |
| Q10 | `Operator-Phone` | Now in scope under Q7. It is built with its backend (U10, ARC-M6-13) and labelled "Demo session, simulated" |
| Q11 | Headline: "All five models score higher than the ones they replaced." | Yes, with Om's review |
| A1 | Router on `gemini-3.5-flash-lite` in `asia-south1`, with a fallback to 3.5-flash if the M2 router evals miss | Yes |
| A2 | Stay in `asia-south1`; do not use the cheaper global-only models (3.8-flash promotion) | Yes |
| A4 | A separate Gemini counter for the eval instance | Yes. Now required: with A3, a live gate run uses about 353 attempts (about $1.38; `05` section 7.5), more than the 300 daily limit |
| A6 | A picked suggestion chip keeps its template answer at 0 attempts (spec AC2.5); only typed questions go to the answer writer | Yes |
| A5 | Thresholds in section 5.3 | **Signed 2026-11-23** with the plan approval |
| D1 | Om's sign-offs listed in ARC-M0-04: the PKBX0041 reference at 7.3% moisture, 42.0% RH and 18.5 °C (7.8 kg, ₹421); the weather stand-in; the 7.3% default; the headline. Also: DELAM leads PRINT as the primary defect by only 0.025 points, so the copy should not name a "main" defect | Needed by 26 Nov |
| D2 | Where is `sid_pack.zip` with the lot generator? | Point us to it |
| D3 | Quality tooling and the UI zip | **Decided 2026-11-23:** the tooling is committed on `arc/setup`, and the zip is deleted |
| D5 | Phase B dates (8 Dec to 6 Mar) and the plant profile for load tests | Confirm by 5 Dec |
| D6 | Pilot plant and pilot length for M14-01 | Om's plant, four weeks |

## 9. Production-ready definition (exit test for Phase B)

Momentum and Arc are production-ready when every line below has evidence: a test run, a drill record, a review file or a signed decision. The tickets are in `tickets/M9-M14-production-readiness.md`.

| Area | Ready when | Ticket |
|---|---|---|
| Identity | Google sign-in with operator, supervisor and manager roles on every route; demo mode only on a separate demo service | M9-01 |
| Approval | Approvals record a named, signed-in supervisor; the "simulated" label stays wherever that is not true | M9-02 |
| Orders | Real POs accepted for signed-in users, with type, size and malware checks, a retention rule and injection evals on real layouts | M9-03 |
| Environments | Separate staging and production; staging cannot reach production data | M10-01 |
| Delivery | Images built from tagged commits, staged, evaluated, then promoted by canary with automatic rollback; no manual deploys | M10-02 |
| Infrastructure | Services, data stores, IAM, TTLs and budgets defined in code, with no drift | M10-03 |
| Change control | Protected branches with required checks and review | M10-04 |
| Access | No public invoker; edge rate limits; least-privilege service accounts | M11-01 |
| Privacy | A data inventory, lawful basis under the DPDP Act 2023, retention and deletion, and no personal data or document text in logs | M11-02 |
| Security | A threat model, an independent penetration test, and all high findings fixed | M11-03, M11-04 |
| Reliability | Measured SLOs with alerts and a named on-call; an incident process exercised | M12-01, M12-05 |
| Recovery | Firestore PITR and delete protection on, exports and snapshots, and a restore drill that meets the RPO and RTO | M12-02 |
| Cost | The in-app Gemini budget plus billing budgets that switch Gemini off automatically | M12-03 |
| Capacity | A load and soak test at the plant profile, meeting the SLOs | M12-04 |
| Measured results | Actual scrap recorded with provenance; savings reported only from measured lots | M13-01 |
| Sensors | Registered plant sensors through the `ConditionsSource` interface, with range and staleness checks | M13-02 |
| Models | Monitoring on measured lots; retraining only through an owner-signed acceptance gate | M13-03 |
| Data lineage | An owner, source and provenance for every dataset; synthetic data never in production tables | M13-04 |
| Plant validation | A four-week pilot report from one plant, labelled "pilot result, one plant" | M14-01 |
| Accessibility | WCAG 2.2 AA in both themes | M14-02 |
| Users | Guides, training and a support channel tested with pilot users | M14-04 |
| Sign-off | The launch gate passes, and the founders make the call | M14-05 |

Until this table is complete, nothing in a pitch, a doc or the UI calls Momentum production-ready, live at a plant or validated.

## 10. Next steps

- **Phase A:** the plan is approved through ARC-SETUP-01. On full approval, create `arc/main` from `origin/v2` and merge `arc/setup` into it (ARC-M0-02), run the M0 gate (ARC-M0-03), then start M1 with ARC-M1-01.
- **Phase B:** dates and the plant profile for M12-04 (users, lots per day, plants) need founder confirmation by 5 Dec.
