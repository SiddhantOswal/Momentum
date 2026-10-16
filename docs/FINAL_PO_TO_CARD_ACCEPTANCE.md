# Final private PO-to-approved-card acceptance

**Not executed.** The source config is accepted for the supervised prototype by owner decision D4-2026-10-16-OM; the deployed candidate predates it and is still blocked. This is the single model-enabled acceptance procedure after genuine evidence passes. Earlier isolated transport acceptance is not a substitute. Use the existing application and APIs, Approach B, no Firebase requirement.

## 1. Preconditions and authority — stop unless all pass

- Genuine owner artifacts passed [D4_EVIDENCE_INGESTION.md](D4_EVIDENCE_INGESTION.md), or the recorded owner decision D4-2026-10-16-OM applies to the unchanged version-1 models; actual accepted config installed, tests passed, all five model etags/Vertex versions refreshed.
- A source snapshot containing that accepted config was built and privately deployed with explicit release authorization. Record build ID, source/archive hash, image digest, revision, exact tag URL and configuration. **Today's prepared blocked snapshot is not an accepted-model image.**
- Private Cloud Run IAM invocation is available; service max2/min0, runtime SA `prepagent-run@prepagent-hack.iam.gserviceaccount.com`; default traffic remains unchanged. Record actual independent-feature rollback target without pretending it is a proven full-workflow revision.
- Shared Firestore100-attempt/IST policy and signing secret configured; active model/optimizer/synthetic/audit/TEST-write adapters enabled. No mock routes.
- **Fresh bounded execution approval** covers this run. Earlier15-provider-attempt allowance is exhausted. Propose one PO extraction plus one grounded explanation (target2 attempts), maximum3 attempts, no automatic retry, explicit US$1 estimate stop, approved per-query caps (risk/explanation80MiB, optimizer100MiB, persistence50MiB). Re-estimate from actual fixture/input bounds before calls; limits are not global monetary hard stops.
- Read today's counter independently, record IST day and remaining allowance. Prefer a run outside the midnight boundary. Do not reset the document. Keep other private provider work idle during the measurement window, or report attribution uncertainty.
- Participant supplies a real confirmation record for the approved synthetic case: paper context, actual test date/shift, simulated/manual conditions and all seven planned settings. This is a demo participant assertion, **not authenticated human identity or factory telemetry**. Do not generate it from optimizer suggestions. If absent, stop.
- Real approved fixture: `test/fixtures/synthetic_POs/PO1_ClientA_single_B1047.pdf`, SHA256 `d789722039e0d9f29d2106655416aae0447159d23df56c7dc215ee875c8fb44a`. The server enforces the exact allowlist.
- Budget alert configuration/current usage reviewed; source evidence private and no production/customer data. No new model evaluation/retraining/public release is included.

Participant file, kept outside Git: `/PRIVATE/OPERATOR_CONFIRMED_INPUT.json`. Required shape is:

```json
{
  "operatorConfirmed": false,
  "confirmationSource": "Participant review of approved synthetic PO and simulated/manual test context",
  "operatorFields": {"orderId":"TEST-CLA/PO/2026/1047","paperType":"RECYCLED","paperSupplier":"SUP-D"},
  "conditions": {"runDate":"OPERATOR_TEST_DATE","shift":"DAY","ambientRhPct":86,"ambientTempC":26,"paperMoisturePct":10.8},
  "levers": {"sfSpeedMpm":48,"rollTempC":162,"gumApplication":"HIGH","gumViscositySec":32,"pastingPressure":"MED","dryingHours":5,"printSpeedSpm":60}
}
```

The numeric values are the approved PKBX0041 synthetic reference case, not measured readings. The operator supplies the date and consciously confirms/edits the values, then sets `operatorConfirmed:true`. The false/placeholder template is intentionally not executable as a confirmed request.

## 2. Capture source, resource and model preflight

Use the installed SDK path or equivalent reviewed CLI. Metadata commands are read-only:

```sh
/Users/siddhant/prepagent-work/google-cloud-sdk/bin/gcloud run services describe prepagent --project=prepagent-hack --region=asia-south1 --format=json
/Users/siddhant/prepagent-work/google-cloud-sdk/bin/gcloud run services get-iam-policy prepagent --project=prepagent-hack --region=asia-south1 --format=json
/Users/siddhant/prepagent-work/google-cloud-sdk/bin/gcloud run revisions describe ACCEPTED_PRIVATE_REVISION --project=prepagent-hack --region=asia-south1 --format='json(metadata.name,spec.serviceAccountName,status.imageDigest,status.conditions)'
```

