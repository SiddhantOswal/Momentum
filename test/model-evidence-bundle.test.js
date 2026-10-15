import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateModelEvidenceBundle, evidenceDigest } from '../src/model-evidence-bundle.js';
import { REQUIRED_MODEL_R2, isModelSetAccepted } from '../src/model-acceptance.js';
import { validateFiles } from '../tools/validate-model-evidence.mjs';
const sha = s => createHash('sha256').update(s).digest('hex');
const clock = Date.parse('2026-10-15T12:00:00Z');
// All artifacts here are deterministic invented TEST DOUBLES, never model evidence.
function fixture() {
  const current = Object.keys(REQUIRED_MODEL_R2).map(defect => ({
    modelReference: { projectId: 'prepagent-hack', datasetId: 'prepagent', modelId: 'm_' + defect.toLowerCase() }, etag: 'TEST-ONLY-' + defect, creationTime:String(Date.parse('2026-10-13T00:00:00Z')),
    featureColumns:[{name:'TEST_FEATURE'}], trainingRuns: [{ vertexAiModelVersion: '1', trainingOptions:{inputLabelColumns:['rate_'+defect.toLowerCase()+'_pct']}, evaluationMetrics: { regressionMetrics: { rSquared: REQUIRED_MODEL_R2[defect] } },
      dataSplitResult: { evaluationTable: { projectId:'prepagent-hack',datasetId:'TEST',tableId:'split_' + defect } },
      modelLevelGlobalExplanation:{explanations:[{featureName:'TEST_FEATURE',attribution:1}]} }],
  }));
  const values={lot_id:'TEST-MEMBER-1',run_date:'2026-08-01',TEST_FEATURE:1,...Object.fromEntries(Object.keys(REQUIRED_MODEL_R2).map(d=>['rate_'+d.toLowerCase()+'_pct',1]))};
  const bundle = { schemaVersion:1,evidenceKind:'HISTORICAL',evaluationId:'TEST-ONLY-NOT-EVIDENCE',evaluatedAt:'2026-10-14T10:00:00Z',splitId:'TEST-members-explicit',
    source:{ dataset:'prepagent-hack.prepagent.lots',identity:'TEST-SNAPSHOT',rowIdentity:'lot-id',from:'2026-08-01',through:'2026-08-31',query:'SELECT TEST_ONLY',querySha256:sha('SELECT TEST_ONLY'),rows:[{id:'TEST-MEMBER-1',runDate:'2026-08-01',values,rowSha256:evidenceDigest(values)}] },
    models:current.map((model,i) => { const defect=Object.keys(REQUIRED_MODEL_R2)[i], resource='prepagent.m_'+defect.toLowerCase(),query='CREATE MODEL '+resource+' AS SELECT TEST_ONLY';
      return {defect,resource,modelVersion:'1',modelEtag:model.etag,sampleCount:1,members:['TEST-MEMBER-1'],r2:REQUIRED_MODEL_R2[defect],evaluatedAt:'2026-10-14T10:00:00Z',querySha256:sha(query),evaluationDataset:'prepagent-hack.TEST.split_'+defect,
        evaluatedModel:structuredClone(model),evaluationJob:{jobReference:{projectId:'prepagent-hack',location:'asia-south1',jobId:'TEST-JOB-'+defect},status:{state:'DONE'},statistics:{startTime:String(Date.parse('2026-10-14T09:59:00Z')),endTime:String(Date.parse('2026-10-14T10:00:00Z'))},configuration:{query:{query}}},
        featureReview:{reviewer:'TEST-REVIEWER-NOT-OM',reviewedAt:'2026-10-14T11:00:00Z',decision:'APPROVE_PROTOTYPE',modelEtag:model.etag,featureEvidenceSha256:evidenceDigest(model.trainingRuns[0].modelLevelGlobalExplanation),membershipSha256:evidenceDigest(['TEST-MEMBER-1'])} };
    }) };
  return {bundle,current};
}
const validate = ({bundle,current},options={}) => validateModelEvidenceBundle(bundle,current,{now:clock,...options});
test('offline evidence validator prepares a candidate only from consistent explicit test artifacts',()=>{
  const f=fixture(),result=validate(f);assert.equal(result.ok,true);assert.equal(result.status,'CONSISTENT_NOT_INSTALLED');assert.equal(isModelSetAccepted(result.acceptanceCandidate),true);
  assert.equal(result.acceptanceCandidate.evidenceKind,'HISTORICAL');assert.match(result.boundary,/not cloud authenticity/);
});
test('partial, malformed and duplicate model evidence fails closed',()=>{
  for(const bundle of [null,{},[],{models:[null]},{schemaVersion:1,source:{rows:[null]},models:[{}]}])assert.equal(validateModelEvidenceBundle(bundle,[]).ok,false);
  for(const change of [f=>f.bundle.models.pop(),f=>f.bundle.models[1]=f.bundle.models[0],f=>f.current.pop(),f=>f.current[0].trainingRuns={}]){
    const f=fixture();change(f);assert.equal(validate(f).ok,false);
  }
});
test('all independent thresholds and actual metric linkage are enforced',()=>{
  for(let i=0;i<5;i++){
    const f=fixture();f.bundle.models[i].r2-=0.0001;assert.equal(validate(f).ok,false);
  }
  const f=fixture();f.bundle.models[0].r2+=0.1;f.bundle.models[0].evaluatedModel.trainingRuns[0].evaluationMetrics.regressionMetrics.rSquared+=0.1;assert.equal(validate(f).ok,false,'Cannot forge a metric under the original etag');
});
test('genuine observed threshold failure is distinct from unavailable or inconsistent evidence',()=>{
  const f=fixture();const low=REQUIRED_MODEL_R2.WARP-0.01;
  f.current[0].trainingRuns[0].evaluationMetrics.regressionMetrics.rSquared=low;
  f.bundle.models[0].evaluatedModel.trainingRuns[0].evaluationMetrics.regressionMetrics.rSquared=low;f.bundle.models[0].r2=low;
  assert.ok(validate(f).issues.some(i=>i.code==='MODEL_THRESHOLD_NOT_MET'));
  delete f.bundle.models[0].r2;
  assert.ok(validate(f).issues.some(i=>i.code==='EVALUATION_METRIC_UNVERIFIED'));
});
test('wrong project, current version, etag and stale split evidence are rejected',()=>{
  for(const change of [f=>f.current[0].modelReference.projectId='other-project',f=>f.bundle.models[0].modelVersion='2',f=>f.bundle.models[0].modelEtag='old',f=>f.bundle.models[0].evaluationDataset='old-split']){
    const f=fixture();change(f);assert.equal(validate(f).ok,false);
  }
});
test('historical frozen feature rows do not require invented lot IDs or discarded row dates',()=>{
  const f=fixture();f.bundle.source.rowIdentity='feature-row';const row=f.bundle.source.rows[0];delete row.runDate;delete row.values.lot_id;delete row.values.run_date;row.rowSha256=evidenceDigest(row.values);
  assert.equal(validate(f).ok,true);
  f.bundle.source.rowIdentity='lot-id';assert.equal(validate(f).ok,false);
});
test('membership counts, source fingerprints, dates and missing provenance cannot be inferred',()=>{
  for(const change of [f=>f.bundle.models[0].sampleCount=null,f=>f.bundle.models[0].members=[],f=>f.bundle.models[0].members.push('unknown'),f=>f.bundle.source.rows.push(f.bundle.source.rows[0]),f=>f.bundle.source.rows[0].rowSha256='not-a-hash',f=>f.bundle.source.rows[0].runDate='2026-02-31',f=>f.bundle.source.querySha256='0'.repeat(64),f=>f.bundle.source.identity='']){
    const f=fixture();change(f);assert.equal(validate(f).ok,false);
  }
});
test('failed/pending jobs and missing or future owner reviews are rejected',()=>{
  for(const change of [f=>f.bundle.models[0].evaluationJob.status.state='RUNNING',f=>f.bundle.models[0].evaluationJob.status.errorResult={reason:'denied'},f=>delete f.bundle.models[0].featureReview,f=>f.bundle.models[0].featureReview.featureEvidenceSha256='b'.repeat(64),f=>f.bundle.models[0].featureReview.reviewedAt='2027-01-01T00:00:00Z',f=>f.bundle.evaluatedAt='2027-01-01T00:00:00Z']){
    const f=fixture();change(f);assert.equal(validate(f).ok,false);
  }
});
test('old evidence timestamps cannot be attached to a later current model or different job completion',()=>{
 const f=fixture();f.current[0].creationTime=String(Date.parse('2026-10-15T01:00:00Z'));assert.equal(validate(f).ok,false);
 const g=fixture();g.bundle.models[0].evaluatedAt='2026-10-14T09:00:00Z';assert.equal(validate(g).ok,false);
});
test('new evaluation must match exact prepared SQL, frozen timestamp and full source membership',()=>{
  const f=fixture();f.bundle.evidenceKind='NEW_EVALUATION';f.bundle.source.asOf='2026-10-14T09:00:00Z';const queries={source:f.bundle.source.query};
  for(const m of f.bundle.models){const query=`SELECT * FROM ML.EVALUATE(MODEL ${m.resource}, (SELECT * FROM lots FOR SYSTEM_TIME AS OF @source_as_of))`;queries[m.resource]=query;m.querySha256=sha(query);m.evaluationJob.configuration.query={query,queryParameters:[{name:'source_as_of',parameterValue:{value:f.bundle.source.asOf}}]};m.evaluationResult={schema:{fields:[{name:'r2_score'}]},rows:[{f:[{v:String(m.r2)}]}]};}
  assert.equal(validate(f,{preparedQueries:queries}).ok,true);
  assert.equal(validate(f).ok,false,'No unreviewed SQL fallback');
  const bad=structuredClone(f);bad.bundle.models[0].evaluationJob.configuration.query.queryParameters[0].parameterValue.value='2026-10-14T08:00:00Z';assert.equal(validate(bad,{preparedQueries:queries}).ok,false);
  const badMetric=structuredClone(f);badMetric.bundle.models[0].evaluationResult.rows[0].f[0].v='NaN';assert.equal(validate(badMetric,{preparedQueries:queries}).ok,false);
});
test('CLI uses exclusive output and never installs or overwrites active model acceptance',()=>{
  const dir=mkdtempSync(join(tmpdir(),'ustaad-evidence-test-'));try{
    const f=fixture(),bundleFile=join(dir,'bundle.json'),metadataFile=join(dir,'metadata.json'),outputFile=join(dir,'report.json');
    writeFileSync(bundleFile,JSON.stringify(f.bundle));writeFileSync(metadataFile,JSON.stringify(f.current));
    const active=new URL('../config/model-acceptance.json',import.meta.url);const before=readFileSync(active);
    assert.equal(validateFiles({bundleFile,metadataFile,outputFile}).ok,true);assert.deepEqual(readFileSync(active),before);assert.throws(()=>validateFiles({bundleFile,metadataFile,outputFile}),/EEXIST/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
