# Arc delivery status

Last updated: 2026-11-23. Finals: 3 to 5 December 2026, pitch on 4 December.

## Done
- Delivery folders created on branch `arc/m0-discovery`, cut from `v2` at `eb6eab9`. The work moved to `arc/setup` on 2026-11-23 for the first commit.
- `01-business-requirements.md` written (business analyst). Reviewed at the M0 gate. Baselines NOT MEASURED.
- `02-product-spec.md` written (product manager). Reviewed at the M0 gate. Eval thresholds signed 2026-11-23; baselines NOT MEASURED. It raises founder questions Q7 to Q11.
- PKBX0041 re-run on the m2_* models (data engineer, read-only). The published 17.4 kg, ₹925 does not reproduce. The m2_* models give 23.2 kg / ₹1,035 at 10.8% moisture and 16.5 kg / ₹879 at 7.3% moisture and 86% RH. Label: model estimate on m2_* models, not a measured saving. Record: `data/PKBX0041-m2-rerun.md`.
- `03-discovery-audit.md` (solutions architect): v2 map, capability inventory, in-memory state. Read-only. Test baseline as re-run at the M0 gate on Node 26.13.1: `origin/v2` 75 files, 588 tests, 587 pass, 1 fail (`test/job-draft-persistence.test.js:508`), 0 cancelled; `arc/main` 605 tests, 604 pass, 1 fail. An earlier Node 22.17.1 figure (599 tests, 1 cancelled) could not be reproduced and is NOT VERIFIED.
- `data/data-audit.md` and `data/stale-claims.md` (data engineer): 15 read-only BigQuery jobs, 230 MiB billed. m2 R² re-measured: 0.4682, 0.5194, 0.388, 0.6404, 0.1081, matching `config/model-acceptance.json`. The data engineer also ran the local test suite once by mistake, with output discarded; it is not used as evidence.
- ADR-0001 (build on v2; read-only Codex audit, nothing in that repo touched).
- `04-technical-design.md` with ADR-0002 to ADR-0006 (solutions architect) and `05-ai-design.md` with ADR-0007 to ADR-0011 (AI architect). All Proposed. No code or cloud changes.
- Vertex AI model check (2026-11-22, free `countTokens` calls): `gemini-3.5-flash` and `gemini-3.5-flash-lite` are served in `asia-south1`; 3.6, 3.7 and 3.8 Flash and 3.1 Pro Preview are global only; the 2.5 family is not served. Prices read from the Vertex pricing page on the same day.
- Tickets for M0 to M8 in `tickets/`, and `00-plan.md`.
- ARC-SETUP-01 on branch `arc/setup`: short gate CONDITIONAL GO, merged into `arc/main` (`8bc30fd`) (cut from `origin/v2` at `eb6eab9`, with no upstream so it cannot push to `v2` by accident):
  - The commit-message check covers only commits not in `origin/v2` (merge-base). `node --test test/quality-rules.test.js`: 15 of 15 pass. `check.mjs commits`: 0 commits checked from `eb6eab9`. An explicit range over Om's last 3 commits exits 1, which is why the default range now excludes them.
  - `.claude/settings.json` denies `git commit -n*`, `git commit *-n *`, `git -c core.hooksPath*` and `git config core.hooksPath*`.
  - `docs/Momentum_UI_Source.zip` deleted after `diff -rq` against `docs/arc/design/source/`. A SHA-256 list of all 126 files is in `changes/2026-11-23-ui-zip-deletion.md`.
  - Short review gate (code, security, compliance, verification): CONDITIONAL GO, `reviews/SETUP-review.md`. Quality tests 17 of 17 after the review fixes.
