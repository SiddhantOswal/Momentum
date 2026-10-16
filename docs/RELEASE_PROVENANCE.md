
## Approved-data wording replacement —16October2026

Current private wording candidate: `prepagent-approved-365e632b`, https://approved-365e632b---prepagent-26mwt2n7ba-el.a.run.app. Image `asia-south1-docker.pkg.dev/prepagent-hack/prepagent/prepagent@sha256:9f6840d7dc86db6c30480cae834fcb069de7530b94716f947a80185c6e629f2c`; build `2ed7aeb3-0f39-4d72-bb1b-88f7ed6d7f3f`; manifest `365e632b166294dbb95d8103b6e7183e473bdc12985a9edba4d7260cb155613f`; archive `403b213da53c5318cb366d15e10d3017d46b22e4f62bfe24759b19ce04b89ae0`. Owner requested removal of synthetic-data wording. Live banner/PO links/errors now use approved-data wording; mock backup output remains explicitly mock, sensors simulated and savings predicted. No dataset was transformed or relabeled as measured factory outcomes. Legacy internal identifiers/env/API keys remain compatible. Historical evidence is preserved. Default traffic and private IAM unchanged, max2; no new paid model calls or local suites. Full integration proof from the preceding candidate retains its stated source/scope; this replacement receives targeted live wording/gate checks only. See docs/evidence/approved-data-wording-20261016/.


## Superseding live GCP checkpoint —16October2026

Private candidate `prepagent-v1f-9edd78db` is now deployed at https://v1f-9edd78db---prepagent-26mwt2n7ba-el.a.run.app; image `asia-south1-docker.pkg.dev/prepagent-hack/prepagent/prepagent@sha256:13aea5e51ab935273925111e1cbfc5d996bbc2dbc71c90cf5796883ebe4d6f59`, Cloud Build `7b5a323f-73a0-4be0-9bd4-ab47a23f784d`. Default100%prepagent-00005-s5x and private IAM unchanged; max2. Actual remote browser verified extraction/catalog/conditions/history/photo/Impact and bounded security checks. Two Gemini attempts; counter2/100. D4 remains blocked; no model-enabled draft/approval/PDF flow or public release is claimed. No local suites, commit or push in this assignment. See GCP_END_TO_END_ACCEPTANCE_REPORT.md and docs/evidence/live-gcp-20261016/ for exact scope, retained failed assertions/follow-up results, cost and submission dependencies. Historical statements below saying no build/deploy are superseded only for this new candidate.

> **Final V1 freeze candidate:** [V1_CODE_FREEZE.md](V1_CODE_FREEZE.md) and [PRIVATE_CANDIDATE_AUTHORIZATION_PACKAGE.md](PRIVATE_CANDIDATE_AUTHORIZATION_PACKAGE.md) supersede source/build commands below. Current source manifest `9edd78db8d66ee8e80825aea770cbb531337e7a748500d8d8199768909d05af8`, archive `dd0ac91ddfec18aa2cd7bb464fce9c7f4d2fae7abce31ee9bf959e1fcdbd0082`, directory `/Users/siddhant/prepagent-work/release-artifacts/ustaad-v1-freeze-release-20261016`. Earlier f303d043 artifacts are historical and preserved. No image/build/deployment exists for the new source; D4 remains blocked.

> **16October private preparation update:** [PRIVATE_CANDIDATE_AUTHORIZATION_PACKAGE.md](PRIVATE_CANDIDATE_AUTHORIZATION_PACKAGE.md) contains the refreshed exact-archive tests, production-only local smoke, current cloud read-back and approval checkpoint. Source/archive hashes below remain unchanged. No container engine is installed, so no new image/build exists. The new proposed env uses recognized `USTAAD_ENABLE_FIREBASE_AUTH=false`; the historical proposal below is superseded for that flag. No deployment/IAM/traffic change performed.

# Ustaad release provenance and controlled release procedure

## Prepared artifact — not a new deployment

