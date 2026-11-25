import { expect, test } from '@playwright/test';

// Every backend call this spec makes is answered here, so it stays off the per-IP API limit the
// other specs share. Values are test fixtures shaped like the real responses, not plant figures.
const json = (status, body) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

const SESSION = 'a'.repeat(32);
const LOT_ID = `LOT-HACK-${SESSION}-${'b'.repeat(12)}`;
const JOB_ID = `JOB-HACK-${SESSION}-${'c'.repeat(40)}`;
// The plan and the read-back carry different fingerprints, so a test can tell which one approval sends.
const FINGERPRINT = 'd'.repeat(64);
const READ_BACK_FINGERPRINT = 'f'.repeat(64);
const REVIEW_ID = '0b9a4c1e-2f3d-4a5b-8c6d-7e8f9a0b1c2d';

const PROFILE = {
  orderId: 'TEST-CLA/PO/2026/1047', itemCode: 'PKBX0041', customerId: 'CL-A', boxStyle: 'RSC', lengthMm: 400, widthMm: 300, heightMm: 250,
  ply: 5, fluteProfile: 'BC', topLinerGsm: 180, fluteGsm: 140, innerLinerGsm: 150, linerBf: 22, paperType: 'RECYCLED', paperSupplier: 'SUP-D',
  inkColors: 2, inkCoveragePct: 30, quantity: 1300,
};
const EXTRACTION = {
  ok: true, agent: 'extractOrder', source: 'vertex-gemini', isRealModelPrediction: true,
  reviewId: REVIEW_ID, reviewFingerprint: 'e'.repeat(64), missingFields: [], needsClarification: false,
  purchaseOrderDocument: { poNumber: 'CLA/PO/2026/1047', buyer: 'Client A' },
  lines: [{ lineIndex: 0, sourcePage: 1, extractedItemCode: 'PKBX0041', quantity: 1300, status: 'MATCHED', catalogStatus: 'MATCHED', candidates: [], resolvedItemCode: 'PKBX0041',
    orderProfile: { ply: 5, fluteProfile: 'BC', boxStyle: 'RSC', lengthMm: 400, widthMm: 300, heightMm: 250 } }],
};
const TARGET_USE = {
  WARP: { useClass: 'optimizer', reason: 'Counted.' }, DELAM: { useClass: 'optimizer', reason: 'Counted.' }, STRENGTH: { useClass: 'optimizer', reason: 'Counted.' },
  PRINT: { useClass: 'optimizer', reason: 'Counted.' }, CRACK: { useClass: 'advisory', reason: 'Low confidence.' },
};
const LEVERS = { sfSpeedMpm: 48, rollTempC: 162, gumApplication: 'HIGH', gumViscositySec: 32, pastingPressure: 'MED', dryingHours: 5, printSpeedSpm: 60 };
const BEST_LEVERS = { ...LEVERS, rollTempC: 170, gumApplication: 'MED' };
const BASE_RISK = { ratesPct: { WARP: 1.2, DELAM: 1.4, STRENGTH: 0.7, PRINT: 1.5, CRACK: 0.3 }, totalScrapPct: 4.8, totalScrapKg: 70.2, scrapCost: 3740, currency: 'INR', primaryDefect: 'PRINT', targetUse: TARGET_USE };
const BEST_RISK = { ratesPct: { WARP: 1.0, DELAM: 1.1, STRENGTH: 0.75, PRINT: 1.4, CRACK: 0.3 }, totalScrapPct: 4.25, totalScrapKg: 61.5, scrapCost: 3277, currency: 'INR', primaryDefect: 'PRINT', targetUse: TARGET_USE };
const CHANGES = [
  { lever: 'rollTempC', from: 162, to: 170, reason: 'Lower delamination.' },
  { lever: 'gumApplication', from: 'HIGH', to: 'MED', reason: 'Lower warp.' },
];
const CONDITIONS = { runDate: '2026-11-25', shift: 'DAY', ambientRhPct: 61, ambientTempC: 27.5, paperMoisturePct: 8.1 };
const OPTIMIZATION = { baseline: { levers: LEVERS, risk: BASE_RISK }, best: { levers: BEST_LEVERS, risk: BEST_RISK }, changes: CHANGES, savings: { kg: 8.7, inr: 463 }, modelPredicted: true };
const SHEET = {
  jobId: JOB_ID, status: 'DRAFT', order: { ...PROFILE, sourcePoNumber: 'CLA/PO/2026/1047', purchaseOrderLineIndex: 0 },
  conditions: { ...CONDITIONS, conditionSource: 'manual-entry', supervisorConfirmed: true },
  baseline: OPTIMIZATION.baseline, recommended: OPTIMIZATION.best, changes: CHANGES, savings: { kg: 8.7, inr: 463 },
  explanation: 'Stored explanation text.', evidence: [],
};
const REVISION = { lotId: LOT_ID, number: 1, fingerprint: FINGERPRINT, status: 'CURRENT' };
const READ_BACK_REVISION = { ...REVISION, fingerprint: READ_BACK_FINGERPRINT };
const PLAN = {
  ok: true, durable: true, jobId: JOB_ID, runId: 'run-1', completedStages: ['extractOrder', 'getConditions', 'predictRisk', 'optimizeLevers', 'findSimilarRuns', 'explainRisk', 'generateJobSheet'],
  orderProfile: PROFILE, conditions: { ...CONDITIONS, conditionSource: 'manual-entry', supervisorConfirmed: true },
  conditionSources: { ambientRhPct: 'weather', ambientTempC: 'plant', paperMoisturePct: 'plant' }, confidence: 'normal',
  prediction: BASE_RISK, humidityBand: { ambientRhPct: { low: 56, high: 66 }, ratesPct: { PRINT: { low: 1.3, high: 1.7 } } },
  optimization: OPTIMIZATION, evidence: [], explanation: 'Stored explanation text.', jobSheet: SHEET, revision: REVISION,
};
const STATUS = { ok: true, modelAcceptance: { status: 'accepted', models: [
  { defect: 'WARP', r2: 0.4682, sampleCount: 219 }, { defect: 'DELAM', r2: 0.5194, sampleCount: 219 }, { defect: 'STRENGTH', r2: 0.388, sampleCount: 219 },
  { defect: 'PRINT', r2: 0.6404, sampleCount: 219 }, { defect: 'CRACK', r2: 0.1081, sampleCount: 219 },
] } };

