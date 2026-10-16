import { test, expect } from '@playwright/test';
import { RiskExplanationRequestSchema, RiskOptimizationRequestSchema, RiskPredictionRequestSchema } from '../../src/schemas.js';
import { jobSheetFixture } from '../fixtures/job-sheet.js';

const sample = 'test/fixtures/synthetic_POs/PO1_ClientA_single_B1047.pdf';
const runId = 'ec884530-a0df-4428-a5c1-c14149724ef9';
const job = { ...jobSheetFixture, status: 'DRAFT' };
const levers = { ...job.baseline.levers };
const prediction = { ok: true, source: 'bigquery-ml', isRealModelPrediction: true, ...job.baseline.risk, modelAcceptance: { status: 'accepted' } };
const optimization = { ok: true, source: 'bigquery-ml', isRealModelPrediction: true, baseline: job.baseline, best: job.recommended, changes: job.changes, savings: job.savings, planBaselineLabel: 'Supervisor-planned settings' };
const impact = { ok: true, source: 'bigquery', kpis: { lotsScored: 219, lotsChanged: 207, netSavingMonth: 7320, kgSavedMonth: 138, scrapPctBefore: 7.06, scrapPctAfter: 6.39, scrapCostBefore: 78774, scrapCostAfter: 71434, currency: 'INR' }, monthly: [{ month: '2026-08', lots: 200, scrapCost: 80000, scrapKg: 1500, avgScrapPct: 7.2, series: 'simulated' }, { month: '2026-09', lots: 219, scrapCost: 78776, scrapKg: 1478, avgScrapPct: 7.06, series: 'simulated' }], seasonal: [{ season: 'Monsoon', warp: 2.2, delam: 1.4, strength: 1.3, print: .7, crack: .4 }], topItems: [{ label: 'Item 1', lots: 42, avgScrapPct: 7.1, scrapCost12m: 15000, mainDefect: 'WARP' }], counterfactual: { month: '2026-09', scrapCost: 71454, currency: 'INR', label: 'September 2026 with agent settings (counterfactual, not observed production)' } };

async function fulfill(route, body, status = 200) { await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }); }
async function boot(page, configured = false, hackathon = false) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1') return route.abort();
    return route.continue();
  });
  if (hackathon) {
    await page.route('**/api/auth/config', route => fulfill(route, {
      enabled: false, authorizationMode: 'HACKATHON_DEMO', demoSessionConfigured: true,
      approvalNote: 'Hackathon Demonstration Mode: Supervisor approval is available to all participants for demonstration purposes. In production, approval is restricted to authorised supervisors.'
    }));
    await page.route('**/api/auth/demo-session', route => fulfill(route, {ok:true, authorizationMode:'HACKATHON_DEMO', authenticatedHuman:false}));
  }
  if (configured) {
    await page.route('**/api/status', async (route) => {
      const r = await route.fetch(); const status = await r.json();
      if (hackathon) { status.authorizationMode = "HACKATHON_DEMO"; status.demoSessionConfigured = true; }
      for (const key of ['extractOrder', 'currentConditions', 'predictRisk', 'optimizeRisk', 'findSimilarRuns', 'explainRisk', 'findSeenBefore', 'approveJob', 'getJobCard', 'saveFeedback', 'getStoredJobSheet', 'getImpactSummary', 'jobCreationAvailable']) status.integrations[key] = true;
      status.runtimeAvailability.jobCreationAvailable = true;
      await fulfill(route, status);
    });
  }
  await page.goto('/');
  await expect(page.locator('#connection-label')).toHaveText('Backend reachable');
  return errors;
}
async function navigate(page,label) {
  if (label === 'Production analysis') {
    await page.getByLabel('Primary navigation').getByRole('link',{name:'New Lot',exact:true}).click();
    await page.locator('[data-dashboard-stage="2"]').click();
    await expect(page.locator('#screen-analysis-heading')).toBeFocused();
  } else await page.getByLabel('Primary navigation').getByRole('link',{name:label,exact:true}).click();
}
async function fillInputs(page) {
  await page.locator('#production-setup').evaluate(el => { el.open = true; });
  await page.locator('#analysis-runDate').fill('2026-10-15');
  await page.locator('#analysis-shift').selectOption('DAY');
  await page.locator('#analysis-ambientRhPct').fill('86');
  await page.locator('#analysis-ambientTempC').fill('26');
  await page.locator('#analysis-paperMoisturePct').fill('10.8');
  for (const [key,value] of Object.entries(levers)) {
    const input = page.locator('#analysis-' + key);
    if (typeof value === 'number') await input.fill(String(value)); else await input.selectOption(value);
  }
  await page.locator('#conditions-supervisor-confirmed').check();
  await page.locator('#machine-settings-confirmed').check();
}
async function sourceContext(page) {
  await page.locator('#extraction-order-id').fill('TEST-BROWSER-PO');
  await page.locator('#extraction-paper-type').selectOption('RECYCLED');
  await page.locator('#extraction-paper-supplier').fill('SUP-D');
  await page.locator('#order-pdf').setInputFiles(sample);
}
const extraction = (status = 'MATCHED') => ({ ok: true, source: 'vertex-gemini', isRealModelPrediction: false, reviewId: runId, reviewFingerprint: 'a'.repeat(64), purchaseOrderDocument: { poNumber: 'QA-1', buyer: 'Synthetic test buyer', deliveryDate: '15-10-2026' }, documentMissingFields: [], lines: [{ lineIndex: 0, sourcePage: 1, extractedItemCode: status === 'UNKNOWN_CODE' ? 'UNKNOWN' : job.order.itemCode, quantity: status === 'MISSING_QTY' ? undefined : job.order.quantity, status, candidates: status === 'AMBIGUOUS' ? [job.order.itemCode, 'OTHER'] : [], orderProfile: job.order }], missingFields: [], needsClarification: status !== 'MATCHED' });