- Branch/HEAD: `main` / `22bea45cad184cda737e3cd60468020722a38e5f`. Worktree is dirty and intentionally preserved; HEAD does not identify all candidate code.
- Source manifest SHA256: `f303d043ce83531faabb08874620617aa82510b6600940ebe27ed1031777db02`.
- Deterministic archive SHA256: `c085efc8414776139b01dac552e157342fac630ee6d934b684876ac3baad8bed`. Two independent full-source preparations produced identical archive hashes.
- Durable local source directory: `/Users/siddhant/prepagent-work/release-artifacts/ustaad-v1-20261015-final`.
- Archive: `/Users/siddhant/prepagent-work/release-artifacts/ustaad-v1-20261015-final.tar.gz`. No upload has occurred.
- Files: 120, explicitly selected runtime sources/assets/approved samples, four allowed configs and private Cloud Build configuration. `SOURCE_MANIFEST.json` identifies every included file. Docs, tests, CLI tools, env files, credentials and `.git` are excluded from the image context. Nested credential-like files and symlinks cause failure rather than silent inclusion.
- Dependency lock identity: `77cd7f6966e93a89d3140520b62cb7ffcd1b2431f8ad40ad045b1864b2c8d65d`. No dependency was added for this consolidation. Base Node22image is pinned by digest in Dockerfile; inspect it and the lock before any authorized build.
- Current image/build ID: **none for this prepared source**. `PRIVATE_RELEASE_PLAN.json` and `CANDIDATE_ENV_PROPOSED.json` are proposed only.
- Model gate in this snapshot: **BLOCKED**. Installing accepted D4 evidence changes source; generate and test a new snapshot before model-enabled acceptance. Do not deploy this archive and claim its models are accepted.

Source identity and current tests are in `docs/evidence/final-consolidation-20261015/`. Test/source hashes and all retained dirty-file paths are recorded separately. The snapshot is a runtime artifact, not a claim that all docs/tests are committed or contained in the container.

## Existing private cloud baseline

`prepagent-b-1015-43c1a259`, digest `sha256:f9125d32da1233ff560241099af1e900788869212cfae6b7b011e80fce0f6fd2`, is the previous independently tested private-feature candidate. Its earlier source/build evidence is retained. It is **not a fully accepted PO-to-card rollback revision**.

Default traffic remains100% `prepagent-00005-s5x`. Service IAM remains private; service max2/min0. Runtime identity is `prepagent-run@prepagent-hack.iam.gserviceaccount.com`. Existing signing secret `ustaad-hackathon-session-signing:1` and shared `(default)` Firestore counter are reused. No new service/IAM/billing configuration is proposed.

Historical revision-level max12 on old00005 must not be confused with the current service maximum2. New candidates use revision maximum2 as well. No spending hard cap is inferred from autoscaling.

## Pre-build checks

After owner deployment/build approval:

1. Re-read service/revision/IAM, traffic, scale, runtime identity and existing secret binding. Stop on unexpected drift; never add a broad fallback role.
2. Verify all current source hashes match the selected manifest. Preserve UI handoff and all unrelated changes. Compare the actual archive SHA256.
3. Run tests against that exact runtime input set. Save test source hashes/logs, lock hash and source manifest. No staging/commit/push required for this immutable artifact method.
4. Review proposed env: HACKATHON_DEMO; Firebase inactive; synthetic-only and audit enabled; shared100/IST Firestore counter; intended model/adapter flags; mock routes off. `USTAAD_PUBLIC_ORIGIN` must equal the exact candidate HTTPS URL, not a client-supplied Forwarded host. Secret values are never in this file.
5. Ensure no paid browser action is exercised without a new allowance. The existing provider-run allowance is exhausted even if the daily counter has room.

## Exact private build and deployment commands — NOT EXECUTED

The following identify the prepared blocked-model artifact. If D4 is installed, recompute all hashes/suffixes and use its newly reviewed plan instead. Do not paste an invented digest.