/**
 * Answers the routes the New Lot pages call. `overrides` replaces a route's reply by path key,
 * and every request is recorded so a test can check what was sent.
 */
async function mockBackend(page, overrides = {}) {
  const calls = [];
  await page.route('**/*', async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    const method = request.method();
    const key = `${method} ${pathname.replace(JOB_ID, ':job').replace(LOT_ID, ':lot')}`;
    const known = [
      'GET /api/auth/config', 'GET /api/status', 'POST /orders/extract', 'GET /conditions/weather', 'GET /conditions/current', 'POST /jobs',
      'GET /jobs/:job', 'POST /jobs/:job/approve', 'GET /lots/:lot', 'PUT /lots/:lot/conditions', 'POST /risk/explanation',
    ];
    if (pathname.startsWith('/samples/')) return route.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.4 test' });
    if (pathname.startsWith('/api/') && !known.includes(key)) return route.fulfill(json(404, { ok: false, error: { code: 'ARC_NOT_ENABLED', message: 'Arc is not enabled.' } }));
    if (!known.includes(key)) return route.fallback();
    calls.push({ key, headers: request.headers(), body: request.postData(), json: (() => { try { return request.postDataJSON(); } catch { return undefined; } })() });
    if (overrides[key]) return route.fulfill(typeof overrides[key] === 'function' ? overrides[key](calls) : overrides[key]);
    switch (key) {
      case 'GET /api/auth/config': return route.fulfill(json(200, { enabled: false, provider: 'firebase-google' }));
      case 'GET /api/status': return route.fulfill(json(200, STATUS));
      case 'POST /orders/extract': return route.fulfill(json(200, EXTRACTION));
      case 'GET /conditions/weather': return route.fulfill(json(200, { ok: true, source: 'google-maps-weather', ambientRhPct: 61, ambientTempC: 27.5, observedAt: '2026-11-25T08:30:00Z', location: 'Pune' }));
      case 'GET /conditions/current': return route.fulfill(json(200, { ok: true, agent: 'getConditions', source: 'simulated-sensor', isRealModelPrediction: false, data: CONDITIONS, sensorSource: 'simulated', provenance: { timestamp: '2026-11-20T06:00:00Z', freshness: 'stale' } }));
      case 'POST /jobs': return route.fulfill(json(200, PLAN));
      case 'GET /jobs/:job': return route.fulfill(json(200, { ok: true, jobSheet: SHEET, revision: READ_BACK_REVISION }));
      case 'POST /jobs/:job/approve': return route.fulfill(json(200, { ok: true, jobSheet: { ...SHEET, status: 'APPROVED', approvedAt: '2026-11-25T09:00:00Z', cardUri: 'gs://prepagent-hack-data/jobcards/test.pdf' } }));
      case 'GET /lots/:lot': return route.fulfill(json(200, { ok: true, lot: { lotId: LOT_ID, stage: 'conditions', currentRevision: 1, currentJobId: JOB_ID }, revision: { jobId: JOB_ID, number: 1, status: 'SUPERSEDED', supersededReason: { field: 'paperMoisturePct', from: 8.1, to: 9, provenance: 'operator_entry', byRole: 'Supervisor session' } } }));
      case 'PUT /lots/:lot/conditions': return route.fulfill(json(200, { ok: true, lot: { lotId: LOT_ID, stage: 'conditions' }, superseded: { jobId: JOB_ID, number: 1, reason: { field: 'paperMoisturePct' } } }));
      case 'POST /risk/explanation': return route.fulfill(json(200, { ok: true, source: 'bigquery-ml-and-gemini', explanation: 'Higher roll temperature lowers the delamination estimate. The model attribution is not proof of cause. Similar past lots ran at the same settings.', rows: [] }));
    }
  });
  return calls;
}