test('real offline startup, all navigation, dialogs, keyboard, files and unavailable states', async ({ page }) => {
  const errors = await boot(page);
  await expect(page).toHaveTitle('New lot · Ustaad AI');
  await expect(page.locator('#prepare-job')).toBeDisabled();
  await page.locator('#review-order').click();
  await expect(page.locator('#upload-result')).toContainText('Select a PDF or JPEG');
  await page.locator('#order-pdf').setInputFiles({ name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from('invalid') });
  await expect(page.locator('#upload-result')).toContainText('Select a PDF or JPEG');
  await page.locator('#order-pdf').setInputFiles({ name: 'empty.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(0) });
  await expect(page.locator('#upload-result')).toContainText('10 MiB');
  await expect(page.locator('#sample-order')).toHaveCount(0);
  await page.locator('#order-pdf').setInputFiles(sample);
  await expect(page.locator('#selected-file-name')).toContainText('PO1_ClientA');
  await page.locator('#open-status').click();
  await expect(page.locator('#status-dialog')).toBeVisible();
  await expect(page.locator('#backend-availability')).toHaveText('Reachable');
  await page.keyboard.press('Escape');
  await expect(page.locator('#open-status')).toBeFocused();
  await page.locator('#open-session').click();
  await expect(page.locator('#session-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  for (const [label, id] of [['Production analysis', 'screen-production-analysis'], ['Defect Check', 'screen-defect-check'], ['Impact', 'screen-impact'], ['New Lot', 'screen-order-input']]) {
    await navigate(page,label);
    await expect(page.locator('#' + id)).toBeVisible();
  }
  await page.getByRole('link', { name: 'Impact', exact: true }).click();
  await expect(page.locator('#load-impact')).toBeDisabled();
  await expect(page.locator('#impact-content')).toBeHidden();
  await page.screenshot({ path: 'docs/evidence/frontend/impact-unavailable-1440.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('responsive real offline screens have no page overflow at every requested width', async ({ page }) => {
  await boot(page);
  for (const width of [1440, 1280, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [label,id] of [['New Lot','screen-order-input'],['Production analysis','screen-production-analysis'],['Defect Check','screen-defect-check'],['Impact','screen-impact']]) {
      await navigate(page,label);
      await expect(page.locator('#'+id)).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      expect(overflow, label+' at '+width).toBeLessThanOrEqual(1);
      if ((width === 1440 || width === 768 || width === 390) && label === 'New Lot') await page.screenshot({ path: `docs/evidence/frontend/new-lot-${width}.png`, fullPage: true });
    }
  }
});

test('review source, block unknown and ambiguous codes, require quantity and confirmations', async ({ page }) => {
  await boot(page, true); await sourceContext(page);
  let state = 'UNKNOWN_CODE'; await page.route('**/orders/extract', (route) => fulfill(route, extraction(state)));
  await page.locator('#review-order').click();
  await page.getByRole('radio', { name: 'Select source PO line 1' }).check();
  await page.locator('#confirm-order-line').click();
  await expect(page.locator('#confirm-order-line')).not.toBeChecked();
  await expect(page.locator('#prepare-job')).toBeDisabled();
  state = 'AMBIGUOUS'; await page.locator('#review-order').click();
  await page.getByRole('radio', { name: 'Select source PO line 1' }).check();
  await page.locator('[data-role="confirmed-item-code"]').fill('NOT-A-CANDIDATE');
  await page.locator('#confirm-order-line').click();
  await expect(page.locator('#confirm-order-line')).not.toBeChecked();
  await page.locator('[data-role="catalog-candidates"]').selectOption(job.order.itemCode);
  await page.locator('[data-role="confirmed-quantity"]').fill('');
  await page.locator('#confirm-order-line').click(); await expect(page.locator('#confirm-order-line')).not.toBeChecked();
  await page.locator('[data-role="confirmed-quantity"]').fill('1300');
  await page.locator('#confirm-order-line').click();
  await expect(page.locator('#analysis-itemCode')).toHaveValue(job.order.itemCode);
  await expect(page.locator('#production-setup')).toHaveAttribute('open','');
  await fillInputs(page);
  await expect(page.locator('#prepare-job')).toBeEnabled();
  await page.locator('#analysis-rollTempC').fill('169');
  await expect(page.locator('#machine-settings-confirmed')).not.toBeChecked();
  await expect(page.locator('#prepare-job')).toBeDisabled();
  await page.locator('#order-pdf').setInputFiles('test/fixtures/synthetic_POs/PO2_ClientA_multiline.pdf');
  await expect(page.locator('#purchase-order-review')).toBeHidden();
});

test('contract-correct planning, actual trace events, stored review, approval and PDF', async ({ page }) => {
  const errors = await boot(page, true); await sourceContext(page);
  await page.route('**/orders/extract', (route) => fulfill(route, extraction()));
  await page.locator('#review-order').click();
  await page.getByRole('radio', { name: 'Select source PO line 1' }).check(); await page.locator('#confirm-order-line').check(); await fillInputs(page);
  let submitted;
  await page.route('**/jobs', async (route) => { submitted = route.request(); await fulfill(route, { ok: true, durable: true, runId, jobSheet: job }); });
  await page.route('**/api/runs/*/events', (route) => route.fulfill({ contentType: 'text/event-stream', body: 'event: run.completed\ndata: '+JSON.stringify({id:runId+':1',runId,sequence:1,type:'run.completed'})+'\n\n' }));
  await page.locator('#prepare-job').click();
  await expect(page.locator('#screen-production-analysis')).toBeVisible();
  await expect(page.locator('#stored-job-preview')).toBeHidden();
  expect(submitted.headers()['idempotency-key']).toBeTruthy();
  const body = submitted.postData(); for (const key of ['reviewId','reviewFingerprint','confirmedSourceLine','conditionsConfirmed','sfSpeedMpm','confirmedLineIndex']) expect(body).toContain(key);
  await expect(page.locator('#trace-events')).toContainText('Run completed');
  await expect(page.locator('#optimization-settings table').first()).toBeVisible();
  await expect(page.locator('#optimization-settings')).toContainText('Predicted outcome');
  await expect(page.locator('#risk-metrics .risk-row')).toHaveCount(5);
  await page.locator('[data-dashboard-stage="3"]').click();
  await expect(page.locator('#stored-job-preview')).toBeVisible();
  let approvals=0; await page.route('**/jobs/*/approve?*', (route) => { approvals++; return fulfill(route,{ok:true,jobSheet:{...job,status:'APPROVED'}}); });
  await page.locator('#approval-form button').click();
  expect(approvals).toBe(0); await expect(page.locator('#approval-dialog')).toBeVisible();
  await page.locator('#confirm-approval').click(); await expect(page.locator('#job-status-badge')).toContainText('APPROVED');
  await page.route('**/jobs/*/card.pdf?*', (route) => route.fulfill({contentType:'application/pdf',body:Buffer.from('%PDF-1.4 local offline fixture')}));
  await page.locator('#stored-card-form button').click(); await expect(page.locator('#stored-card-link')).toBeVisible();
  await page.evaluate(() => { const p=document.createElement('p');p.textContent='OFFLINE BROWSER TEST · injected service fixtures';p.style.cssText='padding:12px;color:#e0c08c';document.body.prepend(p); });
  await page.screenshot({path:'docs/evidence/frontend/agent-run-fixture-1440.png',fullPage:true});
  await page.getByRole('link',{name:'Defect Check',exact:true}).click();
  await page.locator('#production-feedback > summary').click();
  await page.locator('#feedback-warp').fill('1.5');
  await page.route('**/jobs/*/feedback', async (route)=>{const data=route.request().postDataJSON();expect(data.rateWarpPct).toBe(1.5);expect(data).not.toHaveProperty('rateDelamPct');await fulfill(route,{ok:true,feedback:{jobId:job.jobId}});});
  await page.locator('#feedback-form button').click(); await expect(page.locator('#feedback-result')).toHaveAttribute('data-state','success');
  for (const width of [1280, 1024, 768, 390]) {
    await page.setViewportSize({width,height:1000});
    await navigate(page,'Production analysis');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
    if(width===768) await page.screenshot({path:'docs/evidence/frontend/agent-run-fixture-768.png',fullPage:true});
  }
  expect(errors).toEqual([]);
});

test('real request shapes for direct risk and what-if; inputs invalidate a slow scenario', async ({ page }) => {
  await boot(page,true); await sourceContext(page); await page.route('**/orders/extract',(route)=>fulfill(route,extraction()));
  await page.locator('#review-order').click(); await page.getByRole('radio',{name:'Select source PO line 1'}).check();await page.locator('#confirm-order-line').check();await fillInputs(page);
  let requests=[]; let release;
  await page.route('**/risk/predict',async route=>{requests.push(route.request().postDataJSON());if(requests.length===2) await new Promise(r=>release=r);await fulfill(route,prediction);});
  await navigate(page,'Production analysis');await page.locator('#request-risk').click();
  await expect(page.locator('#what-if-controls')).toBeVisible();
  expect(Object.keys(requests[0].order).sort()).toEqual(['itemCode','paperSupplier','paperType','quantity']); expect(RiskPredictionRequestSchema.safeParse(requests[0]).success).toBe(true);
  await expect(page.locator('#conditions-supervisor-confirmed')).toBeChecked();
  await page.locator('#what-if-rescore').click();
  await expect.poll(()=>requests.length).toBe(2);
  await page.getByLabel('Primary navigation').getByRole('link',{name:'New Lot',exact:true}).click();await page.locator('#analysis-ambientRhPct').fill('80');release();
  await navigate(page,'Production analysis');await expect(page.locator('#what-if-metrics')).toBeHidden();
  await expect(page.locator('#what-if-controls')).toBeHidden();
});

test('Impact excludes explicitly simulated records, including diagnostics and charts', async ({ page }) => {
  const errors=await boot(page,true);await page.route('**/impact/summary',route=>fulfill(route,impact));
  await page.getByRole('link',{name:'Impact',exact:true}).click();await page.locator('#load-impact').click();
  await expect(page.locator('#impact-content')).toBeHidden();
  await expect(page.locator('#impact-kpis .metric')).toHaveCount(0);
  await expect(page.locator('#impact-result')).toContainText('Production data is unavailable');
  await expect(page.locator('#impact-result-diagnostic')).toBeEmpty();
  expect(await page.evaluate(()=>!!Chart.getChart(document.getElementById('impact-monthly-chart')))).toBe(false);
  await page.screenshot({path:'docs/evidence/frontend/impact-real-data-unavailable-1440.png',fullPage:true});
  await page.route('**/impact/summary',route=>fulfill(route,{ok:true,source:'bigquery',kpis:{}}));
  await page.locator('#load-impact').click();await expect(page.locator('#impact-result')).toContainText('malformed');
  expect(errors).toEqual([]);
});

test('Defect Check uses only supported evidence requests and safely renders notes', async ({ page }) => {
  await boot(page,true);await page.getByRole('link',{name:'Defect Check',exact:true}).click();
  await page.route('**/evidence/seen-before',async route=>{expect(route.request().postDataJSON()).toEqual({defect:'DELAM',ambientRhPct:86});await fulfill(route,{ok:true,source:'bigquery',defect:'DELAM',caseCount:3,avgRateWhenMain:2.3,costWhenMain:5000,goodRuns:{lots:2,avgRatePct:1,...levers},badRuns:{lots:1,avgRatePct:4,...levers},notes:['<img src=x onerror=alert(1)>']});});
  await page.locator('#evidence-defect').selectOption('DELAM');await page.locator('#evidence-humidity').fill('86');await page.locator('#find-seen-before').click();
  await expect(page.locator('#seen-before-content')).toContainText('3');await expect(page.locator('#seen-before-content')).toContainText('<img src=x');await expect(page.locator('#seen-before-content img')).toHaveCount(0);
  await expect(page.locator('[data-evidence-kpi="cases"]')).toHaveText('3');await expect(page.locator('[data-rate-value]')).toHaveCount(2);await page.locator('#detailed-evidence > summary').focus();await page.keyboard.press('Enter');await expect(page.locator('#detailed-evidence tbody tr')).toHaveCount(9);await expect(page.locator('#evidence-scope-note')).toContainText('Different cohorts');
  await page.evaluate(()=>{const p=document.createElement('p');p.textContent='OFFLINE BROWSER TEST · injected service fixtures';p.style.cssText='padding:12px;color:#e0c08c';document.body.prepend(p);});
  await page.screenshot({path:'docs/evidence/frontend/defect-fixture-1440.png',fullPage:true});
  await page.locator('#evidence-humidity').fill('60');await expect(page.locator('#seen-before-content')).toBeHidden();
});

test('reduced motion, labelled controls, focus and form contrast', async ({ page }) => {
  await page.emulateMedia({reducedMotion:'reduce'}); await boot(page);
  const a11y = await page.evaluate(()=>{
    const missing=[...document.querySelectorAll('input,select,textarea')].filter(e=>e.type!=='hidden' && !e.labels?.length && !e.getAttribute('aria-label')).map(e=>e.id);
    const rgb=s=>s.match(/\d+/g).slice(0,3).map(Number);
    const lum=a=>a.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
    const input=document.getElementById('extraction-order-id'),style=getComputedStyle(input);
    const border=lum(rgb(style.borderColor)),bg=lum(rgb(getComputedStyle(input.closest('.lot-context')).backgroundColor));
    return {missing,duration:getComputedStyle(document.getElementById('screen-order-input')).animationDuration,ratio:(Math.max(border,bg)+.05)/(Math.min(border,bg)+.05)};
  });
  expect(a11y.missing).toEqual([]);expect(parseFloat(a11y.duration)).toBeLessThan(.001);expect(a11y.ratio).toBeGreaterThanOrEqual(3);
  await page.evaluate(()=>{document.body.tabIndex=-1;document.body.focus();});
  await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'Skip to main content'})).toBeFocused();
  await page.keyboard.press('Enter');await expect(page.locator('#main-content')).toBeFocused();
});

test('conditions provenance and stale extraction preserve user input without inventing readings', async ({page})=>{
  await boot(page,true);await sourceContext(page);
  await page.route('**/orders/extract',route=>fulfill(route,{ok:false,error:{code:'SERVICE_UNAVAILABLE',message:'Extraction is unavailable for this offline test.'}},503));
  await page.locator('#review-order').click();await expect(page.locator('#upload-result')).toContainText('Extraction is unavailable');
  await expect(page.locator('#extraction-paper-supplier')).toHaveValue('SUP-D');await expect(page.locator('#selected-file-name')).toContainText('PO1');
  await page.unroute('**/orders/extract');let release;
  await page.route('**/orders/extract',async route=>{await new Promise(r=>release=r);await fulfill(route,extraction());});
  await page.locator('#review-order').click();await expect.poll(()=>typeof release).toBe('function');
  await page.locator('#extraction-order-id').fill('TEST-CHANGED-CONTEXT');release();await expect(page.locator('#purchase-order-review')).toBeHidden();
  await page.locator('#production-setup > summary').click();
  await page.locator('#analysis-shift').selectOption('DAY');
  await page.route('**/conditions/current?shift=DAY',route=>fulfill(route,{ok:true,source:'bigquery',sensorSource:'simulated',data:job.conditions,provenance:{plantId:'PLANT-01',readingId:'QA',timestamp:'2026-10-14T00:00:00Z',ageSeconds:90000,freshness:'stale'}}));
  await page.locator('[data-json-get="/conditions/current"]').click();await expect(page.locator('#analysis-ambientRhPct')).toHaveValue('');
  await expect(page.locator('#conditions-result')).toContainText('Production data is unavailable');
  await expect(page.locator('#conditions-fields')).toBeHidden();await expect(page.locator('#conditions-supervisor-confirmed')).not.toBeChecked();
  await page.locator('#analysis-ambientRhPct').fill('71');
  await expect(page.locator('#condition-source-label')).toContainText('Operator-entered');
});

test('optimization, historical evidence and explanation retain strict request schemas and attribution',async({page})=>{
  await boot(page,true);await sourceContext(page);await page.route('**/orders/extract',route=>fulfill(route,extraction()));await page.locator('#review-order').click();await page.getByRole('radio',{name:'Select source PO line 1'}).check();await page.locator('#confirm-order-line').check();await fillInputs(page);
  await page.route('**/risk/predict',route=>fulfill(route,prediction));
  await page.route('**/risk/optimize',async route=>{expect(RiskOptimizationRequestSchema.safeParse(route.request().postDataJSON()).success).toBe(true);await fulfill(route,optimization);});
  const evidence=[{lotId:'QA-LOT',orderId:'QA-ORDER',runDate:'2026-09-01',primaryDefect:'WARP',levers,ambientRhPct:85,totalScrapPct:5,operatorNote:'Test-only operator note.'}];
  await page.route('**/risk/similar-runs',route=>fulfill(route,{ok:true,source:'bigquery',evidence}));
  await page.route('**/risk/explanation',async route=>{expect(RiskExplanationRequestSchema.safeParse(route.request().postDataJSON()).success).toBe(true);await fulfill(route,{ok:true,source:'bigquery-ml-and-gemini',explanation:'Offline attribution explanation for this test fixture.',rows:[{defect:'WARP',driver:'ambient_rh_pct',attributionPts:.4}]});});
  await navigate(page,'Production analysis');await page.locator('#evidence-disclosure > summary').click();await expect(page.locator('#request-risk-explanation')).toBeDisabled();
  await page.locator('#request-risk').click();await page.locator('#request-optimization').click();await expect(page.locator('#request-risk-explanation')).toBeDisabled();
  await page.locator('#load-similar-runs').click();await expect(page.locator('#similar-runs-list')).toContainText('QA-LOT');await expect(page.locator('#request-risk-explanation')).toBeEnabled();
  await page.locator('#request-risk-explanation').click();await expect(page.locator('#risk-explanation-content')).toContainText('Offline attribution');
  await page.locator('#risk-explanation-content summary').click();await expect(page.locator('#risk-explanation-content')).toContainText('0.4 percentage points');
});

test('local PDF utility remains separate from persisted approval and handles invalid JSON',async({page})=>{
  await boot(page);await navigate(page,'Production analysis');await page.locator('.utility-panel').filter({has:page.locator('#job-sheet-form')}).locator('summary').click();
  await page.locator('#job-sheet-json').fill('invalid');await page.locator('#job-sheet-form button').click();await expect(page.locator('#job-sheet-result')).toContainText('valid JobSheet JSON');
  await page.locator('#job-sheet-json').fill(JSON.stringify(job));
  await page.route('**/job-sheets/render.pdf?lang=en',route=>route.fulfill({contentType:'application/pdf',body:Buffer.from('%PDF-1.4 supplied fixture only')}));
  await page.locator('#job-sheet-form button').click();await expect(page.locator('#local-job-sheet-preview')).toBeVisible();await expect(page.locator('#pdf-link')).toBeVisible();
  await expect(page.locator('#approval-form button')).toBeDisabled();await expect(page.locator('#stored-job-preview')).toBeHidden();
});

test('progressive sections preserve keyboard access and entered values across navigation', async ({page})=>{
  await boot(page);
  await expect(page.locator('#production-setup')).not.toHaveAttribute('open','');
  const summary=page.locator('#production-setup > summary');await summary.focus();await page.keyboard.press('Enter');
  await expect(page.locator('#analysis-ambientRhPct')).toBeVisible();await page.locator('#analysis-ambientRhPct').fill('73');
  await navigate(page,'Production analysis');
  await expect(page.locator('#evidence-disclosure')).not.toHaveAttribute('open','');
  await page.locator('#evidence-disclosure > summary').focus();await page.keyboard.press('Enter');
  await expect(page.locator('#load-similar-runs')).toBeVisible();await expect(page.locator('#request-risk-explanation')).toBeVisible();
  await page.locator('.what-if-section > summary').focus();await page.keyboard.press('Enter');await expect(page.locator('#what-if-unavailable')).toBeVisible();
  await page.getByLabel('Primary navigation').getByRole('link',{name:'New Lot',exact:true}).click();await expect(page.locator('#analysis-ambientRhPct')).toHaveValue('73');
});

test('all screens and notifications exclude sample UI and rejected generated responses',async({page})=>{
  await boot(page,true);
  for(const label of ['New Lot','Production analysis','Defect Check','Impact']) {
    await navigate(page,label);
    await expect(page.locator('body')).not.toContainText(/synthetic|simulated/i);
  }
  await page.getByLabel('Primary navigation').getByRole('link',{name:'New Lot',exact:true}).click();
  await expect(page.locator('#sample-order')).toHaveCount(0);
  await page.locator('#open-status').click();
  await expect(page.locator('#status-dialog')).not.toContainText(/synthetic|simulated/i);
  await page.keyboard.press('Escape');
  await sourceContext(page);
  await page.route('**/orders/extract',route=>fulfill(route,{ok:false,error:{code:'VALIDATION_ERROR',message:'Only approved synthetic fixtures are permitted.'}},400));
  await page.locator('#review-order').click();
  await expect(page.locator('#upload-result')).toContainText('backend data policy');
  await expect(page.locator('#upload-result-diagnostic')).toBeEmpty();
  await expect(page.locator('#toast-region')).not.toContainText(/synthetic|simulated/i);
  await expect(page.locator('body')).not.toContainText(/synthetic|simulated/i);
});


test('hackathon participants share one genuine-action UI with explicit demo actor labels and no sign-in', async ({page}) => {
  // Browser service doubles only; actual signed-cookie and persistence contracts
  // are tested separately. No Gemini, Firebase or cloud write is performed.
  let reservations = 0;
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/auth/demo-session') reservations++; });
  const errors = await boot(page, true, true);
  await expect(page.locator('#supervisor-auth-status')).toContainText('Temporary demo session active');
  await expect(page.locator('#supervisor-sign-in')).toBeHidden();
  await expect(page.locator('#hackathon-provenance-note')).toContainText('Owner-approved data');
  await sourceContext(page);
  await page.route('**/orders/extract', route => fulfill(route, extraction()));
  await page.locator('#review-order').click();
  await page.getByRole('radio',{name:'Select source PO line 1'}).check();
  await page.locator('#confirm-order-line').check();
  await page.locator('#production-setup').evaluate(el => { el.open = true; });
  await page.locator('#analysis-shift').selectOption('DAY');
  await page.route('**/conditions/current?shift=DAY', route => fulfill(route, {ok:true,source:'bigquery',sensorSource:'simulated',data:job.conditions,provenance:{plantId:'PLANT-01',readingId:'TEST-READING',timestamp:'2026-10-14T00:00:00Z',ageSeconds:90000,freshness:'stale'}}));
  await page.locator('[data-json-get="/conditions/current"]').click();
  await expect(page.locator('#condition-source-label')).toContainText('Simulated');
  await expect(page.locator('#conditions-fields')).toContainText('STALE');
  await expect(page.locator('#conditions-supervisor-confirmed')).not.toBeChecked();
  await fillInputs(page);
  const demoJob = {...job,jobId:'JOB-HACK-'+ 'a'.repeat(32)+'-'+ 'b'.repeat(40)};
  await page.route('**/jobs', route => fulfill(route,{ok:true,durable:true,jobSheet:demoJob}));
  await page.locator('#prepare-job').click();
  await page.locator('[data-dashboard-stage="3"]').click();
  await expect(page.locator('#stored-job-preview')).toBeVisible();
  await expect(page.locator('#hackathon-approval-note')).toHaveText('Hackathon Demonstration Mode: Supervisor approval is available to all participants for demonstration purposes. In production, approval is restricted to authorised supervisors.');
  let approvals = 0;
  await page.route('**/jobs/*/approve?*', route => { approvals++; return fulfill(route,{ok:true,jobSheet:{...demoJob,status:'APPROVED'},cardUri:'gs://prepagent-hack-data/jobcards/TEST-browser.pdf'}); });
  await page.locator('#approval-form button').click();
  expect(approvals).toBe(0);
  await page.locator('#confirm-approval').click();
  await expect(page.locator('#job-status-badge')).toContainText('APPROVED');
  expect(approvals).toBe(1);
  await page.route('**/jobs/*/card.pdf?*', route => route.fulfill({contentType:'application/pdf',body:Buffer.from('%PDF-1.4 local hackathon browser fixture')}));
  await page.locator('#stored-card-form button').click();
  await expect(page.locator('#stored-card-link')).toBeVisible();
  expect(reservations).toBe(1);
  await page.getByRole('link',{name:'Impact',exact:true}).click();
  await page.route('**/impact/summary',route=>fulfill(route,impact));
  await page.locator('#load-impact').click();
  await expect(page.locator('#impact-content')).toBeVisible();
  await expect(page.locator('#impact-coverage')).toContainText('not measured factory outcomes');
  for (const width of [768,390]) {
    await page.setViewportSize({width,height:1000});
    try { await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1); }
    catch (error) {
      console.log(await page.evaluate(()=>JSON.stringify({width:innerWidth,documentWidth:document.documentElement.scrollWidth,nodes:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.right>innerWidth+1}).slice(0,15).map(e=>({tag:e.tagName,id:e.id,class:e.className,width:e.getBoundingClientRect().width,min:getComputedStyle(e).minWidth,display:getComputedStyle(e).display}))})));
      throw error;
    }
      // Chart resize is asynchronous; assertions above wait for stable geometry.

  }
  expect(errors).toEqual([]);
});


