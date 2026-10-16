# Release provenance and operating safeguards

## Current source versus deployed image

The repository contains the premium analytics presentation plus the subsequent honest empty Impact workspace and portable local setup. **The newest source is not yet the recorded Cloud Run image.** Obtain the source commit with `git rev-parse HEAD`; use a new immutable manifest for any future build.

| Last verified private premium candidate | Identity |
|---|---|
| Revision | `prepagent-premium-analytics-v2` |
| Tagged URL | `https://premium-analytics-v1---prepagent-26mwt2n7ba-el.a.run.app` |
| Cloud Build | `c324d109-f0a3-41a4-9942-2d62fd4781f8` |
| Image digest | `sha256:e1103dec7a9271c475d9e2d03c891da2f3a0d66480a134b3ccee54a29dc478ae` |
| Source manifest SHA256 | `ec42893201317037120a231b73f651b0eafbd1b751e6737ebe8b3eadbf9d124d` |
| Source archive SHA256 | `b5fa78e2a3091c202c698d47ce388adb809830a404e0a7fa938fc12df2f08936` |
| Prior UX rollback revision | `prepagent-ux-defect-v2` |
| Prior UX image digest | `sha256:3acba6b9e7ea77b589b5c2e62848b225a31d9fed6338a7f397f33fd10fbd0248` |

The build was made from a manifest-identified snapshot over `7509266ed70202e4eaf83aab56734a5502ccb3be`. The later premium presentation commit is `a689c99b43c59804548befc7a93f484f23cefc14`; its runtime files were independently compared with that snapshot. Later empty-state/setup/doc changes require a new build before they can be called deployed.

## Last verified safeguards

Project `prepagent-hack`, region `asia-south1`, service `prepagent`; runtime identity `prepagent-run@prepagent-hack.iam.gserviceaccount.com`. Private IAM, service/revision maximum two instances, minimum zero, concurrency one and timeout 120 seconds were verified. Default traffic remained 100% on `prepagent-00005-s5x`; tagged candidates received no default traffic.

Approach B session/TEST boundaries, approved-input restrictions, shared Firestore 100-attempt/IST counter, model gate and mock-route isolation remain required. D4 is **blocked**. Existing ₹5,000 budget alert and ₹27,000 planned ceiling are distinct; alerts are not hard spending limits. These are dated observations, not a claim that live resources cannot change.

[Reviewed evidence summary](evidence/REVIEWED_RELEASE_SUMMARY.json) states the exact scope of historical live checks and later local clone checks. No full accepted-model cloud workflow or public judging release is claimed.

## Read-only verification

```sh
gcloud run services describe prepagent --project=prepagent-hack --region=asia-south1 --format=json
gcloud run services get-iam-policy prepagent --project=prepagent-hack --region=asia-south1 --format=json
gcloud run revisions describe prepagent-premium-analytics-v2 --project=prepagent-hack --region=asia-south1 --format=json
gcloud run revisions describe prepagent-ux-defect-v2 --project=prepagent-hack --region=asia-south1 --format=json
```

Do not publish raw command output containing operational details or credentials.

## Preparing a later candidate

Use `tools/prepare-release-snapshot.py` with new output/evidence paths; it refuses overwrite and explicitly includes runtime source and approved inputs. Preserve the manifest, lockfile identity, archive hash, successful Cloud Build ID, immutable image digest, environment/secret references and actual revision. `ops/cloudbuild-private.yaml` is a build definition, not deployment authorization.

Cloud changes require the applicable release authority and a fresh configuration/IAM/traffic read-back. Do not enable Firebase, expand IAM, change budget, deploy or switch traffic merely because the source is available. Keep the existing private revision and its image for rollback. Use the [genuine final acceptance runbook](FINAL_PO_TO_CARD_ACCEPTANCE.md) only after accepted evidence and required prerequisites pass.

## Withdrawing the premium tag

After confirming the tag still identifies the candidate being withdrawn, this command removes only that entry point; it does not delete a revision/image or intentionally shift default traffic:

```sh
gcloud run services update-traffic prepagent --project=prepagent-hack --region=asia-south1 --remove-tags=premium-analytics-v1
```

Do not run it as an installation step. Restoring default traffic or changing public access is a separate release operation requiring the exact previously saved policy/configuration and verification. A source push to GitHub does not execute any of these commands automatically.