const filled = (overrides = {}) => ({
  file: { name: 'PO1_ClientA_single_B1047.pdf', size: 13, sample: 'PO1' },
  context: { orderId: 'TEST-CLA/PO/2026/1047', paperType: 'RECYCLED', paperSupplier: 'SUP-D' },
  extraction: EXTRACTION, lineIndex: 0, itemCode: 'PKBX0041', quantity: '1300', checks: [true, true, true], orderConfirmed: true,
  conditions: { ambientRhPct: '61', paperMoisturePct: '8.1', ambientTempC: '27.5', runDate: '2026-11-25', shift: 'DAY' },
  sources: { ambientRhPct: { kind: 'weather', observedAt: '2026-11-25T08:30:00Z', location: 'Pune' }, ambientTempC: { kind: 'weather', observedAt: '2026-11-25T08:30:00Z', location: 'Pune' } },
  levers: Object.fromEntries(Object.entries(LEVERS).map(([key, value]) => [key, String(value)])),
  lotId: LOT_ID, plannedInputs: undefined, plan: PLAN,
  ...overrides,
});

/** Opens a step with the lot state already saved in this tab, as after a reload. */
async function openStep(page, hash, state) {
  await page.goto('about:blank');
  if (state) {
    const saved = { ...state, plannedInputs: state.plan ? { conditions: state.conditions, levers: state.levers } : undefined };
    // Only the first load seeds the state, so a reload shows what the page saved itself.
    await page.addInitScript((value) => { if (!sessionStorage.getItem('momentum-new-lot')) sessionStorage.setItem('momentum-new-lot', value); }, JSON.stringify(saved));
  }
  await page.goto('/app/' + hash);
  await expect(page.getByRole('heading', { level: 1, name: 'New lot' })).toBeVisible();
}

const STEPS = [
  { hash: '#/new-lot/order', step: 'Order', marker: 'What we read from the order' },
  { hash: '#/new-lot/conditions', step: 'Conditions', marker: 'Planned machine settings' },
  { hash: '#/new-lot/settings', step: 'Settings and risk', marker: '2 of 7 settings change' },
  { hash: '#/new-lot/approve', step: 'Review and approve', marker: 'Supervisor decision' },
];