- PKBX0041 final reference (data engineer, read-only, 100 MiB billed in two jobs): 7.3% moisture, 42.0% RH, 18.5 °C (the modeled winter median 18.35 °C; founders asked for about 19 °C). 62.9 to 55.1 kg, ₹3,355 to ₹2,934, a reduction of 7.8 kg and ₹421. Roll 162 to 170 °C, gum HIGH to MED, viscosity 32 to 45 s. All five risks fall. Job `arc_pkbx0041_m2_t19_rh420_t185_20261122T212952Z`. Model estimate, awaiting Om sign-off. README, `DEMO_LOT` and designs not edited (ARC-M6-09, ARC-M6-19).
- New tickets: ARC-M1-11 (replayed APPROVED status undefined, `job-draft-persistence.test.js:508`), ARC-M1-13 (weather timeout test fails only in the full run), ARC-M1-14 (no Vertex `safetySettings`), ARC-M1-15 (check safety names against current Vertex docs), ARC-M2-07 (`npm run eval:offline`), ARC-M1-16 (stale m_* fixtures), ARC-M6-19 (design figures after sign-off).
- Plan extended to production readiness: Phase B, M9 to M14 (`tickets/M9-M14-production-readiness.md`), and a production-ready definition in `00-plan.md` section 9.
- ARC-M0-06 merged (`5dd674f`): O10 now allows 2 attempts for a typed data question and 0 for a chip; J10 job-card retrieval (AC10.1 to AC10.11, design gap G15); J11 recovery (AC11.1 to AC11.11, design gap G16); PROPOSED latency targets (spec section 3.5; `plan_lot` p50 30 s, p95 50 s, over 60 s fails); Q7 to Q11 marked answered. Follow-ups placed in ARC-M2-01, ARC-M2-05 and ARC-M3-03.
- ARC-M0-04 question list for Om: `data/om-signoff-request.md` (`00ff9c1`). Waiting for the founders to send it.
- **M0 gate: GO** (2026-11-23, `reviews/M0-review.md`, `arc/main` at `b26b4f3`). All eight reviewers at GO after three repair rounds. Evals NOT RUN (no suites yet).
- ARC-M1-15 merged: `data/vertex-safety-reference.md`. QA lead PASS on all three ACs. The free `countTokens` checks were re-run on 2026-11-23: `systemInstruction` and `thinkingLevel` accepted, unknown fields rejected. `safetySettings` and `toolConfig` are confirmed in the docs only; live confirmation is a merge condition of ARC-M1-14.
- ARC-M1-01 merged: route logic moved into `src/commands/` (10 commands, 3 helpers, 9 commits). QA PASS. `npm test` 611, 610 pass, 1 known fail (ARC-M1-11); acceptance 317, 316 pass. Base and branch gave identical status, headers and bodies on 24 requests in both demo modes. Follow-up: the parity test missed a dropped `currency` query and checks only the PDF header.
- ARC-M1-01 parity follow-up merged (`39b55fc`). QA PASS: a dropped `currency` query and a truncated PDF now both fail the test.
- ARC-M1-11 merged (`661e664`). The replay loader rejected approved records without `evidence`; missing `evidence` is now read as `[]`. QA PASS on all five checks; status and audit checks are not loosened. `npm test` on `arc/main`: 612 tests, 612 pass, 0 fail, 0 cancelled.
- ARC-M1-11 test follow-up merged (`3c5ee85`): the new replay test now fails without the fix. QA PASS.
- ARC-M1-02 merged: `src/google-cloud/firestore-rest.js` (shared codecs, transactions, preconditions) and `src/state-schemas.js` (all `04` section 2 documents). Both existing adapters use the helper, and their tests are unchanged. QA PASS on all six checks; 7 of 8 helper mutations caught. `npm test` 643 of 643. Tech-lead decision: `ArcEventDocSchema` requires `waitingFor` exactly on `step.waiting_for_user`, following `04` section 2.6 and I6.
- ARC-M1-02 timestamp test merged (`5891192`), checked by the delivery lead: the mutation fails the test.
- ARC-M1-04 done (cloud change): 13 Firestore TTL policies on `expiresAt` created on 2026-11-23, state CREATING at read-back. Record: `changes/2026-11-23-firestore-ttl-policies.md`. Cost: no charge for the policies; deletes are inside the free tier at demo load.

## In progress

- Running in parallel: ARC-M1-03 (fingerprint and optimizer default), ARC-M1-06 (durable PO reviews), ARC-M1-07 (durable traces), ARC-M1-09 (rate-limit key), ARC-M1-18 (PDF labels), ARC-M1-12 and ARC-M1-14 (Gemini request and safety settings, with 2 to 4 live smoke calls under $0.01).
- CI "Unit tests" is expected to fail on `arc/main` until ARC-M1-11 lands (`test/job-draft-persistence.test.js:508`). No CI run exists yet; nothing has been pushed.

## Blocked

- None. Om's sign-offs (ARC-M0-04) are needed by 26 Nov for the PKBX0041 reference and the weather label.

## Next

1. Finish the M0 gate: merge the round-2 repairs, then the reviewers re-check them.
2. After M0 is GO: QA-verify and merge ARC-M1-15, resume and finish ARC-M1-01, then continue M1 in ticket order.

## Open founder questions

Asked only when a ticket needs them.
- F2 remaining: the pitch slot time. Until it is known, the 80-attempt pitch reserve covers all of 4 December (SGT).
- F4: whether Billing credits cover Vertex AI and Cloud Run (console check). Blocks the first cost-bearing cloud change.
- D1: Om's sign-offs (ARC-M0-04). D2: where `sid_pack.zip` is. D5: Phase B dates and plant profile.

