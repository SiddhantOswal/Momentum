# Momentum — judge walkthrough and parallel GCP observation guide

This guide exercises the public application and shows where to observe its cloud activity. Use a desktop browser and a second window signed into the authorized Google Cloud project. Do not display tokens, cookies, personal email addresses, or raw confidential records in a recording.

## Release identity to verify first

- Application: <https://prepagent-26mwt2n7ba-el.a.run.app>
- Project: `prepagent-hack`; region: `asia-south1`; service: `prepagent`
- Current documented public revision: `prepagent-momentum-v1`; image digest: `sha256:e52183d3d353a3a34ba1123776900ab1eae53e96deb9bcfb65d72e80ac4895be`
- Maximum instances: 2. Runtime service account: `prepagent-run@prepagent-hack.iam.gserviceaccount.com`.
- App invocation is public. Application writes still use signed Approach B demo sessions, same-origin checks, session ownership and TEST scope. A demo session is not proof of a verified human identity.
- Current source/runtime and bounded public checks are documented in [release provenance](RELEASE_PROVENANCE.md) and [the curated release record](evidence/MOMENTUM_PUBLIC_RELEASE_20261016.json).

Before starting, verify the current serving revision in Cloud Run; releases can change after this guide was written. The published URL is the canonical app URL, not localhost.

## Prepare the two-window view

### Window A — application

1. Open the application URL above in Chrome.
2. Confirm the browser shows the Momentum title and the app header says Momentum.
3. Open **Application and integration status** from the status indicator. Let `/api/status` finish. Review the displayed runtime mode and adapter availability. “Configured” means enabled in configuration; it is not by itself proof that a query or provider call succeeded.
4. Open **Supervisor session** if needed. The deployed app creates/reuses its short-lived signed demo session through its own same-origin session endpoint. Do not copy or display the session cookie.

### Window B — Google Cloud Console

Open these console pages in separate tabs, signed into an account already authorized for project observation:

1. **Cloud Run service:** Google Cloud Console → project `prepagent-hack` → Cloud Run → Services → `prepagent` → Revisions. Confirm traffic points to the current approved revision and max instances is 2. The service IAM page shows public invocation; application authorization remains a separate layer.
2. **Request logs:** Console → Logging → Logs Explorer. Select the same project and use this filter, replacing the revision if it has changed:

   ```text
   resource.type="cloud_run_revision"
   resource.labels.service_name="prepagent"
   resource.labels.location="asia-south1"
   resource.labels.revision_name="prepagent-momentum-v1"
   logName="projects/prepagent-hack/logs/run.googleapis.com%2Frequests"
   ```

   Set the time range to **Last 1 hour** and refresh after each action. These logs show requests reaching Cloud Run, status, latency and revision. They do not by themselves prove that a downstream query/provider call succeeded.
3. **Application logs:** In the same Logs Explorer, change the final line to:

   ```text
   (logName="projects/prepagent-hack/logs/run.googleapis.com%2Fstdout" OR logName="projects/prepagent-hack/logs/run.googleapis.com%2Fstderr")
   ```

   The app emits limited structured logs (not a full sensitive request transcript). Do not expect every successful Gemini action to produce a detailed prompt/token log.
4. **BigQuery jobs:** Console → BigQuery → project `prepagent-hack` → Job history. Refresh after history, Impact, prediction and optimization actions. Inspect job ID, principal, state, bytes processed/billed, SQL and result only where the viewer has access. A BigQuery job is the independent evidence for a query; an HTTP 200 alone is not.
5. **Firestore counter:** Console → Firestore → Databases → `(default)` → Data → `gemini_daily_usage` → today’s Asia/Kolkata date document. The document stores `dayKey`, `timezone`, `attemptCount`, `configuredCap`, `policyVersion`, and update time. Observe the count before and after a deliberate paid Gemini action. Do not edit/reset it. If UI permissions do not expose the collection, record it as not independently visible; do not infer the count from app status.
6. **Cloud Storage cards:** Console → Cloud Storage → Buckets → `prepagent-hack-data` → `jobcards/`. Only inspect the actual object created for your run. Check generation, size and content type; do not change ACLs or delete it.

Use Cloud Logging's time range and revision filter to correlate each UI action. If logs are delayed, refresh once after allowing for ingestion; do not repeat a paid action to make a log appear. The prior approved full-run evidence includes exact BigQuery job IDs and the independent PDF object hash in `evidence/D4_LIVE_ACCEPTANCE_20261016.json`.

