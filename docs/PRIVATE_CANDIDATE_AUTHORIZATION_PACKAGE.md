> **V1 freeze source supersedes the earlier candidate:** final archive/source identities and exact runtime checks are in `docs/evidence/v1-code-freeze-20261016/`. Final counts104 focused/310 acceptance/521 full/25 browser are reconciled in `V1_CODE_FREEZE.md`. Historical preparation results below remain bounded to their stated source. No build/deploy authorized or executed.

# Private candidate authorization package —16 October2026

**Checkpoint: ready for owner review of one Cloud Build and one private, zero-default-traffic candidate deployment. Neither has been executed. D4 remains blocked.**

## 1. Exact source and preservation

- Branch/HEAD: `main` / `22bea45cad184cda737e3cd60468020722a38e5f`; dirty worktree preserved. HEAD alone does not identify the candidate.
- Immutable source archive: `/Users/siddhant/prepagent-work/release-artifacts/ustaad-v1-freeze-release-20261016.tar.gz`.
- Archive SHA256: `dd0ac91ddfec18aa2cd7bb464fce9c7f4d2fae7abce31ee9bf959e1fcdbd0082`.
- Source manifest SHA256: `9edd78db8d66ee8e80825aea770cbb531337e7a748500d8d8199768909d05af8`.
- Source directory: `/Users/siddhant/prepagent-work/release-artifacts/ustaad-v1-freeze-release-20261016`.
-120 explicitly selected payload files plus `SOURCE_MANIFEST.json`; includes `src/`, `public/`, approved sample/font assets, SQL, four runtime configs, Dockerfile, lockfile and private build config. No docs/tests/tools/env/credentials/.git enter the runtime build context.
- Lock SHA256: `77cd7f6966e93a89d3140520b62cb7ffcd1b2431f8ad40ad045b1864b2c8d65d`.
- All archive entries verified against their manifest and current source; two previous independent normalized preparations have identical archive hashes. Current check again confirms all120 entries. No runtime source change was required in this pass.

Final freeze tests ran against the settled worktree whose120runtime files match the new immutable archive before and after verification. A separate fresh extraction passed clean production-only install/startup/security smoke. Earlier candidate tests used a separately hashed test-only overlay; those historical logs are retained. This pass preserved generated browser screenshots separately and restored only its own changes to exact pre-run bytes.

## 2. Container image/build result and limitations

**No image digest or new build ID exists for this candidate.** Docker, Podman, nerdctl and Colima are absent; no Docker daemon socket exists. No container engine/VM was installed and no remote build was silently substituted for the permitted local build.

Verified locally: exact archive, clean production-only `npm ci --omit=dev`, Node22 startup, health/UI/static/auth/status routes, Approach B configuration, D4 refusal, missing-key fail-closed behavior and forged/tampered-session denial. Local production smoke used an ephemeral key in memory and blocked all external fetches. It is not Linux/container or runtime-SA cloud integration proof.

Dockerfile pins `node:22-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392`; uses the exact lock, explicit COPY paths, non-root node user and port8080. Build config is the archived `cloudbuild.yaml`, byte-identical to `ops/cloudbuild-private.yaml`,900second timeout, startup/assets/syntax/dependency-audit checks before image publication. It records HEAD/source labels. Builder image tags and npm install timestamps mean bit-for-bit image reproducibility is **not claimed**; record resolved step images and immutable resulting digest from the actual build.

The environment prevents local image validation. The smallest valid next action is the proposed one bounded Cloud Build below; stop on any failed image build/startup/audit. No model-dependent acceptance is needed to perform that build or private deployment.

## 3. Candidate tests and independent acceptance

| Check against extracted candidate | Result |
|---|---|
| Focused backend |104 passed,0 failed/skipped |
| `npm run test:acceptance` |310 passed,0 failed/skipped |
| `npm test` |521 passed,0 failed/skipped |
| `npm run test:ui` |25 passed,0 failed/skipped |
| Runtime JavaScript syntax |65 modules passed |
| Runtime JSON/build YAML and proposed env parsing |PASS |
| Clean production dependency install/startup |PASS locally, not container |
| `npm audit --omit=dev --json` |0 vulnerabilities |
| Exact runtime hashes after tests |All120 match |

