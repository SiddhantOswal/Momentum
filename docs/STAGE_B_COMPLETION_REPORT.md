> **Latest final private-cloud evidence (15 October 2026):** [STAGE_B_FINAL_CLOUD_ACCEPTANCE_REPORT.md](STAGE_B_FINAL_CLOUD_ACCEPTANCE_REPORT.md). Historical results below remain preserved; full live PO-to-card acceptance is still model-evidence blocked.

# Stage B — scoped cloud evidence and Approach B integration

Updated 15 October 2026. **PARTIALLY VERIFIED; EXTERNAL / RELEASE BLOCKERS REMAIN.**

## Current result

Owner's final Approach B amends scope A: one application, no mandatory sign-in for hackathon participants, genuine approval/persistence with honest signed-demo actor provenance. Firebase production authentication is retained. This policy is implemented and locally tested, **not activated on Cloud Run**. Model acceptance, confirmation and canonical optimizer gates remain intact.

Details: [authorization contract](HACKATHON_DEMO_AUTHORIZATION.md), [timed verification and source hashes](evidence/HACKATHON_DEMO_LOCAL_VERIFICATION.json), [approval ledger](evidence/STAGE_B_APPROVAL_LEDGER.json).

## Approval ledger and real cloud evidence

All five original scopes were explicitly approved, including Firebase Terms/registration side effects. Approach B subsequently superseded mandatory Firebase login for hackathon access. No new cloud mutation was performed while implementing Approach B.

| Scope | Actually executed earlier in Stage B | Evidence / remaining boundary |
|---|---|---|
| A Firebase | Enabled Firebase/Identity Toolkit APIs; created exact custom role containing only `firebaseauth.users.get`; bound only the approved runtime account. One existing-project Firebase registration POST returned403. No app/provider/user/claim created. | `STAGE_B_FIREBASE_RESULT.json`, postflight and approval ledger. Permission diagnostic found all four documented prerequisites; no broader IAM granted. Owner Console registration remains relevant to production Firebase, **not a hackathon workflow prerequisite under Approach B**. No real human token accepted. |
| B counter | Published exact approved deny rules to existing default database. Exactly three real admin reservations, one sequential and two concurrent via independent clients; independently read count0→3. Anonymous read/write denied; state unchanged after denial checks. No Gemini call. | `STAGE_B_RULES_RESULT.json`, `STAGE_B_COUNTER_RESULT.json`, `STAGE_B_COUNTER_DENIAL_RESULT.json`. Count consumed, not reset/deleted. This proves admin transaction behavior, not runtime SA access or two deployed Cloud Run instances. |
| C budget | Corrected only threshold fractions to0.5/0.9/1.0; independently read back unchanged ₹5,000 monthly amount, project scope and notification configuration. | `STAGE_B_BUDGET_RESULT.json`. Recipient delivery, current spend and remaining credits unverified. ₹27,000 planning target is not a billing hard cap or replacement budget. |
| D audit schema | Added nullable JSON `approval_audit_json` only; independent schema confirms previous columns unchanged and zero rows before/after. Job `ustaad_approval_audit_schema_20261015`. | `STAGE_B_AUDIT_SCHEMA_RESULT.json`. No historical backfill or business record write. Runtime audit flag unchanged. Durable actor approval remains unverified. |
| E optimizer | Exactly one approved100MiB-ceiling query after preflight: `ustad_pkbx0041_acceptance_100m_20261015`. Independent results GET and real application decoder checked. | `STAGE_B_OPTIMIZER_RESULT.json`, `STAGE_B_OPTIMIZER_QUERY_RESULTS.json`.42 checks pass. Three child jobs billed90MiB total, below100MiB; actual currency charge/credits not known. Initial local collector mishandled CLI ASSERT wrapper; recovered saved response without re-executing query. |

PKBX0041 actual result: baseline10.18% /100.4kg /₹5,351; best170°C/MED/35s,8.42% /83kg /₹4,426; three changes;17.4kg /₹925 predicted savings;₹0 slowdown allowance. Canonical SQL SHA256 remains `9b6c048fe5d4185da707e09618165dae92a2312f0c4529edd0f9853d95b0b17b`. Isolated optimizer acceptance does not establish complete model acceptance or a live PO workflow.