```sh
SNAPSHOT='/Users/siddhant/prepagent-work/release-artifacts/ustaad-v1-20261015-final'
IMAGE='asia-south1-docker.pkg.dev/prepagent-hack/prepagent/prepagent:final-f303d043ce83'
/Users/siddhant/prepagent-work/google-cloud-sdk/bin/gcloud builds submit "$SNAPSHOT" \
  --project=prepagent-hack --config="$SNAPSHOT/cloudbuild.yaml" \
  --substitutions="_HEAD=22bea45cad184cda737e3cd60468020722a38e5f,_SOURCE_SHA=f303d043ce83531faabb08874620617aa82510b6600940ebe27ed1031777db02,_IMAGE=$IMAGE"
```

Capture the actual build ID and inspect its SUCCESS result, source object generation, step-image digests, startup/static/syntax/npm-audit results and resolved image digest. Existing Cloud Build bucket/repository/builder are reused. No new builder role/API/scanner is silently enabled. The npm audit covers dependencies, not OS-image CVEs; Artifact Registry scanning was disabled at inspection.

Use the actual immutable image URI returned by that build, then:

```sh
/Users/siddhant/prepagent-work/google-cloud-sdk/bin/gcloud run deploy prepagent \
  --project=prepagent-hack --region=asia-south1 \
  --image=ACTUAL_BUILT_IMAGE_AT_SHA256 \
  --revision-suffix=v1f-f303d043 --tag=v1f-f303d043 --no-traffic \
  --service-account=prepagent-run@prepagent-hack.iam.gserviceaccount.com \
  --min=0 --max=2 --min-instances=0 --max-instances=2 \
  --concurrency=1 --timeout=120s --memory=1Gi --cpu=1 \
  --cpu-throttling --no-cpu-boost --invoker-iam-check \
  --env-vars-file=docs/evidence/final-consolidation-20261015/CANDIDATE_ENV_PROPOSED.json \
  --set-secrets=USTAAD_DEMO_SESSION_SIGNING_KEY=ustaad-hackathon-session-signing:1
```

Do not add `--allow-unauthenticated`, remove IAM, or switch default traffic. Record exact candidate revision, digest, URL, runtime/secret references and before/after default traffic/IAM. The planned URL is `https://v1f-f303d043---prepagent-26mwt2n7ba-el.a.run.app`; it is **not deployed**.

Verify IAM-unauthenticated requests are denied; legitimate Cloud Run invocation can load health/UI/assets/status. Obtain a real signed demo session, reject tampered/missing sessions/forged headers, and verify cross-session namespace refusal. While D4 is blocked, prediction/preparation/approval must refuse; do not use test data to circumvent that gate. Verify model-independent Impact/evidence/conditions using existing bounded query caps/cache without unnecessary provider calls. Inspect browser console/network errors against the actual new candidate. Full model-enabled acceptance follows `FINAL_PO_TO_CARD_ACCEPTANCE.md` only after prerequisites pass.

## Candidate withdrawal and rollback

No default traffic switch occurs in private acceptance. To withdraw **only this newly approved tag**, first verify it has0%defaulttraffic and no unrelated owner change:

```sh
/Users/siddhant/prepagent-work/google-cloud-sdk/bin/gcloud run services update-traffic prepagent \
  --project=prepagent-hack --region=asia-south1 --remove-tags=v1f-f303d043
```

This is a prepared rollback command, not an executed/tested traffic rollback. Preserve source/images/revisions and TEST evidence. The earlier V4 private feature URL can remain a comparison baseline, but must not be labeled full-workflow known-good. After a successful model-enabled candidate, record its revision/digest as the actual acceptance/rollback anchor.

A secret-version disable alone does not revoke keys already cached in running environment variables. Rotation requires a new secret version, explicit private revision update, validation and removal of old serving tags/revisions. Do not reset counters or delete referenced PDFs as recovery.

## Stage D public release — separate explicit approval

No public operation below is authorized by preparing this document. Before public IAM:

- Full private model-enabled workflow and negative/replay/PDF read-back pass on the exact selected source/image.
- Inventory all tagged legacy/diagnostic revisions and remove every unapproved public entry point under an exact reviewed tag list. Cloud Run invoker policy is service-wide: old tagged URLs would otherwise also become public.
- Promote only the accepted revision; do not make old default00005public while the accepted candidate has0%traffic.
- Review route matrix, globally metered Gemini, per-query caps, synthetic-only uploads, demo disclosure, privacy, request limits, error/latency evidence, budget configuration and actual notification receipt. Process-local/IP throttling is not a global per-visitor guarantee behind the proxy; shared100/day accounting is the global Gemini guard.
- Record previous traffic and an actually accepted rollback target, monitoring owner, cost allowance and November7private/delete owner.

