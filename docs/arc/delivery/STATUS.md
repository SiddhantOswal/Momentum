# Arc delivery status

Last updated: 2026-11-23. Finals: 3 to 5 December 2026, pitch on 4 December.

## Done

- Delivery folders created on branch `arc/m0-discovery`, cut from `v2` at `eb6eab9`. The work moved to `arc/setup` on 2026-11-23 for the first commit.
- `01-business-requirements.md` written (business analyst). Not yet reviewed. No tests or evals run; every target is a proposal with baseline NOT MEASURED.

- `02-product-spec.md` written (product manager). Not yet reviewed. Thresholds are PROPOSED, and baselines are NOT MEASURED. It raises founder questions Q7 to Q11.

- PKBX0041 re-run on the m2_* models (data engineer, read-only). The published 17.4 kg / ₹925 does not reproduce. The m2_* models give 23.2 kg / ₹1,035 at 10.8% moisture and 16.5 kg / ₹879 at 7.3% moisture and 86% RH. Label: model estimate on m2_* models, not a measured saving. Record: `data/PKBX0041-m2-rerun.md`.
- `03-discovery-audit.md` (solutions architect): v2 map, capability inventory, in-memory state. Read-only; the audit ran 599 local tests, with 597 passing, 1 failing (`job-draft-persistence.test.js:508`) and 1 cancelled.
- `data/data-audit.md` and `data/stale-claims.md` (data engineer): 15 read-only BigQuery jobs, 230 MiB billed. m2 R² re-measured: 0.4682, 0.5194, 0.388, 0.6404, 0.1081, matching `config/model-acceptance.json`. The data engineer also ran the local test suite once by mistake, with output discarded; it is not used as evidence.
- ADR-0001 (build on v2; read-only Codex audit, nothing in that repo touched).
- `04-technical-design.md` with ADR-0002 to ADR-0006 (solutions architect) and `05-ai-design.md` with ADR-0007 to ADR-0011 (AI architect). All Proposed. No code or cloud changes.
- Vertex AI model check (2026-11-22, free `countTokens` calls): `gemini-3.5-flash` and `gemini-3.5-flash-lite` are served in `asia-south1`; 3.6, 3.7 and 3.8 Flash and 3.1 Pro Preview are global only; the 2.5 family is not served. Prices read from the Vertex pricing page on the same day.
- Tickets for M0 to M8 in `tickets/`, and `00-plan.md`.

- ARC-SETUP-01 built on branch `arc/setup`, in review (cut from `origin/v2` at `eb6eab9`, with no upstream so it cannot push to `v2` by accident):
  - The commit-message check covers only commits not in `origin/v2` (merge-base). `node --test test/quality-rules.test.js`: 15 of 15 pass. `check.mjs commits`: 0 commits checked from `eb6eab9`. An explicit range over Om's last 3 commits exits 1, which is why the default range now excludes them.
  - `.claude/settings.json` denies `git commit -n*`, `git commit *-n *`, `git -c core.hooksPath*` and `git config core.hooksPath*`.
  - `docs/Momentum_UI_Source.zip` deleted after `diff -rq` against `docs/arc/design/source/`. A SHA-256 list of all 126 files is in `changes/2026-11-23-ui-zip-deletion.md`.
  - Short review gate (code, security, compliance, verification): CONDITIONAL GO, `reviews/SETUP-review.md`. Quality tests 17 of 17 after the review fixes.
