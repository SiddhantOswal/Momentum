# M7 evals, guardrails and hardening

Suites and proposed thresholds: `05-ai-design.md` section 7 and `responsible-ai.md`. Thresholds need founder sign-off (A5). Offline suites are built alongside each M2 to M5 ticket; this milestone completes them, runs the live suites and hardens the system.

### ARC-M7-01 Complete the offline suites (P0)
- Goal: `grounding`, `scope-refusal`, `off-topic`, `insufficient-data`, `po-injection`, `approval-bypass`, `numeric-fidelity`, `provenance-labels` and `tool-registry`, with the case counts in 05 section 7. V5 seeds are adapted into executable cases with their own oracles.
- AC: every suite runs in CI. Each has at least one case shown to fail when the guard is removed.
- Depends on: M2-07. Owner: AI engineer; QA lead checks that the cases can fail.
- Test plan: the CI run, plus a mutation run (guard disabled) recorded in the PR.

### ARC-M7-02 Live eval run on a separate counter (P0)
- Goal: run the live suites on a non-production revision with its own Gemini counter (decision A4), labelled "eval run, not the live service".
- AC: the report gives pass rates against the signed thresholds, with attempts used and cost. A suite that did not run is NOT RUN.
- Depends on: M7-01, M1-08, A4, A5. Owner: AI evals reviewer, independent of the AI engineer.
- Test plan: the run itself; the raw results kept under `docs/arc/delivery/evals/`.

### ARC-M7-03 PO injection variants (P0)
- Goal: 12 injected variants of PO1 to PO5 and 6 photo-injection images, run in a test mode that does not widen the live synthetic allowlist (spec Q5).
- AC: 0 capability changes, extra tool calls or approvals. The tripwire log records each attempt with no document text.
- Depends on: M7-01. Owner: AI engineer; security reviewer checks.
- Test plan: the live `po-injection` suite.

### ARC-M7-04 Load and failure rehearsal (P1)
- Goal: a load test at the demo profile (5 concurrent sessions, 40 lots and 150 turns a day) on a tagged revision, plus failure drills: Gemini error, BigQuery timeout, instance restart mid-plan, budget exhausted, weather down.
- AC: no lost review, duplicate job or double charge. Each failure shows its designed state. p95 latencies are recorded.
- Depends on: M3-01, M1-09. Owner: QA lead.
- Test plan: a scripted load run; drill results in `reviews/M7-load.md`.

### ARC-M7-05 Security pass (P0)
- Goal: review authentication and session scoping on the new routes, the unauthenticated routes (`/impact/summary`, `/fx`, `/conditions/weather`), input limits, secrets, IAM scope and the upload privacy note.
- AC: findings are fixed by their owners or accepted in writing by the founders.
- Depends on: M6-03. Owner: security reviewer.
- Test plan: the reviewer's checklist and any tests added for the fixes.

### ARC-M7-06 Measured time and steps saved (P0)
- Goal: measure O1 and O2. Scripted Playwright runs of the manual route and the Arc route with PO1, run 5 times each, count actions and time.
- AC: `data/arc-route-comparison.md` gives medians and ranges, labelled "demo-session count, not plant measurement". No figure is quoted before this runs.
- Depends on: M6-03, M6-06. Owner: QA lead; the verification auditor checks.
- Test plan: the runs themselves.
