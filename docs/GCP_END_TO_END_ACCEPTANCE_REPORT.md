# GCP end-to-end acceptance report —16October2026

## Executive verdict

**Privately deployed, independently functional cloud features; full model-enabled workflow BLOCKED—OMD4. Not public and not submission-complete.** No new owner-independent critical application defect was found in executed scenarios. This is not a claim that every possible failure/race was live-tested.

Captured 2026-10-15T23:20:30.989511+00:00. Actual private URL: https://v1f-9edd78db---prepagent-26mwt2n7ba-el.a.run.app

Revision `prepagent-v1f-9edd78db`; image `asia-south1-docker.pkg.dev/prepagent-hack/prepagent/prepagent@sha256:13aea5e51ab935273925111e1cbfc5d996bbc2dbc71c90cf5796883ebe4d6f59`; build `7b5a323f-73a0-4be0-9bd4-ab47a23f784d`. Frozen archive `dd0ac91ddfec18aa2cd7bb464fce9c7f4d2fae7abce31ee9bf959e1fcdbd0082`, manifest `9edd78db8d66ee8e80825aea770cbb531337e7a748500d8d8199768909d05af8`. Dirty HEAD is not the source identity.

## Official compliance

See HACKATHON_OFFICIAL_REQUIREMENTS_2026.md. Manufacturing alignment and GoogleAI/CloudRun implementation have evidence. Mandatory full working end-to-end prototype remains incomplete. Public code repository, strictly-under3minute published video,PDFdeck, eligibility/freshness/rights attestations and actual submission remain unverified owner obligations. No external publication or messages sent.

## Actual live acceptance

