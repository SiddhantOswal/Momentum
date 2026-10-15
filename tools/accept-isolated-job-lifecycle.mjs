import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { createHackathonDemoAuthenticator, demoJobIdentity, isDemoPrincipal } from '../src/hackathon-demo-auth.js';
import { createBigQueryReadClient } from '../src/google-cloud/bigquery-read-client.js';
import { createBigQueryWriteClient } from '../src/google-cloud/bigquery-write-client.js';
import { createJobSheetRepository } from '../src/google-cloud/job-sheet-repository.js';
import { createCloudStorageClient } from '../src/google-cloud/storage-client.js';
import { createJobCardService } from '../src/google-cloud/job-card-service.js';
import { renderJobSheetPdf } from '../src/job-sheet-pdf.js';
import { JobSheetSchema } from '../src/schemas.js';
import { jobSheetFixture } from '../test/fixtures/job-sheet.js';

const PROJECT='prepagent-hack', BUCKET='prepagent-hack-data';
const sha = value => createHash('sha256').update(value).digest('hex');
export function isolatedTransportFixture(principal, nonce) {
  if (!isDemoPrincipal(principal) || !/^[a-f0-9-]{36}$/.test(nonce)) throw new Error('Verified isolated demo principal and UUID required.');
  const identity=demoJobIdentity(principal,{keyHash:sha('ISOLATED-TRANSPORT-'+nonce)});
  return JobSheetSchema.parse({ ...structuredClone(jobSheetFixture), jobId:identity.jobId, plantId:'PLANT-01',
    order:{...jobSheetFixture.order,orderId:'TEST-ISOLATED-TRANSPORT-'+nonce,customerId:'TEST-ISOLATED-NOT-PRODUCTION'},
    conditions:{...jobSheetFixture.conditions,conditionSource:'manual-entry',supervisorConfirmed:false}, changes:[],evidence:[],
    explanation:'ISOLATED TRANSPORT CONTRACT TEST. Synthetic renderer-test values only. NOT model output, NOT a production recommendation, NOT a confirmed operator plan. D4 remains BLOCKED. Actor is an ephemeral locally server-issued demo session verified by the acceptance harness, not a Cloud Run browser session or authenticated human.',
    savings:{kg:0,inr:0},status:'DRAFT' });
}
export const isolatedPlan = Object.freeze({project:PROJECT,table:'prepagent.job_sheets',bucket:BUCKET,
  scope:'One explicitly labelled synthetic TEST transport fixture through existing repository/card adapters; not application model acceptance',
  newGeminiCalls:0,newEvaluations:0,newCloudConfiguration:0,maximumQueryJobs:24,maximumBytesPerQuery:52428800,
  maximumStorageUploads:2,retention:'Retain the one audited TEST row and referenced PDF; delete only the own generation-pinned disposable probe',
  credentials:'Existing approved operator CLI identity; does not prove Cloud Run runtime-SA write access'});

