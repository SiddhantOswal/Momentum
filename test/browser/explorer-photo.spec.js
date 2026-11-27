import { expect, test } from '@playwright/test';

const json = (status, body) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
const NOT_ENABLED = json(404, { ok: false, error: { code: 'ARC_NOT_ENABLED', message: 'Arc is not enabled on this deployment.' } });

// Floor lots belong to other sessions; their jobs must never be requested.
const FLOOR_LOT = { lotId: 'JOB-HACK-other-1', jobId: 'JOB-HACK-other-1', orderId: 'TEST-PO-7', itemCode: 'SKU-FLOOR-7', quantity: 800, status: 'planned', updatedAt: '2026-11-25T09:00:00.000Z',
  changes: [{ lever: 'dryingHours', from: 6, to: 8 }, { lever: 'gumViscositySec', from: 30, to: 38 }, { lever: 'notALever', from: 1, to: 2 }] };
const OLDER = { ...FLOOR_LOT, lotId: 'JOB-HACK-other-0', jobId: 'JOB-HACK-other-0', itemCode: 'SKU-OLD', updatedAt: '2026-11-24T09:00:00.000Z' };
const SESSION = { ok: true, session: { authorizationMode: 'HACKATHON_DEMO', identityLabel: 'Demo session, simulated', expiresAt: '2026-11-25T12:00:00.000Z',
  activeLots: [{ lotId: 'LOT-T-1', stage: 'draft_review', currentJobId: 'JOB-TEST-1', currentRevision: 1 }], jobIds: [], activeTaskRunId: null, resumable: false, turnCount: 0 } };
const LEVERS = { sfSpeedMpm: 41, rollTempC: 163, gumApplication: 'HIGH', gumViscositySec: 33, pastingPressure: 'MED', dryingHours: 6, printSpeedSpm: 52 };
const JOB = { ok: true, jobSheet: {
  jobId: 'JOB-TEST-1', order: { orderId: 'TEST-PO-1', itemCode: 'SKU-TEST-9', quantity: 500 },
  conditions: { runDate: '2026-11-25', shift: 'DAY', ambientRhPct: 47, ambientTempC: 21, paperMoisturePct: 7.1, supervisorConfirmed: true },
  baseline: { levers: LEVERS, risk: {} },
  recommended: { levers: { ...LEVERS, rollTempC: 171, gumApplication: 'MED', gumViscositySec: 44 }, risk: {} },
  changes: [
    { lever: 'rollTempC', from: 163, to: 171, reason: 'r' },
    { lever: 'gumApplication', from: 'HIGH', to: 'MED', reason: 'r' },
    { lever: 'gumViscositySec', from: 33, to: 44, reason: 'r' },
    // Not a setting the page knows: it must be left out, not crash the page.
    { lever: 'notALever', from: 1, to: 2, reason: 'r' },
  ],
  explanation: 'x', savings: { kg: 1, amount: 1, currency: 'INR' }, status: 'DRAFT',
} };
const STATUS = { ok: true, modelAcceptance: { status: 'accepted', requiredR2: { PRINT: 0.6 }, models: [
  { defect: 'PRINT', r2: 0.6404, sampleCount: 219 }, { defect: 'CRACK', r2: 0.1081, sampleCount: 219 },
] } };
const PHOTOS = { ok: true, photos: Array.from({ length: 10 }, (_, i) => ({ id: `photo-${String(i + 1).padStart(2, '0')}`, label: `Approved photo ${i + 1}` })) };

// Answers every backend call so this file never reaches the per-IP limit or a real service.
// `overrides` maps a path to a response (or a function of the route); every request is recorded.
async function mockBackend(page, overrides = {}) {
  const calls = [];
  const answers = {
    '/api/auth/config': json(200, { enabled: false, provider: 'firebase-google' }),
    '/api/status': json(200, STATUS),
    '/api/arc/session': json(200, SESSION),
    '/api/lots': json(200, { ok: true, mode: 'memory', lots: [OLDER, FLOOR_LOT], events: [] }),
    '/jobs/JOB-TEST-1': json(200, JOB),
    '/evidence/approved-photos': json(200, PHOTOS),
    '/conditions/weather': json(200, { ok: true, source: 'google-maps-weather', ambientRhPct: 52, ambientTempC: 22, observedAt: '2026-11-25T04:30:00Z', location: 'Pune' }),
    ...overrides,
  };
  const handler = route => {
    const url = new URL(route.request().url());
    calls.push(`${route.request().method()} ${url.pathname}`);
    const answer = answers[url.pathname];
    if (typeof answer === 'function') return answer(route);
    return route.fulfill(answer ?? NOT_ENABLED);
  };
  for (const pattern of ['**/api/**', '**/jobs/**', '**/evidence/**', '**/conditions/**', '**/risk/**', '**/lots/**']) await page.route(pattern, handler);
  return calls;
}

