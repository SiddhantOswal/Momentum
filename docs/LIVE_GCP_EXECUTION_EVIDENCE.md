# Live Google Cloud execution evidence

Captured 2026-10-15T23:20:30.989511+00:00. Actual private URL: https://v1f-9edd78db---prepagent-26mwt2n7ba-el.a.run.app

Revision `prepagent-v1f-9edd78db`; image `asia-south1-docker.pkg.dev/prepagent-hack/prepagent/prepagent@sha256:13aea5e51ab935273925111e1cbfc5d996bbc2dbc71c90cf5796883ebe4d6f59`; build `7b5a323f-73a0-4be0-9bd4-ab47a23f784d`. Frozen archive `dd0ac91ddfec18aa2cd7bb464fce9c7f4d2fae7abce31ee9bf959e1fcdbd0082`, manifest `9edd78db8d66ee8e80825aea770cbb531337e7a748500d8d8199768909d05af8`. Dirty HEAD is not the source identity.

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

## Independent proof

Evidence directory: `docs/evidence/live-gcp-20261016/`. BUILD_RESULT/BUILD_LOG and CLOUD_BUILD_SOURCE_PROOF tie uploaded generation1792105916394652 and120matched payload files to the image. DEPLOYMENT and POSTFLIGHT prove private IAM,0%candidate default traffic, old100%default, max2, same runtime identity, secret reference and environment. HTTP_LIVE holds32passed bounded checks. BROWSER_LIVE holds actual UI requests/screenshots; BROWSER_FOLLOWUP and BROWSER_INVALID_UPLOAD hold targeted follow-ups. DOWNSTREAM_READBACK holds actual counter2/100, exact GCS input byte match and runtime-SA BigQuery jobs. CLOUD_RUN_LOGS_FINAL is service-side request evidence. No raw credentials/cookies were written to evidence.

## Retained diagnostics; no false all-green claim

Initial browser journal21/22assertions succeeded; its cache expectation failed because source was bigquery rather than bigquery-cache. Two Cloud Run instance IDs are visible in logs; cache is per-instance. Follow-up HTTP and browser hit bigquery-cache. Second browser journal10/11assertions succeeded; malformed-file text was inspected before the asynchronous request and context validation finished. A targeted awaited request with valid TEST context and spoofed unapproved PDF verified400 and visible refusal, without another provider call. Original journals remain unchanged. These are harness/timing/expectation diagnoses, not repaired application defects. No runtime source repair or replacement build was needed.

## Observation limits

Query job correlation uses runtime SA, SQL and timestamp; no per-request BigQuery labels exist. Thirteen observed jobs initially included eight dashboard query jobs across two instances, catalog, conditions, history and two missing-JobSheet reads; latest metadata is authoritative if counts differ. Query-cache hits still create real jobs. Multi-instance exactly-once approval/idempotency is not guaranteed; D6 accepts process-local coordination plus durable BigQuery state. No outage injection,2h session expiry or destructive quota exhaustion was performed. Historical local tests are not new live evidence.

## Actual usage

```json
{
  "newProviderAttempts": 2,
  "counterBefore": "No current-day document(404), logical0; previous day18retained",
  "counterAfter": {
    "integerValue": "2"
  },
  "model": "gemini-3.5-flash",
  "region": "asia-south1",
  "inputTokens": 2116,
  "outputAndThoughtTokens": 734,
  "totalTokens": 2850,
  "estimatedProviderUSD": 0.010758,
  "pricingURL": "https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing",
  "runtimeQueryJobsObserved": 13,
  "billedBytes": 10485760,
  "builds": 1,
  "buildId": "7b5a323f-73a0-4be0-9bd4-ab47a23f784d",
  "buildDurationSeconds": 63.592675,
  "costLimit": "US$1 planning allowance for build/private smoke; provider stopUS$10; no free credits assumed",
  "invoice": "Unavailable; estimates are not actual invoiced charges; billing can lag"
}
```

## Additional bounded evidence

GCS_PRIVATE_ACCESS.json verifies anonymous403for the actual newly uploaded input object. CLOUD_BUILD_SOURCE_PROOF.json independently downloads the actual Cloud Build source generation and matches all120payload hashes; the gcloud-uploaded tar hash differs from the original deterministic tar because packaging metadata/compression differ, not payloads. The extra entry is only SOURCE_MANIFEST.json. STATIC_ROUTE_CONTROL_INVENTORY.json discovers actual routes/controls; discovery is not runtime acceptance. Final Cloud Run logs contain140request entries and two instance IDs at capture. No new business decision was persisted.

Live verification did not inject Gemini429/503/timeouts, Firestore outages, BQ failures, corrupt GCS cards, process restarts, session expiry, high-volume rate-limit exhaustion, concurrent approvals or interrupted positive model runs. They remain UNVERIFIED against this deployment; historical local tests do not change that classification. No physical sensors, completed-lot learning or durable episodic memory is claimed.