`CANDIDATE_TESTS.json` retains the first full-suite run's512passes/4failures: the verification copier accidentally included only selected extensions from `tools/node_modules`, omitting a required `.cjs` dependency. Removing only that incomplete test-only dependency overlay restored normal resolution to clean root dependencies. `CANDIDATE_RETEST.json` records516passes; no application/test assertion was changed. Initial production smoke expected the wrong summary status string; corrected the smoke to assert the actual documented `prototype-thresholds-met` display with `completeAcceptanceEvidenceAvailable=false` and unavailable job creation. D4 config remains `status:blocked`; the real approval refusal was checked. Both diagnostic failures remain recorded.

Browser verification includes24labelled intercepted-provider cases plus one actual local mock-backend journey with no API interception. Neither is live-model cloud acceptance. Read-only cloud checks from the preceding preparation pass, reused without repetition during final freeze:

- Project514663464609, service IAM/config, runtime project IAM and secret-level accessor read back; max2 and default100%`prepagent-00005-s5x` unchanged.
- Existing V4 private health/status/auth read: IAM-unauthenticated403, legitimate invocation200; genuine signed session; D4 approval503; forged/missing/tampered session401 and missing-origin/cross-namespace403. No provider/query/business write.
- Existing V4 returns404 for `/dashboard.css`, confirming its older source. Current archived source serves that asset in local production smoke; do not treat old V4 as verification of the new UI. New deployment must verify it again.
- Independently downloaded the existing isolated TEST card's exact GCS generation1792087313953086,11378bytes; SHA256 `f662af4559fd76234854a03dd8c3c267294e5712639866abafc8ad913d0eb22b` matches prior audit/PDF evidence. No new JobSheet/upload/approval was needed.
- Existing optimizer job `ustad_pkbx0041_acceptance_100m_20261015` read back, unchanged accepted fixture and90MiB historical billing. No rerun.
- Existing ten classifications7matches/3mismatches, four-query dashboard/privacy/cache and isolated real persistence evidence remain sufficiently current. This pass reran their local contracts; it did not recreate paid results.
- Actual counter records:15October18/100 retained;16October no document yet(404). No reservation/reset/new provider allowance. Existing runtime transactional acceptance and deterministic race/outage/timeout/no-refund tests retained.
- Actual released Firestore ruleset `450fe5e1-e1b9-4e03-8a0b-e82e0d554fd8` denies counter client reads/writes. Server IAM is separate. Existing budget amount/scope/.5,.9,1/channel unchanged; email channel enabled. Receipt/spend/remaining credits not proven.

Initial budget/rules GETs lacked the required quota-project header and failed403; exact re-reads with `x-goog-user-project: prepagent-hack` succeeded. Only request headers changed, not APIs/IAM/ADC configuration. One initial GET used the wrong budget identifier and is retained as a harness error; only the recorded actual resource was subsequently verified.

## 4. Proposed Cloud Run revision configuration

| Setting | Proposed value |
|---|---|
| Service/project/region |prepagent / prepagent-hack / asia-south1 |
| Revision/tag |prepagent-v1f-9edd78db / v1f-9edd78db |
| Image |Actual immutable digest from successful approved build; never invented |
| Default traffic |No shift; existing100%prepagent-00005-s5x |
| Access |Private IAM invocation preserved; existing ingress all retained |
| Runtime SA |prepagent-run@prepagent-hack.iam.gserviceaccount.com |
| Scale |Service/revision max2, min0 |
| Resources |1CPU,1Gi, concurrency1, timeout120s, request-based CPU, CPU boost off |
| Secret |Existing USTAAD_DEMO_SESSION_SIGNING_KEY from ustaad-hackathon-session-signing:1 |
| Policy |HACKATHON_DEMO; synthetic-only; audit enabled; mock/demo agent routes disabled |
| Firebase |Explicit recognized flag USTAAD_ENABLE_FIREBASE_AUTH=false; separate production policy retained |
| Provider accounting |Existing Firestore(default),100attempts/Asia/Kolkata day, fail-closed |
| Model gate |Current archived acceptance config BLOCKED; no acceptance flag override |
| Queries |Existing per-query limits; approved optimizer maximum104857600bytes |

