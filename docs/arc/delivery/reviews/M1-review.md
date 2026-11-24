# M1 review gate

Date: 2026-11-24. Tip reviewed: `arc/main` at 2963b3e. Scope: `git diff b26b4f3..2963b3e` (140 files: about 66 source, config and prompt files, 61 test files and fixtures, 13 delivery docs). Previous gate: M0 (`reviews/M0-review.md`, GO).

Merged in M1: ARC-M1-01 to M1-12 (except M1-13), M1-14, M1-15, M1-17 to M1-20, M1-22. Known open items, not findings: M1-13 (needs Node 22; not reproducible on Node 26), M1-16 (Copilot), M1-21, M1-23 to M1-27, ARC-SETUP-02.

## Verdicts

| Reviewer | Verdict | Report summary |
|---|---|---|
| Code reviewer | CONDITIONAL GO | 6 should-fix, 4 nits. Fix CR-1 and CR-2 before M2 |
| QA lead | CONDITIONAL GO | `npm test` 913 of 913 on three runs, including two at once and `--test-concurrency=1`; 10 of 10 sampled mutations fail their tests; every changed assertion is approved except two noted rows |
| Security reviewer | CONDITIONAL GO | No blocking findings; SEC-1 and SEC-2 before the budget flags go live |
| AI evals reviewer | CONDITIONAL GO | 154 of 154 AI-surface tests pass; every eval suite NOT RUN (the harness is ARC-M2-07) |
| Responsible-AI reviewer | CONDITIONAL GO | Approve guard works as designed and is off until ARC-M8-05; four conditions |
| Compliance reviewer | CONDITIONAL GO | No other model provider; nothing from `docs/arc/reference/` tracked; `v2` untouched |
| Copy editor | CONDITIONAL GO | No banned words or wrong figures; records out of date; PDF wording |
| Verification auditor | CONDITIONAL GO | About 60 claims checked, 51 supported; no test count or number is false; 9 stale or unsupported records |

**Overall: CONDITIONAL GO.** No finding is BLOCKING. M2 work may continue. The conditions below have deadlines, and a repair round by the owners and a re-check by the same reviewers close them (at most three rounds).

## Conditions, by deadline

### Before any M2 ticket merges
| ID | Finding | Owner |
|---|---|---|
| CR-1 | `selectJobIdempotencyStore` returns the in-memory store outside demo mode when the Firestore flag is off. A live service would silently use a per-instance store (a local-only path in a product route, and duplicate jobs across instances). Fail closed with 503 outside demo mode | Backend |
| CR-2 | Stale comment at `index.mjs:122` ("keeps idempotency process-local") | Backend |

### Before the budget flags (`USTAAD_GEMINI_BUDGET_POLICY`) go live on a real revision
| ID | Finding | Owner |
|---|---|---|
| SEC-1 | The client key is the full address, so an IPv6 /64 can rotate addresses past every per-IP limit; an unusable `X-Forwarded-For` puts every client in one "unknown" bucket. Key IPv6 on the /64 prefix and alert on the unknown bucket | Backend |
| SEC-2 | `/api/status` is unauthenticated and shows the rupee cap, spend, reserve units and window state, with about 6 Firestore reads per call. Return only availability without a verified session, and cache for a few seconds | Backend |