Metadata postflight was captured in `STAGE_B_POSTFLIGHT.json` at2026-10-15T05:07:35Z. It is timestamped evidence, not a guarantee of later cloud state. No additional cloud inspection, provider request, reservation or infrastructure mutation was needed for Approach B.

## Exact implementation changes in this continuation

| Files | Behavior |
|---|---|
| `src/hackathon-demo-auth.js` | Explicit configured mode, HMAC-SHA256 two-hour signed sessions, no default secret, mandatory synthetic-only/audit configuration, privately branded demo principals, deterministic session job namespace. |
| `src/approval-authorization.js` | Production verified-supervisor policy plus isolated record-scoped demo policy; truthful actor provenance. |
| `index.mjs` | Same-origin Secure/HttpOnly/SameSite Strict session issuance, CSRF Origin checks, scoped job/card/feedback/trace access, anonymized-summary-only global insights policy, mode-aware availability and namespaced submissions. Existing model/confirmation gates retained. |
| `src/job-idempotency.js` | Validates optional server-derived HACK namespace while preserving existing key/payload replay and conflict checks. |
| `src/schemas.js` | Backward-compatible demo audit fields; complete matching demo actor/job namespace required together. No new cloud column required. |
| `src/google-cloud/job-sheet-repository.js`, `src/google-cloud/job-card-service.js` | Independent approval/card capability checks before reads/uploads; require durable audit for demo principals; same genuine persistence/read-back/reconciliation path. |
| `src/job-sheet-pdf.js` | Same renderer/card, accurate demonstration-approval disclaimer on namespaced records. Manufacturing stages unchanged. |
| `src/service-ports.js` | Hackathon mode never selects mock adapters and always requires shared Gemini accounting, including outside Cloud Run. |
| `src/supervisor-auth-client.js` | Reuses existing auth boundary; no-login session bootstrap, single-flight cookie setup, no automatic action/provider retry, expiry explanation, approval note, prototype provenance and approved PO1 download. Firebase branch retained. |
| `src/ui/api.js`, `src/ui/workflow.js` | Server-advertised hackathon display policy allows labeled simulated/manual inputs and impact; mock provider output still rejected. Production policy retained. Exact approval controls/design retained. |
| `test/hackathon-demo-auth.test.js`, `test/hackathon-demo-http.test.js`, `test/approval-audit.test.js`, `test/job-sheet-pdf.test.js`, `test/frontend-contracts.test.js`, `test/browser/frontend.spec.js` | Session integrity, expiry, instance key consistency, forged principals/headers, cross-session records, namespace/idempotency conflicts, concurrent approval, audit/read-back, PDF, failure paths and no-login browser journey. Local service doubles are explicitly labeled. |
| `test/app.test.js` | Await server exit during teardown; fixed observed fixed-port race without changing assertions. |
| Existing tracker/register/audit and this report | Reconcile new owner decision, actual cloud evidence and residual gates. |

Previously prepared Stage B admin-only counter/optimizer acceptance tools and their tests remain. UI handoff was explicitly confirmed before UI edits. The UI editor advanced HEAD from274a941 to22bea45; this agent did not commit/push/stage. Browser screenshots regenerated by tests are retained under `docs/evidence/approach-b/`; editor's committed screenshot baselines were preserved.

## Local verification

Timed commands and per-file source hashes are in `HACKATHON_DEMO_LOCAL_VERIFICATION.json`:

| Command | Actual final result |
|---|---|
| `node --test test/hackathon-demo-auth.test.js test/hackathon-demo-http.test.js test/approval-audit.test.js test/job-sheet-pdf.test.js test/provider-metering-contract.test.js test/firebase-supervisor-auth.test.js test/frontend-contracts.test.js` |55 passed,0 failed/skipped/cancelled |
| `npm run test:acceptance` |248 passed,0 failed/skipped/cancelled |
| `npm test` |485 passed,0 failed/skipped/cancelled |
| `npm run test:ui` |14 passed,0 failed/skipped;51.3s, local Chrome and injected service doubles |
| `node --check` per `index.mjs`, all runtime JS and tools MJS |67 modules passed |
| JSON parsing of `config/*.json` and `ops/**/*.json` |5 passed |
| `npm audit --omit=dev --json` |0 reported production dependency vulnerabilities |
| `git diff --check` |exit0 |