Capture `bq show --model --format=prettyjson prepagent-hack:prepagent.m_warp` and equivalent delam/strength/print/crack metadata. Match **each etag and linked Vertex version** to the installed accepted record. Repeat this check after the workflow. A changed model invalidates this acceptance; no automatic replacement or threshold change.

Create a new private evidence directory and set non-secret paths:

```sh
umask 077
mkdir /PRIVATE/NEW_ACCEPTANCE_RUN
export USTAAD_ACCEPTANCE_URL='https://ACCEPTED-TAG---prepagent-26mwt2n7ba-el.a.run.app'
export USTAAD_ACCEPTANCE_DIR='/PRIVATE/NEW_ACCEPTANCE_RUN'
export USTAAD_CONFIRMED_INPUT='/PRIVATE/OPERATOR_CONFIRMED_INPUT.json'
node
```

Replace placeholders only from actual approved release metadata. The following blocks run **in that one Node REPL**, retaining credentials only in memory. Do not print tokens/cookies or put them in URLs/command arguments. Use a legitimate CLI principal with Cloud Run invocation. `X-Serverless-Authorization` authenticates infrastructure; the cookie authorizes the demo session. Firebase `Authorization` is not needed here.

## 3. Safe API client and blocked-state preflight

```js
const fs = await import('node:fs');
const {execFileSync} = await import('node:child_process');
const {createHash,randomUUID} = await import('node:crypto');
const {isDeepStrictEqual} = await import('node:util');
const {LeversSchema,RunConditionsSchema} = await import('./src/schemas.js');
const base = process.env.USTAAD_ACCEPTANCE_URL;
const directory = process.env.USTAAD_ACCEPTANCE_DIR;
const must = (condition,message) => { if (!condition) throw Error(message); };
must(/^https:\/\/[a-z0-9-]+---prepagent-26mwt2n7ba-el\.a\.run\.app$/.test(base),'Use the exact approved private tag URL');
const sha = value => createHash('sha256').update(value).digest('hex');
const sdk = '/Users/siddhant/prepagent-work/google-cloud-sdk/bin/';
const cloudToken = execFileSync(sdk+'gcloud',['auth','print-identity-token'],{encoding:'utf8'}).trim();
const input = JSON.parse(fs.readFileSync(process.env.USTAAD_CONFIRMED_INPUT,'utf8'));
must(input.operatorConfirmed===true && typeof input.confirmationSource==='string','Real participant confirmation record required');
const conditions = RunConditionsSchema.parse(input.conditions);
const levers = LeversSchema.parse(input.levers);
const start = new Date().toISOString();
const log = [];
function client() {
  let cookie;
  return async (path,{method='GET',body,headers={},allowFailure=false}={}) => {
    const begin=Date.now();
    const requestHeaders={'X-Serverless-Authorization':'Bearer '+cloudToken,Origin:base,...headers};
    if(cookie)requestHeaders.Cookie=cookie;
    const multipart=body instanceof FormData;
    if(body!==undefined&&!multipart)requestHeaders['Content-Type']='application/json';
    const response=await fetch(base+path,{method,headers:requestHeaders,body:body===undefined?undefined:multipart?body:JSON.stringify(body),signal:AbortSignal.timeout(65000)});
    const setCookie=response.headers.get('set-cookie');
    if(setCookie)cookie=setCookie.split(';')[0];
    const type=response.headers.get('content-type')??'';
    const data=type.includes('application/pdf')?{contentType:type,bytes:Buffer.from(await response.arrayBuffer())}:type.includes('text/event-stream')?{events:await response.text()}:await response.json();
    log.push({at:new Date().toISOString(),path,method,status:response.status,durationMs:Date.now()-begin});
    fs.writeFileSync(directory+'/http-log.json',JSON.stringify(log,null,2),{mode:0o600});
    if(!allowFailure)must(response.ok&&data.ok!==false,'STOP '+path+' '+response.status+' '+(data.error?.code??''));
    return {status:response.status,data};
  };
}
const api = client();
const status = (await api('/api/status')).data;
must(status.executionMode==='live-service' && status.authorizationMode==='HACKATHON_DEMO','Wrong execution or authorization mode');
must(status.modelAcceptance.status==='accepted' && (status.modelAcceptance.completeAcceptanceEvidenceAvailable===true || status.modelAcceptance.evaluationId==='D4-2026-10-16-OM'),'D4 BLOCKED: STOP; no model-dependent call');
must(status.runtimeAvailability.jobCreationAvailable===true,'Required persistence/model adapters unavailable');
fs.writeFileSync(directory+'/status.json',JSON.stringify(status,null,2),{mode:0o600});
const session = await api('/api/auth/demo-session',{method:'POST'});
must(session.data.authenticatedHuman===false,'Do not impersonate a human supervisor');
```

