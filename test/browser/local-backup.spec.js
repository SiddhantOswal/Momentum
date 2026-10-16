import {test,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
let server;
let base;
test.beforeAll(async()=>{
 const listener=createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));base='http://127.0.0.1:'+port;
 server=spawn(process.execPath,['index.mjs'],{env:{...process.env,PORT:String(port),K_SERVICE:'',USTAAD_ENABLE_DEMO_MODE:'true',USTAAD_AUTHORIZATION_MODE:'',USTAAD_ENABLE_FIREBASE_AUTH:'false',USTAAD_ENABLE_LIVE_MODEL_CALLS:'false',USTAAD_PLANT_ID:'PLANT-DEMO-01'},stdio:'ignore'});
 for(let n=0;n<80;n++){try{if((await fetch(base+'/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}
 throw Error('Local backup failed to start');
});
test.afterAll(async()=>{if(server && server.exitCode===null && server.signalCode===null){await Promise.race([new Promise(r=>{server.once('exit',r);server.kill('SIGTERM');}),new Promise(r=>setTimeout(r,2000))]);}});
test('real local backup UI uses its actual local adapters through draft, approval, PDF, feedback and Impact',async({page,request},testInfo)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await expect(page.locator('#local-synthetic-demo-note')).toContainText('not live Gemini');
 await page.locator('#order-pdf').setInputFiles('test/fixtures/synthetic_POs/PO1_ClientA_single_B1047.pdf');
 await page.locator('#extraction-order-id').fill('TEST-LOCAL-42');await page.locator('#extraction-paper-type').selectOption('VIRGIN');await page.locator('#extraction-paper-supplier').fill('SUPPLIER-TEST');
 await page.locator('#review-order').click();await expect(page.locator('.po-line-review__item')).toHaveCount(1);
 await page.getByRole('radio',{name:'Select source PO line 1'}).check();await page.locator('#confirm-order-line').check();
 for(const[name,value]of Object.entries({runDate:'2026-10-11',ambientRhPct:'50',ambientTempC:'28',paperMoisturePct:'9',sfSpeedMpm:'40',rollTempC:'165',gumViscositySec:'40',dryingHours:'6',printSpeedSpm:'50'}))await page.locator('#analysis-'+name).fill(value);
 for(const[name,value]of Object.entries({shift:'DAY',gumApplication:'MED',pastingPressure:'MED'}))await page.locator('#analysis-'+name).selectOption(value);
 await page.locator('#conditions-supervisor-confirmed').check();await page.locator('#machine-settings-confirmed').check();
 await expect(page.locator('#prepare-job')).toBeEnabled();const creation=page.waitForResponse(r=>r.url()===base+'/jobs'&&r.request().method()==='POST');await page.locator('#prepare-job').click();const created=await(await creation).json();expect(created.durable).toBe(false);expect(created.storageScope).toBe('process-memory');
 await expect(page.locator('#risk-metrics .risk-row')).toHaveCount(5);
 const jobId=await page.locator('#shared-job-id').inputValue();const draft=await(await request.get(base+'/jobs/'+jobId)).json();expect(draft.jobSheet.status).toBe('DRAFT');
 await page.locator('[data-dashboard-stage="3"]').click();await page.locator('#approval-form button[type=submit]').click();await page.locator('#confirm-approval').click();await expect(page.locator('#job-status-badge')).toContainText('APPROVED');
 const first=await(await request.post(base+'/jobs/'+jobId+'/approve')).json();const second=await(await request.post(base+'/jobs/'+jobId+'/approve')).json();expect(second.approvedAt).toBe(first.approvedAt);expect(second.jobSheet.cardUri).toMatch(/^local-demo:/);
 await page.locator('#stored-card-form button[type=submit]').click();await expect(page.locator('#stored-card-link')).toBeVisible();
 const pdf=await request.get(base+'/jobs/'+jobId+'/card.pdf');expect(pdf.status()).toBe(200);expect((await pdf.body()).subarray(0,5).toString()).toBe('%PDF-');
 await testInfo.attach('local-synthetic-card',{body:await pdf.body(),contentType:'application/pdf'});
 await page.getByRole('link',{name:'Defect Check',exact:true}).click();await page.locator('#production-feedback > summary').click();
 await page.locator('#feedback-warp').fill('2');await page.locator('#feedback-note').fill('LOCAL MOCK BACKUP feedback, not factory outcomes');
 const feedback=page.waitForResponse(r=>r.url().endsWith('/feedback')&&r.request().method()==='POST');await page.locator('#feedback-form button[type=submit]').click();const saved=await(await feedback).json();expect(saved.ok).toBe(true);
 await page.reload();await expect(page.locator('#local-synthetic-demo-note')).toBeVisible();await page.getByRole('link',{name:'New Lot',exact:true}).click();await page.locator('[data-dashboard-stage="3"]').click();await page.locator('#shared-job-id').fill(jobId);await page.locator('#load-stored-job-form button[type=submit]').click();await expect(page.locator('#job-status-badge')).toContainText('APPROVED');
 await testInfo.attach('local-approved-ui',{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
 await page.getByRole('link',{name:'Impact',exact:true}).click();await page.locator('#load-impact').click();await expect(page.locator('#impact-content')).toBeVisible();await expect(page.locator('#impact-coverage')).toContainText('LOCAL MOCK BACKUP');
 expect(errors).toEqual([]);
});
