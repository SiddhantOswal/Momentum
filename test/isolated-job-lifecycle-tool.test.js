import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { isolatedTransportFixture, isolatedPlan } from '../tools/accept-isolated-job-lifecycle.mjs';
import { createHackathonDemoAuthenticator, demoOwnsJob } from '../src/hackathon-demo-auth.js';
import { JobSheetSchema } from '../src/schemas.js';

test('isolated lifecycle harness defaults to plan-only with fixed TEST resources and no provider calls',()=>{
  const result=JSON.parse(execFileSync(process.execPath,['tools/accept-isolated-job-lifecycle.mjs'],{encoding:'utf8'}));
  assert.equal(result.project,'prepagent-hack');assert.equal(result.newGeminiCalls,0);assert.equal(result.maximumQueryJobs,24);assert.equal(result.maximumStorageUploads,2);
  assert.match(result.scope,/not application model acceptance/);assert.equal(isolatedPlan.newCloudConfiguration,0);
});
test('isolated fixture requires a genuine local demo capability and makes no model/human/confirmation claim',()=>{
  const auth=createHackathonDemoAuthenticator({mode:'HACKATHON_DEMO',signingKey:'a'.repeat(64),syntheticOnly:true,auditEnabled:true});
  const actor=auth.authenticate(auth.issue()).principal,job=isolatedTransportFixture(actor,randomUUID());
  assert.equal(JobSheetSchema.safeParse(job).success,true);assert.equal(demoOwnsJob(actor,job.jobId),true);
  assert.match(job.order.orderId,/^TEST-ISOLATED-TRANSPORT-/);assert.match(job.explanation,/NOT model output/);assert.match(job.explanation,/NOT a confirmed operator plan/);
  assert.equal(job.conditions.supervisorConfirmed,false);assert.deepEqual(job.changes,[]);assert.equal(job.savings.inr,0);
  assert.throws(()=>isolatedTransportFixture({...actor},randomUUID()),/Verified isolated/);
  assert.throws(()=>isolatedTransportFixture(actor,'other-project-or-job'),/UUID/);
});
