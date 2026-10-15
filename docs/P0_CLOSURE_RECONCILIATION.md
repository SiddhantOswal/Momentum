> **Superseding final consolidation —16 October2026 IST:** [FINAL_CONSOLIDATION_REPORT.md](FINAL_CONSOLIDATION_REPORT.md) and `docs/evidence/final-consolidation-20261015/` are the current status. Approach B retained; Firebase separate. Current tests99 focused/305 acceptance/516 full/24 browser, all pass. One isolated real TEST row now proves draft/approval-audit/PDF adapter transport, not model-enabled application acceptance. D4 stays BLOCKED. Ten photos already classified once7/10; no repeat. Current source reproducible but not newly built/deployed. Default/private traffic and max2 unchanged. Release approval and optional completed-lot outcome rules are separate from D4. Historical statements below (including zero rows, max12 or12-photo requirements) are superseded where contradictory.

# Ustaad — P0 closure and current-source reconciliation

15 October 2026. New evidence: `docs/evidence/p0-reconciliation-20261015/`. Historical live acceptance: [Stage B final report](STAGE_B_FINAL_CLOUD_ACCEPTANCE_REPORT.md).

## 1. Executive verdict and authority

**Full private PO-to-approved-card acceptance remains blocked by incomplete model evidence.** Shared Firestore accounting, corrected budget thresholds, the additive approval-audit schema and direct optimizer acceptance already exist. They were not repeated.

The owner reconfirmed **“Retain Approach B; Firebase remains separate.”** Signed demo sessions remain the hackathon policy. Firebase production authentication stays in the codebase; no authenticated human identity is fabricated. The owner subsequently confirmed that the other UI session finished, allowing a settled-source browser rerun.

The prompt's old HEAD, missing-counter and unsuccessful-optimizer starting facts are superseded by actual evidence. Current HEAD is `22bea45cad184cda737e3cd60468020722a38e5f`, with extensive unstaged and untracked work. The current guided UI and this backend fix are newer than the deployed V4 image. No clean-release or new-deployment claim is made.

## 2. Changes implemented in this pass

- **`src/model-acceptance.js`:** malformed historical evidence lists or entries now report blocked status instead of crashing status reporting. Accepted summaries use the accepted models, evaluation date and split; historical display metadata cannot override them. The acceptance predicate and all thresholds are unchanged.
- **`test/model-acceptance.test.js`:** two additional regression tests cover malformed evidence shapes/null entries and conflicting historical metadata. Positive examples are explicitly local test fixtures; they do not accept the real models.
- **`docs/MODEL_EVALUATION_APPROVAL_PROPOSAL.md`:** prepared a narrow optional new-evaluation alternative if historical membership/counts cannot be recovered. It specifies exact source archival, actual counts, model identity checks, six proposed capped queries and approval boundaries. Six exact proposed SQL files under `ops/evaluation-proposed/` were generated from saved model features and training labels, with version/etag/hash records. No new evaluation or dry run was executed.
- **Existing setup/approval documents and tracker:** reconciled completed scopes, optional Firebase status, current tests and remaining dependencies without deleting historical evidence.

No UI implementation or browser assertion was changed by this pass. All preexisting source changes were preserved. Only this run's generated screenshot differences were saved as new artifacts and restored to their exact owner-handoff bytes, rather than to Git HEAD.

## 3. Local verification

Exact commands, UTC start/end times, exits and logs: `FINAL_LOCAL_TESTS.json`, `BROWSER_FINAL.json` and `FINAL_STATIC_CHECKS.json` in the new evidence directory.

| Command/check | Current result |
|---|---|
| `node --test test/model-acceptance.test.js test/risk-prediction-service.test.js test/risk-optimization-service.test.js test/firebase-supervisor-auth.test.js test/firestore-gemini-attempt-store.test.js test/daily-gemini-call-cap.test.js test/approval-audit.test.js` | **80 passed**, 0 failed/skipped |
| `npm run test:acceptance` | **251 passed**, 0 failed/skipped |
| `npm test` | **501 passed**, 0 failed/skipped; full suite completed |
| `npm run test:ui` after ownership handoff | **24 passed**, 0 failed/skipped |
| `node --check` for runtime/tool modules | **70 passed** |
| Configuration parsing | **6 JSON, 3 YAML** passed |
| `npm audit --omit=dev --json` | **0 reported production dependency vulnerabilities** |
| `git diff --check` | Passed |

