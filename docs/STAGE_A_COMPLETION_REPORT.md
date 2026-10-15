# Stage A implementation and evidence — 15 October 2026

## Executive verdict

Backend prerequisites are substantially more complete and locally exercised.
The authenticated PO-to-approved-card **cloud workflow remains blocked**. No
Firebase/Firestore setup, IAM/billing change, business write, paid inference,
container build, deployment or traffic/access change occurred in this pass.
Four dashboard SELECTs and one PLANT-01 SELECT ran under bounded D10 read authority.

Review [the exact Stage B approval plan](STAGE_A_APPROVAL_PLAN.md) before authorizing
cloud mutations. Its sections2–9 contain resource IDs, minimal IAM diff, commands,
costs, immutable evidence gaps and rollback. Sections12–13 contain every P0/P1/
release PASS/FAIL/BLOCKED item, readiness criteria and individually approvable actions.

## Implemented in this pass

| Files | Change and evidence boundary |
|---|---|
| `src/google-cloud/firestore-gemini-attempt-store.js`, `src/daily-gemini-call-cap.js` | Shared existing-DB transactional attempt reservations, strict IST/date/policy checks, ≤3 definite-conflict retries,5s deadline, no ambiguous retry/refund, no provider call inside transaction or after cancellation/day rollover. Local REST test doubles only; store opt-in remains off in cloud. |
| `src/service-ports.js`, `index.mjs` | Single metered Gemini construction, shared accounting required on Cloud Run, safe cap429/status reporting. Audit-enabled approval opt-in. Separate configured lifecycle status from connectivity and avoid permanent demo-only status. First-user Firebase sign-in config available without granting supervisor access. Optimizer budget defaults80MiB, permits proposed100MiB explicitly, invalid larger settings disable optimizer. No runtime flags changed. |
| `src/firebase-supervisor-auth.js` | Mandatory exact UID allowlist plus trusted Google supervisor claim; privately branded verified principals cannot be replaced by client-supplied identity objects. Existing signature/revocation/project/provider checks retained. |
| `tools/provision-supervisor.mjs` | Admin-only dry-run/apply identity verification, preserve unrelated claims,0600 create-only backup, independent claim read-back; role-only rollback preserves later unrelated claims and revokes refresh tokens. No public route, no key generation, no administrator operation run. |
| `src/schemas.js`, `src/bigquery-mapper.js` | Optional backward-compatible approval actor JSON contract and mapping; job/state/server time/correlation/decision/card linkage. |
| `src/google-cloud/bigquery-write-client.js`, `src/google-cloud/job-sheet-repository.js`, `src/google-cloud/job-card-service.js` | Same TEST-only conditional approval update stores actor audit; exact independent read-back and replay validation; uploaded-card reconciliation/cleanup retained. Live approval adapter stays unavailable without audit flag/schema. No actual DDL/write/read-back acceptance. |
| `src/stored-job-sheet-lookup.js` | Prototype API withholds non-TEST stored orders; mismatched identity never returns a job payload. All approved supervisors share prototype TEST scope; no invented per-user ownership policy. |
| `src/linked-feedback-service.js`, `src/google-cloud/feedback-service.js` | Writer receives validated stored TEST order identity; raw alternative JobSheet streaming write removed. Completed-lot outcomes are not invented or enabled. |
| `src/google-cloud/order-extraction-service.js`, `src/google-cloud/risk-evidence-service.js` | Safe usage-accounting failure classification, daily exhaustion rather than false provider success; extraction cleanup retained. |
| `src/google-cloud/vertex-gemini-client.js` |64KiB content+tool JSON bytes,12k-character JSON prompt,16KiB response-schema bounds;2048 output-token bound; no automatic provider retry. Provider input-file token count remains unmeasured. |
| `src/google-cloud/bigquery-read-client.js` | Real defect closed: canonical optimizer's exact two read-only ASSERT guards can reach transport. Arbitrary scripting/mutations still denied. `sql/optimize.sql` itself unchanged. |
| `Dockerfile` | Copies required `public/` assets into image. Build-context static test only; no build or image acceptance. |
| `sql/migrations/approval_audit_proposed.sql` | Proposed nullable audit column only; **not applied**. |
| `ops/iam/firebase-token-verifier.yaml`, `ops/iam/firestore-counter-minimum.yaml`, `ops/firestore/gemini-counter.rules`, `ops/billing/correct-budget-thresholds.json` | Reviewable proposals, not applied. Initial existing-DB counter needs no added Firestore role; optional narrowing is not part of initial functional grant. |

New/extended tests:

- `test/firestore-gemini-attempt-store.test.js`
- `test/approval-audit.test.js`
- `test/provider-metering-contract.test.js`
- `test/auth-bootstrap-http.test.js`
- `test/supervisor-provisioning.test.js`
- `test/fixtures/verified-supervisor.js`
- `test/firebase-supervisor-auth.test.js`
- `test/bigquery-read-client.test.js`
- `test/bigquery-write-client.test.js`
- `test/linked-feedback-service.test.js`
- `test/stored-job-sheet-lookup.test.js`
- `test/container-build-context.test.js`