for (const theme of ['dark', 'light']) {
  test(`each New Lot step renders in the ${theme} theme`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: theme });
    await mockBackend(page);
    for (const { hash, step, marker } of STEPS) {
      await openStep(page, hash, filled());
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(page.locator('.m')).toHaveCSS('background-color', theme === 'dark' ? 'rgb(18, 21, 25)' : 'rgb(238, 240, 242)');
      await expect(page.getByRole('list', { name: 'New lot steps' }).locator('[aria-current="step"]')).toContainText(step);
      await expect(page.getByRole('heading', { name: marker })).toBeVisible();
      await expect(page.getByRole('group', { name: 'Lot' })).toContainText('Modelled on our plant');
      const text = await page.locator('main').innerText();
      expect(text).not.toMatch(/synthetic/i);
      expect(text).not.toMatch(/pass level/i);
      expect(text).not.toMatch(/8,640/);
    }
  });
}

test('the manual route reads the order, plans the lot and approves through the backend commands', async ({ page }) => {
  const calls = await mockBackend(page);
  await openStep(page, '#/new-lot/order');

  await page.getByRole('button', { name: 'PO1 Single line' }).click();
  await expect(page.getByLabel('Order ID')).toHaveValue('TEST-CLA/PO/2026/1047');
  await page.getByRole('button', { name: 'Read order with Gemini' }).click();
  await expect(page.getByText('Read from the order by Gemini.', { exact: false })).toBeVisible();
  const read = calls.find((call) => call.key === 'POST /orders/extract');
  expect(read.body).toContain('name="orderId"');
  expect(read.body).toContain('TEST-CLA/PO/2026/1047');
  await expect(page.locator('.ci.ok')).toHaveCount(3);
  await expect(page.locator('.rd').filter({ hasText: 'Customer' })).toContainText('Client A');
  await expect(page.locator('.rd').filter({ hasText: 'Board' })).toContainText('From catalog');

  const confirm = page.getByRole('button', { name: 'Confirm order' });
  await expect(confirm).toBeDisabled();
  for (const label of ['The source line is the one you want', 'The quantity matches the order', 'The catalog item is the right box']) await page.getByLabel(label).check();
  await confirm.click();

  await expect(page).toHaveURL(/#\/new-lot\/conditions$/);
  await expect(page.getByLabel('Humidity')).toHaveValue('61');
  await expect(page.locator('#nl-ambientRhPct-src')).toContainText('Weather record, Pune');
  await expect(page.getByText('10 fields left to confirm')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Lot' })).toContainText('Operator: confirm 10 fields');
  await page.getByLabel('Paper moisture').fill('8.1');
  await page.getByLabel('Run date').fill('2026-11-25');
  await page.getByLabel('Shift').selectOption('DAY');
  for (const [label, value] of [['Single-facer speed', '48'], ['Roll temperature', '162'], ['Gum viscosity', '32'], ['Drying time', '5'], ['Print speed', '60']]) await page.getByLabel(label).fill(value);
  await page.getByLabel('Gum application').selectOption('HIGH');
  await page.getByLabel('Pasting pressure').selectOption('MED');
  await expect(page.getByText('All 12 fields entered.')).toBeVisible();
  await page.getByRole('button', { name: 'Plan this lot' }).click();

  await expect(page).toHaveURL(/#\/new-lot\/settings$/);
  const plan = calls.find((call) => call.key === 'POST /jobs');
  expect(plan.headers['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);
  for (const [field, value] of [['reviewId', REVIEW_ID], ['confirmedSourceLine', 'true'], ['conditionsConfirmed', 'true'], ['confirmedItemCode', 'PKBX0041'], ['paperMoisturePct', '8.1'], ['gumApplication', 'HIGH']]) {
    expect(plan.body).toMatch(new RegExp(`name="${field}"\\r\\n\\r\\n${value}\\r\\n`));
  }
  await expect(page.locator('.kr').filter({ hasText: 'Scrap for this lot' })).toContainText('70.2');
  await expect(page.locator('.kr').filter({ hasText: 'Scrap for this lot' })).toContainText('61.5');
  await expect(page.getByText('Totals leave out Crease cracking: low confidence, not counted.')).toBeVisible();
  await expect(page.getByRole('table', { name: 'Model fit scores' })).toContainText('Low confidence, not counted');
  await expect(page.getByText('Tested on 219 lots.')).toBeVisible();

  await page.getByRole('button', { name: 'Explain' }).click();
  await expect(page.getByText('Higher roll temperature lowers', { exact: false })).toBeVisible();
  await expect(page.locator('#nl-explanation').getByText('Generated by Gemini')).toBeVisible();
  const explanation = calls.find((call) => call.key === 'POST /risk/explanation').json;
  expect(Object.keys(explanation.conditions).sort()).toEqual(['ambientRhPct', 'ambientTempC', 'paperMoisturePct', 'runDate', 'shift']);
  expect(explanation.optimization).toEqual(OPTIMIZATION);

  await page.getByRole('link', { name: 'Review job card' }).click();
  await expect(page).toHaveURL(/#\/new-lot\/approve$/);
  await expect(page.getByText('Rev 1 is stored and read back.')).toBeVisible();
  const approve = page.getByRole('button', { name: 'Approve Rev 1' });
  await expect(approve).toBeDisabled();
  await page.getByLabel('I reviewed the settings and limits on this card.').check();
  await approve.click();

  const sent = calls.filter((call) => call.key === 'POST /jobs/:job/approve');
  expect(sent).toHaveLength(1);
  expect(sent[0].json).toEqual({ reviewConfirmed: true, revisionFingerprint: READ_BACK_FINGERPRINT });
  await expect(page.getByRole('link', { name: 'Open the job card PDF' })).toHaveAttribute('href', `/jobs/${JOB_ID}/card.pdf?lang=en&currency=INR`);
  await expect(page.locator('section').filter({ hasText: 'Supervisor decision' }).getByText('Demo session, simulated').first()).toBeVisible();
});

test('Approve stays disabled until the box is ticked, and nothing is sent before then', async ({ page }) => {
  const calls = await mockBackend(page);
  await openStep(page, '#/new-lot/approve', filled());
  const approve = page.getByRole('button', { name: 'Approve Rev 1' });
  const box = page.getByLabel('I reviewed the settings and limits on this card.');
  await expect(box).toBeEnabled();
  await expect(approve).toBeDisabled();
  await approve.click({ force: true });
  await box.check();
  await expect(approve).toBeEnabled();
  await box.uncheck();
  await expect(approve).toBeDisabled();
  expect(calls.filter((call) => call.key === 'POST /jobs/:job/approve')).toHaveLength(0);
  await expect(page.getByText('The approval is recorded as a simulated demo-session approval.')).toBeVisible();
});

test('the Gemini chip shows only when the explanation response says Gemini wrote it', async ({ page }) => {
  await mockBackend(page, { 'POST /risk/explanation': json(200, { ok: true, source: 'bigquery-ml-attribution-summary', explanation: 'Roll temperature has the largest attribution. Gum application is next. Drying time is third.', rows: [] }) });
  await openStep(page, '#/new-lot/settings', filled());
  await page.getByRole('button', { name: 'Explain' }).click();
  await expect(page.getByText('Roll temperature has the largest attribution.', { exact: false })).toBeVisible();
  await expect(page.getByText('Gemini did not write this text.', { exact: false })).toBeVisible();
  await expect(page.locator('#nl-explanation').getByText('Generated by Gemini')).toHaveCount(0);
});

test('a stale revision conflict from the approve guard shows the Stale state', async ({ page }) => {
  const calls = await mockBackend(page, {
    'POST /jobs/:job/approve': json(409, { ok: false, error: { code: 'REVISION_SUPERSEDED', message: 'An input changed after this draft was prepared, so it is replaced and read only.' } }),
  });
  await openStep(page, '#/new-lot/approve', filled());
  await page.getByLabel('I reviewed the settings and limits on this card.').check();
  await page.getByRole('button', { name: 'Approve Rev 1' }).click();

  await expect(page.getByText('Out of date. Nothing has been approved.')).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: 'An input changed after Rev 1 was prepared.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve Rev 1' })).toBeDisabled();
  await expect(page.getByText('Replaced, read only')).toBeVisible();
  await expect(page.locator('section').filter({ hasText: 'What changed' })).toContainText('Paper moisture');
  await expect(page.getByRole('link', { name: 'Plan this lot again' })).toHaveAttribute('href', '#/new-lot/conditions');
  expect(calls.filter((call) => call.key === 'POST /jobs/:job/approve')).toHaveLength(1);
});

test('editing a condition after planning records it on the lot and the replaced draft cannot be approved', async ({ page }) => {
  const calls = await mockBackend(page);
  await openStep(page, '#/new-lot/conditions', filled());
  await page.getByLabel('Paper moisture').fill('9');
  await page.getByLabel('Paper moisture').blur();
  await expect.poll(() => calls.filter((call) => call.key === 'PUT /lots/:lot/conditions').length).toBe(1);
  expect(calls.find((call) => call.key === 'PUT /lots/:lot/conditions').json).toEqual({ conditions: [{ field: 'paperMoisturePct', value: 9, source: 'typed' }] });
  await expect(page.getByText('The draft is out of date')).toBeVisible();
  await page.goto('/app/#/new-lot/approve');
  await expect(page.getByText('Out of date. Nothing has been approved.')).toBeVisible();
});

test('Recovery keeps the finished numbers when the explanation step fails, and Retry plans again with the same key', async ({ page }) => {
  let attempts = 0;
  const failed = json(503, {
    ok: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'The evidence-grounded risk explanation is temporarily unavailable.' },
    blockedAt: 'explainRisk', orderProfile: PROFILE, conditions: PLAN.conditions, prediction: BASE_RISK, optimization: OPTIMIZATION, evidence: [{ lotId: 'L1', orderId: 'O1', runDate: '2026-09-02' }],
  });
  const calls = await mockBackend(page, { 'POST /jobs': () => (++attempts === 1 ? failed : json(200, PLAN)) });
  await openStep(page, '#/new-lot/conditions', filled({ plan: undefined, lotId: undefined }));
  await page.getByRole('button', { name: 'Plan this lot' }).click();

  await expect(page).toHaveURL(/#\/new-lot\/settings$/);
  await expect(page.getByText('Part of the analysis did not finish. The rest is kept.')).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: 'The explanation is not available.' })).toBeVisible();
  await expect(page.locator('.st').filter({ hasText: 'Risk evidence' })).toContainText('Done, 1 similar lot found');
  await expect(page.locator('.st').filter({ hasText: 'Explanation' })).toContainText('Not available');
  await expect(page.locator('.kr')).toContainText('Roll temperature');

  await page.reload();
  await expect(page.getByText('Part of the analysis did not finish. The rest is kept.')).toBeVisible();

  await page.getByRole('button', { name: 'Retry explanation' }).click();
  await expect(page.getByRole('heading', { name: '2 of 7 settings change' })).toBeVisible();
  const keys = calls.filter((call) => call.key === 'POST /jobs').map((call) => call.headers['idempotency-key']);
  expect(keys).toHaveLength(2);
  expect(keys[1]).toBe(keys[0]);
});