Exact environment is `docs/evidence/v1-code-freeze-20261016/CANDIDATE_ENV_PROPOSED.json`. It corrects the earlier proposal's unused `USTAAD_FIREBASE_AUTH_ENABLED` name to the actual recognized `USTAAD_ENABLE_FIREBASE_AUTH=false`. No running environment changed. Model/provider adapter flags remain configured as previously proposed, but approval of this preparation does not authorize provider invocations. Private post-deployment checks below are no-provider/no-query/no-write only. No Firebase identity is fabricated.

## 5. Exact proposed commands — NOT EXECUTED

Preconditions: owner approves one build and one private revision plus read-only/negative smoke, fresh resource/IAM/traffic snapshot still matches this report, tag/revision absent, exact archive/lock/env hashes match. Existing registry `asia-south1-docker.pkg.dev/prepagent-hack/prepagent`, source bucket `prepagent-hack_cloudbuild` and build identity are reused. Stop on required new API/resource/permission.

```sh
SDK='/Users/siddhant/prepagent-work/google-cloud-sdk/bin'
SNAPSHOT='/Users/siddhant/prepagent-work/release-artifacts/ustaad-v1-freeze-release-20261016'
IMAGE='asia-south1-docker.pkg.dev/prepagent-hack/prepagent/prepagent:final-9edd78db8d66'
shasum -a 256 "$SNAPSHOT.tar.gz"
# Must equal dd0ac91ddfec18aa2cd7bb464fce9c7f4d2fae7abce31ee9bf959e1fcdbd0082.
"$SDK/gcloud" builds submit "$SNAPSHOT" --project=prepagent-hack --region=global   --config="$SNAPSHOT/cloudbuild.yaml" --timeout=900s   --substitutions="_HEAD=22bea45cad184cda737e3cd60468020722a38e5f,_SOURCE_SHA=9edd78db8d66ee8e80825aea770cbb531337e7a748500d8d8199768909d05af8,_IMAGE=$IMAGE"   --format=json > /PRIVATE/NEW_BUILD_RESULT.json
```

Capture the actual build ID, source generation and SUCCESS status, step-image digests, test/audit output and `results.images[].digest`. Stop on unknown/high-cost machine configuration or failed checks; no automatic repeat. The build's existing default worker is reviewed against the cost estimate before execution; do not silently choose a larger machine. Read back the image and use its immutable digest:

```sh
# NEW_BUILD_ID must be the ID just returned, not the historical build ID.
"$SDK/gcloud" builds describe NEW_BUILD_ID --project=prepagent-hack --region=global --format=json
"$SDK/gcloud" artifacts docker images describe "$IMAGE" --project=prepagent-hack --format=json
# Replace the following value only with the verified actual results.images digest.
BUILT_IMAGE='asia-south1-docker.pkg.dev/prepagent-hack/prepagent/prepagent@sha256:ACTUAL_VERIFIED_DIGEST'
"$SDK/gcloud" run deploy prepagent --project=prepagent-hack --region=asia-south1   --image="$BUILT_IMAGE" --revision-suffix=v1f-9edd78db --tag=v1f-9edd78db --no-traffic   --service-account=prepagent-run@prepagent-hack.iam.gserviceaccount.com   --min=0 --max=2 --min-instances=0 --max-instances=2   --concurrency=1 --timeout=120s --memory=1Gi --cpu=1   --ingress=all --cpu-throttling --no-cpu-boost --invoker-iam-check   --env-vars-file=docs/evidence/v1-code-freeze-20261016/CANDIDATE_ENV_PROPOSED.json   --set-secrets=USTAAD_DEMO_SESSION_SIGNING_KEY=ustaad-hackathon-session-signing:1
```