Docs: this report, `STAGE_A_APPROVAL_PLAN.md`, `FIREBASE_AUTH_SETUP.md`, appended
current reconciliation in `OM_DEPENDENCY_REGISTER.md` and
`PRODUCTION_READINESS_AUDIT.md`, plus the five JSON evidence files in
`docs/evidence/`. Existing decision text and unrelated edits are preserved.

The other editor owns the UI, its public assets, localization changes, browser
tests and associated presentation routes. Their changes were not reverted or
replaced. Remaining auth UX integration waits for their handoff, as the owner
instructed. The existing auth client has optional refresh support; sign out/in
also obtains refreshed role claims. No auth token is put in a URL.

## Actual local verification

Runtime Node22.17.1 / npm10.9.2. [Machine-readable results and observed source hashes](evidence/STAGE_A_LOCAL_VERIFICATION.json).

| Command | Actual result |
|---|---|
| Focused backend command below |105pass,0fail,0skip,0cancel;347ms |
| `node --test test/auth-bootstrap-http.test.js` |1pass,0fail,0skip; also included in full suite |
| `npm run test:acceptance` |247pass,0fail,0skip,0cancel;8,716ms |
| `npm test` |467pass,0fail,0skip,0cancel;9,401ms |
| `node --check` on `index.mjs`, every `src/**/*.js`, `tools/provision-supervisor.mjs` |59modules,0fail |
| Python `json.loads` for package/lock, config, locales, ops and evidence JSON |19files,0fail |
| `yaml.safe_load` for both `ops/iam/*.yaml` |2files,0fail |
| `npm audit --omit=dev --json` |0reported production vulnerabilities; not a container scan or assurance of zero defects |
| `git diff --check` |Exit0 |

Exact focused command:

```sh
node --test test/provider-metering-contract.test.js test/stored-job-sheet-lookup.test.js test/daily-gemini-call-cap.test.js test/approval-audit.test.js test/firebase-supervisor-auth.test.js test/firestore-gemini-attempt-store.test.js test/supervisor-provisioning.test.js test/bigquery-read-client.test.js test/bigquery-write-client.test.js test/linked-feedback-service.test.js test/google-cloud-order-extraction.test.js test/job-sheet-repository.test.js test/container-build-context.test.js
```

All local tests use isolated doubles where cloud behavior is required. Acceptance
includes synthetic PO1 orchestration, five risks, persisted-draft contracts,
approval replay/recovery and PDF stage-order tests. The original acceptance
selector does not include every new focused file; `npm test` includes root-level
Node test files, while separately owned Playwright/browser tests are **not**
included in that command and were not run by this backend pass. No live integration
claim derives from their counts.

Initial current acceptance run:245pass/2fail due to the concurrent UI move from
inline code/standalone Impact HTML to modules/navigation. The UI owner updated
those tests; complete reruns passed. Other intermediate fixture failures caused
by the new mandatory UID/TEST-writer prerequisites were corrected to provide
explicit approved test identities, not by weakening server gates. Historical
test counts in older report sections do not supersede these command results.

## Actual Google Cloud evidence

Exact commands, URLs, timestamps and errors:
[STAGE_A_CLOUD_INVENTORY.json](evidence/STAGE_A_CLOUD_INVENTORY.json).
No tokens/credentials or notification recipient addresses are stored. Some initial
local SDK operations needed sandbox access for credential cache/network; a TLS
client issue was corrected using system curl with certificate verification, not
by disabling TLS. Correct quota-project headers exposed API-disabled status;
no API was enabled. A permission-metadata command timed out and is recorded.

### Query results

All four real dashboard SELECTs passed schema validation/anonymization through
the actual application adapter. Second call reused its success cache; total
query count remained4. This is not a deployed endpoint/UI smoke test.
[Safe results and full job statistics](evidence/STAGE_A_IMPACT_RESULT.json)

| SQL/job | Actual outcome |
|---|---|
| `dash_kpis.sql` — `job_bu2VF0NBudTxO-cd5Abt89y48Nta` | DONE;1row;15,111bytes processed;10MiB billed;1238ms client |
| `dash_monthly.sql` — `job_8azCVk5EtvCL_K5yWpmlDKRO925L` | DONE;24rows;342,400bytes processed;10MiB billed;2829ms |
| `dash_top_items.sql` — `job_RTdXEkvyj4AdlrFLfgd8jTBCfqbN` | DONE;10rows;196,595bytes processed;10MiB billed;3105ms |
| `dash_seasonal.sql` — `job_FT48ntkd0F84_M0y7heEMmh9cpAa` | DONE;4rows;256,800bytes processed;10MiB billed;3236ms |
| PLANT-01 — `ustad_plant_stage_a_20261015` | DONE;INR/53.3perkg/locale`mr`;27bytes processed;10MiB billed;232ms server runtime |