test('a saved review survives a reload, so the order does not need to be read again', async ({ page }) => {
  const calls = await mockBackend(page);
  await openStep(page, '#/new-lot/order');
  await page.getByRole('button', { name: 'PO1 Single line' }).click();
  await page.getByRole('button', { name: 'Read order with Gemini' }).click();
  await expect(page.locator('.rd').filter({ hasText: 'PO number' })).toContainText('CLA/PO/2026/1047');
  await page.reload();
  await expect(page.locator('.rd').filter({ hasText: 'PO number' })).toContainText('CLA/PO/2026/1047');
  await expect(page.getByText('Line 1 is selected')).toBeVisible();
  expect(calls.filter((call) => call.key === 'POST /orders/extract')).toHaveLength(1);
});

test('a read-back without a revision keeps Approve off and says why', async ({ page }) => {
  const calls = await mockBackend(page, { 'GET /jobs/:job': json(200, { ok: true, jobSheet: SHEET }) });
  await openStep(page, '#/new-lot/approve', filled());
  await expect(page.getByRole('alert').filter({ hasText: 'This draft has no registered revision.' })).toBeVisible();
  await expect(page.getByLabel('I reviewed the settings and limits on this card.')).toBeDisabled();
  await expect(page.getByRole('button', { name: /^Approve/ })).toBeDisabled();
  expect(calls.filter((call) => call.key === 'POST /jobs/:job/approve')).toHaveLength(0);
});

