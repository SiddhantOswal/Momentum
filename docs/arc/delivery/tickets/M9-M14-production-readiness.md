# Phase B: production readiness (M9 to M14)

Phase A (M0 to M8) ends with the finals release candidate on 30 Nov. Phase B takes Momentum and Arc from a labelled demo to a service a plant can run every day. It starts after the finals, from 8 Dec, and each milestone ends with the same review gate. Dates are proposals for the founders to confirm. The exit test for Phase B is the production-ready definition in `00-plan.md` section 9.

Nothing in Phase B changes a Phase A label until the matching capability exists. For example, "Demo session, simulated" stays on approvals until ARC-M9-02 ships.

## M9 Identity, roles and named approvals (proposed 8 to 19 Dec)

### ARC-M9-01 Google sign-in with roles (P0)
- Goal: switch on the existing Google sign-in (`src/user-session-auth.js`, `/api/auth/session`, `USTAAD_AUTH_MODE`) with the roles operator, supervisor and manager, held in Firestore and managed by a manager. Demo mode stays available only on a separate demo service.
- AC: every route checks the role it needs. Only supervisors and managers can approve. An expired session is refused. Role changes are written to an audit record.
- Depends on: M8. Owner: backend engineer; security reviewer.
- Test plan: route tests for each role, a session-expiry test and a browser sign-in test.

### ARC-M9-02 Named supervisor approval (P0)
- Goal: the approval records the signed-in supervisor's identity and time. The card and the PDF show the name, and the "simulated" label is removed only for these approvals.
- AC: `authenticatedHuman: true` only with a verified Google identity. The demo service still labels approvals as simulated.
- Depends on: M9-01, M1-10. Owner: backend engineer and frontend engineer.
- Test plan: an approval audit test, a PDF content check and a provenance-labels case.

### ARC-M9-03 Real purchase orders (P0)
- Goal: accept real customer POs (`USTAAD_ACCEPT_REAL_ORDERS`) for signed-in users, with file type and size checks, malware scanning before storage, and a retention rule.
- AC: the synthetic allowlist stays enforced on the demo service. Real POs are readable only by their plant's users. Injection handling and evals cover real-PO shapes.
- Depends on: M9-01, M11-02. Owner: backend engineer; security reviewer.
- Test plan: route tests, plus the `po-injection` suite extended with real-PO layouts.

## M10 Environments, CI/CD and infrastructure as code (proposed 8 to 19 Dec, in parallel with M9)

### ARC-M10-01 Separate staging and production (P0)
- Goal: a staging project (or services and datasets with clear names) with its own Firestore, BigQuery dataset, bucket and Gemini budget. Production data is never written by staging. ADR required.
- AC: a staging deploy cannot reach production resources (checked with IAM). The data copy into staging is synthetic or masked.
- Depends on: M8. Owner: solutions architect and release manager.
- Test plan: IAM policy checks and a staging smoke run.

### ARC-M10-02 Build and deploy pipeline (P0)
- Goal: Cloud Build (or GitHub Actions with Workload Identity Federation, decided by ADR) builds the image from a tagged commit and pushes it to Artifact Registry, deploys to staging, runs the preflight and evals, then promotes the same image to production with a canary traffic split and automatic rollback on a failed health check.
- AC: no manual `gcloud run deploy` is needed. Every production revision traces to a commit and a passed gate. Rollback is one command and is drilled.
- Depends on: M10-01, M8-01. Owner: release manager.
- Test plan: a pipeline dry run, a canary with a forced failure that rolls back, and a provenance check from revision to commit.

### ARC-M10-03 Infrastructure as code (P1)
- Goal: Cloud Run services, Firestore indexes and TTLs, BigQuery datasets and views, buckets, service accounts, secrets (names only) and budgets defined in code (Terraform or scripted `gcloud`, decided by ADR) and reviewed like code.
- AC: a plan against production shows no drift. New environments are created from code.
- Depends on: M10-01. Owner: solutions architect.
- Test plan: a drift check in CI.