- PKBX0041 final reference (data engineer, read-only, 100 MiB billed in two jobs): 7.3% moisture, 42.0% RH, 18.5 °C (the modeled winter median 18.35 °C; founders asked for about 19 °C). 62.9 to 55.1 kg, ₹3,355 to ₹2,934, a reduction of 7.8 kg and ₹421. Roll 162 to 170 °C, gum HIGH to MED, viscosity 32 to 45 s. All five risks fall. Job `arc_pkbx0041_m2_t19_rh420_t185_20261122T212952Z`. Model estimate, awaiting Om sign-off. README, `DEMO_LOT` and designs not edited (ARC-M6-09, ARC-M6-19).
- New tickets: ARC-M1-11 (replayed APPROVED status undefined, `job-draft-persistence.test.js:508`), ARC-M1-13 (weather timeout test fails only in the full run), ARC-M1-14 (no Vertex `safetySettings`), ARC-M1-15 (check safety names against current Vertex docs), ARC-M2-07 (`npm run eval:offline`), ARC-M1-16 (stale m_* fixtures), ARC-M6-19 (design figures after sign-off).
- Plan extended to production readiness: Phase B, M9 to M14 (`tickets/M9-M14-production-readiness.md`), and a production-ready definition in `00-plan.md` section 9.
- ARC-M0-06 merged (`5dd674f`): O10 now allows 2 attempts for a typed data question and 0 for a chip; J10 job-card retrieval (AC10.1 to AC10.11, design gap G15); J11 recovery (AC11.1 to AC11.11, design gap G16); PROPOSED latency targets (spec section 3.5; `plan_lot` p50 30 s, p95 50 s, over 60 s fails); Q7 to Q11 marked answered. Follow-ups placed in ARC-M2-01, ARC-M2-05 and ARC-M3-03.
- ARC-M0-04 question list for Om: `data/om-signoff-request.md` (`00ff9c1`). Waiting for the founders to send it.

## In progress

- **Resume point (2026-11-23).** ARC-M0-03, the full M0 review gate over `origin/v2..arc/main` (252 files, 12 commits at `ed821e4` plus this status commit), was started with all eight reviewers in parallel. The account usage limit stopped them; it resets at 07:20 IST. On resume: collect or rerun each reviewer, write `reviews/M0-review.md`, fix blocking findings through their owners, and re-review.
- Built, not merged (they wait for QA and the M0 GO): ARC-M1-15 on `arc/ARC-M1-15-vertex-reference` (`3279481`). ARC-M1-01 on `arc/ARC-M1-01-commands` was being built in worktree `.claude/worktrees/agent-ae8940e3f24a159d2`; check its branch for commits and run `npm test` there before QA.

## Blocked

- None. Om's sign-offs (ARC-M0-04) are needed by 26 Nov for the PKBX0041 reference and the weather label.

## Next

1. ARC-M0-06, then the ARC-M0-03 gate.
2. M1, starting with ARC-M1-01 (move route logic into `src/commands/`).

## Open founder questions

Asked only when a ticket needs them.
- F1: which URL the competition submission lists (decides `prepagent` Gemini off or a separate counter). Blocks the ARC-M1-08 cloud change.
- F2: the time of the pitch slot (budget numbers accepted with the plan). Blocks the ARC-M1-08 reserve window.
- F4: whether Billing credits cover Vertex AI and Cloud Run (console check). Blocks the first cost-bearing cloud change.
- D1: Om's sign-offs (ARC-M0-04). D2: where `sid_pack.zip` is. D5: Phase B dates and plant profile.

## Known risks