test('planning again after the approve guard replaced the draft sends a new idempotency key', async ({ page }) => {
  const calls = await mockBackend(page, {
    'POST /jobs/:job/approve': json(409, { ok: false, error: { code: 'REVISION_SUPERSEDED', message: 'An input changed after this draft was prepared, so it is replaced and read only.' } }),
  });
  await openStep(page, '#/new-lot/conditions', filled({ plan: undefined }));
  await page.getByRole('button', { name: 'Plan this lot' }).click();
  await expect(page).toHaveURL(/#\/new-lot\/settings$/);
  await page.getByRole('link', { name: 'Review job card' }).click();
  await page.getByLabel('I reviewed the settings and limits on this card.').check();
  await page.getByRole('button', { name: 'Approve Rev 1' }).click();
  await expect(page.getByText('Out of date. Nothing has been approved.')).toBeVisible();

  // The inputs are unchanged, so only the stale signal can make the key change.
  await page.getByRole('link', { name: 'Plan this lot again' }).click();
  await page.getByRole('button', { name: 'Plan this lot' }).click();
  await expect(page).toHaveURL(/#\/new-lot\/settings$/);
  const keys = calls.filter((call) => call.key === 'POST /jobs').map((call) => call.headers['idempotency-key']);
  expect(keys).toHaveLength(2);
  expect(keys[1]).not.toBe(keys[0]);
});

test('a plan that comes back with a replaced revision is shown as stale, not approvable', async ({ page }) => {
  await mockBackend(page, { 'POST /jobs': json(200, { ...PLAN, revision: { ...REVISION, status: 'SUPERSEDED' } }) });
  await openStep(page, '#/new-lot/conditions', filled({ plan: undefined }));
  await page.getByRole('button', { name: 'Plan this lot' }).click();
  await expect(page).toHaveURL(/#\/new-lot\/settings$/);
  await page.goto('/app/#/new-lot/approve');
  await expect(page.getByText('Out of date. Nothing has been approved.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve Rev 1' })).toBeDisabled();
});

const PHONE_SCREENS = [
  ...STEPS.map(({ hash }) => ({ name: hash, hash, state: filled() })),
  { name: 'recovery', hash: '#/new-lot/settings', state: filled({ plan: undefined, partial: { outputs: { ...PLAN, jobSheet: undefined, revision: undefined, blockedAt: 'explainRisk' }, message: 'The explanation is unavailable.' } }) },
  { name: 'stale', hash: '#/new-lot/approve', state: filled({ stale: { jobId: JOB_ID, number: 1, message: 'Replaced.' } }) },
];

test('all six screens fit a phone screen, and nothing inside them scrolls sideways', async ({ context }) => {
  for (const { name, hash, state } of PHONE_SCREENS) {
    // A new tab per screen starts with empty session storage, so each state seeds cleanly.
    const fresh = await context.newPage();
    await fresh.setViewportSize({ width: 375, height: 800 });
    await mockBackend(fresh);
    await openStep(fresh, hash, state);
    await expect(fresh.locator('main .nl')).toBeVisible();
    const wide = await fresh.evaluate(() => {
      // Visually hidden text (clipped to nothing) is meant to overflow its 1 px box.
      const hidden = (element) => { for (let node = element; node; node = node.parentElement) if (getComputedStyle(node).clip !== 'auto') return true; return false; };
      return [...document.querySelectorAll('main *')]
        .filter((element) => element.scrollWidth > element.clientWidth + 1 && !hidden(element))
        .map((element) => `${element.tagName.toLowerCase()}.${element.className} ${element.scrollWidth}>${element.clientWidth}`);
    });
    expect(wide, name).toEqual([]);
    const overflow = await fresh.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, name).toBeLessThanOrEqual(0);
    await fresh.close();
  }
});