An earlier browser run overlapped the UI editor's changes: **16 passed, 8 failed**, retained in `LOCAL_TESTS.json` and `test-4.log`. It completed before an attempted cancellation, so no process was killed. After the owner confirmed handoff, the complete suite passed against the settled source. No assertions were weakened or failures converted to skips. The failures cannot be used as acceptance of a stable source state.

Successful local provider, persistence, approval and browser scenarios use clearly identified test doubles. They are not new cloud integration evidence. No container build or OS-image scan was performed in this pass; npm audit is not OS vulnerability scanning.

## 4. Current read-only cloud evidence

`CLOUD_READBACK.json` contains exact commands/GETs, timestamps, resources and results. `PROJECT_IDENTITY.json`, `FIRESTORE_DATABASE.json`, `ENABLED_APIS.json` and `SIGNING_SECRET_IAM.json` provide additional independent reads. Tokens were kept in memory and never recorded.

| Resource/check | Observed result | Verification limit |
|---|---|---|
| Project | `prepagent-hack`, number `514663464609`, active | Correct existing project reused |
| Firebase registration | GET404 `NOT_FOUND` | No new registration attempted after historical403 |
| Identity Toolkit configuration | GET404 `CONFIGURATION_NOT_FOUND` | No Google sign-in, web app or real token acceptance established |
| Firebase runtime custom role | Existing `ustaadSupervisorTokenVerifier`, only `firebaseauth.users.get`, runtime binding present | Not a reason to add another/broader role |
| Firestore | Existing `(default)`, Native/Standard, `asia-south1`, pessimistic concurrency, free-tier eligibility flag true | No new database or permission change |
| Daily counter | **18/100**, Asia/Kolkata, `ist-attempts-v1`; unchanged server timestamp | No reservation, refund or reset in this pass |
| Client rules | Existing deny ruleset `450fe5e1-e1b9-4e03-8a0b-e82e0d554fd8` still released | Prior real client-denial evidence retained |
| Budget | INR5,000/month; thresholds **0.5,0.9,1.0**, original project scope | Receipt, actual spend and remaining credits unknown |
| JobSheet schema | Nullable `approval_audit_json JSON`; **0 rows** | Schema is not successful approval/read-back evidence |
| Optimizer | Existing `ustad_pkbx0041_acceptance_100m_20261015` is DONE | No new retry/query submitted |
| Cloud Run | Private IAM; service max2; default100% `prepagent-00005-s5x` unchanged | No traffic switch or new revision |
| Signing secret | Existing secret-level accessor for approved runtime SA | Secret payload not accessed or printed |
| Five models | Existing model metadata still available; sample counts remain null in acceptance configuration | No evaluation or retraining |

Previous Stage B evidence remains: five genuine PO extractions passed their fixture comparisons; ten photos were classified once, with **7 matches and 3 mismatches**; all15 provider attempts were metered. Existing optimizer evidence has42 passing comparisons and90MiB billed. These are historical real results, not repeated operations in this pass.

## 5. P0 acceptance matrix

| Requirement | Local result | Live result / remaining action |
|---|---|---|
| Firebase Google provider, supervisor claim and token | PASS deterministic contracts | BLOCKED optional production policy; not a hackathon prerequisite under Approach B |
| Signed demo authorization and identity-spoofing refusal | PASS | Prior real session/private-IAM checks accepted; no Firebase impersonation |
| Shared daily counter and centralized provider metering | PASS race/failure/midnight tests | PASS prior runtime transactions; current counter/rules unchanged |
| Model acceptance evidence | PASS fail-closed regressions | **BLOCKED** actual membership/counts/source identity/review |
| Canonical optimizer | PASS local contracts | PASS existing direct PKBX0041 result; application decisions remain model-gated |
| Persistent actor audit | PASS test-double lifecycle/adapters | PASS schema only; successful real approval/read-back BLOCKED |