- PKBX0041 (100.4 to 83.0 kg, ₹925) is a 15 October result from the old m_* models, but the README and 15 design screens show it as current (list in `data/PKBX0041-m2-rerun.md`).
- Several designs show the old R² values.
- Rehearsals and the pitch share one Gemini daily cap (300 on `momentum`, 100 on `prepagent`), which resets at midnight IST (02:30 Singapore). Both services count against the same Firestore day document.
- PO review state is an in-memory Map with a 30-minute TTL. `momentum` now runs up to 4 instances. Session affinity is on, but it is best-effort, so a review can still be lost. Durable review state is needed.
- The optimizer's code default byte limit (80 MiB, `readOptimizerQueryBudget` in `src/service-ports.js`) is below the 90 MiB each run is billed. Production works only because `USTAAD_OPTIMIZER_MAX_BYTES_BILLED` is set to 100 MiB. Needs a ticket.
- `tools/validate-optimizer-acceptance.mjs` still checks against the October m_* values.
- Superseded on 2026-11-23: the 24.5 °C reference (8.2 kg, ₹437) is replaced by the 18.5 °C run (7.8 kg, ₹421) in Done. The tables in `data/PKBX0041-m2-rerun.md` and `data/stale-claims.md` that list 24.5 °C values as the "new value" must move to the 18.5 °C figures after Om signs off.
- The README, `src/ui/workflow.js` `DEMO_LOT` and 15 design screens (light and dark) still show the old case (17.4 kg / ₹925, 86% RH, 35 s viscosity, strength trade-off). They are listed in `data/PKBX0041-m2-rerun.md`. None are edited yet.
- The "How far to trust this" panels in four designs show the old R² values. Current values: 0.47, 0.52, 0.39, 0.64, 0.11.
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
| 2026-11-22 | The on-screen PKBX0041 reference is the m2_* run at 7.3% moisture, replacing 17.4 kg / ₹925. Humidity is set to the value the modeled history pairs with 7.3% moisture, not 86% | The old figure does not reproduce on m2_*; 86% RH is unrealistic at 7.3% | Founders (Om to confirm realism) |
| 2026-11-22 | `momentum`: Gemini cap 100 to 300, max instances 2 to 4, session affinity on. Live on `momentum-00023-yaz`; rollback to `momentum-v2be-8`. Record: `changes/2026-11-22-momentum-limits.md` | Arc needs more calls; affinity reduces lost PO reviews | Founders |
| 2026-11-23 | Q7: every approved page ships, dark and light, built by parallel agents. Gaps between UI and backend are listed in `00-plan.md` section 6, each with a ticket | Founders want the full UI built without cuts | Founders |
| 2026-11-23 | A3: Gemini writes chat answers from the same turn's tool results; code checks every number and ID, and the template answer is the fallback. The AI architect had recommended templates only; that position stays recorded in ADR-0009 | Gen AI usage award; the checks keep numeric fidelity | Founders |
| 2026-11-23 | F3: Cloud Run min 1 and max 6 to 2 Dec, min 2 on 3 and 4 Dec, min 0 and max 4 from 5 Dec. Applied in ARC-M8-02 with a change record, after the prices are checked | No cold start on stage; saturation at max 2 was seen on 20 Nov | Founders |
| 2026-11-23 | Q10 superseded by Q7: Operator-Phone is built with its backend (ARC-M6-13), labelled as a simulated demo session | Follows Q7 | Delivery lead |
| 2026-11-23 | Keep PKBX0041 as the reference lot with the honest m2 re-run figures, labelled as a model estimate; do not chase a bigger number | Credibility | Founders |
| 2026-11-23 | Ambient temperature provisional at the December to February band (asked for about 19 °C; run at the modeled median 18.5 °C), awaiting Om | 24.5 °C matched only October and November | Founders (Om to confirm) |
| 2026-11-23 | Delete `docs/Momentum_UI_Source.zip` | Duplicate of `docs/arc/design/source/` | Founders |
| 2026-11-23 | README, `DEMO_LOT` and design files are not edited until the figures are final; the edits are ARC-M6-09 and ARC-M6-19 | Change claims only with final evidence | Founders |
| 2026-11-23 | Commit check covers only commits not in `origin/v2`; hook bypass commands denied | Om's commits are never flagged or rewritten | Founders |
| 2026-11-23 | RAI thresholds stay PROPOSED until the plan is approved | A reviewer cannot set its own pass mark | Founders |
| 2026-11-23 | Settings hardening, option (a): `bq query` and `gcloud auth print-access-token` move to ask; `node`, `npm` and `npx` are allowed only for named test, check and build commands; `find` is no longer auto-allowed; `cat` and `grep` on `.env` files are denied; more hook bypasses are denied (`-an`, trailing `-n`, abbreviated `--no-verify`, `git -c` hooks, any `git config` of `core.hooksPath`, git config env vars); edits to `scripts/git-hooks`, `scripts/quality` and `.github/workflows` ask first. CI remains the real gate | Setup gate: security B2 and N1 to N3, code review finding 1 | Founders |
| 2026-11-23 | Plan approved, Phases A and B. RAI thresholds signed off (A5). The plan's recommendations are accepted for Q8, Q9, Q11 (with Om's review), A1, A2, A4, A6, F5, D4 and D6 | Founder approval | Founders |
| 2026-11-23 | `arc/main` cut from `origin/v2` (`eb6eab9`), no upstream, fast-forwarded to `arc/setup` (`8bc30fd`) | ARC-M0-02 | Delivery lead |