async function open(page, hash, theme = 'dark') {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: theme });
  await page.goto('about:blank');
  await page.goto('/app/' + hash);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}

async function expectNoRetiredCopy(page) {
  const text = await page.locator('main').innerText();
  expect(text).not.toMatch(/synthetic/i);
  expect(text).not.toMatch(/pass level/i);
  expect(text).not.toMatch(/0\.078/);
}

async function expectEmphasisCard(card) {
  const expected = await card.evaluate(element => {
    const sample = document.createElement('span');
    sample.style.backgroundColor = 'color-mix(in srgb, var(--ac) 9%, var(--cd))';
    element.append(sample);
    const background = getComputedStyle(sample).backgroundColor;
    sample.remove();
    return background;
  });
  await expect(card).toHaveCSS('background-color', expected);
  await expect(card).toHaveCSS('border-top-color', 'rgba(245, 197, 24, 0.55)');
}

for (const theme of ['dark', 'light']) {
  test(`Plant Explorer shows the current lot's plan in the ${theme} theme`, async ({ page }) => {
    const calls = await mockBackend(page);
    await open(page, '#/explorer', theme);

    await expect(page.getByRole('heading', { level: 1, name: 'Plant Explorer' })).toBeVisible();
    await expect(page.getByText('Stage by stage. Illustrative, no live readings.')).toHaveCount(0);
    await expect(page.locator('main')).not.toContainText(/illustrative/i);
    await expect(page.getByRole('img', { name: /Corrugator line/ })).toBeVisible();

    // Opens on Glue, the stage with the most changes, and every value is the stored plan's.
    const tabs = page.getByRole('tablist', { name: 'Stages' });
    await expect(tabs.getByRole('tab')).toHaveText(['1Unwind', '2Corrugate', '3Glue', '4Dry', '5Cut']);
    await expect(tabs.getByRole('tab', { name: /Glue/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('SKU-TEST-9, stage 3 of 5, glue')).toBeVisible();
    const panel = page.getByRole('tabpanel');
    await expect(panel.getByRole('heading', { name: 'Glue, stage 3' })).toBeVisible();
    await expect(panel.getByText('Model estimate')).toHaveCount(0);
    await expect(panel.locator('.pe-row')).toHaveText([/Gum application\s*was HIGH\s*MEDIUM/, /Gum viscosity\s*was 33 s\s*44 s/, /Pasting pressure\s*No change\s*MEDIUM/]);

    const callouts = page.locator('.pe-call');
    await expect(callouts).toHaveText([/Roll temperature\s*163 → 171 °C/, /Gum application\s*HIGH → MEDIUM/, /Gum viscosity\s*33 → 44 s/]);
    await expect(page.locator('.pe-call.sel')).toHaveCount(2);
    await expect(page.locator('.pe-floor')).toHaveText(/Floor conditions\s*47% humidity confirmed/);

    await expect(page.getByText('Modeled lots', { exact: true })).toHaveCount(0);
    const history = page.getByRole('combobox', { name: 'Historical evidence' });
    await expect(history.locator('option:not([disabled])')).toHaveText(['Warp', 'Delamination', 'Strength', 'Print', 'Crack']);
    await history.selectOption('Delamination');
    await expect(history).toHaveValue('Delamination');
    await expect(page.getByRole('link', { name: 'Open Insights' })).toHaveAttribute('href', '#/insights');
    await expect(page.getByText('0.64 on 219 test lots')).toBeVisible();
    await expect(page.getByText('Low confidence in humid months')).toBeVisible();

    const kraft = page.locator('.kr');
    await expectEmphasisCard(kraft);
    await expect(page.locator('.m')).toHaveCSS('background-color', theme === 'dark' ? 'rgb(18, 21, 25)' : 'rgb(238, 240, 242)');
    expect((await page.locator('.pe-map').boundingBox()).width).toBe(768);
    await expectNoRetiredCopy(page);
    // The session's own job is read; the floor lots of other sessions are not.
    expect(calls.filter(call => call.startsWith('GET /jobs/'))).toEqual(['GET /jobs/JOB-TEST-1']);
  });

  test(`Photo diagnosis renders the approved photos in the ${theme} theme`, async ({ page }) => {
    await mockBackend(page);
    await open(page, '#/photo', theme);

    await expect(page.getByRole('heading', { level: 1, name: 'Photo diagnosis' })).toBeVisible();
    await expect(page.getByText('Reads the file once')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Approved photo 1 of 10' })).toBeVisible();
    const thumbs = page.getByRole('group', { name: 'Approved photos' }).getByRole('button');
    await expect(thumbs).toHaveCount(10);
    await expect(thumbs.first()).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('img', { name: /^Example side view of a corrugated board cross-section, not the selected approved photo$/ })).toBeVisible();
    await expect(page.getByText('Example image, not the approved photo')).toHaveCount(0);

    const diagnosis = page.locator('section', { has: page.getByRole('heading', { name: 'Diagnosis' }) });
    await expect(diagnosis.getByText('Not run yet')).toBeVisible();
    await expect(diagnosis.locator('.pd-field')).toHaveText([/Likely defect\s*–/, /What it looked at\s*–/, /Suggested follow-up\s*–/]);
    await expect(diagnosis.getByRole('button', { name: 'Run diagnosis' })).toBeEnabled();
    await expect(diagnosis.getByRole('button', { name: 'Other photo' })).toBeEnabled();

    // No stored accuracy run exists, so the trust card names the gap instead of the design's count.
    const trust = page.locator('.kr');
    await expect(trust.getByRole('heading', { name: 'How far to trust this' })).toBeVisible();
    await expect(trust.getByText(/approved photos is not connected yet, so no match count is shown\./)).toBeVisible();
    await expect(trust.getByText('Not connected', { exact: true })).toHaveCount(0);
    await expect(trust).not.toContainText('7 of 10');
    await expectEmphasisCard(trust);
    await expect(page.locator('.m')).toHaveCSS('background-color', theme === 'dark' ? 'rgb(18, 21, 25)' : 'rgb(238, 240, 242)');
    await expectNoRetiredCopy(page);
  });
}

test('the compare control shows not connected and sends nothing', async ({ page }) => {
  const calls = await mockBackend(page);
  await open(page, '#/explorer');
  const compare = page.getByRole('button', { name: 'Compare HIGH and MEDIUM' });
  await expect(compare).toBeVisible();
  await expect(compare).toBeDisabled();
  await expect(compare).toHaveAccessibleDescription('A comparison only. Changes go through New Lot. Comparing two estimates for one lot is not built yet.');
  await expect(page.getByRole('tabpanel').getByText('Not connected', { exact: true })).toHaveCount(0);

  const before = calls.length;
  await compare.click({ force: true });
  await compare.dispatchEvent('click');
  await page.waitForTimeout(300);
  expect(calls.slice(before)).toEqual([]);
  expect(calls.filter(call => call.includes('/risk/'))).toEqual([]);
});

test('stage tabs follow the keyboard and the stage card follows the tab', async ({ page }) => {
  await mockBackend(page);
  await open(page, '#/explorer');
  const glue = page.getByRole('tab', { name: /Glue/ });
  await glue.focus();
  await page.keyboard.press('ArrowLeft');
  const corrugate = page.getByRole('tab', { name: /Corrugate/ });
  await expect(corrugate).toBeFocused();
  await expect(corrugate).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel').locator('.pe-row')).toHaveText([/Single facer speed\s*No change\s*41 m\/min/, /Roll temperature\s*was 163 °C\s*171 °C/]);
  await expect(page.locator('.pe-call.sel')).toHaveText([/Roll temperature/]);
  await page.keyboard.press('Home');
  await expect(page.getByRole('tab', { name: /Unwind/ })).toBeFocused();
  await expect(page.getByRole('tabpanel')).toContainText('The plan has no setting at this stage.');
  await expect(page.getByRole('tabpanel').getByText('Model estimate')).toHaveCount(0);
});

test('without a lot in this session, the newest floor lot is shown from its changes only', async ({ page }) => {
  const calls = await mockBackend(page, { '/api/arc/session': NOT_ENABLED });
  await open(page, '#/explorer');
  await expect(page.getByText('SKU-FLOOR-7, stage 3 of 5, glue')).toBeVisible();
  await expect(page.locator('.pe-call')).toHaveText([/Gum viscosity\s*30 → 38 s/, /Drying time\s*6 → 8 h/]);
  const panel = page.getByRole('tabpanel');
  await expect(panel.locator('.pe-row')).toHaveText([/Gum viscosity\s*was 30 s\s*38 s/]);
  await expect(panel).toContainText('Newest lot on the floor view, changed settings only.');
  // The floor record has no conditions, so no humidity is shown for it.
  await expect(page.locator('.pe-floor')).toHaveCount(0);
  await page.getByRole('tab', { name: /Corrugate/ }).click();
  await expect(panel).toContainText('The plan changes nothing at this stage.');
  await expect(panel.locator('.pe-row')).toHaveCount(0);
  expect(calls.filter(call => call.startsWith('GET /jobs/'))).toEqual([]);
});

test('Plant Explorer says so when no lot is planned', async ({ page }) => {
  const calls = await mockBackend(page, {
    '/api/arc/session': json(200, { ...SESSION, session: { ...SESSION.session, activeLots: [] } }),
    '/api/lots': json(200, { ok: true, lots: [{ ...FLOOR_LOT, changes: undefined }], events: [] }),
  });
  await open(page, '#/explorer');
  await expect(page.getByRole('tabpanel')).toContainText('No lot is planned yet, so there are no settings to show.');
  await expect(page.locator('.pe-call')).toHaveCount(0);
  await expect(page.locator('.pe-floor')).toHaveCount(0);
  expect(calls.filter(call => call.startsWith('GET /jobs/'))).toEqual([]);
});

test('Plant Explorer reports a failed lot read', async ({ page }) => {
  await mockBackend(page, { '/jobs/JOB-TEST-1': json(503, { ok: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'The stored job could not be retrieved.' } }) });
  await open(page, '#/explorer');
  await expect(page.getByRole('alert')).toHaveText('The current lot could not be read. The stored job could not be retrieved.');
});

test('Model watch never prints a missing sample count', async ({ page }) => {
  await mockBackend(page, { '/api/status': json(200, { ok: true, modelAcceptance: { models: [{ defect: 'PRINT', r2: 0.6404, sampleCount: null }] } }) });
  await open(page, '#/explorer');
  await expect(page.getByText('0.64 on the held-out test lots')).toBeVisible();
  await expect(page.locator('main')).not.toContainText('null');
});

test('an approved photo result shows the label from the response and no source chips', async ({ page }) => {
  const posts = [];
  const calls = await mockBackend(page, {
    '/evidence/classify-photo': route => { posts.push(route.request().postDataJSON()); return route.fulfill(json(200, { ok: true, source: 'vertex-gemini', isRealModelPrediction: true, photoId: 'photo-03', label: 'STRENGTH', model: 'gemini' })); },
  });
  await open(page, '#/photo');
  await page.getByRole('button', { name: 'Approved photo 3' }).click();
  await expect(page.getByRole('heading', { name: 'Approved photo 3 of 10' })).toBeVisible();
  await page.getByRole('button', { name: 'Run diagnosis' }).click();

  const diagnosis = page.locator('section', { has: page.getByRole('heading', { name: 'Diagnosis' }) });
  await expect(diagnosis.getByText('Done')).toBeVisible();
  await expect(diagnosis.locator('.pd-field').first()).toHaveText(/Likely defect\s*Box strength/);
  await expect(diagnosis.locator('.pd-chips')).toHaveCount(0);
  await expect(diagnosis).not.toContainText(/Approved reference photo|Generated by Gemini/);
  await expect(diagnosis.getByText('Uploaded photo', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Run diagnosis' })).toBeDisabled();
  expect(posts).toEqual([{ photoId: 'photo-03' }]);
  expect(calls.filter(call => call === 'POST /evidence/diagnose-photo')).toEqual([]);
});

test('a result that did not come from Gemini shows no Gemini chip', async ({ page }) => {
  await mockBackend(page, {
    '/evidence/classify-photo': json(200, { ok: true, source: 'mock-demo', isRealModelPrediction: false, photoId: 'photo-01', label: 'CRACK' }),
  });
  await open(page, '#/photo');
  await page.getByRole('button', { name: 'Run diagnosis' }).click();
  const diagnosis = page.locator('section', { has: page.getByRole('heading', { name: 'Diagnosis' }) });
  await expect(diagnosis.locator('.pd-field').first()).toHaveText(/Crease cracking/);
  await expect(page.getByText('Generated by Gemini')).toHaveCount(0);
});

test('an uploaded photo is labelled as uploaded, never as an approved reference', async ({ page }) => {
  let uploads = 0;
  await mockBackend(page, {
    '/evidence/diagnose-photo': route => {
      uploads += 1;
      return route.fulfill(json(200, { ok: true, source: 'vertex-gemini', isRealModelPrediction: true, recognised: true,
        diagnosis: { label: 'WARP', severity: 'MEDIUM', confidence: 0.8, visibleSigns: ['Sheet edge lifts at one corner'] } }));
    },
  });
  await open(page, '#/photo');
  await page.locator('input[type=file]').setInputFiles({ name: 'sheet.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]) });
  await expect(page.getByRole('heading', { name: 'Uploaded photo' })).toBeVisible();
  await expect(page.getByText('Do not upload photos of people.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approved photo 1', exact: true })).toHaveAttribute('aria-pressed', 'false');
  expect(uploads).toBe(0);

  await page.getByRole('button', { name: 'Run diagnosis' }).click();
  const diagnosis = page.locator('section', { has: page.getByRole('heading', { name: 'Diagnosis' }) });
  await expect(diagnosis.locator('.pd-field')).toHaveText([/Warp, medium severity/, /Sheet edge lifts at one corner/, /Search past lots with this defect below\./]);
  await expect(diagnosis.locator('.pd-chips')).toHaveCount(0);
  await expect(diagnosis.getByText('Approved reference photo', { exact: true })).toHaveCount(0);
  await expect(diagnosis.getByText('Your photo, not an approved reference photo.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run diagnosis' })).toBeDisabled();
  expect(uploads).toBe(1);
});

test('the privacy note is on the upload control before any file is chosen', async ({ page }) => {
  await mockBackend(page);
  await open(page, '#/photo');
  const note = 'Do not upload photos of people. JPEG, PNG or WebP, up to 8 MiB.';
  await expect(page.getByText(note)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Other photo' })).toHaveAccessibleDescription(note);
  await expect(page.getByLabel('Choose a photo to upload')).toHaveAttribute('aria-describedby', 'pd-upload-note');
});

const REFUSED_FILES = [
  { name: 'board.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a\x01\x00\x01\x00\x00\x00') },
  // A PDF renamed to .jpg: the browser calls it image/jpeg, the first bytes say otherwise.
  { name: 'order.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('%PDF-1.7\n%âãÏÓ\n1 0 obj') },
  { name: 'empty.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(0) },
  { name: 'big.jpg', mimeType: 'image/jpeg', buffer: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(8 * 1024 * 1024)]) },
];

test('a refused file is stopped in the browser and sends nothing', async ({ page }) => {
  const calls = await mockBackend(page);
  await open(page, '#/photo');
  const diagnosis = page.locator('section', { has: page.getByRole('heading', { name: 'Diagnosis' }) });
  for (const file of REFUSED_FILES) {
    await page.locator('input[type=file]').setInputFiles(file);
    await expect(page.getByRole('alert')).toHaveText('Upload a JPEG, PNG or WebP photo up to 8 MiB.');
    await expect(page.getByRole('heading', { name: 'Approved photo 1 of 10' })).toBeVisible();
    // A refusal is not a failed run.
    await expect(diagnosis.getByText('Not run yet')).toBeVisible();
    await expect(diagnosis.getByText('Not run', { exact: true })).toHaveCount(0);
  }
  expect(calls.filter(call => call.startsWith('POST'))).toEqual([]);
});

// Holds a route's answer until the test releases it.
function held(body) {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  return { release, handler: async route => { await gate; await route.fulfill(json(200, body)).catch(() => {}); } };
}

test('a late approved-photo result stays with its photo', async ({ page }) => {
  const late = held({ ok: true, source: 'vertex-gemini', photoId: 'photo-01', label: 'CRACK' });
  await mockBackend(page, { '/evidence/classify-photo': late.handler });
  await open(page, '#/photo');
  const diagnosis = page.locator('section', { has: page.getByRole('heading', { name: 'Diagnosis' }) });

  await page.getByRole('button', { name: 'Run diagnosis' }).click();
  await expect(diagnosis.getByText('Reading the photo').first()).toBeVisible();
  await page.getByRole('button', { name: 'Approved photo 5', exact: true }).click();
  late.release();

  await expect(page.getByRole('heading', { name: 'Approved photo 5 of 10' })).toBeVisible();
  await page.waitForTimeout(300);
  await expect(diagnosis.getByText('Not run yet')).toBeVisible();
  await expect(diagnosis.locator('.pd-field')).toHaveText([/Likely defect\s*–/, /What it looked at\s*–/, /Suggested follow-up\s*–/]);
  await expect(diagnosis.locator('.pd-chips')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Run diagnosis' })).toBeEnabled();

  await page.getByRole('button', { name: 'Approved photo 1', exact: true }).click();
  await expect(diagnosis.locator('.pd-field').first()).toHaveText(/Crease cracking/);
});

test('a late upload result never shows under an approved photo', async ({ page }) => {
  const late = held({ ok: true, source: 'vertex-gemini', recognised: true, diagnosis: { label: 'WARP', severity: 'HIGH', confidence: 0.9, visibleSigns: ['Bowed sheet'] } });
  await mockBackend(page, { '/evidence/diagnose-photo': late.handler });
  await open(page, '#/photo');
  const diagnosis = page.locator('section', { has: page.getByRole('heading', { name: 'Diagnosis' }) });

  await page.locator('input[type=file]').setInputFiles({ name: 'sheet.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]) });
  await expect(page.getByRole('heading', { name: 'Uploaded photo' })).toBeVisible();
  await page.getByRole('button', { name: 'Run diagnosis' }).click();
  await page.getByRole('button', { name: 'Approved photo 2', exact: true }).click();
  late.release();

  await expect(page.getByRole('heading', { name: 'Approved photo 2 of 10' })).toBeVisible();
  await page.waitForTimeout(300);
  await expect(diagnosis.getByText('Not run yet')).toBeVisible();
  await expect(diagnosis).not.toContainText('Warp');
  await expect(diagnosis.getByText('Uploaded photo', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Seen before' })).toHaveCount(0);
});

test('seen before lists past lots and shows the zero-result state', async ({ page }) => {
  const searches = [];
  let reply = { ok: true, source: 'bigquery', defect: 'CRACK', caseCount: 14, avgRateWhenMain: 3.25, costWhenMain: 41250, goodRuns: null, badRuns: null, notes: [] };
  await mockBackend(page, {
    '/evidence/classify-photo': json(200, { ok: true, source: 'vertex-gemini', photoId: 'photo-01', label: 'CRACK' }),
    '/evidence/seen-before': route => { searches.push(route.request().postDataJSON()); return route.fulfill(json(200, reply)); },
  });
  await open(page, '#/photo');
  await page.getByRole('button', { name: 'Run diagnosis' }).click();

  const card = page.locator('section', { has: page.getByRole('heading', { name: 'Seen before' }) });
  await expect(card.getByText('Modeled records')).toHaveCount(0);
  await expect(card.getByLabel('Defect')).toHaveValue('CRACK');
  await expect(card.getByLabel('Humidity, %')).toHaveValue('52');
  await expect(card).not.toContainText(/Weather record|Public weather record/i);
  await expect(card.getByText('No search yet')).toBeVisible();

  await card.getByRole('button', { name: 'Search history' }).click();
  await expect(card.getByText('Past lots', { exact: true })).toBeVisible();
  await expect(card.locator('.pd-stats')).toContainText('14');
  await expect(card.getByText('Average crease cracking rate in those lots')).toBeVisible();
  await expect(card.locator('.pd-stats')).toContainText('3.25');
  await expect(card.locator('.pd-stats')).not.toContainText('Typical scrap');
  await expect(card.locator('.pd-stats')).toContainText('₹41,250');
  expect(searches).toEqual([{ defect: 'CRACK', ambientRhPct: 52 }]);

  reply = { ...reply, caseCount: 0, avgRateWhenMain: 0, costWhenMain: 0 };
  await card.getByLabel('Humidity, %').fill('91');
  await expect(card.getByText('Entered by operator')).toHaveCount(0);
  await card.getByRole('button', { name: 'Search history' }).click();
  await expect(card.getByText('No past lots found')).toBeVisible();
  await expect(card).toContainText('No modeled lot near 91% humidity had crease cracking as its main defect.');
  await expect(card.locator('.pd-stats')).toHaveCount(0);
  expect(searches).toEqual([{ defect: 'CRACK', ambientRhPct: 52 }, { defect: 'CRACK', ambientRhPct: 91 }]);

  await card.getByLabel('Defect').selectOption('');
  await expect(card.getByRole('button', { name: 'Search history' })).toBeDisabled();
  await expect(card.getByText('Pick a defect first.')).toBeVisible();
});

test('the approved photos fail closed when the list cannot be read', async ({ page }) => {
  await mockBackend(page, { '/evidence/approved-photos': json(503, { ok: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'The approved photo classification service is not enabled.' } }) });
  await open(page, '#/photo');
  await expect(page.getByRole('alert')).toContainText('The approved photos could not be read. The approved photo classification service is not enabled.');
  await expect(page.getByRole('button', { name: 'Run diagnosis' })).toBeDisabled();
  await expect(page.getByRole('group', { name: 'Approved photos' })).toHaveCount(0);
});

// Lists the page, plus every element inside main whose content is wider than its box.
async function sidewaysOverflow(page) {
  return page.evaluate(() => {
    const found = [];
    const root = document.documentElement;
    if (root.scrollWidth > root.clientWidth) found.push(`document ${root.scrollWidth} > ${root.clientWidth}`);
    for (const el of document.querySelectorAll('main *')) {
      if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1) found.push(`${el.tagName.toLowerCase()}.${el.className} ${el.scrollWidth} > ${el.clientWidth}`);
    }
    return found;
  });
}

test('#/explorer fits a phone screen without sideways scrolling', async ({ page }) => {
  await mockBackend(page);
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/app/#/explorer');
  await expect(page.locator('.pe-call')).toHaveCount(3);
  await expect(page.locator('.pe-floor')).toBeVisible();
  expect(await sidewaysOverflow(page)).toEqual([]);
});

test('#/photo fits a phone screen with a diagnosis and a history result on it', async ({ page }) => {
  await mockBackend(page, {
    '/evidence/diagnose-photo': json(200, { ok: true, source: 'vertex-gemini', recognised: true,
      diagnosis: { label: 'DELAM', severity: 'MEDIUM', confidence: 0.7, visibleSigns: ['Liner separating from the flute along the long edge of the sheet'] } }),
    '/evidence/seen-before': json(200, { ok: true, source: 'bigquery', defect: 'DELAM', caseCount: 1234, avgRateWhenMain: 12.75, costWhenMain: 1234567, goodRuns: null, badRuns: null, notes: [] }),
  });
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/app/#/photo');
  await expect(page.getByRole('heading', { name: 'Approved photo 1 of 10' })).toBeVisible();
  expect(await sidewaysOverflow(page)).toEqual([]);

  await page.locator('input[type=file]').setInputFiles({ name: 'sheet.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]) });
  await page.getByRole('button', { name: 'Run diagnosis' }).click();
  await expect(page.locator('.pd-field').first()).toHaveText(/Delamination/);
  await page.getByRole('button', { name: 'Search history' }).click();
  await expect(page.locator('.pd-stats')).toContainText('₹12,34,567');
  expect(await sidewaysOverflow(page)).toEqual([]);
});