## 6. P1 acceptance matrix

| Requirement | Status and exact boundary |
|---|---|
| PO extraction/catalog/clarification | Prior five genuine fixture checks PASS; current local regressions PASS |
| Conditions | Prior real simulated-reading retrieval PASS; actual user confirmation still required in the next valid workflow |
| Five risks, workflow optimization and explanation | **BLOCKED** by model acceptance; no fabricated outputs or confirmation |
| DRAFT persistence and independent read-back | **BLOCKED** valid model-gated DRAFT; no fake row inserted |
| Demo approval and durable audit | **BLOCKED** valid persisted DRAFT; local refusal/replay/failure tests PASS |
| PDF generation, GCS persistence and retrieval | Local tests PASS; positive live path **BLOCKED** by approved JobSheet |
| Ten photos | Prior comparison completed once:7 correct,3 different; no relabeling or retries |
| Impact | Prior actual four-query adapter/private HTTP accepted; current local privacy/cache/browser tests PASS |
| Feedback/learning | Local TEST/session guards PASS; no live feedback without parent job; completed-lot outcome truth contract unresolved |

## 7. Exact remaining inputs

### Om-owned evidence

For each exact current model version, provide the actual evaluation membership and count, source snapshot or reproducible evaluated window, and review of the recovered version-specific feature artifact. Stable historical training IDs, saved metrics and version observations already exist; numerical thresholds are not being reopened. Do not infer counts from an80/20 percentage.

If that evidence cannot be recovered, review the [new evaluation proposal](MODEL_EVALUATION_APPROVAL_PROPOSAL.md). It is a proposed new September evaluation, not historical reconstruction. It requires separate approval of the population and six bounded queries. A failed result would remain blocked; no retraining or threshold change is included.

The completed-lot learning claim additionally needs the authoritative source/meaning of actual outcomes, partial-feedback behavior and replay semantics. A table schema alone does not establish those business facts.

### Owner actions and later authorization

- Confirm actual budget notification receipt and current Billing/Credits visibility if available. No credentials or private keys are requested.
- After the model gate passes, approve a fresh small provider/TEST-workflow allowance. The earlier run's15 attempts are exhausted; remaining daily quota does not authorize another acceptance run.
- Under this prompt's mutation checkpoint, approve any new private revision separately after the current UI/backend source is frozen. Do not repeat the five-PO or ten-photo batches unnecessarily.
- Public promotion/IAM remains separately gated. Remove obsolete diagnostic/legacy tags and promote only a fully accepted revision before any public IAM change; service-wide IAM can otherwise expose old tagged code and the old default revision.

Firebase registration remains an optional future production-style setup issue under the confirmed Approach B decision. It must not be falsely listed as the hackathon's remaining identity blocker.

## 8. Approval-ready resource/IAM delta

**Recommended mutation set now: none.** Existing counter, budget, audit migration and optimizer work must not be duplicated.

| Resource | Existing purpose/state | Proposed action now / rollback boundary |
|---|---|---|
| Firestore default database, Mumbai | Shared counter18; client deny rules | None. Do not reset/delete consumed reservations or weaken rules |
| Runtime SA | Existing `datastore.user`, minimal Auth-read role and legacy data/storage roles | No new grant or narrowing. Do not use broad IAM as a registration workaround |
| Signing secret version1 | Shared key, secret-level runtime access | None. Rotation requires new version/revision; old instances cache secret environment values |
| BigQuery `job_sheets` | Additive nullable audit JSON | None. No backfill, second lifecycle database or schema rollback |
| INR5,000 monthly budget | Correct alert thresholds | None. Keep amount, linkage, scope and channel unchanged |
| Private Cloud Run | Existing V4 candidate, max2, unchanged default traffic | None. Current source is not the V4 image; a new private release needs approval |
| Optional Firebase web app/provider | Registration/configuration absent | Deferred. Original Stage A setup/provisioning commands remain available but are not instructions to duplicate completed role/API work |