## Known risks

- Old PKBX0041 figures (100.4 to 83.0 kg, ₹925 from the 15 October m_* run; also 86% RH, 35 s viscosity and a strength trade-off) still appear in the README, `src/ui/workflow.js` `DEMO_LOT` and 15 design screens (list in `data/PKBX0041-m2-rerun.md`). The model-trust panels in the designs show the old R² values; the current values are 0.47, 0.52, 0.39, 0.64 and 0.11. Fixed by ARC-M6-09 and ARC-M6-19 after Om signs off.
- Rehearsals and the pitch share one Gemini daily cap (300 on `momentum`, 100 on `prepagent`), which resets at midnight IST (02:30 Singapore). Both services count against the same Firestore day document.
- PO review state is an in-memory Map with a 30-minute TTL. `momentum` now runs up to 4 instances. Session affinity is on, but it is best-effort, so a review can still be lost. Durable review state is needed.
- The optimizer's code default byte limit (80 MiB, `readOptimizerQueryBudget` in `src/service-ports.js`) is below the 90 MiB each run is billed. Production works only because `USTAAD_OPTIMIZER_MAX_BYTES_BILLED` is set to 100 MiB. Needs a ticket.
- `tools/validate-optimizer-acceptance.mjs` still checks against the October m_* values.
- Superseded on 2026-11-23: the 24.5 °C reference (8.2 kg, ₹437) is replaced by the 18.5 °C run (7.8 kg, ₹421) in Done. The tables in `data/PKBX0041-m2-rerun.md` and `data/stale-claims.md` that list 24.5 °C values as the "new value" must move to the 18.5 °C figures after Om signs off.
- `getInsights` has no live adapter, and `durableIdempotencyConfigured` is hard-coded `false` (`index.mjs:711`, `723`); turning either on is a code change (ARC-M1-05, ARC-M4-01).
- The shared Gemini counter can lock one service out for a day when `momentum` (300) and `prepagent` (100) disagree on the cap (`decodeCount`, design E7). Not yet seen live. Founder question F1.
- The `/jobs` fingerprint ignores conditions (design E6); fix in ARC-M1-03 before Arc calls `/jobs`.
- The lot generator (`sid_pack.zip`, seed 20261010) is not in the repo (ARC-M0-05).

## Decision log

