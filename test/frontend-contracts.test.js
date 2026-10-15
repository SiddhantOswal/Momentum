import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequestGate, assertProductionResponse } from '../src/ui/api.js';
import { isRiskDisplay, isOptimizationDisplay, isSeenBefore, isJobDisplay, isConditionsDisplay } from '../src/ui/contracts.js';
import { ORDER_FIELDS, CONDITION_FIELDS, LEVER_FIELDS } from '../src/ui/fields.js';
import { OrderProfileSchema, RunConditionsSchema, LeversSchema } from '../src/schemas.js';
import { jobSheetFixture as job } from './fixtures/job-sheet.js';
import { isApprovedSyntheticPurchaseOrder } from '../src/synthetic-po-allowlist.js';

test('all order, condition and lever controls exactly preserve the current schema fields', () => {
  for (const [fields, schema] of [[ORDER_FIELDS,OrderProfileSchema],[CONDITION_FIELDS,RunConditionsSchema],[LEVER_FIELDS,LeversSchema]]) assert.deepEqual(fields.map(([n])=>n).sort(), Object.keys(schema.shape).sort());
});
test('latest-request gate aborts old work and ignores an adapter that resolves after invalidation', () => {
  const gate=createRequestGate();const first=gate.begin();assert.equal(first.current(),true);
  const second=gate.begin();assert.equal(first.current(),false);assert.equal(first.signal.aborted,true);assert.equal(second.current(),true);
  gate.invalidate();assert.equal(second.current(),false);assert.equal(second.signal.aborted,true);
});
test('risk and optimization display contracts fail closed on malformed results; missing optional percentages are not zero', () => {
  assert.equal(isRiskDisplay(job.baseline.risk),true);
  assert.equal(isRiskDisplay({...job.baseline.risk,scrapCost:null}),false);
  assert.equal(isRiskDisplay({...job.baseline.risk,ratesPct:{WARP:1}}),false);
  assert.equal(isRiskDisplay({...job.baseline.risk,ratesPct:{...job.baseline.risk.ratesPct,CRACK:NaN}}),false);
  const opt={baseline:job.baseline,best:job.recommended,changes:job.changes,savings:job.savings};assert.equal(isOptimizationDisplay(opt),true);
  assert.equal(isOptimizationDisplay({...opt,savings:{kg:1}}),false);
  assert.equal(isOptimizationDisplay({...opt,changes:[...job.changes,...job.changes,...job.changes,...job.changes]}),false);
  assert.equal(isOptimizationDisplay({...opt,best:{...job.recommended,levers:{...job.recommended.levers,rollTempC:190}}}),false);
});
test('defect evidence preserves absent groups and zero cases without creating fallback settings', () => {
  const response={ok:true,source:'bigquery',defect:'DELAM',caseCount:0,avgRateWhenMain:0,costWhenMain:0,goodRuns:null,badRuns:null,notes:[]};
  assert.equal(isSeenBefore(response),true);assert.equal(isSeenBefore({...response,caseCount:undefined}),false);
  assert.equal(isSeenBefore({...response,source:'preview'}),false);assert.equal(isSeenBefore({...response,notes:[123]}),false);
  assert.equal(isSeenBefore({...response,goodRuns:{lots:2,avgRatePct:1,...job.baseline.levers}}),true);
});
test('every shipped synthetic sample exactly matches the existing backend-approved byte allowlist', async () => {
  for (const name of ['PO1_ClientA_single_B1047.pdf','PO2_ClientA_multiline.pdf','PO3_ClientP_electronics_with_fitment.pdf','PO4_ClientQ_ambiguous_set.pdf','PO5_ClientB_scanned.jpg']) assert.equal(isApprovedSyntheticPurchaseOrder(new Uint8Array(await readFile(new URL('../public/samples/'+name,import.meta.url)))),true,name);
});

test('malformed conditions and stored sheets cannot enable review or approval',()=>{
  assert.equal(isConditionsDisplay(job.conditions),true);assert.equal(isConditionsDisplay({...job.conditions,ambientRhPct:null}),false);
  assert.equal(isConditionsDisplay({...job.conditions,shift:'UNKNOWN'}),false);assert.equal(isJobDisplay(job),true);
  assert.equal(isJobDisplay({...job,status:'APPROVED',recommended:null}),false);assert.equal(isJobDisplay({...job,order:{itemCode:'INCOMPLETE'}}),false);
});

test('production UI rejects generated response provenance at any nesting level', () => {
  for (const payload of [
    {ok:true,source:'mock-demo'},
    {ok:true,source:'offline-test-adapter'},
    {ok:true,source:'bigquery',sensorSource:'simulated'},
    {ok:true,monthly:[{series:'simulated',scrapCost:123}]},
    {ok:true,jobSheet:{evidence:[{isSynthetic:true}]}},
    {ok:true,data:{isSimulated:true}},
  ]) assert.throws(()=>assertProductionResponse(payload), /Production data is unavailable/);
});
test('production UI preserves genuine BigQuery, Gemini and observed records without changing payloads', () => {
  for (const payload of [{ok:true,source:'bigquery',caseCount:3}, {ok:true,source:'vertex-gemini'}, {ok:true,source:'bigquery-ml',isRealModelPrediction:true}, {ok:true,monthly:[{series:'observed',scrapCost:123}]}, {ok:false,error:{code:'VALIDATION_ERROR',message:'Quantity is required.'}}]) {
    const snapshot=structuredClone(payload);assert.doesNotThrow(()=>assertProductionResponse(payload));assert.deepEqual(payload,snapshot);
  }
});
test('backend data-policy errors remain unavailable without exposing sample messaging', () => {
  assert.throws(()=>assertProductionResponse({ok:false,error:{code:'VALIDATION_ERROR',message:'Only approved synthetic fixtures are accepted.'}}), error=> /backend data policy/.test(error.message) && !/synthetic|simulated|fixture/i.test(error.message));
});