async function execute(evidenceFile) {
  const evidence={startedAt:new Date().toISOString(),plan:isolatedPlan,status:'RUNNING',checks:[],operations:[]};
  writeFileSync(evidenceFile,JSON.stringify(evidence,null,2)+'\n',{flag:'wx',mode:0o600});
  const save=()=>writeFileSync(evidenceFile,JSON.stringify(evidence,null,2)+'\n',{mode:0o600});
  const check=(name,pass)=>{evidence.checks.push({name,pass,at:new Date().toISOString()});save();if(!pass)throw Error(name);};
  const sdk='/Users/siddhant/prepagent-work/google-cloud-sdk/bin/gcloud';
  const project=JSON.parse(execFileSync(sdk,['projects','describe',PROJECT,'--format=json(projectId,projectNumber)'],{encoding:'utf8'}));
  check('exact authorized project',project.projectId===PROJECT&&project.projectNumber==='514663464609');
  const configBytes=readFileSync(new URL('../config/model-acceptance.json',import.meta.url));
  check('application gate remains blocked',JSON.parse(configBytes).status==='blocked');
  const accessToken=execFileSync(sdk,['auth','print-access-token'],{encoding:'utf8'}).trim();
  const auth=createHackathonDemoAuthenticator({mode:'HACKATHON_DEMO',signingKey:randomBytes(32).toString('hex'),syntheticOnly:true,auditEnabled:true});
  const principal=auth.authenticate(auth.issue()).principal;
  const job=isolatedTransportFixture(principal,randomUUID());evidence.jobId=job.jobId;evidence.testOrderId=job.order.orderId;
  evidence.actor={kind:'locally-issued isolated harness demo session',authenticatedHuman:false,uid:principal.uid};save();
  let queries=0,uploads=0;
  const trackedFetch=async(url,options={})=>{
    const parsed=new URL(url),method=options.method??'GET';
    if(!['bigquery.googleapis.com','storage.googleapis.com'].includes(parsed.hostname))throw Error('Unexpected service forbidden.');
    if(parsed.hostname==='bigquery.googleapis.com'&&method==='POST'){
      const body=JSON.parse(options.body);
      if(++queries>24||Number(body.maximumBytesBilled)>52428800||!body.query.includes('prepagent.job_sheets')||/ML\./i.test(body.query)||
        !body.queryParameters?.some(p=>p.name==='jobId'&&p.parameterValue.value===job.jobId))throw Error('Isolated query scope exceeded.');
    }
    if(parsed.pathname.startsWith('/upload/')&&++uploads>2)throw Error('Isolated upload scope exceeded.');
    const start=Date.now();const response=await fetch(url,{...options,signal:options.signal ? AbortSignal.any([options.signal,AbortSignal.timeout(60000)]) : AbortSignal.timeout(60000)});let payload;
    if(parsed.hostname==='bigquery.googleapis.com'){try{payload=await response.clone().json();}catch{}}
    evidence.operations.push({at:new Date().toISOString(),host:parsed.hostname,method,path:parsed.pathname,status:response.status,durationMs:Date.now()-start,
      ...(payload?.jobReference?{jobReference:payload.jobReference,totalBytesProcessed:payload.totalBytesProcessed??null,numDmlAffectedRows:payload.numDmlAffectedRows??null}:{}),
      ...(parsed.hostname==='bigquery.googleapis.com'&&method==='POST'?{querySha256:sha(JSON.parse(options.body).query)}:{})});save();return response;
  };
  const options={projectId:PROJECT,tokenProvider:async()=>accessToken,fetchImpl:trackedFetch};
  const bigquery=createBigQueryReadClient(options), writer=createBigQueryWriteClient({...options,requireApprovalAudit:true});
  const repository=()=>createJobSheetRepository({bigquery,writer,projectId:PROJECT,approvalAuditEnabled:true});
  const storage=createCloudStorageClient({bucket:BUCKET,tokenProvider:options.tokenProvider,fetchImpl:trackedFetch});
  const card=()=>createJobCardService({repository:repository(),storage,renderPdf:renderJobSheetPdf,bucket:BUCKET,requireApprovalAudit:true});
  try{
    const absent=await repository().get(job.jobId);check('new unique job absent before write',absent===undefined);
    const draft=await repository().createDraft({jobSheet:job,plantId:'PLANT-01',savingsCost:0});check('real DRAFT write and required read-back',draft.status==='DRAFT');
    const independent=await repository().get(job.jobId);check('fresh repository independent DRAFT read',independent.status==='DRAFT'&&independent.explanation===job.explanation);
    evidence.draft=independent;save();
    const replay=await repository().createDraft({jobSheet:job,plantId:'PLANT-01',savingsCost:0});check('repeat same draft preserves creation timestamp',replay.createdAt===draft.createdAt);
    let conflict=false;try{await repository().createDraft({jobSheet:{...job,explanation:job.explanation+' CONFLICT'},plantId:'PLANT-01',savingsCost:0});}catch(error){conflict=error.code==='JOB_SHEET_WRITE_UNCONFIRMED';}
    check('altered-payload draft cannot report success',conflict);
    const approval=await card().approveJob({jobId:job.jobId,supervisorPrincipal:principal,correlationId:randomUUID()});
    check('real adapter approval succeeded',approval.ok===true);evidence.approval=approval;save();
    const saved=await repository().get(job.jobId);
    check('independent approved state/audit identity read-back',saved.status==='APPROVED'&&saved.approvalAudit.actorUid===principal.uid&&saved.approvalAudit.authenticatedHuman===false&&saved.approvalAudit.cardUri===saved.cardUri);
    evidence.independentApproved=saved;save();
    const repeated=await card().approveJob({jobId:job.jobId,supervisorPrincipal:principal,correlationId:randomUUID()});
    check('repeated approval preserves decision and PDF URI',repeated.ok&&repeated.cardUri===saved.cardUri&&isDeepStrictEqual(repeated.jobSheet.approvalAudit,saved.approvalAudit));
    const other=auth.authenticate(auth.issue()).principal;
    const denied=await card().getJobCard({jobId:job.jobId,supervisorPrincipal:other});check('other legitimate demo session denied before object access',denied.ok===false&&denied.error.code==='SUPERVISOR_AUTHORIZATION_REQUIRED');
    const file=await card().getJobCard({jobId:job.jobId,supervisorPrincipal:principal});check('real supported card adapter retrieval',file.ok&&file.contentType==='application/pdf');
    const objectName=saved.cardUri.slice(('gs://'+BUCKET+'/').length);
    const metadata=await storage.getMetadata({name:objectName});const downloaded=await storage.download({name:objectName,generation:metadata.generation});
    check('independent pinned-generation PDF matches returned bytes',sha(downloaded.bytes)===sha(file.bytes));
    const pdfFile=evidenceFile.replace(/\.json$/,'.pdf');writeFileSync(pdfFile,file.bytes,{flag:'wx',mode:0o600});
    evidence.pdf={uri:saved.cardUri,generation:metadata.generation,bytes:file.bytes.byteLength,sha256:sha(file.bytes),localFile:pdfFile};save();
    const probe=await storage.upload({name:'jobcards/TEST-ISOLATED-PROBE-'+randomUUID()+'.pdf',contentType:'application/pdf',bytes:file.bytes});
    await storage.delete({name:probe.name,generation:probe.generation});let missing=false;try{await storage.download({name:probe.name,generation:probe.generation});}catch{missing=evidence.operations.at(-1)?.status===404;}
    check('own generation-pinned disposable PDF cleanup independently confirmed',missing);evidence.deletedProbe={name:probe.name,generation:probe.generation};
    check('active model configuration unchanged',readFileSync(new URL('../config/model-acceptance.json',import.meta.url)).equals(configBytes));
    evidence.status='PASS_ISOLATED_ADAPTER_TRANSPORT_ONLY';
  }catch(error){evidence.status='FAIL_RETAIN_RECOVERY_EVIDENCE';evidence.error={name:error.name,code:error.code??null,message:error.message};process.exitCode=1;}
  evidence.finishedAt=new Date().toISOString();evidence.queryJobs=queries;evidence.storageUploads=uploads;save();
  console.log(JSON.stringify({status:evidence.status,jobId:job.jobId,checks:evidence.checks.length,queryJobs:queries,providerCalls:0}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const args=process.argv.slice(2);
  if(args.length===0)console.log(JSON.stringify(isolatedPlan,null,2));
  else if(args.length===3&&args[0]==='--execute'&&args[1]==='--evidence'&&args[2].endsWith('.json'))await execute(args[2]);
  else{console.error('Default is plan-only. Authorized execution: --execute --evidence NEW_FILE.json');process.exitCode=2;}
}