| Date | Decision | Why | Who |
|---|---|---|---|
| 2026-11-22 | Arc work happens on `arc/*` feature branches, never on `v2` directly | CLAUDE.md section 7: do not rewrite Om's `v2` branch | Delivery lead |
| 2026-11-22 | No merges into `main` or `v2` for now. Arc stays on its own branch until the founders decide otherwise | Keep Arc separate from the live and V2 lines | Founders |
| 2026-11-22 | `docs/arc/reference/` added to `.gitignore` | It was excluded only by one clone's `.git/info/exclude` | Founders |
| 2026-11-22 | Plant location is Pune. Weather comes from the Google Maps Platform Weather API through a backend tool, labelled "public weather record, not a plant sensor" | Om's plant is in Pune | Founders |
| 2026-11-22 | Eval thresholds are signed off by the named founders, not by an agent | A reviewer cannot set its own pass mark | Founders |
| 2026-11-22 | Paper moisture is pre-filled at 7.3% and always editable; the entered value is the one used end to end | Example default, never hard-coded | Founders |
| 2026-11-22 | Photo diagnosis keeps the ten approved photos and adds user uploads in Arc and the dashboard | Real use needs own photos | Founders |
| 2026-11-22 | PO prompt-injection evals run at significant milestone gates | Cost and cap control | Founders |
| 2026-11-22 | Re-run PKBX0041 on the m2_* models with read-only queries | Old figure is from the m_* models | Founders |
| 2026-11-22 | The on-screen PKBX0041 reference is the m2_* run at 7.3% moisture, replacing 17.4 kg, ₹925. Humidity is set to the value the modeled history pairs with 7.3% moisture, not 86% | The old figure does not reproduce on m2_*; 86% RH is unrealistic at 7.3% | Founders (Om to confirm realism) |
| 2026-11-22 | `momentum`: Gemini cap 100 to 300, max instances 2 to 4, session affinity on. Live on `momentum-00023-yaz`; rollback to `momentum-v2be-8`. Record: `changes/2026-11-22-momentum-limits.md` | Arc needs more calls; affinity reduces lost PO reviews | Founders |
| 2026-11-23 | Q7: every approved page ships, dark and light, built by parallel agents. Gaps between UI and backend are listed in `00-plan.md` section 6, each with a ticket | Founders want the full UI built without cuts | Founders |
| 2026-11-23 | A3: Gemini writes chat answers from the same turn's tool results; code checks every number and ID, and the template answer is the fallback. The AI architect had recommended templates only; that position stays recorded in ADR-0009 | Gen AI usage award; the checks keep numeric fidelity | Founders |
| 2026-11-23 | F3: Cloud Run min 1 and max 6 to 2 Dec, min 2 on 3 and 4 Dec, min 0 and max 4 from 5 Dec. Applied in ARC-M8-02 with a change record, after the prices are checked | No cold start on stage; saturation at max 2 was seen on 20 Nov | Founders |
| 2026-11-23 | Q10 superseded by Q7: Operator-Phone is built with its backend (ARC-M6-13), labelled as a simulated demo session | Follows Q7 | Delivery lead |
| 2026-11-23 | Keep PKBX0041 as the reference lot with the m2 re-run figures, labelled as a model estimate; do not chase a bigger number | Credibility | Founders |
| 2026-11-23 | Ambient temperature provisional at the December to February band (asked for about 19 °C; run at the modeled median 18.5 °C), awaiting Om | 24.5 °C matched only October and November | Founders (Om to confirm) |
| 2026-11-23 | Delete `docs/Momentum_UI_Source.zip` | Duplicate of `docs/arc/design/source/` | Founders |
| 2026-11-23 | README, `DEMO_LOT` and design files are not edited until the figures are final; the edits are ARC-M6-09 and ARC-M6-19 | Change claims only with final evidence | Founders |
| 2026-11-23 | Commit check covers only commits not in `origin/v2`; hook bypass commands denied | Om's commits are never flagged or rewritten | Founders |
| 2026-11-23 | RAI thresholds stay PROPOSED until the plan is approved | A reviewer cannot set its own pass mark | Founders |
| 2026-11-23 | Settings hardening, option (a): `bq query` and `gcloud auth print-access-token` move to ask; `node`, `npm` and `npx` are allowed only for named test, check and build commands; `find` is no longer auto-allowed; `cat` and `grep` on `.env` files are denied; more hook bypasses are denied (`-an`, trailing `-n`, abbreviated `--no-verify`, `git -c` hooks, any `git config` of `core.hooksPath`, git config env vars); edits to `scripts/git-hooks`, `scripts/quality` and `.github/workflows` ask first. CI remains the real gate | Setup gate: security B2 and N1 to N3, code review finding 1 | Founders |
| 2026-11-23 | Plan approved, Phases A and B. RAI thresholds signed off (A5). The plan's recommendations are accepted for Q8, Q9, Q11 (with Om's review), A1, A2, A4, A6, F5, D4 and D6 | Founder approval | Founders |
| 2026-11-23 | `arc/main` cut from `origin/v2` (`eb6eab9`), no upstream, fast-forwarded to `arc/setup` (`8bc30fd`) | ARC-M0-02 | Delivery lead |
| 2026-11-23 | M0 closed with GO from all eight reviewers | `reviews/M0-review.md` | Delivery lead |
| 2026-11-23 | `ArcEventDocSchema` requires `waitingFor` exactly on `step.waiting_for_user` events | `04` section 2.6 and I6 say the event carries the same `waitingFor` | Tech lead |
| 2026-11-23 | F1: the old `prepagent` Cloud Run service stays on, unchanged. ARC-M1-08 moves `momentum` to its own budget counters (`budget_counters`), so the shared `gemini_daily_usage` document can no longer lock Momentum out. No interim change to `prepagent` unless the founders ask | People may still open the older service; the submitted product is Momentum on the `momentum` service | Founders |
| 2026-11-23 | F2 (partial): Google Cloud credits total 25,000; the founders set aside 10,000 for this build. Currency to confirm; read as INR, matching the existing ₹5,000 alert | The worst-case cost on call-count limits (about ₹1.2 lakh over 13 days) is above 10,000, so ARC-M1-08 adds rupee caps from Gemini `usageMetadata`, and ARC-M8-02 adds a ₹10,000 billing budget with alerts at 50%, 90% and 100% | Founders; delivery lead proposal |
| 2026-11-23 | F2: the budget is ₹10,000 (INR) out of 25,000 in credits. Gemini stops for the day at about ₹600 on `momentum` and about ₹200 on the eval counter, alongside the attempt limits. The project gets a ₹10,000 billing budget with alerts at 50%, 90% and 100% (ARC-M8-02). The pitch reserve of 80 attempts covers all of 4 Dec SGT until the slot time is known | Typical spend about ₹9,000 to 5 Dec; rupee caps keep the worst case under ₹10,000 | Founders |