No additional IAM permission, resource or cloud mutation is needed to review Om's files or run local tests. A new evaluation would use existing resources and require query approval, not IAM expansion. Firebase registration's partial irreversibility and historical403 require an owner-supported Console resolution if that separate policy is activated; never invent a UID or assign a role from a client header.

## 9. Usage, pricing and spending limits

This pass made metadata/document reads only: **0 Gemini attempts,0 new BigQuery query jobs,0 counter reservations,0 builds/deployments and0 cloud configuration mutations**. Ordinary document reads can have normal service billing; no invoice-level incremental cost is claimed.

| Service | Observed usage / proposed workload | Estimate and uncertainty | Monitoring |
|---|---|---|---|
| Gemini | Previous15 attempts;0 new | Previous estimateUS$0.094415, not total invoice. No new paid workload proposed here | Provider usage and shared counter |
| Firestore | Counter18; this pass reads only. Configured maximum100 daily reservations, plus bounded internal transaction retries | Document read/write units; total project usage/charges unknown. Free-tier eligibility is not proof of zero charges | Database/document metadata and billing |
| Firebase Auth | No configured Google provider or actual sign-in | Optional base/Identity Platform pricing depends on selected tier and active users; do not enable/upgrade based on an assumed free bill | Provider configuration and eventual real-user acceptance |
| BigQuery |0 new jobs; previous optimizer90MiB; prior runtime window180MiB | Processed/billed bytes. Proposed new evaluation≤300MiB requires dry run and regional price check first | Existing job IDs; future capped jobs only if approved |
| Cloud Run/Build |0 new builds/revisions | Request CPU/memory, build minutes and storage charges not recovered as invoice evidence | Current resource metadata and historical build IDs |
| Storage/Secret Manager | Existing approved objects and one signing version;0 new writes | Storage/operation/version-month charges and remaining credit unknown | Resource inventory and billing |

Official sources reviewed: [Firestore pricing](https://cloud.google.com/firestore/pricing), [Firebase pricing](https://firebase.google.com/pricing), [Identity Platform differences](https://firebase.google.com/docs/auth/). Firestore free allowance is shared within its applicable scope, and transaction retries can add reads. Keep the INR5,000 monthly early-warning alert separate from the INR27,000 total planning ceiling. Neither budget alerts nor request caps are global monetary hard stops.

## 10. Source, deployment, rollback and readiness

Current private candidate: `prepagent-b-1015-43c1a259`, image digest `sha256:f9125d32da1233ff560241099af1e900788869212cfae6b7b011e80fce0f6fd2`. Its immutable source/build evidence remains in the prior report. Current UI/backend inputs differ; `FINAL_STATIC_CHECKS.json` records those differences and current source hashes. No new image was built or represented as deployed.

No traffic changed in this pass. The original100% revision is a traffic baseline, not a newly proven successful workflow rollback target. Preserve it privately. The previous report documents withdrawing only owned candidate tags and safely rotating the signing key; no rollback mutation was performed here. Do not delete acceptance evidence, counters or approved source objects.

| Readiness | Verdict | Evidence needed to advance |
|---|---|---|
| Local development / synthetic rehearsal | Conditionally Ready | Current backend and24 local browser tests pass; provider success doubles remain labeled |
| Complete private cloud demo | Not Ready | Accepted model artifacts, actual confirmation, real DRAFT/approval/audit/PDF/replay acceptance |
| Public hackathon judging | Not Ready | Full private acceptance, current source/image, obsolete-tag cleanup, safeguards, rollback rehearsal, explicit release approval and public smoke test |
| General software production | Not Ready | Distributed lifecycle, authentication, operations/security/recovery evidence beyond the prototype |
| Real factory deployment | Not Ready | Genuine outcomes/telemetry, operational validation and factory authorization; no simulation passed off as factory evidence |

## 11. Next executable step

**Validate Om's actual evidence as soon as supplied; otherwise obtain approval for the narrow new-evaluation proposal.** In parallel, freeze the now-handed-off source and retain the successful current regression evidence. No new cloud setup is required for either review.

No staging, commit, push, reset, clean, public IAM change, cloud configuration mutation, business-data write, new evaluation or retraining occurred in this pass. Historical authorized mutations remain recorded rather than falsely described as never performed.