An earlier full run finished481pass/3fail: status/auth responses and one fetch failure exposed the existing test-server teardown race. After awaiting process exit, full reruns passed484/484, then485/485 after the added UI contract test. No assertions removed/weakened, no failures converted into skips. An initial new HTTP test was blocked by sandbox loopback restrictions; its permitted local rerun passed. Node/full suites exclude Playwright; browser results are reported separately.

## Workflow acceptance matrix

| Stage | Local evidence | Real service / deployed status |
|---|---|---|
| Approved fixture upload/extraction/review | Existing hash/schema/catalog tests plus browser fixture flow | Genuine Gemini extraction NOT executed; separate paid approval/runtime required |
| Conditions/operator settings confirmation | Server guards, simulated/manual provenance, stale labels, unconfirmed denial | Authenticated human no longer required for hackathon; real demo-session confirmation on candidate not exercised |
| Five risks | Prediction validation and fail-closed tests | Historical metrics exceed per-model thresholds; required evaluation membership/count/source/version review incomplete, gate BLOCKED |
| Optimizer | Contract/transport tests | Exact scoped PKBX0041 query PASS; app decision route still requires model acceptance |
| Grounded explanation/evidence | Schema/provenance/request tests | No genuine Gemini explanation in this pass |
| Draft persistence/read-back | Repository/idempotency/failure tests | No TEST DRAFT business write acceptance in this pass |
| Demo approval/audit | Concurrent/replay/forgery/read-back tests against BigQuery/Storage doubles | Nullable audit column exists; genuine demo actor write/read-back NOT exercised |
| PDF/card retrieval | Actual renderer text/stage tests; service doubles for GCS and UI | No genuine stored approved card retrieval acceptance |
| Shared Gemini cap | Deterministic race/failure tests | Three real admin reservations PASS; runtime/two-instance acceptance pending |
| Impact | Safe rendering/cache/schema tests; browser labels | Prior Stage A four-query evidence exists; deployed UI acceptance pending |
| Photos/learning | Canonical10-photo decision preserved | No paid classification; completed-lot truth/idempotency contract unresolved, writes remain disabled |

## Release and security verdicts

- Local deterministic demonstration/testing: **Conditionally Ready**; local backup is explicitly simulated. Approach B live-service flow safely refuses incomplete gates.
- Private cloud full workflow: **Not Ready**; model evidence, signing-key/runtime setup, controlled source/candidate and paid-call approval remain.
- Public judging: **Not Ready**; no public release/deployment approval; complete bounded private acceptance and release safeguards still required.
- General production / real factory: **Not Ready / out of V1 scope**; demo actor capabilities are deliberately unsuitable for real production approval.

No Approach B deployment, Cloud Run configuration/traffic/public access change, paid call, model evaluation/retraining or cloud business write occurred. Earlier approved A–E mutations are recorded above and must not be described as a no-cloud-mutation Stage B pass. Current local source is dirty/uncommitted; no source-to-image mapping for these changes exists. Previously observed Run revisions00005/00011 and private IAM are historical; re-inspect before release. No new known-good rollback image has been established.

## Inputs and next actions

1. **Om/model owner:** supply exact version-linked evaluation membership/counts, source snapshot/window and explicit reviewed feature-evidence artifact; alternatively separately approve a clearly new bounded evaluation contract. Numerical R² alone is insufficient. This remains the central live-decision blocker.
2. **Release owner + engineer:** authorize secure shared32-byte signing-key provisioning and the exact private-candidate configuration/build/deployment plan after source freeze. No secret should be sent in chat. The source is ready to prepare that concrete plan; no deployment is authorized yet.
3. **Owner:** separately approve the narrow paid Gemini synthetic acceptance proposal, provider attempt/token bounds, TEST JobSheet/approval/GCS acceptance operations and cost ceiling when model/runtime prerequisites pass. A–E approval does not cover these calls.
4. **Billing owner:** confirm notification receipt and actual spend/credits through available billing evidence; alerts are not hard caps.
5. **Optional production Firebase:** finish adding Firebase to the existing project in Console or share its exact error, then real Google sign-in yields an actual UID for owner verification. The supplied account and accepted Terms are already recorded; do not request them again. This is no longer required for hackathon Approach B.
6. **Optional full learning claim:** define completed-lot outcome truth, partial feedback and idempotency semantics. Do not invent manufacturing outcomes.

UI handoff and ten-photo inventory count are resolved. No missing-photo request or mandatory-supervisor-sign-in decision remains for the hackathon path.