No `--allow-unauthenticated`, IAM binding command or `--to-revisions` is included. A no-traffic deployment still changes the latest service template and adds a tag; those changes are part of the requested approval. Existing service-level max2/min0 are explicitly preserved. Never run placeholders. Installed gcloud589help recognizes the proposed flags.

## 6. Private access and no default shift

Before/after independently read:

```sh
"$SDK/gcloud" run services describe prepagent --project=prepagent-hack --region=asia-south1 --format=json
"$SDK/gcloud" run services get-iam-policy prepagent --project=prepagent-hack --region=asia-south1 --format=json
"$SDK/gcloud" run revisions describe prepagent-v1f-9edd78db --project=prepagent-hack --region=asia-south1 --format=json
```

Require default100%old revision unchanged, new revision0%default and only intended new tag, IAM unchanged/noallUsers/noallAuthenticatedUsers, service/revisionmax2, expected runtimeSA/digest/secret reference/env and healthy ready conditions. Project inherited IAM must also remain private; do not infer private access from ingress settings alone.

## 7. Estimated additional cost

This pass: no cloud build/deploy, no BigQuery queries, no provider calls/reservations or business writes. Only resource/metadata/private HTTP and one existing PDF read; actual invoice not available. No exact INR or free-credit claim.

Proposed scope: one build≤15minutes, existing image/source/log storage, one private revision min0 and≤30 no-provider/no-query smoke requests. At the published e2-standard-2 default-pool reference priceUS$0.006/min,15minutes isUS$0.09 before credits/tax. A conservative two-instance15minute request-active envelope at reference1CPU/1Gi request rates is aboutUS$0.05 compute; actual regional SKU/startup/log/storage/egress and retention vary. Operational planning allowance **US$1 incremental**, not an enforced global cap; stop before build if reviewed machine/SKU/retention estimate exceeds it. No free quota/credits assumed. Set an explicit retention/review date for new image/source artifacts; do not delete existing evidence automatically.