## Part A — public UI and read-only evidence

### 1. Landing and service status

1. In Window A reload the public URL.
2. Confirm the Momentum wordmark, **New Lot**, **Defect Check**, **Impact**, currency selector, backend status and session control appear.
3. Click the status indicator → review `/api/status` → close the dialog. In Window B, confirm `GET /`, static assets and `GET /api/status` request entries on the serving revision.
4. Click **Supervisor session** and read the notice. Explain that Approach B grants a temporary signed demo capability, not verified human identity.

### 2. Historical defect evidence (BigQuery read)

1. Click **Defect Check**.
2. Choose defect **WARP**.
3. Enter relative humidity **86**.
4. Click **Find historical cases** once.
5. Wait for the success or explicit empty/error message. Review the historical case count, rate groups, operating conditions, original evidence table and operator notes.
6. Explain that 685 selected-primary WARP cases and 401/397 lower/upper defect-rate observations come from different cohorts; do not sum or use one as the other's denominator. These are historical modeled records/associations, not current-order predictions or causal proof.
7. In Window B, refresh request logs and BigQuery Job history. Confirm `POST /evidence/seen-before` reached the current revision and find the corresponding completed query where visible. Record its job ID and bytes; do not re-run merely to produce another job.

### 3. Photo Diagnosis (approved list read; classification is paid)

1. On Defect Check choose **Photo Diagnosis**.
2. Click **Load approved photos**. Confirm ten choices appear. This is a list operation; it does not classify or call Gemini.
3. Select a photo. Confirm the page says selection changed and no diagnosis was requested.
4. For the full judge walkthrough, choose one photo only and click **Classify approved photo** once. This invokes Gemini and consumes one shared daily attempt even if the provider fails ambiguously. Do not classify all ten again: the retained historical comparison was 7/10 and is not calibrated accuracy.
5. Review the returned supported label and prototype limitation; do not infer confidence or cause if none is returned.
6. In Window B confirm `GET /evidence/approved-photos`, `POST /evidence/classify-photo`, the Firestore counter increment, and any provider metadata exposed by the app/logs. Successful detailed Gemini usage telemetry may not be available in Cloud Logging. Do not expose prompt/body content in a recording.

### 4. Production Impact (BigQuery reads)

1. Click **Impact**.
2. Before loading, confirm the page shows an honest empty-state: no KPI values or chart points are presented as results.
3. Click **Load impact evidence** once.
4. Review returned KPI cards, baseline/modelled comparison, monthly and seasonal views, item-group breakdown, units and source/method details. Keep “held-out simulation estimate” distinct from observed outcomes; no annualized ROI or measured savings claim is supported.
5. Expand **Evaluation details**, monthly values and seasonal values to show the source numbers behind each chart.
6. In Window B confirm `GET /impact/summary` and the associated four query-family jobs or valid cached results. Record job IDs/cache status/bytes actually visible. Loading the dashboard does not create a JobSheet.

## Part B — complete PO-to-approved-card journey

This section performs real Gemini and BigQuery work and writes a TEST JobSheet plus a Cloud Storage PDF. It is optional for casual judges; coordinate a single demonstration run to avoid duplicate paid calls and duplicate TEST records. The approved fixture is included in the repository at `public/samples/PO1_ClientA_single_B1047.pdf` (same bytes also at `test/fixtures/synthetic_POs/PO1_ClientA_single_B1047.pdf`). SHA256: `d789722039e0d9f29d2106655416aae0447159d23df56c7dc215ee875c8fb44a`.

Use the real approved file; arbitrary uploads are rejected. Each extraction and explanation attempt is metered globally, including failed/ambiguous attempts. Stop on any failure; do not rapidly retry. Confirm there are sufficient calls left today in the Firestore counter and that the exact current model-acceptance status is accepted under the documented supervised-prototype exception.

### 5. Extract and review the approved PO

