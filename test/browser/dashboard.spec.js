import {test,expect} from '@playwright/test';
import {RiskPredictionRequestSchema,RiskOptimizationRequestSchema,SimilarRunsRequestSchema,RiskExplanationRequestSchema,FeedbackInputSchema} from '../../src/schemas.js';
import {jobSheetFixture} from '../fixtures/job-sheet.js';

const runId='ec884530-a0df-4428-a5c1-c14149724ef9';
const file='test/fixtures/synthetic_POs/PO1_ClientA_single_B1047.pdf';
const job={...jobSheetFixture,status:'DRAFT',recommended:{...jobSheetFixture.recommended,levers:{...jobSheetFixture.recommended.levers,rollTempC:170}},changes:[{lever:'rollTempC',from:165,to:170,reason:'Model comparison for the supplied inputs.'}]};
const prediction={ok:true,source:'bigquery-ml',isRealModelPrediction:true,...job.baseline.risk,modelAcceptance:{status:'accepted'}};
const optimization={ok:true,source:'bigquery-ml',isRealModelPrediction:true,baseline:job.baseline,best:job.recommended,changes:job.changes,savings:job.savings};
const extraction=(status='MATCHED')=>({ok:true,source:'vertex-gemini',reviewId:runId,reviewFingerprint:'a'.repeat(64),purchaseOrderDocument:{poNumber:'SOURCE-PO',buyer:'QA buyer',deliveryDate:'15-10-2026'},documentMissingFields:[],lines:[{lineIndex:0,sourcePage:1,extractedItemCode:job.order.itemCode,quantity:status==='MISSING_QTY'?undefined:job.order.quantity,status,candidates:status==='AMBIGUOUS'?[job.order.itemCode,'OTHER']:[],orderProfile:job.order}],missingFields:[],needsClarification:status!=='MATCHED'});
const fulfill=(route,body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
async function boot(page,configured=true,hackathon=false){
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  if(configured)await page.route('**/api/status',async route=>{
    const response=await route.fetch();const data=await response.json();
    for(const key of ['extractOrder','currentConditions','predictRisk','optimizeRisk','findSimilarRuns','explainRisk','findSeenBefore','approveJob','getJobCard','saveFeedback','getStoredJobSheet','getImpactSummary','jobCreationAvailable','getApprovedPhotos','classifyApprovedPhoto'])data.integrations[key]=true;
    data.runtimeAvailability.jobCreationAvailable=true;
    if(hackathon)data.authorizationMode='HACKATHON_DEMO';
    await fulfill(route,data);
  });
  if(hackathon){
    await page.route('**/api/auth/config',route=>fulfill(route,{enabled:false,authorizationMode:'HACKATHON_DEMO',demoSessionConfigured:true,approvalNote:'Demonstration approval is not a production supervisor identity.'}));
    await page.route('**/api/auth/demo-session',route=>fulfill(route,{ok:true,authorizationMode:'HACKATHON_DEMO',authenticatedHuman:false}));
  }
  await page.goto('/dashboard?mock=1');await expect(page.locator('#connection-label')).toHaveText('Backend reachable');return errors;
}
const stage=(page,n)=>page.locator(`[data-dashboard-stage="${n}"]`);
async function intake(page,status='MATCHED'){
  await page.locator('#extraction-order-id').fill('DASHBOARD-QA-PO');await page.locator('#extraction-paper-type').selectOption('RECYCLED');await page.locator('#extraction-paper-supplier').fill('SUP-D');await page.locator('#order-pdf').setInputFiles(file);
  await page.route('**/orders/extract',async route=>{
    const r=route.request();const form=await new Request(r.url(),{method:'POST',headers:r.headers(),body:r.postDataBuffer()}).formData();
    expect([...form.keys()].sort()).toEqual(['file','orderId','paperSupplier','paperType']);expect(form.get('orderId')).toBe('DASHBOARD-QA-PO');
    await fulfill(route,extraction(status));
  });
  await page.locator('#review-order').click();await page.getByRole('radio',{name:'Select source PO line 1'}).check();
}
async function confirmInputs(page){
  await page.locator('#confirm-order-line').check();
  await page.locator('#analysis-runDate').fill('2026-10-15');await page.locator('#analysis-shift').selectOption('DAY');
  for(const [id,value] of [['ambientRhPct','86'],['ambientTempC','26'],['paperMoisturePct','10.8']])await page.locator('#analysis-'+id).fill(value);
  for(const [key,value] of Object.entries(job.baseline.levers)){
    const input=page.locator('#analysis-'+key);if(typeof value==='number')await input.fill(String(value));else await input.selectOption(value);
  }
  await page.locator('#conditions-supervisor-confirmed').check();await page.locator('#machine-settings-confirmed').check();
}
async function labelEvidence(page){await page.evaluate(()=>{if(document.getElementById('offline-test-label'))return;const p=document.createElement('p');p.id='offline-test-label';p.className='method-note';p.textContent='OFFLINE BROWSER TEST · injected service fixtures';document.body.prepend(p);});}

test('canonical dashboard resolves aliases, keeps blank inputs and navigates without mock or automatic model calls',async({page,request})=>{
  const calls=[];page.on('request',r=>calls.push(new URL(r.url()).pathname));const errors=await boot(page,false);
  await expect(page.locator('body')).toHaveClass('guided-dashboard');await expect(page.locator('.primary-nav a')).toHaveCount(3);
  await expect(stage(page,1)).toHaveAttribute('aria-current','step');await expect(page.locator('#analysis-sfSpeedMpm')).toHaveValue('');
  await page.locator('#extraction-order-id').fill('KEEP-THIS-INPUT');
  for(const [n,id] of [[2,'screen-production-analysis'],[3,'dashboard-job-review'],[1,'screen-order-input']]){await stage(page,n).click();await expect(page.locator('#'+id)).toBeVisible();await expect(stage(page,n)).toHaveAttribute('aria-current','step');}
  await expect(page.locator('#extraction-order-id')).toHaveValue('KEEP-THIS-INPUT');
  for(const label of ['Defect Check','Impact']){await page.getByRole('link',{name:label,exact:true}).click();await expect(page.locator('.dashboard-stages')).toBeHidden();}
  expect(calls.some(path=>/mock\.js|\/risk\/|\/jobs$|\/conditions\//.test(path))).toBe(false);
  expect(await(await request.get('/')).text()).toContain('class="guided-dashboard"');
  await expect(page).toHaveURL(/\/\?mock=1#/);
  await expect(page.locator('.workspace-switch')).toHaveCount(0);expect(errors).toEqual([]);
});

test('guided dashboard reorganizes all screens at desktop/tablet/mobile sizes without page overflow',async({page})=>{
  await boot(page,false);
  for(const width of [1440,1280,1024,768,390]){
    await page.setViewportSize({width,height:1000});
    await page.getByLabel('Primary navigation').getByRole('link',{name:'New Lot',exact:true}).click();
    for(const n of [1,2,3]){await stage(page,n).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);}
    for(const label of ['Defect Check','Impact']){await page.getByRole('link',{name:label,exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);}
    await page.getByLabel('Primary navigation').getByRole('link',{name:'New Lot',exact:true}).click();
    await expect(page.locator('#screen-order-input')).toBeVisible();
    await page.locator('#screen-order-input').evaluate(async el=>{await Promise.all(el.getAnimations().map(a=>a.finished.catch(()=>{})));});
    if([1440,768,390].includes(width))await page.screenshot({path:`test-results/evidence/shared-dashboard/new-lot-${width}.png`,fullPage:true,animations:'disabled'});
  }
});

test('source review retains ambiguity, quantity and explicit operator confirmations',async({page})=>{
  await boot(page);await intake(page,'AMBIGUOUS');
  await page.locator('[data-role="confirmed-item-code"]').fill('NOT-A-CANDIDATE');await page.locator('#confirm-order-line').click();await expect(page.locator('#confirm-order-line')).not.toBeChecked();
  await page.locator('[data-role="catalog-candidates"]').selectOption(job.order.itemCode);await page.locator('[data-role="confirmed-quantity"]').fill('');await page.locator('#confirm-order-line').click();await expect(page.locator('#prepare-job')).toBeDisabled();
  await page.locator('[data-role="confirmed-quantity"]').fill(String(job.order.quantity));await confirmInputs(page);await expect(page.locator('#prepare-job')).toBeEnabled();
  await page.locator('#analysis-rollTempC').fill('171');await expect(page.locator('#machine-settings-confirmed')).not.toBeChecked();await expect(page.locator('#prepare-job')).toBeDisabled();
});

test('one persisted job request feeds analysis, then explicit review/approval/PDF and schema-correct feedback',async({page})=>{
  const errors=await boot(page);await intake(page);await confirmInputs(page);let creates=0,approvals=0;
  await page.route('**/jobs',async route=>{
    creates++;const r=route.request();expect(r.headers()['idempotency-key']).toBeTruthy();const form=await new Request(r.url(),{method:'POST',headers:r.headers(),body:r.postDataBuffer()}).formData();
    for(const [key,value] of Object.entries({reviewId:runId,reviewFingerprint:'a'.repeat(64),confirmedSourceLine:'true',conditionsConfirmed:'true',confirmedLineIndex:'1',confirmedItemCode:job.order.itemCode}))expect(form.get(key)).toBe(value);
    for(const [key,value] of Object.entries(job.baseline.levers))expect(form.get(key)).toBe(String(value));
    expect(form.has('prediction')).toBe(false);expect(form.has('finalLevers')).toBe(false);
    await fulfill(route,{ok:true,durable:true,runId,jobSheet:job});
  });
  await page.route('**/api/runs/*/events',route=>route.fulfill({contentType:'text/event-stream',body:'event: run.completed\ndata: '+JSON.stringify({id:runId+':1',runId,sequence:1,type:'run.completed'})+'\n\n'}));
  await page.locator('#prepare-job').click();await expect(page.locator('#screen-production-analysis')).toBeVisible();await expect(page.locator('#risk-metrics .risk-row')).toHaveCount(5);await expect(page.locator('#trace-events')).toContainText('Run completed');
  await expect(page.locator('#optimization-settings .setting-change-note')).toHaveText('Changed');expect(creates).toBe(1);
  await stage(page,3).click();await expect(page.locator('#stored-job-preview')).toBeVisible();
  await page.getByText('Manufacturing sequence and settings',{exact:true}).click();await expect(page.locator('.manufacturing-sequence tbody tr')).toHaveCount(9);await expect(page.locator('.manufacturing-sequence')).toContainText('170 °C');await expect(page.locator('.manufacturing-sequence caption')).toContainText('approval required');
  await labelEvidence(page);await page.screenshot({path:'test-results/evidence/shared-dashboard/job-draft-settings-fixture-1440.png',fullPage:true,animations:'disabled'});
  await page.route('**/jobs/*/approve?*',route=>{approvals++;expect(route.request().postData()).toBeNull();const url=new URL(route.request().url());expect(url.searchParams.get('lang')).toBe('en');return fulfill(route,{ok:true,jobSheet:{...job,status:'APPROVED'}});});
  await page.locator('#approval-form button').click();expect(approvals).toBe(0);await expect(page.locator('#approval-dialog')).toBeVisible();await page.locator('#confirm-approval').click();await expect(page.locator('#job-status-badge')).toContainText('APPROVED');expect(approvals).toBe(1);
  await page.route('**/jobs/*/card.pdf?*',route=>route.fulfill({contentType:'application/pdf',body:Buffer.from('%PDF-1.4 offline browser fixture')}));await page.locator('#stored-card-form button').click();await expect(page.locator('#stored-card-link')).toBeVisible();
  await labelEvidence(page);await page.screenshot({path:'test-results/evidence/shared-dashboard/job-card-fixture-1440.png',fullPage:true,animations:'disabled'});
  await page.getByRole('link',{name:'Defect Check',exact:true}).click();await page.locator('#production-feedback > summary').click();await page.locator('#feedback-warp').fill('1.5');
  await page.route('**/jobs/*/feedback',route=>{const data=route.request().postDataJSON();expect(FeedbackInputSchema.safeParse(data).success).toBe(true);expect(data).not.toHaveProperty('actualScrapKg');expect(data).not.toHaveProperty('mainDefect');return fulfill(route,{ok:true,feedback:data});});
  await page.locator('#feedback-form button').click();await expect(page.locator('#feedback-result')).toHaveAttribute('data-state','success');expect(errors).toEqual([]);
});

test('risk, optimizer, evidence and explanation use exact contracts; what-if remains independent and stale-safe',async({page})=>{
  await boot(page);await intake(page);await confirmInputs(page);
  let predictions=0,release;
  await page.route('**/risk/predict',async route=>{predictions++;expect(RiskPredictionRequestSchema.safeParse(route.request().postDataJSON()).success).toBe(true);if(predictions===2)await new Promise(resolve=>release=resolve);await fulfill(route,prediction);});
  await page.route('**/risk/optimize',route=>{expect(RiskOptimizationRequestSchema.safeParse(route.request().postDataJSON()).success).toBe(true);return fulfill(route,optimization);});
  await page.route('**/risk/similar-runs',route=>{expect(SimilarRunsRequestSchema.safeParse(route.request().postDataJSON()).success).toBe(true);return fulfill(route,{ok:true,source:'bigquery',evidence:[{lotId:'QA-LOT',orderId:'QA-ORDER',runDate:'2026-09-01',primaryDefect:'WARP',levers:job.baseline.levers}]});});
  await page.route('**/risk/explanation',route=>{expect(RiskExplanationRequestSchema.safeParse(route.request().postDataJSON()).success).toBe(true);return fulfill(route,{ok:true,source:'bigquery-ml-and-gemini',explanation:'Model attribution for the supplied inputs.',rows:[{defect:'WARP',driver:'ambient_rh_pct',attributionPts:0.4}]});});
  await stage(page,2).click();await page.locator('#request-risk').click();await page.locator('#request-optimization').click();await page.locator('#evidence-disclosure > summary').click();await page.locator('#load-similar-runs').click();await page.locator('#request-risk-explanation').click();await expect(page.locator('#risk-explanation-content')).toContainText('Model attribution');
  await page.locator('#what-if-rescore').click();await expect.poll(()=>typeof release).toBe('function');await stage(page,1).click();await page.locator('#analysis-ambientRhPct').fill('80');release();
  await stage(page,2).click();await expect(page.locator('#what-if-metrics')).toBeHidden();await expect(page.locator('#what-if-controls')).toBeHidden();
});

test('approved-photo and historical-case integrations use supported inputs without image retention or invented counts',async({page})=>{
  await boot(page);await page.getByRole('link',{name:'Defect Check',exact:true}).click();
  await page.route('**/evidence/approved-photos',route=>fulfill(route,{ok:true,photos:Array.from({length:10},(_,i)=>({id:'photo-'+String(i+1).padStart(2,'0'),label:'Approved photo '+(i+1)}))}));
  await page.locator('#di-tab-photo').click();await expect(page.getByText('Approved photo classification',{exact:true})).toBeVisible();
  await page.locator('#load-approved-photos').click();await page.locator('#approved-photo-id').selectOption('photo-01');
  await page.route('**/evidence/classify-photo',route=>{expect(route.request().postDataJSON()).toEqual({photoId:'photo-01'});return fulfill(route,{ok:true,source:'vertex-gemini',isRealModelPrediction:true,photoId:'photo-01',label:'DELAM',classifiedAt:'2026-10-15T00:00:00Z'});});
  await page.locator('#classify-approved-photo').click();await expect(page.locator('#approved-photo-result')).toContainText('DELAM');
  await page.locator('#di-tab-history').click();await page.locator('#evidence-defect').selectOption('DELAM');await page.locator('#evidence-humidity').fill('86');
  await page.route('**/evidence/seen-before',route=>{expect(route.request().postDataJSON()).toEqual({defect:'DELAM',ambientRhPct:86});return fulfill(route,{ok:true,source:'bigquery',defect:'DELAM',caseCount:3,avgRateWhenMain:2,costWhenMain:500,goodRuns:null,badRuns:null,notes:['<img src=x onerror=alert(1)>']});});
  await page.locator('#find-seen-before').click();await expect(page.locator('#seen-before-content')).toContainText('3');await expect(page.locator('#seen-before-content img')).toHaveCount(0);await expect(page.locator('#seen-before-content')).toContainText('<img src=x');
});

test('Impact and currency retain configured authorization/provenance and malformed responses clear prior charts',async({page})=>{
  await boot(page,true,true);await expect(page.locator('#supervisor-auth-status')).toContainText('Temporary demo session active');
  const impact={ok:true,source:'bigquery',kpis:{lotsScored:2,lotsChanged:1,netSavingMonth:10,kgSavedMonth:1,scrapPctBefore:5,scrapPctAfter:4,scrapCostBefore:100,scrapCostAfter:90,currency:'INR'},monthly:[{month:'2026-09',lots:2,scrapCost:100,scrapKg:10,avgScrapPct:5,series:'simulated'}],seasonal:[{season:'Monsoon',warp:2,delam:1,strength:1,print:0.5,crack:0.5}],topItems:[],counterfactual:{month:'2026-09',scrapCost:90,currency:'INR',label:'counterfactual, not observed production'}};
  await page.route('**/impact/summary',route=>fulfill(route,impact));await page.getByRole('link',{name:'Impact',exact:true}).click();await page.locator('#load-impact').click();await expect(page.locator('#impact-content')).toBeVisible();
  await page.route('**/fx?base=INR',route=>fulfill(route,{base:'INR',date:'2026-10-14',source:'static-fallback',rates:{INR:1,JPY:1.7}}));await page.locator('#display-currency').selectOption('JPY');await expect(page.locator('#impact-kpis')).toContainText('≈');await expect(page.locator('#impact-kpis')).toContainText('2026-10-14');
  await labelEvidence(page);await page.screenshot({path:'test-results/evidence/shared-dashboard/impact-fixture-1440.png',fullPage:true,animations:'disabled'});
  await page.route('**/impact/summary',route=>fulfill(route,{ok:true,source:'bigquery',kpis:{}}));await page.locator('#load-impact').click();await expect(page.locator('#impact-content')).toBeHidden();expect(await page.evaluate(()=>!!Chart.getChart(document.getElementById('impact-monthly-chart')))).toBe(false);
});

test('model and approval failures preserve the job and inputs without manufacturing success',async({page})=>{
  await boot(page);await intake(page);await confirmInputs(page);await page.route('**/jobs',route=>fulfill(route,{ok:false,error:{code:'MODEL_ACCEPTANCE_REQUIRED',message:'Model acceptance evidence is incomplete.'}},503));
  await page.locator('#prepare-job').click();await expect(page.locator('#prepare-job-result')).toContainText('Model acceptance');await stage(page,1).click();await expect(page.locator('#analysis-ambientRhPct')).toHaveValue('86');
  await stage(page,3).click();await expect(page.locator('#approval-form button')).toBeDisabled();
  await page.locator('#shared-job-id').fill(job.jobId);await page.route('**/jobs/'+job.jobId,route=>fulfill(route,{ok:true,jobSheet:job}));await page.locator('#load-stored-job-form button').click();
  await page.route('**/jobs/*/approve?*',route=>fulfill(route,{ok:false,error:{code:'CONFLICT',message:'The stored state changed. Reload the job.'}},409));await page.locator('#approval-form button').click();await page.locator('#confirm-approval').click();
  await expect(page.locator('#approval-result')).toContainText('stored state changed');await expect(page.locator('#job-status-badge')).toContainText('DRAFT');await expect(page.locator('#stored-card-form button')).toBeDisabled();
});


test('root, dashboard bookmarks and the old job/Impact links open the same application',async({page})=>{
  await boot(page,false);
  for(const path of ['/dashboard#dashboard-job-review','/dashboard/#screen-job-card-approval','/dasboard#dashboard-job-review']){
    await page.goto(path);await expect(page.locator('#dashboard-job-review')).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/');
    await expect(stage(page,3)).toHaveAttribute('aria-current','step');
  }
  await page.goto('/impact');await expect(page.locator('#screen-impact')).toBeVisible();expect(new URL(page.url()).pathname).toBe('/');
  await page.goto('/#screen-production-analysis');await expect(page.locator('#screen-production-analysis')).toBeVisible();
  await page.getByRole('link',{name:'Review job card',exact:false}).click();await expect(page.locator('#dashboard-job-review')).toBeVisible();
});