If any assertion fails, exit the REPL. Health200/configured adapters alone are not acceptance. Independently record the actual Firestore counter before proceeding using an OAuth access token in memory or the existing read-only resource harness; never expose its token. Record today's IST key and count.

## 4. Genuine extraction and actual review

```js
const bytes = fs.readFileSync('test/fixtures/synthetic_POs/PO1_ClientA_single_B1047.pdf');
must(sha(bytes)==='d789722039e0d9f29d2106655416aae0447159d23df56c7dc215ee875c8fb44a','Unapproved fixture');
const upload = new FormData();
upload.append('file',new Blob([bytes],{type:'application/pdf'}),'PO1_ClientA_single_B1047.pdf');
for(const [key,value] of Object.entries(input.operatorFields))upload.append(key,String(value));
const extracted = (await api('/orders/extract',{method:'POST',body:upload})).data;
must(extracted.source==='vertex-gemini'&&extracted.isRealModelPrediction===true,'Genuine extraction required');
must(extracted.purchaseOrderDocument.poNumber==='CLA/PO/2026/1047','Wrong source PO');
const line = extracted.lines[0];
must(line.status==='MATCHED'&&line.resolvedItemCode==='PKBX0041'&&line.quantity===1300,'Clarify discrepancies; never substitute expected results');
must(extracted.reviewId&&extracted.reviewFingerprint&&!extracted.needsClarification,'Complete actual source-line review first');
fs.writeFileSync(directory+'/extraction.json',JSON.stringify(extracted,null,2),{mode:0o600});
const currentConditions = (await api('/conditions/current?shift='+conditions.shift)).data;
fs.writeFileSync(directory+'/conditions-reading.json',JSON.stringify(currentConditions,null,2),{mode:0o600});
```

Inspect the real returned source line, missing fields, paper context, conditions provenance/timestamp/age and all seven planned settings. Use the canonical UI to make this review if preferred; do not create another application. Readings are simulated/manual. Over24h requires an age/stale note, not fabricated refresh. If the participant changes any value, update the confirmed record and restart the preflight deliberately; no automatic retries or silent override.

Only after the participant actually confirms this source line, continue. A stale/missing process-local review reference must fail; record it, do not remove review fields to bypass it.

## 5. One genuine coordinated preparation

Do **not** separately repeat prediction/optimization/explanation just for activity. `POST /jobs` already executes all five accepted predictions, canonical optimizer, historical evidence and grounded explanation, then persists DRAFT. Its actual outputs/trace provide their acceptance evidence.

```js
const idempotencyKey = 'final-acceptance-'+randomUUID();
function preparation(changes={}) {
  const form=new FormData();
  form.append('file',new Blob([bytes],{type:'application/pdf'}),'PO1_ClientA_single_B1047.pdf');
  const fields={...input.operatorFields,...conditions,...levers,confirmedItemCode:'PKBX0041',confirmedQuantity:'1300',confirmedLineIndex:'1',reviewId:extracted.reviewId,reviewFingerprint:extracted.reviewFingerprint,confirmedSourceLine:'true',conditionsConfirmed:'true',...changes};
  for(const [key,value] of Object.entries(fields))form.append(key,String(value));
  return form;
}
const prepared = (await api('/jobs',{method:'POST',headers:{'Idempotency-Key':idempotencyKey},body:preparation()})).data;
must(prepared.durable===true&&prepared.jobSheet.status==='DRAFT','No success without durable DRAFT');
must(prepared.completedStages.includes('predictRisk')&&prepared.completedStages.includes('optimizeLevers')&&prepared.completedStages.includes('explainRisk'),'Missing real stage');
const jobId=prepared.jobId??prepared.jobSheet.jobId;
must(jobId.startsWith('JOB-HACK-')&&prepared.jobSheet.order.orderId.startsWith('TEST-'),'Wrong scoped identity');
must(Object.keys(prepared.prediction.ratesPct).length===5,'All five risks required');
must(prepared.jobSheet.changes.length<=3,'Optimizer constraint violated');
fs.writeFileSync(directory+'/prepared.json',JSON.stringify(prepared,null,2),{mode:0o600});
const draft = (await api('/jobs/'+jobId)).data.jobSheet;
must(draft.status==='DRAFT'&&draft.approvedAt===null&&draft.cardUri===null,'Independent DRAFT read-back mismatch');
fs.writeFileSync(directory+'/draft-readback.json',JSON.stringify(draft,null,2),{mode:0o600});
const trace = await api('/api/runs/'+prepared.runId+'/events');
must(trace.data.events.includes('run.completed'),'No synthetic trace fallback');
fs.writeFileSync(directory+'/trace.sse',trace.data.events,{mode:0o600});
```