Component | Actual action/route | Downstream | Classification | Evidence | Exact boundary
---|---|---|---|---|---
Landing/assets/status | Browser open; /health /api/status /dashboard.css | Cloud Run | PASS — LIVE CLOUD RUN VERIFIED | BROWSER_LIVE.json; HTTP_LIVE.json | Healthy current source; truthful incomplete model readiness
New job and PO input | New Lot; select approved PO1; extract | Cloud Run + GCS + Vertex + BigQuery | PASS — LIVE CLOUD RUN VERIFIED | BROWSER_LIVE.json; DOWNSTREAM_READBACK.json | PO CLA/PO/2026/1047 → PKBX0041 quantity1300; exact source bytes match
Upload negatives | Missing/malformed file; spoof approved filename; oversized request | Cloud Run | PASS — LIVE CLOUD RUN VERIFIED | HTTP_LIVE.json; HTTP_FOLLOWUP.json; BROWSER_INVALID_UPLOAD.json | 400/413 before Gemini; no additional attempts
Extraction review/catalog | Review source line1 and confirm quantity/item | BigQuery catalog | PASS — LIVE CLOUD RUN VERIFIED | BROWSER_LIVE.json | Matched item, dimensions410×305×255,5ply BC; operator paper context separate
Plant/shift/conditions | DAY; Load conditions; confirmation controls | BigQuery simulated readings | PASS — LIVE CLOUD RUN VERIFIED | BROWSER_LIVE.json | PLANT-01;59.9%RH,30.2°C,8.88%moisture; stale source14Oct visibly qualified
Prediction acceptance guard | Valid /risk/predict with/without confirmation | Cloud Run | PASS — LIVE CLOUD RUN VERIFIED | HTTP_FOLLOWUP.json | 400 without confirmation;503 with confirmation while evidence incomplete
Five actual predictions | Run accepted prediction through candidate | BQML | BLOCKED — OM D4 | POSTFLIGHT.json; /api/status | No accepted evidence; no BQML prediction invoked
Optimization guard | Valid /risk/optimize | Cloud Run | PASS — LIVE CLOUD RUN VERIFIED | HTTP_FOLLOWUP.json | 503; model gate preserved
Candidate actual optimization | Model-enabled run | BQML optimizer | BLOCKED — OM D4 | FINAL_PO_TO_CARD_ACCEPTANCE.md | Previous direct optimizer acceptance is not candidate workflow proof
Independent PKBX0041 optimizer | Read existing job, no re-execution | BigQuery | PASS — ISOLATED GCP VERIFIED ONLY | CLOUD_READBACK.json; ../STAGE_B_OPTIMIZER_QUERY_RESULTS.json | 100MiB cap;90MiB prior billing;10.18→8.42%;₹925;17.4kg
Grounded explanation | Accepted model/optimizer explanation | Vertex + model evidence | BLOCKED — OM D4 | /api/status; static call chain | No explanation provider attempt issued
Historical evidence | Defect Check;WARP;86%RH; search | BigQuery | PASS — LIVE CLOUD RUN VERIFIED | BROWSER_LIVE.json; DOWNSTREAM_READBACK.json | Genuine source history rendered; association not causation
Agent trace | Invalid trace connection; unauthorized run request | Cloud Run | PASS — LIVE CLOUD RUN VERIFIED | BROWSER_FOLLOWUP.json; HTTP_LIVE.json | Negative paths exercised; no fabricated successful run
Full agent execution trace | Model-enabled run SSE | Cloud Run orchestration | BLOCKED — OM D4 | FINAL_PO_TO_CARD_ACCEPTANCE.md | Process-local trace, not durable decision memory
DRAFT creation/read-back | /jobs actual accepted-model preparation | BigQuery | BLOCKED — OM D4 | HTTP_LIVE.json; prior isolated lifecycle evidence | No hidden bypass; isolated prior TEST contract retained
Demo authorization/approval guard | Signed session; tamper/forgery/cross-session;approval | Cloud Run | PASS — LIVE CLOUD RUN VERIFIED | HTTP_LIVE.json | Real session integrity and namespace checks; owned approval503D4
Durable candidate approval/audit | DRAFT→APPROVED and independent read | BigQuery | BLOCKED — OM D4 | Prior isolated lifecycle retained | No new job row/approval decision in this pass
Prior TEST persistence/audit/PDF | Existing isolated approved TEST lifecycle | BigQuery + GCS | PASS — ISOLATED GCP VERIFIED ONLY | ../final-consolidation-20261015/; RELEASE_PROVENANCE.md | Not created through this candidate; do not count as deployed E2E
Candidate PDF generation/retrieval | /jobs/:id/card.pdf valid approved job | GCS | BLOCKED — OM D4 | HTTP_LIVE.json | Owned missing job/card404; foreign namespace403; full positive requiresD4
Feedback | Disabled form without job;foreign-session write | Cloud Run | PASS — LIVE CLOUD RUN VERIFIED | BROWSER_FOLLOWUP.json; HTTP_LIVE.json | No reported outcome fabricated
Actual feedback write for accepted job | Session-owned persisted job | BigQuery | BLOCKED — OM D4 | FINAL_PO_TO_CARD_ACCEPTANCE.md | Positive candidate write waits for valid job
Completed-lot learning/physical sensors | Actual manufacturing outcomes/sensors | None | NOT IN APPROVED V1 SCOPE | OM decisions | No verified outcome-source contract or physical deployment
Approved photos | List10; classify photo-01 once via browser | GCS + Vertex | PASS — LIVE CLOUD RUN VERIFIED | BROWSER_LIVE.json; config/approved-photos.json | CRACK matches; preserve prior full-set7/10 result, no score chasing
Impact dashboard | Impact;load;cache;charts;mobile | BigQuery | PASS — LIVE CLOUD RUN VERIFIED | BROWSER_LIVE.json; BROWSER_FOLLOWUP.json; HTTP_FOLLOWUP.json | Four query types;generic labels;held-out estimate, not measured/annualized
Currency/language | USD display calculator;English UI | Cloud Run dated static FX | PASS — LIVE CLOUD RUN VERIFIED | BROWSER_FOLLOWUP.json | 100INR≈1.03USD;dated9Oct static fallback disclosed;not live FX/translation
Navigation/recovery | Refresh/back/forward/status/session/mobile | Cloud Run browser | PASS — LIVE CLOUD RUN VERIFIED | BROWSER_LIVE.json; BROWSER_FOLLOWUP.json | No uncaught page errors; model/approval unavailable truthfully
Quota exhaustion/outages/restart/expired signed session | Destructive/high-volume fault cases not injected | None | UNVERIFIED | Historical deterministic tests only | No live counter exhaustion, service outage,2h expiry, restart or storage-failure simulation
Public complete judging URL | Conditional release | Cloud Run | BLOCKED — OM D4 | DEPLOYMENT.json; POSTFLIGHT.json | Private only; mandatory full E2E gate has not passed