test('approved-photo controls enforce the ten-image contract and safe label rendering',async({page})=>{
  await boot(page,true,true);
  await page.route('**/api/status',async route=>{const response=await route.fetch();const status=await response.json();status.authorizationMode='HACKATHON_DEMO';status.integrations.getApprovedPhotos=true;status.integrations.classifyApprovedPhoto=true;await fulfill(route,status);});
  await page.locator('#open-status').click();await page.locator('[data-json-get="/api/status"]').click();await page.locator('#status-dialog [data-close-dialog]').click();
  await page.getByRole('link',{name:'Defect Check',exact:true}).click();await page.getByRole('tab',{name:'Photo Diagnosis',exact:true}).click();
  const photos=Array.from({length:10},(_,i)=>({id:'photo-'+String(i+1).padStart(2,'0'),label:'Approved photo '+(i+1)}));
  await page.route('**/evidence/approved-photos',route=>fulfill(route,{ok:true,photos}));
  await page.locator('#load-approved-photos').click();await expect(page.locator('#approved-photo-id option')).toHaveCount(11);
  await page.locator('#approved-photo-id').selectOption('photo-01');
  let calls=0;await page.route('**/evidence/classify-photo',route=>{calls++;expect(route.request().postDataJSON()).toEqual({photoId:'photo-01'});return fulfill(route,{ok:true,source:'vertex-gemini',isRealModelPrediction:true,photoId:'photo-01',label:'CRACK',classifiedAt:'2026-10-15T00:00:00Z'});});
  await page.locator('#classify-approved-photo').click();await expect(page.locator('#approved-photo-result')).toContainText('CRACK');expect(calls).toBe(1);
  await page.route('**/evidence/classify-photo',route=>fulfill(route,{ok:true,source:'vertex-gemini',photoId:'photo-01',label:'<img src=x onerror=alert(1)>'}));
  await page.locator('#classify-approved-photo').click();await expect(page.locator('#approved-photo-result')).toContainText('invalid');await expect(page.locator('#approved-photo-result img')).toHaveCount(0);
});