Compare actual PKBX0041 baseline10.18%/100.4kg/INR5351; best170°C/MED/35s,8.42%/83kg/INR4426; predicted17.4kg/INR925, slowdown0. Compare all output schema fields and actual groundings—not just those headline values. Stop unchanged on discrepancy. Do not modify SQL or expected values.

Independently query BigQuery using the operator CLI, cap50MiB, unique query job ID, parameter `jobId:STRING:<actual jobId>`:

```sql
SELECT job_id, status, order_json, conditions_json, baseline_json, recommended_json,
       savings_kg, savings_cost, approved_at, card_uri, approval_audit_json
FROM `prepagent-hack.prepagent.job_sheets`
WHERE job_id = @jobId;
```

Expected exactly one DRAFT row, matching API input/output. Capture its actual query/job ID, bytes and timestamp. This is additional independent persistence proof, not an unrestricted query endpoint.

## 6. Real demo approval, audit and PDF

Participant reviews the persisted draft and deliberately chooses approval under the displayed hackathon authorization note. Never supply an actorUID/role in the body. Then execute:

```js
const approved = (await api('/jobs/'+jobId+'/approve?lang=en&currency=INR',{method:'POST'})).data;
must(approved.jobSheet.status==='APPROVED','Approval did not persist');
const stored = (await api('/jobs/'+jobId)).data.jobSheet;
must(stored.approvalAudit.authenticatedHuman===false&&stored.approvalAudit.authorizationMode==='HACKATHON_DEMO','False identity provenance');
must(stored.approvalAudit.jobId===jobId&&stored.approvalAudit.cardUri===stored.cardUri&&stored.approvalAudit.decidedAt===stored.approvedAt,'Audit/card/state mismatch');
fs.writeFileSync(directory+'/approved-readback.json',JSON.stringify(stored,null,2),{mode:0o600});
const pdf = (await api('/jobs/'+jobId+'/card.pdf')).data;
must(pdf.contentType.includes('application/pdf')&&pdf.bytes.subarray(0,5).toString()==='%PDF-','Invalid returned PDF');
fs.writeFileSync(directory+'/approved-card.pdf',pdf.bytes,{mode:0o600});
const replay = (await api('/jobs/'+jobId+'/approve?lang=en&currency=INR',{method:'POST'})).data;
must(replay.cardUri===stored.cardUri&&isDeepStrictEqual(replay.jobSheet.approvalAudit,stored.approvalAudit),'Duplicate/conflicting approval');
const pdfAgain = (await api('/jobs/'+jobId+'/card.pdf')).data;
must(sha(pdfAgain.bytes)===sha(pdf.bytes),'Repeated card differs');
const conflict = await api('/jobs',{method:'POST',headers:{'Idempotency-Key':idempotencyKey},body:preparation({confirmedQuantity:'1301'}),allowFailure:true});
must(conflict.status===409||conflict.status===400,'Altered request must not create another job');
const other = client();
await other('/api/auth/demo-session',{method:'POST'});
for(const [method,path] of [['GET','/jobs/'+jobId],['POST','/jobs/'+jobId+'/approve'],['GET','/jobs/'+jobId+'/card.pdf'],['POST','/jobs/'+jobId+'/feedback']]) {
  const denied=await other(path,{method,allowFailure:true});must(denied.status===403,'Cross-session access accepted');
}
const after = (await api('/jobs/'+jobId)).data.jobSheet;
must(after.cardUri===stored.cardUri&&isDeepStrictEqual(after.approvalAudit,stored.approvalAudit),'Negative checks altered stored decision');
fs.writeFileSync(directory+'/result.json',JSON.stringify({jobId,runId:prepared.runId,idempotencyKey,sourceSha256:sha(bytes),pdfSha256:sha(pdf.bytes),cardUri:stored.cardUri,startedAt:start,finishedAt:new Date().toISOString(),verdict:'API_SEQUENCE_PASSED_REQUIRES_EXTERNAL_READBACK_AND_PDF_REVIEW'},null,2),{mode:0o600});
```

