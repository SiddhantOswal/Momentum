import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createApprovedPhotoService,PhotoClassificationRequestSchema} from '../src/google-cloud/approved-photo-service.js';
import {withDailyGeminiCallCap,readDailyGeminiCallCapConfig} from '../src/daily-gemini-call-cap.js';
import {createConfiguredServicePorts} from '../src/service-ports.js';

// Isolated storage/Gemini doubles. The JPEG is a test fixture, not photo evidence.
const jpeg=new Uint8Array(readFileSync(new URL('./fixtures/synthetic_POs/PO5_ClientB_scanned.jpg',import.meta.url)));
function setup({bytes=jpeg,corrupt=false,changedBefore=false,changedAfter=false,label='NONE',meterUnavailable=false}={}){
 const hash=createHash('sha256').update(bytes).digest('hex');let calls=0,reads=0;
 const inventory={bucket:'prepagent-hack-data',photos:Array.from({length:10},(_,i)=>({id:'photo-'+String(i+1).padStart(2,'0'),name:'photos/photos/good/good_'+String(i+1).padStart(3,'0')+'.jpg',generation:'1',size:bytes.length,sha256:hash,expectedLabel:'NONE'}))};
 const provider={generateJson:async(args)=>{calls++;assert.equal(args.prompt.includes('expectedLabel'),false);args.onUsage?.({promptTokenCount:100,candidatesTokenCount:5});return {label};},generateContent:async()=>assert.fail('Unexpected provider method')};
 const gemini=meterUnavailable?withDailyGeminiCallCap(provider,readDailyGeminiCallCapConfig({}),{store:{scope:'shared-firestore-transaction',reserveAttempt:async()=>{throw Object.assign(new Error('outage'),{code:'GEMINI_USAGE_UNAVAILABLE'});}}}):provider;
 const service=createApprovedPhotoService({inventory,gemini,model:'test-provider-double',storage:{getMetadata:async({name})=>{reads++;return{name,generation:changedBefore||changedAfter&&reads>1?'2':'1',size:bytes.length,contentType:'image/jpeg'};},download:async({name,generation})=>{assert.equal(generation,'1');return{name,contentType:'image/jpeg',bytes:corrupt?new Uint8Array([1]):bytes};}}});
 return{service,get calls(){return calls;},get reads(){return reads;}};
}
test('approved photo listing is generic and never exposes paths, ground-truth labels or image bytes',async()=>{
 const c=setup();const response=await c.service.list();assert.equal(response.photos.length,10);assert.equal(c.calls,0);assert.doesNotMatch(JSON.stringify(response),/gs:\/\/|expectedLabel|photos\/photos|generation/);
});
test('unknown IDs and arbitrary URI/provenance fields fail closed before paid calls',async()=>{
 const c=setup();assert.equal((await c.service.classify({photoId:'photo-99'})).ok,false);assert.equal(c.calls,0);assert.equal(c.reads,0);
 assert.equal(PhotoClassificationRequestSchema.safeParse({photoId:'photo-01',fileUri:'gs://elsewhere/file.jpg'}).success,false);
});
test('generation, content hash and JPEG structure are checked before classification',async()=>{
 for(const options of [{changedBefore:true},{corrupt:true},{bytes:new Uint8Array([1,2,3])}]){const c=setup(options);assert.equal((await c.service.classify({photoId:'photo-01'})).ok,false);assert.equal(c.calls,0);}
});
test('one metered classification returns only validated actual label and honest provenance',async()=>{
 const c=setup({label:'CRACK'});const r=await c.service.classify({photoId:'photo-01'});assert.equal(r.ok,true);assert.equal(r.label,'CRACK');assert.equal(c.calls,1);assert.equal(c.reads,2);assert.match(r.provenance,/not simulated/);assert.equal(r.modelUsage.promptTokenCount,100);assert.equal(r.expectedLabel,undefined);assert.equal(r.confidence,undefined);
});
test('unsupported output and a changed object after inference never produce success or retries',async()=>{
 for(const options of [{label:'OTHER'},{changedAfter:true}]){const c=setup(options);assert.equal((await c.service.classify({photoId:'photo-01'})).ok,false);assert.equal(c.calls,1);}
});
test('counter outage blocks the provider and no per-process fallback exists in hackathon mode',async()=>{
 const c=setup({meterUnavailable:true});const r=await c.service.classify({photoId:'photo-01'});assert.equal(r.ok,false);assert.equal(c.calls,0);assert.equal(r.error.code,'SERVICE_UNAVAILABLE');
 const env={PROJECT_ID:'prepagent-hack',BUCKET:'prepagent-hack-data',USTAAD_AUTHORIZATION_MODE:'HACKATHON_DEMO',USTAAD_SYNTHETIC_ONLY:'true',USTAAD_ENABLE_APPROVED_PHOTO_CLASSIFICATION:'true',USTAAD_ENABLE_LIVE_MODEL_CALLS:'true'};
 const ports=createConfiguredServicePorts({env,modelConfig:{modelCallsEnabled:true,testModel:'test',location:'asia-south1'}});assert.equal(ports.availability.classifyApprovedPhoto,false);
});
