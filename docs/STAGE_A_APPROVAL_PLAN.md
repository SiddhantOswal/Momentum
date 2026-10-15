> **Current reconciliation —15 October 2026:** Owner reconfirmed **Approach B; Firebase remains separate**. See [P0_CLOSURE_RECONCILIATION.md](P0_CLOSURE_RECONCILIATION.md) and `docs/evidence/p0-reconciliation-20261015/`. The original plan below is historical: counter rules/transactions, budget correction, audit schema and authorized optimizer retry have already completed. Do not rerun them. Existing Firestore/runtime configuration is verified. Firebase registration/configuration still returns404 after the earlier403registration attempt; optional production-style setup remains incomplete, not a mandatory hackathon prerequisite. Existing custom Auth role/binding contains only `firebaseauth.users.get`; no additional IAM grant is presently proposed. No cloud mutation or new provider call was performed in this reconciliation.

# Ustaad: Stage A results and proposed Stage B approval

Prepared 15 October 2026 (IST). **Status: awaiting explicit approval; nothing in
this document has been applied to cloud configuration.** This is a synthetic-data
prototype, not a factory production certification.

## 1. Decisions, source and ownership

- `OM_DECISIONS.md` is authoritative over the older Blueprint and Playbook.
  The owner's final prompts additionally select Firebase Google sign-in, an
  exact supervisor UID allowlist, 100 attempted Gemini requests/day in IST,
  and **ten** canonical photos. Those supersede the older optional-auth,
  process-local-only Gemini and twelve-photo statements. D6's BigQuery JobSheet
  architecture remains unchanged; Firestore here is only for Gemini accounting.
- The Blueprint (22 pages), Playbook (16 pages), `sid_pack/SID_NOTES.md`, canonical
  optimizer and five synthetic PO contracts are available under
  `/Users/siddhant/prepagent-work/docs/`. The repo docs restored in the prior pass
  came from commit `8c7e9a4`; HEAD `274a941` removed docs from tracking. They are
  now untracked local working files. No additional restoration or Git mutation
  was needed in this pass. Preserve these files before any release packaging.
- Main remains `274a9416d6ab1d5695fa36f8181940545c91099e`, with extensive pre-existing
  and current unstaged/untracked work. Passing tests identify a working-tree
  observation, not a reproducible deployed release.
- Another editor owns UI work. Backend changes stay separate. The new UI imports
  `/supervisor-auth-client.js` from `src/ui/workflow.js`; auth UX integration and
  browser acceptance will be coordinated after that editor finishes. No UI
  ownership or source-freeze approval is inferred.
- [Source hashes](evidence/SOURCE_CONTRACT_INVENTORY.json) confirm all five public
  samples exactly match approved originals and local Om decisions match the
  supplied copy. The local optimizer differs from the older supplied file only
  in the already-approved rupee comment, exact missing-row ASSERTs and D2's
  required deterministic tie-break columns; this pass did not alter its SQL.

## 2. Observed resource inventory

Evidence: [cloud inventory](evidence/STAGE_A_CLOUD_INVENTORY.json), observations
at 2026-10-14 20:48–21:12 UTC (15 October IST), plus the exact timestamps in each
record. GET/list/show operations did not enable APIs or modify resources.

| Product/resource | Existing status and location | Proposed change / billing boundary |
|---|---|---|
| GCP project `prepagent-hack`, number `514663464609` | Existing, billing linked | Reuse only; never create another project |
| Firebase registration | Cannot determine while Management API is disabled | Owner checks Console; add Firebase to this **existing** project only if absent and approved |
| `firebase.googleapis.com`, `identitytoolkit.googleapis.com` | Disabled; REST returned `SERVICE_DISABLED` | Enable only after approval; do not interpret failure as proof no web app/provider exists |
| Google sign-in, authorized domains, web app | Unavailable to inspection until API/setup is available | Reuse if present, otherwise one web app named `Ustaad supervisor`; Google provider only; no Hosting/Analytics/phone/SMS/RTDB |
| Firestore `projects/prepagent-hack/databases/(default)` | Existing STANDARD / FIRESTORE_NATIVE, `asia-south1`, PESSIMISTIC, free-tier eligible; created 13 Oct | Reuse; **no database creation**, mode/location change, TTL, backups or PITR activation |
| Firestore Rules release `cloud.firestore` | GET returned 404 NOT_FOUND | Proposed explicit client deny rules; refresh first and preserve any intervening owner rules |
| Counter `gemini_daily_usage/YYYY-MM-DD` | No counter document created/read during Stage A | Create/update only IST daily counter during approved transactions; no prompts or user data |
| Runtime `prepagent-run@prepagent-hack.iam.gserviceaccount.com` | Existing; already `roles/datastore.user` at project scope | No extra Firestore grant needed initially; add only token-revocation read permission described below |
| BigQuery `prepagent.job_sheets` | Existing, 0 rows at inspection, no approval actor column | Optional separately approved additive nullable JSON column; no production backfill |
| `prepagent.feedback`, `lots`, `impact_lots` | Existing schemas inspected; respectively 113 / 5350 / 219 metadata rows | No writes performed. Completed-lot outcome capture remains disabled |
| Cloud Run `prepagent`, `asia-south1` | Private IAM evidence; service max **2**, revision annotation still **12**; concurrency 80, timeout 300s, CPU 1, RAM 1GiB | No change now. Any private candidate deployment/configuration requires separate release approval |
| GCS `prepagent-hack-data` | Existing; ten approved JPEG objects in `photos/photos/` | No download, classification, upload or delete performed |
| Billing account `014B62-B6BC57-970DC2` | Linked; ₹5,000 project-scoped monthly alert exists | Retain amount; separately approve correcting its threshold fractions |