### ARC-M10-04 Branch protection and required checks (P0)
- Goal: `arc/main` and `main` require a PR, the `quality` workflow, the unit tests, the offline evals and one review. Force-push is blocked.
- AC: a PR with a failing check cannot merge.
- Depends on: M2-07. Owner: release manager.
- Test plan: a test PR with a failing check.

## M11 Security and privacy (proposed 5 to 16 Jan)

### ARC-M11-01 Close public access (P0)
- Goal: remove `allUsers` invoker access from production. Users reach the app through sign-in (Identity-Aware Proxy or the app's own auth, decided by ADR). Cloud Armor rate limits sit in front, and service accounts are least-privilege, one per service.
- AC: an unauthenticated request is refused at the edge. Every service account role is justified in a table.
- Depends on: M9-01, M10-03. Owner: security reviewer and solutions architect.
- Test plan: unauthenticated probes, plus an IAM review.

### ARC-M11-02 Privacy and data protection (P0)
- Goal: a data inventory of what personal data exists (user identities, any names in POs, uploaded photos), its lawful basis under India's Digital Personal Data Protection Act 2023, retention per data type, deletion on request, and log redaction.
- AC: no PO text, photo content or personal data appears in logs. Retention rules are applied by TTL or lifecycle policies. A deletion request can be fulfilled within the stated time.
- Depends on: M9-03. Owner: compliance reviewer and backend engineer.
- Test plan: a log scan in staging, a lifecycle-policy check and a deletion drill.

### ARC-M11-03 Threat model and penetration test (P0)
- Goal: a threat model covering auth, prompt injection, approval bypass, data exposure and cost abuse, then an external or independent penetration test before launch.
- AC: every high finding is fixed, and medium findings are fixed or accepted in writing by the founders.
- Depends on: M11-01. Owner: security reviewer.
- Test plan: the test report, plus regression tests for each fix.

### ARC-M11-04 Dependency and image scanning (P1)
- Goal: npm audit and Artifact Registry vulnerability scanning in CI, with an update policy and a lockfile check.
- AC: no known critical vulnerability in a production image.
- Depends on: M10-02. Owner: release manager.
- Test plan: the CI scan results.

## M12 Reliability, observability and cost control (proposed 5 to 23 Jan)

### ARC-M12-01 Service levels and alerting (P0)
- Goal: SLOs for availability, p95 latency per Arc step and per dashboard route, and Gemini error rate, measured from M7 and M8 data. Cloud Monitoring dashboards, alert policies routed to a named on-call, and Error Reporting.
- AC: each SLO has a measured baseline, an alert and a runbook entry.
- Depends on: M7-04, M10-01. Owner: release manager.
- Test plan: a forced alert in staging reaches the on-call.

### ARC-M12-02 Backups and disaster recovery (P0)
- Goal: Firestore point-in-time recovery and delete protection on (both off today), scheduled Firestore exports, BigQuery table snapshots for `job_sheets`, `items` and `lots`, bucket versioning, and a written recovery runbook with targets (RPO and RTO).
- AC: a restore drill in staging meets the targets, and its time is recorded.
- Depends on: M10-03. Owner: solutions architect and data engineer.
- Test plan: the restore drill.

### ARC-M12-03 Hard cost limits (P0)
- Goal: keep the in-app Gemini budget (ADR-0004), and add a billing budget per environment that publishes to Pub/Sub at thresholds and switches Gemini off automatically at 100%. Monthly cost reports go to the founders.
- AC: a simulated budget breach in staging turns Gemini off and shows the designed cap-reached state.
- Depends on: M10-01. Owner: release manager.
- Test plan: the breach drill.

### ARC-M12-04 Production load and soak test (P1)
- Goal: load at the expected plant profile (founders to give users, lots per day and plants), plus a 24-hour soak, on staging.
- AC: the SLOs hold, with no lost or duplicated work, and memory and instance counts stay stable.
- Depends on: M12-01. Owner: QA lead.
- Test plan: the load reports.

### ARC-M12-05 Incident response (P1)
- Goal: an on-call rota, a severity scale, an incident template, a status-communication plan and a post-incident review process.
- AC: one game-day exercise is run and reviewed.
- Depends on: M12-01. Owner: release manager.
- Test plan: the game-day record.

## M13 Data and model operations (proposed 12 Jan to 6 Feb)

### ARC-M13-01 Measured scrap feedback pipeline (P0)
- Goal: operator-entered actual scrap (ARC-M6-15) flows into a measured-results table with provenance "operator-entered actual". Insights shows estimate against actual only where actuals exist.
- AC: no modeled value is ever shown as measured. Measured savings are reported only from lots with actuals, with their count.
- Depends on: M6-15, M9-01. Owner: data engineer.
- Test plan: provenance-labels cases, plus a reconciliation query.

### ARC-M13-02 Plant sensor ingestion (P1)
- Goal: the `ConditionsSource` IoT implementation (ADR-0005), with a Pub/Sub subscription into BigQuery for real sensors (the topic `sensor-readings` exists with no subscription), device identity, unit and range checks, and staleness rules.
- AC: sensor values carry "plant sensor" provenance only from registered devices. Stale readings fall back to operator entry with a note.
- Depends on: Om (sensor hardware and machine ranges), M13-01. Owner: data engineer and backend engineer.
- Test plan: an ingestion test with a device simulator labelled simulated, plus range-rejection tests.

### ARC-M13-03 Model monitoring and retraining gate (P0)
- Goal: track the m2 models on measured lots (R² and error by defect, input drift on conditions). Retraining follows a documented process with an acceptance gate and a named owner's decision, like D4-2026-11-20-OM.
- AC: a model version change is never deployed without an owner decision record and an evaluation on held-out measured lots.
- Depends on: M13-01. Owner: data engineer; Om as model owner.
- Test plan: a monitoring query, plus a dry run of the retraining gate.

### ARC-M13-04 Data lineage and generator (P1)
- Goal: every table has an owner, a provenance column or label, and a documented source. The lot generator (ARC-M0-05) is versioned. Synthetic data never lands in production tables.
- AC: a lineage table in `data/` covers every dataset.
- Depends on: M0-05. Owner: data engineer.
- Test plan: an audit query over INFORMATION_SCHEMA.

## M14 Plant pilot and production launch (proposed 2 Feb to 6 Mar)

### ARC-M14-01 Pilot at Om's plant (P0)
- Goal: four weeks of real use by named operators and supervisors at one plant, on real POs and with measured scrap.
- AC: a pilot report with the number of lots, measured scrap against estimate, time and steps against the manual route (measured), incidents and user feedback. It is labelled "pilot result, one plant".
- Depends on: M9, M11, M12, M13-01, and Om's agreement. Owner: business analyst and Om.
- Test plan: the pilot protocol, agreed before it starts.

### ARC-M14-02 Accessibility (P0)
- Goal: WCAG 2.2 AA across the dashboard and Arc in both themes: keyboard paths, focus order, contrast, screen-reader labels and reduced motion.
- AC: an automated check passes and a manual audit has no open AA failures.
- Depends on: M6. Owner: frontend engineer.
- Test plan: axe in Playwright on every page, plus a manual audit record.

### ARC-M14-03 Languages (P2)
- Goal: the existing `src/locales` extended to the UI and Arc for the plant's languages (founders and Om to choose). Arc answers in the user's language with the same checks.
- AC: every string comes from a locale file, and numeric-fidelity holds in each language.
- Depends on: M14-01 feedback. Owner: frontend engineer and AI engineer.
- Test plan: locale coverage, plus eval cases per language.

### ARC-M14-04 User documentation, training and support (P1)
- Goal: an operator guide, a supervisor guide, an admin guide, a support channel with response times, and in-app help.
- AC: pilot users complete the main tasks using the guides alone.
- Depends on: M14-01. Owner: product manager.
- Test plan: a usability session with pilot users.

### ARC-M14-05 Production launch gate (P0)
- Goal: the full review gate, plus the production-ready checklist in `00-plan.md` section 9, signed by the founders.
- AC: every checklist item has evidence, and the founders make the go or no-go call.
- Depends on: all P0 tickets in Phase B. Owner: release manager.
- Test plan: `/review-gate`, plus the checklist.