Sources checked16October: [Cloud Build pricing](https://cloud.google.com/build/pricing), [Cloud Run pricing](https://cloud.google.com/run/pricing).₹5000 budget remains an alert, not a spending cap;₹27000 planned total is distinct. No billing update proposed.

## 8. IAM changes

**None proposed.** Current runtime has existing aiplatform.user, datastore.user, bigquery.jobUser/dataEditor, storage.objectAdmin and signing-secret-level secretAccessor. These cover existing provider/counter/query/TEST persistence/object operations; TEST-only restriction is application-enforced, not a BigQuery row-level IAM guarantee. Existing identity-reader/custom, translation and Pub/Sub permissions are left untouched; no new use or least-privilege certification for unrelated workloads is claimed.

Existing successful build used `514663464609-compute@developer.gserviceaccount.com`, project existing Cloud Build bucket/repository. Future build/deployment permission failures must stop, not trigger a broad role grant. Operator CLI PDF reads do not prove runtime-SA write access. Prior actual runtime counter/provider evidence remains separate.

## 9. Rollback target and exact commands

There is **no known-good full PO-to-card target while D4 is unresolved**. Existing private feature baseline `prepagent-b-1015-43c1a259`, digest `sha256:f9125d32da1233ff560241099af1e900788869212cfae6b7b011e80fce0f6fd2`, was rechecked for health/status/auth/refusal; image existence and its successful historical build `f734503e-55b7-418e-88ab-de313e97531a` verified. It remains a comparison/feature fallback. Old default00005 is preserved, not newly certified.

Because default traffic never moves, rollback is withdrawal of only the new tag. Verify0%default and no intervening owner change, then under the deployment approval:

```sh
"$SDK/gcloud" run services update-traffic prepagent --project=prepagent-hack --region=asia-south1   --remove-tags=v1f-9edd78db
"$SDK/gcloud" run services describe prepagent --project=prepagent-hack --region=asia-south1 --format=json
"$SDK/gcloud" run services get-iam-policy prepagent --project=prepagent-hack --region=asia-south1 --format=json
```

Require default100%00005 and IAM/max settings unchanged. No revision/image/secret/record/counter deletion. Tag withdrawal does not undo latest-template metadata; snapshot and compare it on any future deploy. Private service IAM remains the access boundary. Rollback command is prepared, not executed or traffic-rehearsed. Unexpected default traffic/IAM drift is an incident requiring reviewed restoration, not a reason to guess a revision or rewrite unrelated tags.

## 10. Verification after approved private deployment

1. Capture actual source object generation/build/digest/revision/config; compare manifest and all pre/post checks above.
2. Use intended private tagged URL and legitimate Cloud Run IAM ID token in `X-Serverless-Authorization`; token stays in memory. Unauthenticated request must401/403; never disable IAM for browser convenience.
3. Verify `/health`, `/`, `/dashboard.css`, `/ui/workflow.js`, `/ui/api.js`, `/supervisor-auth-client.js`, `/api/auth/config`, `/api/status`; require exact current assets, HACKATHON_DEMO, Firebase inactive, synthetic-only, shared100/IST configuration and unavailable job creation with incomplete model evidence.
4. Issue real signed demo session using exact same-origin POST; verify HttpOnly/Secure/SameSiteStrict. Missing/tampered/forged identity rejected; other namespace rejected before repository access; valid owned approval returns MODEL_ACCEPTANCE_REQUIRED without provider/query/write. Test no-origin refusal and disabled mock-agent route.
5. Inspect console/network/layout on actual private candidate through legitimate infrastructure authentication. If browser cannot carry infrastructure credentials, stop browser acceptance and use approved secure automation headers; no public IAM/proxy workaround. Local24browser tests are not substituted for this.
6. Compare Firestore counter(s), budget/rules, logs and traffic/IAM after checks. No counter reservations or business mutations expected. Reuse actual existing dashboard/photo/optimizer results; do not trigger new paid work just to repeat evidence. If inspecting Impact's deployed API would cause fresh SQL, obtain/reuse its bounded approved check deliberately and record that scope separately.
7. Save all results; keep model-dependent workflow and provider calls prohibited. A healthy deployment only accepts the private independent-feature candidate, not the full product.

## 11. Items dependent on D4 versus other boundaries

D4: actual version-linked evaluation membership/counts, source identity/window/run/query provenance, exact five current model versions and Om's feature review. Follow [D4_EVIDENCE_INGESTION.md](D4_EVIDENCE_INGESTION.md), keeping acceptance blocked until genuine evidence passes. No six-query evaluation, training or acceptance change performed.

Only after accepted evidence, a new tested snapshot/build/revision and separately bounded provider allowance: execute [FINAL_PO_TO_CARD_ACCEPTANCE.md](FINAL_PO_TO_CARD_ACCEPTANCE.md) for actual predictions/optimization/grounded explanation/DRAFT/approval/audit/PDF and runtime-SA persistence. Current source can be privately deployed while D4 is blocked; do not wait for Om to perform authorized independent private checks.

Separate: approval of this Cloud Build/private revision; no local container engine; later public access/promotion approval/smoke; optional genuine completed-lot outcome rules; actual budget receipt/spend/credits. None is renamed D4. No public release is included.

## Approval checkpoint

**Awaiting approval for one≤900second Cloud Build of archive `c085efc8…`, followed only on successful image checks by private revision `prepagent-v1f-9edd78db`, no default-traffic shift, no IAM changes and the no-provider/no-query/no-write post-deployment checks above.** Proposed planning exposure≤US$1, subject to preflight; no automatic repeats. Stop on failures or unexpected permissions/cost/configuration. No deployment has occurred.

Evidence: `docs/evidence/private-candidate-preparation-20261016/`. Initial harness diagnostics are preserved alongside final passing results. No staging/commit/push/reset/cleanup or runtime source changes.