### Before the M2 gate
| ID | Finding | Owner |
|---|---|---|
| SEC-3 | `/conditions/weather` is unauthenticated and failures are not cached or shared across concurrent calls | Backend |
| SEC-4 | No concurrent cap on trace streams; `/api/live` and `/api/lots` show every session's lots to any demo session | Backend |
| SEC-5 | `nonEmptyString` has no maximum length (`src/schemas.js:27`) | Backend |
| CR-3 | Transaction retry loop duplicated and already diverged (ARC-M1-25) | Backend |
| CR-4 to CR-6 | Repeated Zod-issue mapping in `plan-lot.js`; `demoMode` labelling inside a shared command; hard-coded lot-ID prefix and length | Backend |
| EV-2 | Build the `model-config` suite (T12, 28 cases) | AI engineer |
| EV-6 | Name an owner and ticket for the T1, T2, T9, T12 and T14 suites (offline suites arrive with ARC-M2-07) | Tech lead |
| RAI-3 | Confirm the `/pdf` preview (`index.mjs:895`) can never be shown as an approved card | Backend |
| QA-1 | Every Firestore, budget and Vertex behaviour is tested on fakes only. A live integration run of the durable stores, the budget counters and the Vertex smoke call is needed before release. Owner and ticket: ARC-M1-28 (new), run in the ARC-M8-01 preflight on a tagged no-traffic revision | Tech lead, release manager |

### Records to correct (delivery lead, this round)
CE-1, CE-2, CE-3, CE-4, CE-9 and VA-1 to VA-5 (STATUS risks and sections out of date; ticket M1-14 condition contradicts STATUS); VA-6 to VA-8 (record the QA mutation counts in the ticket files; the M1-10 count of 22 of 25 was before the repair; "confirmed in Cloud Monitoring" for the three live calls is unverified, so reword it to HTTP 200 as the decision log says); VA-10 (history notes on the 80 MiB default); CO-3 (TTL record: add the read-back, all 13 ACTIVE on 2026-11-24 per the audit); CO-4 (a change record for the pitch secret before any cloud step); CO-2 and RAI-6 (a note on what PO reviews store and for how long; **a founder decision on PO review retention is needed before `USTAAD_ENABLE_DURABLE_PO_REVIEWS` is turned on in production**); QA-2 (record the added `role` arguments and the `job-draft-persistence` identity input as approved changes); QA-3 (a test that the optimizer default does not fall below the recorded PKBX0041 bytes, or accept the literal).

### Wording (backend and frontend, with the PDF)
CE-5 and CE-6 (PDF: "generated by Gemini" in sentence case; reduce the three demo lines to two, using "Demo-session approval, simulated"); CE-7, CE-8, CE-10 and CO-5, CO-6 (error messages and PDF text), RAI-4 (`Defects.tsx` label), CE-11 to CE-14 (nits). These can ride with ARC-M1-23.

### Nits and later
SEC-6 to SEC-11, RAI-5, RAI-7, RAI-9 (update "Known gaps" in `responsible-ai.md`), EV-1, EV-3 to EV-5, CO-7, CO-8, CR-7 to CR-10, QA-4, QA-5. EV-1 and EV-3 (live smoke call for `thinkingLevel: LOW`, `generateJson` with `fileData`, and the Q5 regression run) are owned by the ARC-M8-01 preflight.

## Release conditions carried forward (not M1 blockers)

- The approve guard (7b) is off until ARC-M8-05. Until then the checkbox is enforced only by the UI. State this in the release notes (RAI-1).
- Every live check stays NOT RUN until it is run: Firestore transactions and fencing, `budget_counters`, the two-network rate-limit check, the Vertex smoke call, flag 7b on the live revision, BigQuery row uniqueness.
- The old PKBX0041 figures (17.4 kg, ₹925, 86% RH) remain in `README.md:26` and `src/ui/workflow.js:1936` until ARC-M6-09 and ARC-M6-19. Do not use them in any demo or pitch material (CO-1).
- A stolen pitch cookie can be replayed for up to 2 hours; the constant-time compare is checked by review only, not by a test. Add the key-rotation step to the runbook (SEC-9).
- The runtime service account holds broader roles than the code needs; narrow them in M8 (SEC-10).
- No eval suite has run. All of T1 to T14 are unmeasured and none is reported as passing.

## Not run at this gate

All eval suites; live Firestore, BigQuery and Vertex checks; Playwright (`npm run test:ui`); the two-network rate-limit check; the approve guard on a live revision.