## Cloud activity and costs

One Cloud Build and one private revision deployed. No IAM/budget/rules/schema changes; no default traffic shift; no new service or secret. Two metered provider attempts, one approved input upload, one independent exact-generation input download, existing approved photo read. No JobSheet/approval/feedback/PDF business writes, evaluation or training. Runtime query metadata and byte totals in USAGE_LEDGER.json. Provider estimate aboutUS$0.01076 at published regional input/output rates. Build ran about63.6seconds; at default-pool published rates roughlyUS$0.003–0.007 compute before credits/tax. Storage,logs,Run and reads add small un-invoiced costs; US$1 is an operational planning allowance, not a hard cap. Budget₹5000/.5,.9,1 unchanged; overall₹27000plan remains distinct. Invoice, alert receipt, current spend and credits not independently proven.

## Repairs and verification diagnostics

No application code repair was needed in this pass. Original browser journals contain one failed assertion each (instance-local cache expectation; premature malformed-upload text check). Targeted actual-CloudRun follow-ups passed; failures retained. No local unit/acceptance/browser/mock/runtime suites executed. No configuration or test was weakened to create a pass.

## Security/release

Signed2hour demo session is not verified human identity. Firebase remains separate/disabled. Cloud Run IAM is the private infrastructure boundary. Synthetic hash allowlist,10MiBbodylimit, model gate and namespace checks rejected bounded negative requests. Existing broad runtime data roles were not expanded; application TEST guards are not row-level IAM. Process-local idempotency/trace/rate/cache remain accepted prototype limitations; do not claim cross-instance exactly-once. Live expiry,outage,storage-failure,quota-exhaustion,concurrent positive approvals and restart behavior remain unverified in this assignment. Public release withheld becauseD4 and full functional/browser/PDF gates do not pass. Existing obsolete tags must be reviewed before future service-wide public invoker change.

## Committee

34explicit internal persona assessments and adversarial dissent: COMMITTEE_FINAL_JUDGMENT.md. Current internal63/100:22/40technical,19/25impact,15/25innovation,7/10UX. Conditional78–86only afterD4 and actual full workflow verification. Not an official judging outcome.

## ExactD4 next step

Om must supply version-linked evaluated membership/counts, source identity/query/window/run provenance and reviewed feature evidence for all five current models. Fresh metadata/etags are in POSTFLIGHT.json; all five last-training Vertex versions remain1. Follow D4_EVIDENCE_INGESTION.md; offline validator checks consistency, not authenticity. No new evaluation executed. Accepted evidence requires a new identified image/revision before model-enabled live acceptance; editing a local file cannot change this deployed image.

## Rollback and final operation

Default100%prepagent-00005-s5x is unchanged and is not newly certified as a full known-good product. Previous private feature baseline remainsprepagent-b-1015-43c1a259. To withdraw only this zero-default-traffic candidate after verifying no intervening drift:

```sh
/Users/siddhant/prepagent-work/google-cloud-sdk/bin/gcloud run services update-traffic prepagent --project=prepagent-hack --region=asia-south1 --remove-tags=v1f-9edd78db
/Users/siddhant/prepagent-work/google-cloud-sdk/bin/gcloud run services describe prepagent --project=prepagent-hack --region=asia-south1 --format=json
/Users/siddhant/prepagent-work/google-cloud-sdk/bin/gcloud run services get-iam-policy prepagent --project=prepagent-hack --region=asia-south1 --format=json
```

Rollback prepared, not executed. It does not undo latest-template metadata or delete source/image/counter/evidence. No known-good full-model workflow rollback target exists whileD4 is unresolved. AfterD4:validate genuine evidence → new snapshot/build/private revision → execute FINAL_PO_TO_CARD_ACCEPTANCE.md → assess conditional public gates and archive prior IAM/traffic → release only on actual full PASS.