After explicit StageDapproval, exact command shapes are:

```sh
# Review and substitute only ACTUAL accepted revision and the ACTUAL obsolete tag list.
gcloud run services update-traffic prepagent --project=prepagent-hack --region=asia-south1 \
  --to-revisions=ACCEPTED_REVISION=100 --remove-tags=REVIEWED_OBSOLETE_TAG_LIST
# Only after promotion and all guardrails are read back:
gcloud run services add-iam-policy-binding prepagent --project=prepagent-hack --region=asia-south1 \
  --member=allUsers --role=roles/run.invoker
# Post-judging/incident return to private, under the release plan:
gcloud run services remove-iam-policy-binding prepagent --project=prepagent-hack --region=asia-south1 \
  --member=allUsers --role=roles/run.invoker
```

Never grant `allAuthenticatedUsers`. Public access does not create Firebase supervisor privileges: visitors receive only disclosed signed demo capabilities for TEST-scoped records. Verify public safe pages and scoped APIs after release; no self-assigned roles, arbitrary uploads/URIs or counter administration. Public smoke/video/submission URL verification is a distinct acceptance stage. None of these public/traffic/IAM commands was executed.

## Conditional public procedure — not executed

Do not run untilD4 and the complete new private-candidate workflow, audit/PDF, security and browser gates pass. Record the then-current source/digest/revision and full IAM/default traffic. Review/remove only obsolete diagnostic tags after evidence-backed owner scope confirmation; service IAM exposes every tag, not just the chosen revision. The following template requires the actual fully accepted revision, never the currently blocked candidate by assumption:

```sh
# Only after all conditional release gates pass; replace the validated revision placeholder.
gcloud run services update-traffic prepagent --project=prepagent-hack --region=asia-south1 --to-revisions=ACTUAL_FULLY_ACCEPTED_REVISION=100
gcloud run services add-iam-policy-binding prepagent --project=prepagent-hack --region=asia-south1 --member=allUsers --role=roles/run.invoker
# Critical public failure: remove only this newly added binding; restore recorded prior traffic.
gcloud run services remove-iam-policy-binding prepagent --project=prepagent-hack --region=asia-south1 --member=allUsers --role=roles/run.invoker
gcloud run services update-traffic prepagent --project=prepagent-hack --region=asia-south1 --to-revisions=RECORDED_PRIOR_DEFAULT_REVISION=100
```

Re-read IAM/traffic and smoke-test safe access after every action; do not replace whole IAM policy if another editor changed it. Post-judging privatization removes only the release's public binding and verifies anonymous403, retaining evidence/data unless cleanup is separately approved. No public release was performed in this pass.

## 16 October 2026 — repository publication and local-state reconciliation

Owner explicitly authorized reviewing/committing the newest local product source and publishing it to the existing private GitHub repository's `main` branch. See `REPOSITORY_HYGIENE_REVIEW.md` for the publication record and clone verification. This supersedes earlier no-push instructions **for this repository synchronization only**, not for Cloud Run public access or traffic.

The committed source includes the premium presentation commit `a689c99b43c59804548befc7a93f484f23cefc14` plus the later honest empty Impact workspace and portable local setup. The recorded deployed revision remains `prepagent-premium-analytics-v2`, digest `sha256:e1103dec7a9271c475d9e2d03c891da2f3a0d66480a134b3ccee54a29dc478ae`; it does not contain those later local adjustments. No new container build/deployment, IAM/budget change, traffic shift or model acceptance occurs merely by publishing source to GitHub.

The safe local default is `npm run preview:local`: no mock business figures, empty labeled KPI/chart structure and unavailable cloud controls. `npm run demo:local` remains an explicit, honestly labeled offline backup. Neither local mode proves accepted cloud model execution. D4 remains blocked.