Adding Firebase is **not fully reversible**. It automatically enables APIs and
creates service accounts/API-key configuration; the owner must accept Firebase
Terms in the Console. Billing is shared with the existing billed project (Blaze).
No additional billable workload is authorized just by registration.
[Official setup and side effects](https://firebase.google.com/docs/projects/use-firebase-with-existing-cloud-project)

Approval must cover those documented registration side effects, not only two
manual API enables. Record enabled-service and service-agent IAM diffs afterward;
stop on unexpected expansion. Do not download any service-account key. The
Identity Toolkit service agent, if created, is
`service-514663464609@gcp-sa-identitytoolkit.iam.gserviceaccount.com`; provider
service-agent roles must never be granted to the runtime or browser.

The official registration documentation lists these automatic API products:
App Engine Admin, Pub/Sub, Cloud Resource Manager, Runtime Configuration, Cloud
Testing, Cloud Messaging, Dynamic Links, Hosting, Installations, Firebase
Management, Remote Config, Remote Config Realtime, Rules, Identity Toolkit and
Token Service. Pub/Sub, Resource Manager and Rules are already enabled here.
Approval to register Firebase must explicitly include the remaining documented
automatic API configuration; it does **not** authorize launching those products'
workloads. Do not manually bulk-enable this list or create an App Engine app,
Hosting site, message stream or test workload.

Expected managed identities to inventory include:

| Identity | Expected provider-managed role / handling |
|---|---|
| `service-514663464609@gcp-sa-firebase.iam.gserviceaccount.com` | `roles/firebase.managementServiceAgent` on this project |
| `service-514663464609@gcp-sa-identitytoolkit.iam.gserviceaccount.com` | `roles/identitytoolkit.serviceAgent` on this project |
| `service-514663464609@firebase-rules.iam.gserviceaccount.com` | Existing/new Rules agent, `roles/firebaserules.system`; inspect baseline before attributing to setup |
| `firebase-adminsdk-<generated>@prepagent-hack.iam.gserviceaccount.com` | May be created by registration; suffix/actual bindings are not knowable yet. Do not generate keys or use it as runtime. Stop for review before any additional manual grant |

These identities are distinct from `prepagent-run`; no Owner/Editor grant is
proposed. Unexpected bindings require another approval, not automatic acceptance.
[Documented Google-managed agents](https://docs.cloud.google.com/iam/docs/service-agents)

## 3. IAM diff: minimal functional change

| Principal/resource | Existing | Proposed | Why / risk / rollback |
|---|---|---|---|
| Runtime SA, project `prepagent-hack` | No observed `firebaseauth.users.get` grant | Custom role `projects/prepagent-hack/roles/ustaadSupervisorTokenVerifier`, only `firebaseauth.users.get` | Firebase Admin revoked/disabled-user check. Allows user-state reads; not claim assignment. Remove only this new binding to roll back |
| Runtime SA, existing Firestore DB | Project `roles/datastore.user` | **No added grant** for initial counter acceptance | Already includes begin/read/commit/rollback permissions. Existing role is broader than counter-only and remains a disclosed inherited risk |
| Owner/admin account | Existing permissions not expanded | Use existing approved administrator for setup and `firebaseauth.users.get/update` during one UID provisioning | No new runtime/admin role; stop if administrator lacks permission |
| Browser | No counter access authorized | Explicit deny reads/writes to counter; no client role grant | Server OAuth/IAM bypasses client Security Rules; rules do not confine runtime IAM |

Prepared role: [firebase-token-verifier.yaml](../ops/iam/firebase-token-verifier.yaml).
Preflight verifies custom-role support before creating the role. The read-only
`list-testable-permissions` attempt timed out after 40s; it did not establish
support or denial. **No broad viewer/admin fallback is approved.** Revocation
checking needs a user lookup in addition to signed JWT validation.
[Identity Platform IAM](https://docs.cloud.google.com/identity-platform/docs/access-control)

Firestore REST operations need `datastore.databases.get` for transaction
begin/rollback and `datastore.entities.get/create/update` for document operations.
These are already in the observed runtime role.
[Firestore API permissions](https://firebase.google.com/docs/firestore/security/iam)

An optional *later* tightening candidate is
[firestore-counter-minimum.yaml](../ops/iam/firestore-counter-minimum.yaml), with a
database-resource IAM condition where supported. Do **not** remove the current
role while old deployed revisions may use Firestore idempotency/delete. IAM does
not provide a promised collection-only restriction here. Any narrowing requires
an independent workload/permission check and owner-approved diff; it is not a
prerequisite to reuse the existing grant safely behind the application gates.

## 4. Firebase actions proposed for approval

Execute in order, with the owner controlling Terms, account selection and Console
provider settings. Existing operator credentials only; no new IAM administrator.

### F1. Preflight and register the existing project

Read-only commands, safe to repeat before mutation:

```sh
gcloud projects describe prepagent-hack --format='json(projectId,projectNumber,labels)'
gcloud services list --enabled --project=prepagent-hack --format='value(config.name)'
gcloud projects get-iam-policy prepagent-hack --format=json
gcloud firestore databases describe --database='(default)' --project=prepagent-hack
```

After approval only:

```sh
gcloud services enable firebase.googleapis.com identitytoolkit.googleapis.com --project=prepagent-hack
```

Console: Firebase Console → add Firebase to an existing Google Cloud project →
select **prepagent-hack / 514663464609**, accept Terms if prompted, decline
Analytics/AI-assistance options. If already registered, reuse it. Do not click
create Firestore database. Record automatically created service identities and
APIs before proceeding. Owner must approve registration's irreversible nature.

Verification: Management REST GET
`https://firebase.googleapis.com/v1beta1/projects/prepagent-hack` and
`.../projects/prepagent-hack/webApps`, using an owner access token in memory with
`x-goog-user-project: prepagent-hack`. No bearer token in URLs, logs or command
arguments. Inspect Identity Toolkit GET
`https://identitytoolkit.googleapis.com/admin/v2/projects/prepagent-hack/config`.

### F2. Google provider and one web app

Console: Authentication → Get started if needed → Sign-in method → Google →
enable, owner chooses support email → Save. No other provider or SMS enabled.
Register/reuse web app `Ustaad supervisor`, with Hosting unchecked. Record app ID
returned by Firebase; do not invent one.

Authorized domains: add only the exact current/candidate host actually used for
acceptance, initially `prepagent-26mwt2n7ba-el.a.run.app` and, if used,
`prepagent-514663464609.asia-south1.run.app`; no wildcard `run.app` or arbitrary
redirects. Firebase's own project auth domain is retained. Add `localhost` only
for approved local browser acceptance; remove it afterward if not needed.
Use provider-generated redirect configuration; never accept an arbitrary client
redirect URL. Provider GET verification:
`.../projects/prepagent-hack/defaultSupportedIdpConfigs/google.com`.

Public client values (not Admin credentials):
`USTAAD_FIREBASE_WEB_API_KEY`, `USTAAD_FIREBASE_AUTH_DOMAIN`,
`USTAAD_FIREBASE_WEB_APP_ID`, matching `PROJECT_ID=prepagent-hack` exactly.
Keep API-key restrictions compatible with Firebase Authentication only; no
unrelated API use. Do not expose these to the app by changing Cloud Run yet.

### F3. Runtime token lookup permission

After custom-role support and approved IAM baseline are rechecked:

```sh
gcloud iam roles create ustaadSupervisorTokenVerifier --project=prepagent-hack --file=ops/iam/firebase-token-verifier.yaml
gcloud projects add-iam-policy-binding prepagent-hack --member=serviceAccount:prepagent-run@prepagent-hack.iam.gserviceaccount.com --role=projects/prepagent-hack/roles/ustaadSupervisorTokenVerifier --condition=None
```

If the role already exists, inspect it and stop on differing permissions; do not
overwrite it. Verify role contents and only the new member binding with
`gcloud iam roles describe` / `gcloud projects get-iam-policy`.
No service-account impersonation/Token Creator or Firebase Admin role is proposed.

### F4. Supervisor account and custom claim

Owner names the exact Google account privately. User signs in to this Firebase
project; administrator independently verifies Firebase Users UID, Google
provider, verified email and enabled state. Do not select by domain alone.
For the first user, a locally configured app can publish the public Firebase
sign-in configuration before its UID allowlist is populated. This resolves the
provisioning bootstrap loop: sign-in can obtain a genuine UID, while the backend
continues returning503 for all supervisor actions until the role and UID list are
configured. `supervisorAccessConfigured` is reported separately. This does not
enable model calls or approval; its HTTP refusal path is locally tested. No
Cloud Run deployment is included merely to bootstrap an account.
The prepared admin-only tool preserves unrelated claims and requires a private
create-only backup before mutation. It has no HTTP route and is excluded from
the container.

```sh
node tools/provision-supervisor.mjs --project=prepagent-hack --uid=OWNER_VERIFIED_UID --expected-email=OWNER_APPROVED_GOOGLE_EMAIL
```

The above is identity-check/dry-run only. After the owner approves that exact UID:

```sh
node tools/provision-supervisor.mjs --project=prepagent-hack --uid=OWNER_VERIFIED_UID --expected-email=OWNER_APPROVED_GOOGLE_EMAIL --apply --backup=/private/tmp/ustaad-supervisor-claims-before.json
```

Replace both placeholders from verified Console evidence; do not run with sample
values. Use administrator ADC already authorized for user update; never runtime
credentials. The 0600 backup is private, untracked, outside the repo. Force
`getIdToken(true)` or sign out/in after role assignment. Claim read-back alone
is not signed-token acceptance.

Later candidate config: `USTAAD_FIREBASE_AUTH_ENABLED=true` and
`USTAAD_SUPERVISOR_UID_ALLOWLIST=<exact approved UID>` are both required. Backend
checks signature through Admin SDK, revocation, expiry, issuer, audience, project,
subject/UID, Google provider, trusted role and UID. Forged identity headers cannot
produce the privately branded verified-principal object used for approvals.

No real token has been verified in Stage A. A private Cloud Run request needs
**two different tokens**: Cloud Run IAM ID token in `X-Serverless-Authorization`
and Firebase human ID token in `Authorization`. Keep both in memory/HTTPS headers;
never EventSource query strings. Browser/proxy behavior must be accepted after
UI completion and private candidate authorization.
[Cloud Run dual-header authentication](https://docs.cloud.google.com/run/docs/authenticating/service-to-service)

## 5. Existing Firestore counter plan

Code: `src/google-cloud/firestore-gemini-attempt-store.js`,
`src/daily-gemini-call-cap.js`, centralized construction in `src/service-ports.js`.
No new SDK dependency. REST uses Cloud Run ADC access tokens.

Target: `projects/prepagent-hack/databases/(default)/documents/gemini_daily_usage/YYYY-MM-DD`.
Fields: `dayKey`, `timezone=Asia/Kolkata`, `attemptCount`, `configuredCap=100`,
`updatedAt` (Firestore server time), `policyVersion=ist-attempts-v1`. No payloads,
prompts, credentials, supervisor identity or customer data.

Transaction: begin → transactional document read → verify stored policy/count →
reject if exhausted → conditional create/update count+1 and server timestamp →
commit → only then call Gemini. Three maximum retries for definite ABORTED
conflicts within a five-second accounting deadline. No retry/refund of ambiguous
commits or provider failures. Provider runs outside the transaction. An IST day
change during reservation consumes the old slot and rejects before the provider;
a fresh request must reserve the new day. An outage/policy mismatch blocks calls.

Activation is separately gated by:

```text
USTAAD_ENABLE_FIRESTORE_GEMINI_CAP=true
USTAAD_GEMINI_COUNTER_DATABASE=(default)
GEMINI_DAILY_ATTEMPT_CAP=100
GEMINI_DAILY_ATTEMPT_TIMEZONE=Asia/Kolkata
USTAAD_ENABLE_LIVE_MODEL_CALLS=true
```

The existing model manifest must also permit calls. **Do not apply these to Cloud
Run now.** A configured store is never described as connectivity-verified. Local
maps are not accepted as a multi-instance global cap.

### Client access and transaction acceptance (after approval)

1. Refresh Rules release and existing rulesets. If still absent, Console →
   Firestore → Rules: publish exactly
   [gemini-counter.rules](../ops/firestore/gemini-counter.rules). No database,
   schema, index or client SDK permissions are created. If a release now exists,
   review its exact diff instead of overwriting it.
2. Verify browser/unauthenticated counter read and write denial using no Admin
   access token. Preserve any existing legitimate client rules for other data.
3. Use existing administrator ADC in two independent clients to make **three**
   reservations total on today's actual counter: one sequential, two concurrent.
   Read it independently before/after; verify exactly +3 and policy/server time.
   No Gemini request. Those reservations remain consumed; no counter reset or
   deletion. This proves real transactions with operator identity, not Cloud Run
   runtime permission or two running instances.
4. After separately authorized private candidate deployment, repeat a narrowly
   budgeted reservation/paid-call check via the runtime. Do not add Token Creator
   IAM to impersonate it as a shortcut. Prove final-slot contention locally now;
   do not burn 100 paid calls to exhaust a cloud cap.

Local deterministic tests cover the 99th/100th/101st attempt, shared final-slot
race, restart, conflicts, outage/403, malformed policy, ambiguous commit,
timeout/429/503 and IST midnight. Actual Firestore writes are **not** verified.
At 100 successful reservations/day: roughly 100 transactional reads + 100 writes,
up to 300 reservation reads with three conflict attempts; rejected requests also
consume reads, so these are workload estimates, not Firestore monetary caps.

## 6. Approval actor audit proposal (separate explicit schema approval)

Prepared [approval_audit_proposed.sql](../sql/migrations/approval_audit_proposed.sql)
adds one nullable JSON column to existing `prepagent.job_sheets`. No new table,
database or backfill. Runtime opt-in `USTAAD_ENABLE_APPROVAL_AUDIT=true` stays
off until applied and read-back verified.

After approval only:

```sh
bq query --project_id=prepagent-hack --location=asia-south1 --use_legacy_sql=false < sql/migrations/approval_audit_proposed.sql
bq show --format=prettyjson prepagent-hack:prepagent.job_sheets
```

Audit fields: job ID, verified actor UID, APPROVE action, DRAFT→APPROVED, server
decision time, server correlation UUID, decision UUID, exact card GCS URI. The
same conditional TEST-only UPDATE stores status/card/audit. Independent read-back
must match all of them before success. Replays preserve the original decision.
Failed upload cannot approve; conflicting uploads reconcile to the stored winner
and clean an unused object when safe. Indeterminate outcomes remain errors with
retained evidence for recovery. No distributed exactly-once guarantee is claimed.

Local fake-writer concurrency tests demonstrate the application contract, not
BigQuery transaction/uniqueness guarantees. No cloud draft, approval, PDF upload
or audit read-back was performed. Existing legacy APPROVED rows without audit
cannot be silently upgraded or treated as authenticated approvals.

## 7. Model acceptance evidence and exact remaining action

[Version manifest](evidence/MODEL_VERSION_EVIDENCE.json) records current BQ resource
metadata, Vertex version **1**, saved metrics, full global explanation metadata,
saved training SQL hash and the actual training parent/child job references.
Parent: `bqjob_r4cfdf43fbdc1dad1_000001a12c5223a4_1`.

| Model | R² observed | Prototype threshold | Full acceptance |
|---|---:|---:|---|
| m_warp | 0.6051768596 | .60 | BLOCKED |
| m_delam | 0.6664103997 | .60 | BLOCKED |
| m_strength | 0.4672612714 | .45 | BLOCKED |
| m_print | 0.7511528616 | .60 | BLOCKED |
| m_crack | 0.3010715690 | .30 | BLOCKED |

Saved SQL proves `lots WHERE run_date < DATE '2026-09-01'`, random .2 evaluation;
it does not prove exact sampled rows/count or a lower date boundary/snapshot.
One metadata request for the historical anonymous warp evaluation-split table
returned Access Denied (`bigquery.tables.get`, or unavailable table). No bypass
or repeated access attempt. Counts remain null. General D4 feature review exists;
review of these exact recovered version-specific artifacts must be linked by Om.

Smallest unblock: Om supplies the saved accessible evaluation membership/count
and source snapshot/window for each version, plus confirms review of the manifest's
feature evidence. If unrecoverable, Om approves a **new evaluation** contract
against a named frozen/reproducible source query (for example the synthetic held-out
September window), with real COUNT, evaluation job IDs and metrics. A new query
is not historical evidence and might fail the unchanged thresholds. No retrain.
Live model-dependent routes remain disabled until the complete gate passes.

## 8. Optimizer failure: exact cause and proposed single retry

No SQL objective/grids/formulas/rounding/tie-breaking were changed. The real
read-client previously rejected canonical ASSERT guards before sending SQL;
this code defect is now fixed with an exact guard allowlist and mutation tests.
The approved SQL remains byte-identical to this pass's starting version.

Prior job `ustad_pkbx0041_acceptance_20261015a`:

- Parent cap 83,886,080 bytes (80 MiB).
- First two ASSERT child jobs each billed 10 MiB, leaving 62,914,560 bytes.
- SELECT child `script_job_cde43b48b07343d987145cd8fc497098_2` needed
  **73,400,320** bytes (70 MiB); rejected before returning a result.
- Actual prior billed total 20 MiB; 1,283 bytes processed. This is not a successful
  optimizer acceptance. Candidate product is 8,640 rows for the approved example,
  evaluated through five ML.PREDICT expressions before the ≤3-changes selection.

Propose **one** retry at **104,857,600 bytes (100 MiB)**, covering 20 MiB guards +
70 MiB SELECT + 10 MiB margin. Reference $6.25/TiB yields about **US$0.00060**
before region/currency/free-tier/credit effects. No unbounded retry. Schema or
estimate increase beyond that ceiling stops the run. Owner approval is required
before raising the failed ceiling or running this retry.

Proposed command, not executed:

```sh
bq query --format=prettyjson --job_id=ustad_pkbx0041_acceptance_100m_20261015 --project_id=prepagent-hack --location=asia-south1 --use_legacy_sql=false --maximum_bytes_billed=104857600 --parameter=item_code:STRING:PKBX0041 --parameter=quantity:INT64:1300 --parameter=paper_type:STRING:RECYCLED --parameter=paper_supplier:STRING:SUP-D --parameter=shift:STRING:DAY --parameter=ambient_rh_pct:FLOAT64:86 --parameter=ambient_temp_c:FLOAT64:26 --parameter=paper_moisture_pct:FLOAT64:10.8 --parameter=sf_speed_mpm:FLOAT64:48 --parameter=roll_temp_c:FLOAT64:162 --parameter=gum_application:STRING:HIGH --parameter=gum_viscosity_sec:FLOAT64:32 --parameter=pasting_pressure:STRING:MED --parameter=drying_hours:FLOAT64:5 --parameter=print_speed_spm:FLOAT64:60 < sql/optimize.sql
```

First repeat with `--dry_run` and without job ID, inspect saved failed job/current
SQL hash, and confirm existing retry job ID has not already been submitted.
Dry run alone does not prove script billing or inference. After one execution,
read parent and child metadata and compare **all** expected rows: baseline
10.18%/100.4kg/₹5,351; best roll170/gumMED/viscosity35, 8.42%/83kg/₹4,426;
savings17.4kg/₹925, allowance₹0. Report any difference unchanged.

Application support for optional `USTAAD_OPTIMIZER_MAX_BYTES_BILLED=104857600` is
prepared, default still 80 MiB; invalid/greater values disable optimization.
No runtime configuration was changed. The direct bounded acceptance query is
isolated model validation, not permission to bypass model acceptance in user routes.

## 9. Costs and budget correction requiring approval

**Verified defect:** raw Budget REST `thresholdPercent` values are **50, 90, 100**.
The API uses fractions: .5 means 50%. Thus current thresholds represent
**5,000%, 9,000%, 10,000%**, not the intended 50/90/100%. Prior reports were wrong.
They imply ₹250,000/₹450,000/₹500,000 against ₹5,000, and are unsuitable early
warning. No billing settings changed.
[Budget threshold definition](https://docs.cloud.google.com/billing/docs/reference/budget/rest/v1/billingAccounts.budgets)

Keep ₹5,000/month, project scope and existing channel. Propose correcting only
threshold rules to **0.5 / 0.9 / 1.0** (₹2,500/₹4,500/₹5,000). Prepared body:
[correct-budget-thresholds.json](../ops/billing/correct-budget-thresholds.json).
Refresh etag first; a stale etag stops the update. After separate billing approval,
PATCH `https://billingbudgets.googleapis.com/v1/billingAccounts/014B62-B6BC57-970DC2/budgets/13af65ec-769e-4f30-b11f-a6b0f3bceba6?updateMask=thresholdRules`
with that JSON via a secure authenticated client. GET/read back exact amount,
scope, thresholds and channel. Do not broaden the update mask.

₹27,000 is an overall planning ceiling, not permission to replace the monthly
alert. Possible additional total-period budget/milestones ₹13,500/₹20,250/₹24,300/
₹27,000 need owner-approved start/end dates and gross-vs-net credit treatment.
No new budget is proposed for immediate execution. Current alert includes all
credits; email channel is enabled with one configured recipient, but receipt and
verification state have not been proved. Owner must inspect/test delivery.

| Service | Evidence and proposed workload | Best / conservative estimate | Plausible adverse case / confidence / monitoring |
|---|---|---|---|
| Firebase Google Auth | Not configured; 1–3 approved humans; tier-1 monthly active users | First50,000MAU/month listed at$0 if eligibility/quota remains; no SMS | Other project MAU/plan/quota unknown. Low expected cost, verify billing plan/quota; observe Auth usage |
| Firestore | Existing free-tier-eligible default DB; 3 acceptance reservations, then ≤100 provider reservations/day | 3 reads+3 writes for acceptance, roughly100 reads+writes/day normally; often within existing free allowance | Contention up to3 attempts; denied requests/read traffic and shared quota can exceed estimate. Use actual Mumbai operation SKU; no absolute INR promise |
| Gemini Vertex `gemini-3.5-flash`, `asia-south1` | No invocation this pass; 1 extraction + 1–2 explanation/tool rounds +10 photo requests planned after gates | Illustrative13 calls×(10k input×$1.65/M +2048 output×$9.90/M) ≈$0.48; 100 such attempts ≈$3.68/day | At assumed200k input/call, 100 calls ≈$35.03/day; **not an upper bound** on file tokenization or all-service spend. Capture real usage before expanding. No cache discount assumed |
| BigQuery dashboard | Four actual SELECTs: 810,906 processed bytes;40MiB billed, each10MiB | Reference analysis charge ≈$0.00024 before free tier/credits | Eachquerycap50MiB: fourqueries≤200MiB reference≈$0.0012; cache local toinstance1h; no global query/spend cap |
| BigQuery optimizer | Prior failed20MiB billed; proposedone100MiB retry | Retry reference≤$0.00060; no training | Five BQML predictions; future workflow querycount variable. Record billed bytes/regionSKU, stop above cap |
| Cloud Run | Existing1vCPU/1GiB, concurrency80, timeout300s; no deployment now | Zero incremental Stage A runtime requests; laterrequesttime×regionalCPU/RAM/requestSKU | Max2 is not a spending cap; long requests/retries/other workloads can accumulate cost. Workload latency, actual request billing and free quota remain unverified |
| Storage | No Stage A content reads/writes | Later fixture+PDF object bytes×retention, ClassA/B operations | Retained failed uploads, egress and unrelated bucket data unknown; object lifecycle/cleanup reviewed before acceptance |
| Build/registry/logging/other existing services | No build or added workload | Not estimated as zero for release | Existing usage, retention and billing export not inspected; owner reviews Billing report and credits |

Rates are reference USD, not a forecast exchange rate or INR invoice. Local
JSON output is bounded to2048 tokens, content/tool JSON64KiB, prompts12k characters
and response schemas16KiB. Approved document hashes/10MiB limit constrain files;
their provider input-token count is **not measured**. Failed outbound attempts
consume cap regardless of whether provider bills them. No automatic provider
retry, explicit cache creation, search grounding or committed capacity purchase.

[Vertex regional standard pricing](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing),
[Google/social MAU pricing](https://cloud.google.com/identity-platform/pricing),
[Firestore free quota and billing](https://firebase.google.com/docs/firestore/pricing),
[BigQuery analysis and BQML pricing](https://cloud.google.com/bigquery/pricing?hl=sk),
[Cloud Run pricing](https://cloud.google.com/run/pricing).

Firestore free quota resets on Pacific time, independently of the IST application
counter. Current spend, pending charges, remaining promotional credits, actual
Gemini regional quota/model availability and measured prompt tokens are unknown.
An exact cost ceiling across all GCP services cannot be inferred from these caps.

Current Cloud Billing also documents eligible **service-specific spend caps** for
Vertex and Cloud Run; none is observed configured here. They are not instantaneous
hard project caps, and would need a separately chosen monthly single-service
amount and approval. Do not create one or grant `billing.budgets.configureSpendCap`
implicitly. [Eligibility and limits](https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps)

## 10. Cloud evidence actually obtained

Four dashboard queries executed once through the real read client/impact mapper,
not test doubles, with50MiB maximum per query. No business records were written.
[Results/job statistics](evidence/STAGE_A_IMPACT_RESULT.json)

| SQL | Job ID | Client duration / rows | Billed |
|---|---|---|---:|
| dash_kpis.sql | job_bu2VF0NBudTxO-cd5Abt89y48Nta | 1238ms /1 |10MiB|
| dash_monthly.sql | job_8azCVk5EtvCL_K5yWpmlDKRO925L |2829ms /24 |10MiB|
| dash_top_items.sql | job_RTdXEkvyj4AdlrFLfgd8jTBCfqbN |3105ms /10 |10MiB|
| dash_seasonal.sql | job_FT48ntkd0F84_M0y7heEMmh9cpAa |3236ms /4 |10MiB|

All completed DONE. The real adapter returned safe generic item labels and a
second call hit its success cache with no additional queries. September held-out
estimates:219 lots,207 changed,₹7,320 predicted/net simulated saving,138kg;
7.06%→6.39%. **Not measured factory outcomes.** Monthly chart is the simulated
historical series; top-items query covers Oct2025–Sep2026; KPI estimate is Sep2026
only. Per-lot rounded cost aggregates differ slightly from monthly series
(₹78,774 vs₹78,776 baseline, ₹71,434 vs₹71,454 counterfactual); preserve those
distinct calculations, not a fabricated reconciliation or annualization. Deployed
HTTP/UI endpoint was not exercised by this direct-adapter check.

The object-name listing confirms10 images: crack2, crushed1, delam3, good1,
print2, warp1; folder mappings retained. No classification or photo download.
Models, saved training jobs, table metadata, Run configuration/IAM, API-disabled
state, Firestore database and budget were read. Access-denied evaluation evidence
remains denied; no permission escalation.

Fresh bounded PLANT-01 SELECT (`ustad_plant_stage_a_20261015`,10MiB cap) returned
INR /53.3perkg /default_locale`mr`. The table has only plant ID/name/currency/cost/
locale columns, not machine-standard columns. The approved D3 standards remain
explicit application fallbacks; no seed or locale writes. Actual processed27bytes,
billed10MiB,232ms server runtime, confirmed by independent job metadata read.

## 11. Release provenance, access and rollback

Observed current active revision: `prepagent-00005-s5x`,100% default traffic;
digest `sha256:25395f6c46ff43833b8ecd077bc8950173299cc743425d46baae3c03adaaa9f2`.
Ready tagged candidate `prepagent-00011-yew`,0% default traffic;
digest `sha256:7d75f6ea42f67832d0cfb2240592be4b966a68fd68e8cf98038b131cc2117e75`.
These images are **not** the local source. No clean source/tree→build→digest
mapping is proved. Active revision is an observed traffic target, **not a
tested known-good rollback target**. Source freeze waits for UI ownership handoff.

Public service/project IAM returned no allUsers/allAuthenticatedUsers bindings;
no public invoker bypass observed. Organization-level inheritance and an actual
unauthenticated HTTP probe were not assessed here. Keep private. Service max2
resolves the earlier service-level12 finding; revision12, concurrency/timeout,
request billing and min0 must be reconciled before candidate deployment.

Prepared `Dockerfile` now copies `public/`; static build-context test passes.
No container build, vulnerability scan of an image, deployment or smoke run was
performed. Base image is still `node:22-slim` rather than a pinned digest.

### Rollback by proposed mutation

| Mutation | Reversal / containment | Limits / data handling |
|---|---|---|
| Firebase registration/APIs | Disable Google provider and app auth flag; review any unused API disable separately | Cannot fully remove Firebase; do not delete shared project/service agents or blindly disable APIs |
| Web app/provider/domains | Disable provider; remove only newly added domains; unregister newly created web app only after checking no other consumer | Preserve owner baseline/config snapshot; no claim this erases all identity records |
| New runtime role binding | Command below removes only the new binding | No rollback of existing Firestore/storage/BQ roles |
| Supervisor role | Admin restores only the prior role from private backup while preserving intervening unrelated claims, then revokes refresh tokens | Fresh signed tokens required; never expose backup or add public reset endpoint |
| Counter use | Disable `USTAAD_ENABLE_LIVE_MODEL_CALLS` / shared-counter flag in a separately authorized candidate update; preserve counters | Do not decrement/reset/delete consumed reservations or delete DB |
| New Rules release | Restore previous recorded ruleset if one existed; if none, keep safe client deny rules | Never roll back to permissive client rules for convenience |
| Approval audit column | Disable approval-audit flag/approval adapter; retain nullable column/data | Prefer forward compatibility; dropping column deletes audit evidence and is not approved |
| Budget fractions | Retain safe intended fractions; any subsequent adjustment requires explicit billing review | Do not blindly restore broken50/90/100 values; amount stays₹5,000 |
| Future candidate traffic | Explicit release-only rollback command below | Not part of Firebase/Firestore approval; evidence of functional known-good target still required |

```sh
gcloud projects remove-iam-policy-binding prepagent-hack --member=serviceAccount:prepagent-run@prepagent-hack.iam.gserviceaccount.com --role=projects/prepagent-hack/roles/ustaadSupervisorTokenVerifier --condition=None
```

Only if this task created the role, no binding remains, and the owner approves:
`gcloud iam roles delete ustaadSupervisorTokenVerifier --project=prepagent-hack`.
No command above has been run. No runtime role must gain claim-update permission.

Claim rollback (administrator only, after owner approval, one admin at a time):

```sh
node tools/provision-supervisor.mjs --project=prepagent-hack --uid=OWNER_VERIFIED_UID --expected-email=OWNER_APPROVED_GOOGLE_EMAIL --restore-role-backup=/private/tmp/ustaad-supervisor-claims-before.json
node tools/provision-supervisor.mjs --project=prepagent-hack --uid=OWNER_VERIFIED_UID --expected-email=OWNER_APPROVED_GOOGLE_EMAIL --restore-role-backup=/private/tmp/ustaad-supervisor-claims-before.json --apply --backup=/private/tmp/ustaad-supervisor-claims-before-rollback.json
```

First command is dry-run. The second preserves other *current* claims, restores
only the previous role, independently reads it back and revokes refresh tokens.
It rejects a different project/UID, unsafe backup permissions or an independently
changed role. Claims updates are not a compare-and-swap transaction; serialize
administrator claim changes. No provisioning or rollback command has been run.

Future release-only containment commands (require release authorization):

```sh
gcloud run services update prepagent --project=prepagent-hack --region=asia-south1 --update-env-vars=USTAAD_ENABLE_LIVE_MODEL_CALLS=false
gcloud run services update-traffic prepagent --project=prepagent-hack --region=asia-south1 --to-revisions=prepagent-00005-s5x=100
gcloud run services remove-iam-policy-binding prepagent --project=prepagent-hack --region=asia-south1 --member=allUsers --role=roles/run.invoker
```

Re-read current IAM/traffic before any rollback; preserve unrelated owner changes
and tags, restore only approved diffs. No public binding exists now to remove.
Post-judging owner (Siddhant/project owner) must confirm assignment for private/
delete by7Nov; no automatic deletion is scheduled. TEST cleanup deadline17Oct
must be reconciled with any later acceptance run; only explicit TEST rows and
associated object generations may be cleaned after evidence preservation.

## 12. Acceptance and readiness matrix

PASS below always states the scope. BLOCKED means not live-accepted.

| Requirement | Result | Evidence / next smallest condition |
|---|---|---|
| Firebase Google sign-in configured | BLOCKED | Disabled APIs; owner setup F1–F2 |
| Trusted supervisor claim / approved UID | BLOCKED | Owner account + F4; admin tool only locally tested |
| Real signed/revoked token verified | BLOCKED | Real provider test after setup; no substitute identity |
| Unauthorized requests rejected | PASS locally | Firebase + HTTP negative tests, not deployed revision |
| Shared Firestore counter transactions | BLOCKED | Code/local race tests pass; three real reservations need approval |
| 100/day global Gemini cap | PASS locally / BLOCKED live | Deterministic two-client fake, outage+midnight+101st denial; runtime acceptance pending |
| Provider entry point centrally metered | PASS locally | Runtime source guard and factory tests; no real provider calls |
| Complete model evidence | BLOCKED | Version1 metrics/training jobs recovered; counts/source snapshot/exact review missing |
| Optimizer approved result | BLOCKED | Failed80MiB job explained; proposed one100MiB retry needs approval |
| Durable approval actor audit | BLOCKED | Local tests pass; schema/update/read-back not applied |
| Real PO extraction/catalog/clarification | BLOCKED | Fixtures/local path only; real Gemini unavailable |
| Conditions confirmation | PASS locally / BLOCKED live | Labeled simulated/manual server gate; supervisor/cloud acceptance pending |
| Five model predictions/optimization/explanation | BLOCKED | Complete acceptance gate deliberately remains closed |
| Draft, independent read, approval, PDF retrieval | BLOCKED | Local TEST workflow/recovery tests; real authenticated path not executed |
| Ten photos classified once | BLOCKED | Ten object names observed; no classifications this pass |
| Dashboard SQL/schema/privacy/cache | PASS direct cloud adapter | Four job IDs above; deployed HTTP/browser route unverified |
| Feedback/learning | BLOCKED for complete loop | Feedback code/tests; no cloud write. Actual-used settings/outcome source, partial feedback/idempotency still need contract |
| Source/image/revision mapping | BLOCKED | HEAD known, images known separately; source dirty/UI active/no build |
| Service max≤2 | PASS read-only configuration | Service2, revision12 still inconsistent for release |
| Public access policy | PASS inspection / BLOCKED release | No public bindings observed; real HTTP tests/release approval absent |
| Budget alert thresholds/delivery | FAIL / BLOCKED | Raw fractions wrong; delivery not verified; billing approval required |
| Synthetic-only request boundary | PASS locally | Exact hashes/signatures/size/provenance tests; current deployed source stale |
| Rollback | BLOCKED acceptance | Commands prepared; no live traffic rehearsal or known-good functional candidate |
| Deployment/public smoke test | BLOCKED | Neither authorized nor run |

| Readiness level | Verdict | What is still needed |
|---|---|---|
| Local synthetic demo | Conditionally Ready | Tests pass; finish UI owner handoff/browser auth integration and demo rehearsal |
| Private cloud demo | Not Ready | Setup/counter/model evidence/optimizer/audit schema/private candidate/authenticated PO→PDF read-back |
| Public judging | Not Ready | All private acceptance + corrected budget/receipt, proxy/endpoint checks, source/digest provenance, explicit release approval |
| General software production | Not Ready | Stronger durability/recovery, lifecycle operations, authentication/observability and load evidence; not implied by prototype gates |
| Real factory | Not Ready | Genuine outcomes/calibration/operational adoption and sensor/data governance outside V1 |

## 13. Requested approval scope and exact next step

Approve or decline these separately identifiable actions:

1. **Firebase**: add Firebase to existing project if absent (including documented
   automatic APIs/agents and Terms); Google-only sign-in, one web app, exact
   domains; one minimal runtime user-read role; provision the owner's verified
   Google UID with preserved claims and mandatory allowlist.
2. **Existing Firestore**: reuse `(default)`/Mumbai with current runtime grant;
   publish reviewed deny client rules if missing; perform three real no-Gemini
   reservations and independent read-back. No new DB/Firestore IAM grant.
3. **Budget correction**: preserve₹5,000/month and channel, correct only threshold
   fractions; owner tests delivery and reviews actual spend/credits.
4. **Approval audit schema**: add nullable JSON column only; TEST writes wait for
   auth/model/candidate acceptance prerequisites.
5. **Optimizer**: one100MiB bounded PKBX0041 retry after fresh dry run; no semantic
   SQL changes or automatic repeats.

Approval of1–2 does **not** approve3–5, candidate build/deploy, traffic, public
access, model retraining, new evaluation, or paid Gemini/photo acceptance.
Use existing administrator permissions; stop instead of widening them.

After approval of1–2: refresh resource/IAM snapshots, execute F1–F4 and Firestore
steps1–3, independently verify identity/claims/transactions, then report remaining
model/release gates. The owner must provide the exact supervisor Google account
privately; UID is obtained through real sign-in, never invented. Finish auth UI
integration only after the other editor's handoff. Do not wait on that to prepare
or verify independent backend prerequisites.

Stage A is complete. These are the exact cloud resources, IAM permissions,
expected costs, and rollback actions required for Firebase supervisor
authentication and the Firestore Gemini counter. No cloud configuration mutations
have been performed. Awaiting explicit authorization to execute this plan.