1. In Window A click **New Lot**.
2. Under **Purchase-order document**, click **browse files** and choose `public/samples/PO1_ClientA_single_B1047.pdf` from the cloned repository.
3. In **Purchase order ID**, enter `TEST-CLA/PO/2026/1047`.
4. Set **Loaded paper type** to `RECYCLED` and enter **Loaded paper supplier** `SUP-D` for the approved reference scenario. These are participant-entered TEST context values, not extracted PO facts or factory telemetry.
5. Click **Extract & review order** once. Wait for a response. Inspect the source PO number and extracted line against the PDF. Expected catalog item is `PKBX0041`, quantity `1300`; the operator must confirm the actual extraction matches before proceeding.
6. Check **I verified the selected item code and quantity against the purchase order**. Expand **Item specification** and inspect catalog fields/missing values. Never fill a missing specification by guessing.
7. In Window B confirm `POST /orders/extract` on the active revision. Expect one Gemini attempt reservation in the shared Firestore counter and the genuine extraction source (`vertex-gemini`) on the UI response. A BigQuery catalog lookup may appear depending on the adapter path. Do not claim success from a fixture expected-result file.

### 6. Confirm operating conditions and planned settings

1. Expand **Production setup**.
2. Select the shift chosen by the human running the demo; do not assume it. If choosing **DAY** for the documented reference case, enter/verify the approved reference values below and label them manual/simulated in narration.
3. In **Production conditions**, use the verified reference context if appropriate: RH `86%`, temperature `26°C`, paper moisture `10.8%`. These are manually supplied reference values, not sensor readings. Click **Load conditions** only if you intend to display the configured reading; distinguish the returned source and timestamp from manually entered values.
4. Confirm/edit all seven planned settings. The PKBX0041 reference plan is SF speed `48 m/min`, roll temperature `162°C`, gum application `HIGH`, gum viscosity `32 s`, pasting pressure `MED`, drying `5 h`, print speed `60 sheets/min`. These are the approved case inputs, not plant standards.
5. Check **I confirm the humidity, temperature and paper moisture for this lot**.
6. Check **I reviewed these planned settings**.
7. Verify the **Plan this lot** button becomes enabled only after order-line review and both confirmations. If not, stop and resolve the displayed missing prerequisite; do not bypass it.

### 7. Run the coordinated model and optimization workflow

1. Click **Plan this lot** once.
2. Wait for the real execution trace and result. Do not click individual **Assess current plan** / **Find better settings** after a successful coordinated run merely to repeat predictions.
3. Review all five defect estimates, model caveats and primary defect. Explain the supervised-prototype evidence exception and CRACK's negative supplementary holdout evidence where relevant; do not call this unrestricted factory validation.
4. Review baseline versus optimized settings and the maximum-three-change constraint. For the recorded PKBX0041 reference, expected result was baseline `10.18%`, `100.4 kg`, `₹5,351`; best `8.42%`, `83.0 kg`, `₹4,426`; predicted difference `17.4 kg` and `₹925`; changes: roll `170°C`, gum `MED`, viscosity `35 s`. These are model estimates, not achieved savings. A new run may differ if current query/model outputs differ; use actual results.
5. Expand **Evidence & explanation**. Click **Find similar runs** if not already returned in the trace and still required. Click **Explain recommendation** only once and only when the coordinated result did not already provide it. Verify explanation claims match displayed evidence. Prior implementation corrected “actual observed outcomes” overstatement; remain attentive to modeled history provenance.
6. In Window B inspect the `POST /jobs` request and trace events; BigQuery Job history should show actual model/optimizer/persistence job activity where not cached. Compare job ID and result from this run, not only old sample evidence. Observe Firestore counter after the run; extraction and any explanation each reserve attempts. Predictions and optimization use BigQuery, not Gemini.

### 8. Draft, approval, audit and stored PDF

1. Click **Review job card**.
2. Inspect the stored draft’s order, conditions, all model outputs, recommended settings, provenance, predicted savings and approval state. It must say **DRAFT**.
3. If the draft appears in **Retrieve a stored JobSheet**, paste the displayed actual JobSheet ID and click **Retrieve**. Confirm status and values read back from storage.
4. Click **Approve** / **Approve reviewed draft**. Read the confirmation summary and approve only after reviewing the record. This records a signed Approach B demo-session actor with `authenticatedHuman=false`; do not represent it as named-user identity.
5. Confirm the UI reports **APPROVED** only after persisted approval succeeds.
6. Click **Open / download job card**. Verify a PDF opens/downloads and contains the same JobSheet ID, actual recommendation, approval label, units, process sequence and estimate disclaimers.
7. In Window B inspect `POST /jobs/{id}/approve`, `GET /jobs/{id}`, and `GET /jobs/{id}/card.pdf`; BigQuery should show draft/approval persistence jobs and Cloud Storage should show the generated `jobcards/` object. Verify the object exists and the UI retrieval corresponds to it. Do not delete the durable TEST record or object during a demo.
8. If safely demonstrating replay, click approval a second time only after first persisted success. It should return the same approved state/card; do not treat a cross-instance unsaved review retry as exactly-once. Saved approved job/card retrieval is the durable recovery path.