Each dashboard query cap50MiB; plant query cap10MiB; each dry-run validated before
execution. Combined **50MiB actual billed** (~$0.00030 reference at$6.25/TiB,
before regional SKUs/free quota/credits; not an invoice). No model inference ran.

September KPI results are simulation/held-out estimates:219lots,207changed,
₹7,320 predicted/net saving,138kg,7.06%→6.39%. No annualization. Monthly and
counterfactual aggregate rounding differs slightly; see approval plan rather
than claiming exact cross-series equality.

### Metadata/inventory conclusions

- Service-level maximum is now **2**, superseding historical12. Revision still12;
  active00005 has100% traffic, latest ready00011 is tagged/no default traffic.
  IAM returned no public bindings; no access or traffic change here.
- Firebase Management/Identity Toolkit APIs disabled. Registration/web app/provider
  are **unknown**, not proven absent. Existing Firestore default DB is Native,
  STANDARD, Mumbai. Runtime already has datastore.user. No transaction executed.
- **Budget defect:** raw threshold fractions50/90/100 equal5000/9000/10000percent.
  Correcting them to.5/.9/1 requires approval. ₹5,000 monthly amount/channel
  retained. Current spend/credits/notification delivery not verified.
- All five BQ model resources report linked Vertex version1 and numerical threshold
  compliance. Saved real training jobs/SQL/global explanations recovered in
  [MODEL_VERSION_EVIDENCE.json](evidence/MODEL_VERSION_EVIDENCE.json). These are
  BQ-reported version links, not independent registry acceptance. Exact evaluation
  sample counts/membership, immutable source identity/window and reviewed exact
  version evidence remain incomplete. Anonymous split metadata access denied;
  no bypass. Models remain blocked in live decision routes.
- Prior optimizer job failed because20MiB of ASSERT billing left60MiB, but SELECT
  needed70MiB. One100MiB retry is proposed, **not executed**. SQL contract preserved.
- Fresh photo object-name listing found exactly10; no content download or Gemini
  classification. All five synthetic UI sample hashes match approved originals.

## Remaining security and workflow gates

1. Owner approves Firebase registration side effects, Google provider/web app,
   minimal runtime Auth user-read role, and one verified human UID. Public sign-in
   alone never gives role/allowlist privileges.
2. Owner approves existing-DB shared counter use/rules and three real no-Gemini
   reservations. Actual runtime/two-instance acceptance requires a later private
   candidate; process-local tests are not cloud persistence evidence.
3. Om supplies missing model counts/source evidence and exact review, or explicitly
   approves a newly defined evaluation. Do not lower thresholds or fabricate history.
4. Owner separately approves budget fraction correction, additive approval audit
   column and one bounded optimizer retry. Audit persistence needs independent
   real TEST read-back; current code alone is insufficient.
5. UI handoff, source freeze, image digest/provenance, private candidate deployment
   authorization and real authenticated PO→card acceptance remain. No public
   release authorization exists. Reviewer must accept endpoint separation,
   proxy/rate-limit behavior, budget delivery, min0/max2 and rollback before release.
6. Actual completed-lot outcomes/used settings capture, partial feedback semantics
   and stable idempotency/source lineage must be defined/implemented before a full
   feedback-learning claim. No outcome values or missing photo labels are requested
   or invented. Genuine sensors/retraining are outside V1.

## Readiness and next executable step

| Level | Verdict |
|---|---|
| Local synthetic demo | Conditionally Ready: local suites pass; UI owner handoff/browser rehearsal still needed |
| Private cloud demo | Not Ready: authenticated model-accepted PO→stored approved card not executed |
| Public judging | Not Ready: private acceptance and release/cost/provenance safeguards incomplete |
| General software production | Not Ready; prototype distributed-state guarantees intentionally limited |
| Real factory | Not Ready; synthetic results do not establish physical outcomes/calibration |

Next action is owner review of the five separately scoped approvals in
[Stage A plan section13](STAGE_A_APPROVAL_PLAN.md#13-requested-approval-scope-and-exact-next-step).
After Firebase/Firestore approval, refresh resource snapshots, perform only F1–F4
and counter steps1–3, and capture independent real-provider/counter evidence.
Deployment/public access remains a different approval. Auth UI work begins after
the other editor's handoff, not by overwriting it.

## Git and deployment state

Branch `main`, HEAD `274a9416d6ab1d5695fa36f8181940545c91099e`. Dirty worktree with
preserved modified/untracked files; staged diff empty. Exact observed file list
and112 application-file hashes are in the local evidence JSON; this is not a
source freeze or a release artifact. Runtime/deployed image provenance remains
separate. No staging, commit, push, reset, cleanup, cloud infrastructure mutation,
business write, upload, paid Gemini call, deployment, IAM/traffic/access change,
model retraining or billing update was performed.
