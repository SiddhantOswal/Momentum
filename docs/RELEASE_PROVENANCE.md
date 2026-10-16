# Release provenance and operating safeguards

## Current private candidate — 16 October 2026

**Reference workflow verified, with explicit limitations.** Actual Chrome operated the private Cloud Run application: PO1 extraction/review, catalog match, manual condition confirmation, five-model BigQuery prediction, constrained optimization, grounded Gemini explanation, durable DRAFT, approval, independent BigQuery read-backs, PDF storage and matching independent GCS retrieval. No local/mock workflow was counted.

| Identity | Value |
|---|---|
| Latest private revision | `prepagent-d4-owner-verified-v8` |
| Private URL | https://d4-owner-verified-v8---prepagent-26mwt2n7ba-el.a.run.app |
| Runtime source commit | `197d5c8dc9cbe97d624410329ec94e371945014f` |
| Cloud Build | `079a1385-a5b8-434d-9667-61c6c71ea7d9` |
| Image | `asia-south1-docker.pkg.dev/prepagent-hack/prepagent/prepagent@sha256:e205981b2735ad2bc665923a503a27c4c12ebe02184cedca0814991a3e5898f0` |
| Source manifest SHA256 | `4ec4a69614db8560f7fc1ad8408009c6197eec571ff9b4c1baaf4f3b18e9ed26` |
| Source archive SHA256 | `e704be41b973b514aa317bc660090c619fb1aa4e4d959a5ed9d6f4dec729bd72` |
| Complete paid workflow revision | `prepagent-d4-owner-verified-v7` |
| Complete workflow image | `asia-south1-docker.pkg.dev/prepagent-hack/prepagent/prepagent@sha256:7ce33bb4b6aa6a0f393b19832dfe7c5b61213ef4cc432dff6c3413929ad119f7` |

Only `src/ui/components.js` and `src/ui/workflow.js` differ between v7 and v8, correcting two approval-state labels. Backend, SQL, model config and dependencies match byte-for-byte. V8 genuinely retrieved the approved record and identical PDF across revisions, served the exact current assets, and exercised history, photo inventory, Impact and navigation. Paid extraction/explanation were not repeated on v8. [Machine-readable evidence](evidence/D4_LIVE_ACCEPTANCE_20261016.json) contains actual query IDs, model identities and output hashes. [Approved-job screenshot](evidence/d4-live-20261016/approved-job.png).

### Results and limits

- PKBX0041: baseline **10.18%, 100.4 kg, ₹5,351**; best **8.42%, 83.0 kg, ₹4,426**; predicted difference **17.4 kg / ₹925**. Three changes: roll 170°C, gum MED, viscosity 35s. These are model estimates, not measured savings. BigQuery served cached prediction/attribution results where reported; no claim of five newly uncached inference jobs is made.
- Job `JOB-HACK-01f4e715f22e4026a1f72fab032d5d2c-70a1c7a70bfe46b580b30664f14eefb874903231` independently read as DRAFT and then APPROVED. Audit records a legitimate server-signed demo session with `authenticatedHuman:false`. The two-page PDF is **16,994 bytes**, SHA256 `1e3a6389941c128dd756570d530bfb9af4e5ec41210b4bf249f1112c04a5afb0`, matching GCS generation `1792156107776413`. All pages rendered/inspected; 12 content checks passed.
- Final full-run observations: **43 passed / 2 retained failures**. One negative harness copied multipart bytes without the file and received413; corrected real-file rejection received400. The other observation was an actual cross-instance replay failure. Original records were retained. Twelve PDF checks passed. V8 initially had9 passes/1 premature visibility assertion; explicit navigation wait, native file chooser and counter recheck passed4/4.
- **Coordination limitation:** in-memory PO review/idempotency/trace state is not shared. A later replay reached another instance and failed closed with `stale_review`. Specific cross-instance conflict handling and exactly-once behavior are **unverified**; durable approved-record/card retrieval works. Do not advertise reliable multi-instance replay. Load an already saved job by its ID; a lost unsaved review requires extraction again under remaining authorization/quota.
- **Model evidence exception:** original internal sample counts/membership remain unavailable. Om and the project owner approved supervised-prototype use with unchanged internal R² thresholds. Four September holdout R² values miss those thresholds; CRACK is negative. Complete strict evidence remains false. All five current model etags/Vertex v1 identities were independently checked unchanged before/after. No new evaluation or training was executed.
- Om's provenance identifies a real 117-item master and **modeled training/history**, not digitized factory measurements. The explanation now calls history source records and does not claim independently measured outcomes.
- Seven Gemini attempts were consumed across this pass (including failures): counter13→20/100 on16 October/Asia-Kolkata. The final complete workflow used2; v8 follow-up used0. No counter reset. Observed top-level BigQuery jobs reported199,229,440 billed bytes at the recorded window read-back; caches are identified in the evidence. Invoice totals/remaining credits are not verified.
- Historical photo result remains7/10; no new classification calls. No fabricated observed outcomes or completed-lot learning write. These checks do not establish unrestricted production/factory readiness.

### Access, rollback and repository relationship

Private IAM unchanged; no public release. Default traffic stays100% on `prepagent-00005-s5x`. Service/revision max2, min0; runtime SA `prepagent-run@prepagent-hack.iam.gserviceaccount.com`. Existing budget and IAM were not changed. Source commits and this later documentation commit may differ; runtime equivalence is identified by the manifest above.

Previous V1/premium/UX candidates remain available. V7 remains the complete-workflow reference. With no default traffic shift, rollback requires no production restoration. If withdrawing only this new entry point is authorized, remove its tag:

```sh
gcloud run services update-traffic prepagent --project=prepagent-hack --region=asia-south1 --remove-tags=d4-owner-verified-v8
```

Do not delete existing revisions/images or alter default traffic/IAM. Public rollout and submission verification have not occurred. No broad local unit, acceptance or browser suites were rerun; changed JavaScript syntax, source manifests and Git diff were checked. Regression tests were added but not run under the live-only instruction.

## Historical premium candidate — superseded 16 October

The following table preserves the earlier premium candidate and its then-current source gap. The current evidence is above; these historical observations do not describe the latest candidate.

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