### 9. Feedback and historical outcomes

1. On the saved JobSheet feedback area, provide feedback only if you have a legitimate TEST observation and are willing to persist it. Otherwise show the empty/validation state and do not submit invented measurements.
2. If submitting, use the actual saved JobSheet ID and supported fields, then verify the UI success and corresponding BigQuery feedback row/read-back where your authorized tooling permits.
3. Explain that “feedback recorded” does not mean completed-lot learning or verified actual outcome. No predicted value may be copied into an actual-outcome field.

## Safe negative checks for a judge

Use the approved bounded checks already recorded; do not run abuse/flood tests or intentionally exhaust a quota. Safe examples: attempt a non-allowlisted or spoofed PO filename with invalid bytes (must reject before Gemini); open an old retired tagged URL (should be 404); submit a direct privileged action without a valid session (should reject); use a cross-origin mutation (should reject); request a mock-agent route (must remain disabled). Avoid probing other participants' record IDs beyond the pre-existing controlled acceptance evidence.

## Where each action appears in GCP

| UI action | Cloud Run request | Independent service evidence |
|---|---|---|
| Open app/status | `GET /`, `/api/status` | Cloud Run request log, serving revision |
| Create/reuse demo session | `POST /api/auth/demo-session` | Cloud Run request log; signed cookie stays in browser |
| Historical search | `POST /evidence/seen-before` | BigQuery job or cached query evidence |
| Load approved photo list | `GET /evidence/approved-photos` | Cloud Run request log; no Gemini attempt |
| Classify selected approved photo | `POST /evidence/classify-photo` | Firestore counter reservation; Gemini provider invocation if successful |
| Load Impact | `GET /impact/summary` | Four BigQuery query families/job history or cache evidence |
| Extract PO | `POST /orders/extract` | Firestore reservation; Gemini provider; optional catalog BigQuery lookup |
| Plan whole job | `POST /jobs` | Five BQML predictions, optimizer/history/explanation as orchestrated, BigQuery draft write; Gemini reservation only for explanation if generated |
| Read saved job | `GET /jobs/{id}` | BigQuery persisted row/read-back |
| Approve | `POST /jobs/{id}/approve` | BigQuery state and audit read-back |
| Retrieve card | `GET /jobs/{id}/card.pdf` | Cloud Storage object/generation/size/hash |
| Submit feedback | `POST /jobs/{id}/feedback` | BigQuery feedback persistence, only for valid submitted observation |

The exact request and job set varies with cached queries and whether the coordinated job already includes a stage. The table identifies service families, not a guarantee of one uncached BigQuery job for every model or request. For current recorded IDs/results see [live PO-to-card evidence](evidence/D4_LIVE_ACCEPTANCE_20261016.json). For release revision, access, and public smoke checks see [release provenance](RELEASE_PROVENANCE.md).

## Stop and recovery rules

- On a red/error state, read it, capture the timestamp and revision, and stop. Do not hammer retries.
- Gemini attempts count before provider invocation, including ambiguous failures. A new attempt may spend quota.
- If the browser reloads before saving a draft, process-local order-review state can be lost; restart from extraction only if authorized quota allows. Do not bypass the review fingerprint.
- If approval succeeded but the browser lost the response, retrieve the saved JobSheet by ID before attempting any action. Durable approved record/card retrieval is supported; cross-instance process-local replay is not guaranteed.
- Missing/failed PDF retrieval is not card success. Check actual GCS object and ask an operator to investigate before repeating creation.
- A public Cloud Run page does not grant BigQuery, Firestore, Storage or repository administration rights. Ask the project owner to perform any console observation the judge account is not authorized to see.

## Included judge materials

The five supported purchase-order examples are in `public/samples/`; expected extraction/ambiguity records are in `test/fixtures/synthetic_POs/expected_results.json`. Approved-photo labels/configuration are in `config/approved-photos.json`; images remain in their controlled GCS location. The repository has tracked rendered product screenshots under `docs/evidence/`. No private raw cloud journals, credentials, WhatsApp shares or unrestricted customer data are required in a clone.
