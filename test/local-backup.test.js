import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {isLocalSyntheticRuntime,assertProductionResponse} from '../src/ui/api.js';
import {isImpactSummary} from '../src/impact-ui.js';
import {createConfiguredServicePorts} from '../src/service-ports.js';
test('local response policy requires explicit demo runtime and loopback, never Cloud Run or URL flags',()=>{
 const local={mode:'local-development',executionMode:'demo'};
 for(const host of ['127.0.0.1','localhost','[::1]'])assert.equal(isLocalSyntheticRuntime(local,host),true);
 for(const [status,host]of [[local,'service.run.app'],[{...local,mode:'cloud-run'},'localhost'],[{...local,executionMode:'offline'},'localhost'],[{},'localhost']])assert.equal(isLocalSyntheticRuntime(status,host),false);
 assert.throws(()=>assertProductionResponse({source:'mock-demo'},'HACKATHON_DEMO'));
});
test('local Impact has current validated shape but cannot pass the production-source contract',async()=>{
 const ports=createConfiguredServicePorts({env:{USTAAD_ENABLE_DEMO_MODE:'true'}});const p=await ports.getImpactSummary();
 assert.equal(isImpactSummary(p),false);assert.equal(isImpactSummary(p,{allowLocalDemo:true}),true);assert.equal(p.isRealModelPrediction,false);
 assert.equal(isImpactSummary({...p,kpis:{...p.kpis,netSavingMonth:NaN}},{allowLocalDemo:true}),false);
});
test('local launcher refuses Cloud Run before startup and rejects invalid port',()=>{
 for(const env of [{K_SERVICE:'deployed'},{K_SERVICE:'',USTAAD_LOCAL_DEMO_PORT:'80'}]){
  const p=spawnSync(process.execPath,['tools/run-local-backup.mjs'],{env:{...process.env,...env},encoding:'utf8'});assert.notEqual(p.status,0);assert.match(p.stderr,/cannot run in Cloud Run|must be an integer/);
 }
});

import {isJobDisplay} from '../src/ui/contracts.js';
import {jobSheetFixture} from './fixtures/job-sheet.js';
test('stored INR amount is a valid JobSheet display, without accepting wrong currency or nonfinite amounts',()=>{
 const row={...jobSheetFixture,savings:{kg:1,amount:53,currency:'INR'}};
 assert.equal(isJobDisplay(row),true);
 assert.equal(isJobDisplay({...row,savings:{...row.savings,currency:'USD'}}),false);
 assert.equal(isJobDisplay({...row,savings:{...row.savings,amount:NaN}}),false);
});