No success from the final line alone. Repeat the exact scoped independent BigQuery query above: one APPROVED row with genuine demo actor, immutable decision, timestamp/correlation and exact URI. Independently read the GCS object metadata and download its exact generation; hash must equal `pdfSha256`. Capture object name/generation/content type/length. No public bucket ACL needed.

Parse PDF with pypdf and render all pages. Verify order/source PO, settings/units, actual five risks, predicted savings/caveats, approval state and the nine manufacturing stages in D11 order. Never claim fixture transport values are accepted live output.

## 7. Evidence, costs, failures and cleanup

- Independently read the counter after; reconcile actual reservations against the new approved run allowance, same IST day or both days if a boundary occurred. No refunds/retries. Capture provider usage where returned; missing explanation token telemetry remains explicitly unavailable, not estimated as actual.
- Capture runtime BigQuery job IDs/caps/bytes and Cloud Run revision/request metadata for the interval. If jobs lack request labels, state attribution limits. Re-read five model etags/versions and stop if changed. Record total runtime and actual errors, not only successful responses.
- Every mandatory external integration/read-back/PDF check must pass before changing the verdict to LIVE_PO_TO_CARD_ACCEPTED. Local browser doubles and the separately labeled isolated transport test do not qualify.
- Missing/stale review, trace routing loss, Storage/BQ failure, query cap excess or indeterminate approval: stop the affected operation. Preserve run/job/object IDs and query stored state before proposing any retry. Never resubmit blindly or delete a referenced PDF.
- D6 process-local trace/review/idempotency is not distributed exactly-once. Inspect two-instance/restart behavior in the authorized run; report failures honestly. Fault-injected writes/outages belong in local tests, not destructive production tests.
- Feedback requires genuine supplied outcomes. Do not copy predictions into actual rates or create completed lots. If no approved outcome contract/data exists, mark that optional feature separately rather than attributing it to D4.
- Retain acceptance evidence until owner review. Om's cleanup instruction is17October; do not automatically delete evidence now. The manifest must list exact TEST row/job and PDF URI/generation. Delete only those own objects after confirming the row/reference plan. For GCS use `gcloud storage rm EXACT_URI --if-generation-match=RECORDED_GENERATION --project=prepagent-hack`; no wildcard deletion.
- A separately authorized scoped TEST cleanup query must bind the actual job ID and verify `STARTS_WITH(JSON_VALUE(order_json,'$.orderId'),'TEST-')`. No production/backfill/all-table deletion. Record cleanup job ID and independent absence checks. Current `JOB-HACK-*` PDFs require exact manifest cleanup; a `jobcards/TEST-*` wildcard would miss them.
- No default traffic switch or public IAM is included. Candidate withdrawal/rotation/promotion require the reviewed [release procedure](RELEASE_PROVENANCE.md).

## Current live-only execution instruction supersedes older local-test commands for this acceptance assignment

No npm/unit/acceptance/localbrowser/localdemo suites are to be rerun as part of the final live-cloud assignment. Static source inspection and the evidence consistency validator are distinct from runtime application tests. After authenticD4 validation/installation, record a new immutable source; use build-only Cloud Build configuration; deploy a private no-default-traffic replacement; run the documented actual Cloud Run browser/API journey and independently verify service effects. Existing candidate v1f-9edd78db intentionally contains blocked evidence and cannot become accepted through a local edit. Use legitimate infrastructure invocation plus signed ApproachB session; do not use localhost/proxy/mock responses as deployed proof. Keep cumulative provider attempt budget visible and obtain only genuinely additional usage authorization if previously approved bounds would be exceeded.
