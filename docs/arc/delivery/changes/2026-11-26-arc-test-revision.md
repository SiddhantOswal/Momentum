# Change: tagged test revision of `arc/main` on `momentum` (no traffic)

- Date: 2026-11-26
- Approved by: Om, in the session of 2026-11-26 ("deploy it so I can see it live")
- Service: Cloud Run `momentum`, `asia-south1`, project `prepagent-hack`
- Not changed: the serving revision `momentum-00023-yaz` keeps 100% of traffic on `momentum-ai.cloud.run`. Moving traffic needs the M6 review gate and a separate founder decision.

## What is deployed
`arc/main` after the M6 redesign and ARC-M3-01 (Arc lot preparation), as one new revision with tag `arc-test` and no traffic. Every M1 and Arc flag is on, as in `npm run live:local` (`tools/run-local-live.mjs` `RELEASE_FLAGS`).

## Commands
1. `cd web && npm run build` (the release snapshot ships `public/app`).
2. `python3 tools/prepare-release-snapshot.py --output-dir <scratch>/snap-arc-test --evidence <scratch>/snap-arc-test.json`, then from the snapshot: `gcloud builds submit . --project=prepagent-hack --config=cloudbuild.yaml --substitutions=_HEAD=<arc/main sha>,_SOURCE_SHA=<manifest sha>,_IMAGE=asia-south1-docker.pkg.dev/prepagent-hack/prepagent/prepagent:arc-test-<manifest sha 12>`. The build runs the container smoke test and `npm audit --omit=dev`.
3. `gcloud run deploy momentum --project=prepagent-hack --region=asia-south1 --image=<image@digest> --no-traffic --tag=arc-test --revision-suffix=arc-test-v1 --max-instances=2 --concurrency=20 --update-env-vars=^@^USTAAD_PUBLIC_ORIGIN=https://arc-test---momentum-26mwt2n7ba-el.a.run.app@USTAAD_ENABLE_ARC=true@USTAAD_ENABLE_ARC_METRICS=true@USTAAD_ENABLE_FIRESTORE_IDEMPOTENCY=true@USTAAD_ENABLE_DURABLE_PO_REVIEWS=true@USTAAD_ENABLE_DURABLE_TRACES=true@USTAAD_ENABLE_LOT_REVISIONS=true@USTAAD_ENFORCE_APPROVE_GUARD=true@USTAAD_ENFORCE_MODEL_VERSIONS=true@USTAAD_GEMINI_BUDGET_POLICY=budget-v2@GEMINI_BUDGET_LIMITS=<the live:local limits JSON plus lotPlans.perSessionPerDay 10>`.
4. Read back: the revision's env names and flags, `status.traffic` (100% still on `momentum-00023-yaz`), and `GET /api/status` on the tag URL showing the budget store configured and model versions verified (security review condition 1).
5. One PO1 run through Arc on the tag URL to the Approve card, without approving.

## Limits on the test revision
- Gemini: budget-v2 live pool, Rs 100 a day (`dayCostCapInr`), the same cap as the laptop run; 10 plans per session per IST day.
- Max 2 instances, concurrency 20 (`cloud-run-deploy-settings`).
- The origin check and the session cookie bind to the tag URL only.

## Cost
One Cloud Build (a few rupees), Cloud Run only while the tag URL is used (min instances 0), Gemini under the Rs 100 cap, BigQuery under the per-query byte caps and the plan limit.

## Risks
- The test revision writes to the production Firestore, BigQuery `job_sheets` and Cloud Storage, as `live:local` does. Its records are demo-session records.
- `gcloud run deploy` also makes this revision's settings the service template; a later `gcloud run services update` would start from them. The next production deploy must set its own flags and limits explicitly.

## Rollback
Nothing to roll back for users: no traffic moves. To retire the test link: `gcloud run services update-traffic momentum --project=prepagent-hack --region=asia-south1 --remove-tags=arc-test`. The revision can stay (no cost at zero instances); deleting it needs a separate approval.

## Result
Filled in after the run.
