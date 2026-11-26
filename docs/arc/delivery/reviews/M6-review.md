# M6 review gate

Date: 2026-11-26. Tip reviewed: `arc/main` at `682b960` (local; not pushed). Scope: `git diff 74aad36..682b960`, 358 files and 334 commits since the M1 gate. No M2 gate was run, so this gate also covers the M2 Arc backend (router, registry, turn runner, answer writer), the ML tickets (ARC-ML-01 to 04, M0-05, REL-01, M2-07, impact v3), ARC-DEV-01 (`live:local`), the M6 redesign (ARC-M6-02, M6-03, M6-06a to d), ARC-M3-01 (Arc lot flow), ARC-ML-04b, and the Cloud Run test revision `momentum-arc-test-v2` (tag `arc-test`, no traffic; `changes/2026-11-26-arc-test-revision.md`). Previous gate: M1 (`reviews/M1-review.md`, CONDITIONAL GO).

Eight reviewers ran in parallel and independently, as CLAUDE.md section 5 requires. Their full reports are kept in the session scratchpad; this file is the record.

## Verdicts

| Reviewer | Verdict | Summary |
|---|---|---|
| Code reviewer | CONDITIONAL GO | No blocking findings. 9 should-fix (CR-1 to CR-9), 10 nits. M1 CR-1 and CR-2 closed |
| QA lead | CONDITIONAL GO | `npm test` 1280, 1272 pass, 6 fail (5 from a test path bug, QA-4; 1 laptop python3), 2 skipped; `eval:offline` 215 of 215; web build passes; browser 194 of 195 (the failure was `local-backup.spec.js`, which passed alone). 32 of 36 mutants caught |
| Security reviewer | **NO-GO** | M1 SEC-1 and SEC-2 were due before the budget flags went live on a real revision; `arc-test` now runs budget-v2 on a public URL with both open. New SEC-12 (session cookies from any revision or laptop work on `arc-test`) and SEC-13 (one client can use up the day's Gemini budget, no pitch reserve) |
| AI evals reviewer | CONDITIONAL GO | 215 of 215 offline; 9 of 12 suites built (insufficient-data, tool-registry, privacy-logging not built); every live half NOT RUN. The J4 scrap question is refused as off-topic (EV-1) and no eval could catch it |
| Responsible-AI reviewer | CONDITIONAL GO | Human oversight met. Example paper moisture reaches the Approve card and PDF as "entered by the operator" (RAI-10); live evals due at this gate not run (RAI-11); safety blocks shown as a generic error (RAI-14) |
| Compliance reviewer | CONDITIONAL GO, with one BLOCKING founder item | Gemini on Vertex only; nothing from `docs/arc/reference/` tracked; no secrets; `v2` untouched. CO-1: `arc/*` branches are on the public origin |
| Copy editor | CONDITIONAL GO | No banned words, emoji or attribution. Inconsistent names (defects, levers, modelled/modeled), copy that implies plant data, stale records |
| Verification auditor | **NO-GO** | 62 claims: 44 supported, 4 false, 9 stale, 5 unsupported. Two wrong holdout numbers; the public-origin claim is false; the two `arc/main` lines have split (VA-4) |

## Overall: NO-GO

Two reviewers gave NO-GO. Under section 5 the next milestone (M7) does not start until the blocking issues below are fixed by their owners and re-checked by the same reviewers (at most three repair rounds). Work that fixes the blockers is allowed. The production revision `momentum-00023-yaz` is unchanged and keeps 100% of traffic; nothing here moves traffic.

## Blocking issues

| ID | Finding | Owner | Close by |
|---|---|---|---|
| G-1 (CO-1, VA-3, VA-4) | `arc/main` (`cb1338f`), `arc/ui-vnext` and `arc/ARC-M1-16-stale-fixtures` are on the public GitHub origin with the delivery docs and the M1 security findings. Origin `arc/main` has 15 commits not in Om's local `arc/main`, including a different ARC-M6-02 merge, and `arc/ui-vnext` (Siddhant, 26 Nov) rebuilds the same M6 screens. An origin commit (`c506fd9`) records a founders' decision of 25 Nov accepting the push; local records say the opposite. The gate cannot say which `arc/main` is the integration branch | Founders (Om and Siddhant) | A written decision: which line is `arc/main`, who orchestrates (G4), and whether `arc/*` stays public; local records corrected to match |
| G-2 (SEC-1, M1) | Per-IP limits key on the full IPv6 address, so a /64 rotates past them; callers with no usable address share one "unknown" key with no alert (`src/request-guardrails.js:93-110`) | Backend | Before budget-v2 serves any public URL, or take budget-v2 off `arc-test` |
| G-3 (SEC-2, M1) | `/api/status` is unauthenticated and returns the rupee cap, spend, reserve and limits, with 3 Firestore reads per call and no cache (`index.mjs:733-739`, `src/commands/status.js:180-193`) | Backend | As G-2 |
| G-4 (SEC-12) | Demo-session tokens carry no audience, and every revision and laptop run signs with the same secret; the serving revision mints sessions with no limit, so a script can mint there and use the cookies on `arc-test`, bypassing its mint, session and plan limits (`src/hackathon-demo-auth.js:26-46`, `index.mjs:643-646`) | Backend | As G-2 |
| G-5 (SEC-13) | `ipDayLimit` equals `dayLimit` (100) and no pitch reserve is configured, so one client can use up the day's Gemini in about five minutes | Backend, founders (limits) | Before any traffic move or the pitch; SHOULD-FIX for the no-traffic test link |
| G-6 (VA-1, VA-2) | `data/holdout-2026-10-11.md` and STATUS give crack holdout R² 0.112 (evidence 0.11148, so 0.111) and a warp MAE interval upper bound 0.004 (evidence 0.00347, so 0.003) | Data engineer | Next commit |

## Should-fix, by deadline

### Before any demo, recording, judge use or traffic on the Arc lot flow
| ID | Finding | Owner |
|---|---|---|
| CR-1 | Earlier Arc conditions cards stay live, and `registerPending` re-plans an approved lot (moves the head from `approved` to `planning`) | Frontend, backend |
| CR-2 | Arc lot planning does not require `USTAAD_ENFORCE_APPROVE_GUARD`; a stale card could approve a replaced draft where the guard is off | Backend |
| RAI-10, CR-4, CO-2 | Provenance of conditions on the Approve card and PDF: example moisture shows as "entered by the operator" and `manual-entry`; weather-filled values show as "confirmed by operator"; Arc and New Lot label the same 7.3% differently | Backend, frontend |
| RAI-11 | Live evals due at this gate (po-injection, scope-refusal, approval-bypass, grounding, numeric-fidelity) not run | AI engineer, AI evals |
| RAI-14 | Gemini safety blocks on extraction and photo show "could not read or save its records" | Backend, AI engineer |
| CR-5, RAI-20 | The Arc Approve card's Limits row is fixed text about the model set, not this job | Frontend |
| CR-6 | Two Arc start buttons ("Ask about the data", "Open a job card") spend a router call (spec O10: 0 for a chip) | AI engineer, frontend |
| EV-1 | "How did scrap change over the last 3 months?" (J4) is refused as off-topic; the router has no in-scope "insufficient data" reply (ARC-M4-03) | AI engineer |
| CO-4 | Photo copy says "read once" while uploads are stored in Cloud Storage with no documented retention | Frontend, backend |
| SEC-15 | Old public tag URLs (`demo`, `domain`, `polish`, `r2fix`, `welcome`, `v2be`) serve old code against production data | Release manager, founders |

### Before the M7 gate
| ID | Finding | Owner |
|---|---|---|
| CR-3 | `forbiddenText` (order text kept out of transcripts) is never passed by the turn runner | Backend |
| CR-7, CE-7 | Arc "Next for you" empty text is stale; its links open New Lot pages that do not know the Arc lot | Frontend |
| CR-8 | Requests during the first model-version check (`unchecked`) fail at once instead of waiting | Backend |
| CR-9, QA-4 | `test/orchestrator-scripts.test.js` and `ticket-status.mjs` use `URL.pathname`, so 5 tests fail on any path with spaces; not a missing `codex` | Orchestrator tooling |
| QA-1 | Removing the MATCHED check in `lot-flow.js:83` fails no test | AI engineer |
| QA-2, QA-3 | APPROVAL_IN_PROGRESS browser tests and `local-backup.spec.js` depend on wall-clock time and fail under load | Frontend, release |
| QA-10 | The parity test runs commands, not `POST /jobs`, and gives New Lot `paperMoistureSource` the real form never sends | AI engineer |
| SEC-4, SEC-14, SEC-16, SEC-17 | `/api/live` stream cap and floor-view scope; plan limit fails open without a budget store and has no per-IP cap; `live:local` runs as the developer's owner token; the "unblocked" permissions template lets an agent deploy, move traffic and read secrets without asking | Backend, release |
| EV-2 to EV-7, RAI-12, RAI-13, RAI-15, RAI-17 to RAI-19 | Eval coverage and stale gap notes; photo reference flagged as Gemini text; writer request builder not pinned; router version not recorded; failure messages that claim too much; `responsible-ai.md` known gaps; crack label with an empty floor | AI engineer, AI evals |
| RAI-16 | Insights says "Modeled saving"; the RAI policy says "model-estimated reduction, never a saving". Founder decision | Founders, copy editor |
| CO-3, CO-5, CO-6 | "Last plant reading" implies a sensor; Om's "predicted, not 'not measured'" rule is not recorded in the repo; the spec still cites ₹7,934 | Frontend, founders, product |
| CE-1 to CE-10, CE-13, CE-15, CE-22 to CE-26 | Copy consistency: defect and lever names, modelled/modeled, Arc suggestions implying plant data, "not shown again" card, raw action IDs in Past work, money format in answers and PDF, "job sheet" vs "job card", stale STATUS and gap list, "₹7,927 a month" in docs | Copy editor with owners |
| VA-5 to VA-11 | Stale or unsupported records: "no BigQuery writes" in the handover; "both model sets beat the baseline"; QA and security verdicts not stored in the repo; ARC-ML-04b merged and deployed on an orchestrator spot-check with no independent QA; live figures cite no job ID; U15 and U16 stale; "₹7,927 a month" | Orchestrator, data engineer |

## Nits
CR-10 to CR-19 (duplicated fetch helpers and types, oversized `turn-runner.js` `execute` and `LotScreens.tsx`, comments, approve query string, an empty `orderId`), QA-6 to QA-9 and QA-11 to QA-12, EV-8 and EV-9, RAI-21 to RAI-24, CO-7 to CO-11, CE-11, CE-12, CE-14, CE-16 to CE-21, CE-27 to CE-30, SEC-18, VA-12 to VA-22. Owners pick them up in a follow-up ticket.

## M1 conditions

| ID | State | Evidence |
|---|---|---|
| CR-1 (in-memory idempotency store outside demo mode) | CLOSED | `src/job-idempotency.js:220-230`, `index.mjs:881-886` |
| CR-2 (stale comment) | CLOSED | `index.mjs:130` |
| SEC-1, SEC-2 | OPEN, deadline missed | G-2, G-3 |
| SEC-3, SEC-4, SEC-5 | OPEN | Security report |
| SEC-10 (runtime service account roles) | OPEN, carried to M8 | Live IAM read |
| RAI-1 (approve guard off in production) | Still applies; on for `arc-test` | Change record |
| RAI-3 (PDF preview on Cloud Run) | Fixed in code, record not updated | `index.mjs:901-909` |
| RAI-5 (router prompt version) | OPEN | RAI-13 |
| RAI-6, RAI-9 (PO review retention note; known gaps) | OPEN | RAI-18 |
| QA-1 (live integration run, ARC-M1-28) | OPEN | No recorded run |
| ARC-M1-26 (browser test of the approve body) | CLOSED | `new-lot.spec.js:148`, `arc-screens.spec.js:440` |

## Test evidence at this gate
- `npm test` at `682b960`: 1280 tests, 1272 pass, 6 fail, 2 skipped (QA lead and verification auditor, independently).
- `npm run eval:offline`: 215 of 215 (QA lead, AI evals reviewer on a clean copy, verification auditor).
- `cd web && npm run build`: passes.
- Browser suite with Chrome: 195 tests, 194 pass; the failure was `local-backup.spec.js:13` under load, passing alone (QA lead).
- During the gate the QA lead's backend mutations were applied in the shared checkout and restored; the AI evals reviewer re-ran its suite on a clean copy for that reason (EV-10). `git status` was clean at the end.
