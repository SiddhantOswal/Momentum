import { expect, test } from '@playwright/test';

// Preparation Flow, Planning and Operator phone (ARC-M6-06 group D, M6-11 and M6-13 UI only, M6-17).
// Every backend call is answered here, which keeps this file off the server's per-IP limit and
// lets each state be driven by the response shape the real route returns.

const json = (status, body) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
const NOT_ENABLED = json(404, { ok: false, error: { code: 'ARC_NOT_ENABLED', message: 'Arc is not enabled on this deployment.' } });

const JOB_ID = 'JOB-HACK-0123456789abcdef0123456789abcdef-0123456789abcdef0123456789abcdef01234567';
const RUN_ID = '3f0c8a52-6a0e-4b8e-9d39-0c4a1d2e7b10';
const LEVERS = { sfSpeedMpm: 48, rollTempC: 162, gumApplication: 'HIGH', gumViscositySec: 32, pastingPressure: 'MED', dryingHours: 5, printSpeedSpm: 60 };
const RECOMMENDED = { ...LEVERS, rollTempC: 170, gumApplication: 'MED', gumViscositySec: 45 };
const TARGET_USE = {
  WARP: { useClass: 'optimizer', reason: 'r' }, DELAM: { useClass: 'optimizer', reason: 'r' }, STRENGTH: { useClass: 'optimizer', reason: 'r' },
  PRINT: { useClass: 'optimizer', reason: 'r' }, CRACK: { useClass: 'advisory', reason: 'r' },
};
const risk = { ratesPct: { WARP: 1.1, DELAM: 1.2, STRENGTH: 0.7, PRINT: 1.7, CRACK: 0.4 }, totalScrapKg: 60, scrapCost: 3000, currency: 'INR', primaryDefect: 'PRINT', targetUse: TARGET_USE };

function storedJob(status, extra = {}) {
  return {
    jobId: JOB_ID, createdAt: '2026-11-25T09:00:00.000Z', plantId: 'PLANT-1', status,
    order: { orderId: 'PO-TEST-1', itemCode: 'PKBX0041', quantity: 1300 },
    conditions: { runDate: '2026-11-25', shift: 'DAY', ambientRhPct: 42, ambientTempC: 18.5, paperMoisturePct: 7.3 },
    baseline: { levers: LEVERS, risk }, recommended: { levers: RECOMMENDED, risk },
    changes: [
      { lever: 'rollTempC', from: 162, to: 170, reason: 'r' },
      { lever: 'gumApplication', from: 'HIGH', to: 'MED', reason: 'r' },
      { lever: 'gumViscositySec', from: 32, to: 45, reason: 'r' },
    ],
    evidence: [], explanation: 'Stored explanation.', savings: { kg: 1, amount: 1, currency: 'INR' },
    approvedAt: status === 'APPROVED' ? '2026-11-25T10:00:00.000Z' : null,
    cardUri: status === 'APPROVED' ? 'gs://prepagent-hack-data/jobcards/x.pdf' : null,
    ...extra,
  };
}
const liveLot = (status) => ({ lotId: JOB_ID, jobId: JOB_ID, orderId: 'PO-TEST-1', itemCode: 'PKBX0041', quantity: 1300, status, updatedAt: '2026-11-25T10:00:00.000Z' });

/**
 * Answers every backend call. `routes` maps a path (or a path prefix ending in "*") to a
 * response; anything else gets a 404. Returns the list of every request the page made.
 */
async function mockBackend(page, routes = {}) {
  const requests = [];
  page.on('request', (request) => requests.push({ method: request.method(), url: request.url(), body: request.postData() }));
  const answer = (path) => {
    if (path in routes) return routes[path];
    const prefix = Object.keys(routes).find((key) => key.endsWith('*') && path.startsWith(key.slice(0, -1)));
    return prefix ? routes[prefix] : undefined;
  };
  await page.route(/\/(api|jobs|lots)\//, (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/config') return route.fulfill(json(200, { enabled: false, provider: 'firebase-google' }));
    if (path === '/api/status') return route.fulfill(json(200, { ok: true }));
    const response = answer(path);
    if (response) return route.fulfill(response);
    if (path.startsWith('/api/arc/')) return route.fulfill(NOT_ENABLED);
    return route.fulfill(json(404, { ok: false, error: { code: 'NOT_FOUND', message: 'Not found.' } }));
  });
  return requests;
}

async function open(page, path, { theme = 'dark', width = 1440, height = 900 } = {}) {
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ colorScheme: theme });
  await page.goto('about:blank');
  await page.goto(path);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}

const steps = (page) => page.locator('li[data-step]');
async function stepStates(page) {
  await expect(steps(page)).toHaveCount(9);
  return steps(page).evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-state')));
}

async function noHorizontalScroll(page) {
  const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(scroll).toBeLessThanOrEqual(client);
}

const sse = (events) => ({
  status: 200, contentType: 'text/event-stream; charset=utf-8',
  body: events.map((event, index) => {
    const full = { id: `${RUN_ID}:${index + 1}`, runId: RUN_ID, sequence: index + 1, occurredAt: '2026-11-25T10:00:00.000Z', ...event };
    return `id: ${full.id}\nevent: ${full.type}\ndata: ${JSON.stringify(full)}\n\n`;
  }).join(''),
});

for (const theme of ['dark', 'light']) {
  test.describe(`Preparation flow, ${theme}`, () => {
    test('a stored draft shows steps 1 to 6 done and Review plan waiting on a person', async ({ page }) => {
      await mockBackend(page, {
        '/api/lots': json(200, { ok: true, mode: 'memory', lots: [liveLot('planned')], events: [] }),
        [`/jobs/${JOB_ID}`]: json(200, { ok: true, jobSheet: storedJob('DRAFT') }),
      });
      await open(page, '/app/#/prep-flow', { theme });
      await expect(page.getByRole('heading', { name: 'Preparation flow', level: 1 })).toBeVisible();
      expect(await stepStates(page)).toEqual(['done', 'done', 'done', 'done', 'done', 'done', 'now', 'idle', 'idle']);
      const strip = page.getByLabel('Lot status');
      await expect(strip).toContainText('PKBX0041');
      await expect(strip).toContainText('1,300 boxes');
      await expect(strip).toContainText('Review plan');
      await expect(page.getByRole('heading', { name: 'Selected: Review plan' })).toBeVisible();
      await expect(page.getByText('Do the three changes make sense for today\'s floor?')).toBeVisible();
      await expect(page.getByText('Trust the models? Crack is low confidence.')).toBeVisible();
      await expect(page.locator('li[data-step="5"]')).toContainText('Up to 3 changes allowed');
      await expect(page.locator('main')).not.toContainText(/8,640|\+0\.078|Only Print passes|synthetic/i);
    });

    test('Held renders from a lot head on hold, with the toast', async ({ page }) => {
      await mockBackend(page, {
        '/lots/LOT-HELD-1': json(200, { ok: true, lot: { lotId: 'LOT-HELD-1', stage: 'held', currentRevision: 0, currentJobId: null }, revision: null }),
      });
      await open(page, '/app/?lot=LOT-HELD-1#/prep-flow', { theme });
      await expect(page.getByText('Held. Nothing runs after the unclear order.')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Held at the catalog match' })).toBeVisible();
      expect(await stepStates(page)).toEqual(['done', 'held', 'idle', 'idle', 'idle', 'idle', 'idle', 'idle', 'idle']);
      await expect(page.getByRole('heading', { name: 'Ways out of a hold' })).toBeVisible();
      const toast = page.getByRole('alert').filter({ hasText: 'Order is unclear' });
      await expect(toast).toBeVisible();
      await toast.getByRole('button', { name: 'Dismiss' }).click();
      await expect(toast).toHaveCount(0);
    });

    test('Partial renders from a run trace that stopped at the explanation', async ({ page }) => {
      const ok = (tool) => [{ type: 'tool.started', tool }, { type: 'tool.succeeded', tool }];
      await mockBackend(page, {
        [`/api/runs/${RUN_ID}/events`]: sse([
          { type: 'run.started' },
          ...['extractOrder', 'getConditions', 'predictRisk', 'optimizeLevers', 'findSimilarRuns'].flatMap(ok),
          { type: 'tool.started', tool: 'explainRisk' }, { type: 'tool.unavailable', tool: 'explainRisk', errorCode: 'SERVICE_UNAVAILABLE' },
          { type: 'run.failed' },
        ]),
      });
      await open(page, `/app/?run=${RUN_ID}#/prep-flow`, { theme });
      await expect(page.getByRole('heading', { name: 'Stopped at risk evidence' })).toBeVisible();
      expect(await stepStates(page)).toEqual(['done', 'done', 'done', 'done', 'done', 'failed', 'idle', 'idle', 'idle']);
      await expect(page.getByRole('alert').filter({ hasText: 'Explanation did not finish' })).toBeVisible();
      await expect(page.locator('main')).not.toContainText(/8,640|numbers are saved/i);
    });
  });
}

test('an approved job shows every step done, the job record only because a card is stored', async ({ page }) => {
  await mockBackend(page, { [`/jobs/${JOB_ID}`]: json(200, { ok: true, jobSheet: storedJob('APPROVED') }) });
  await open(page, `/app/?job=${JOB_ID}#/prep-flow`);
  expect(await stepStates(page)).toEqual(Array(9).fill('done'));
  await expect(page.getByRole('link', { name: 'Open on the operator\'s phone' })).toHaveAttribute('href', `?job=${JOB_ID}#/operator`);
});

test('an approved job with no stored card leaves the job record not connected', async ({ page }) => {
  await mockBackend(page, { [`/jobs/${JOB_ID}`]: json(200, { ok: true, jobSheet: storedJob('APPROVED', { cardUri: null }) }) });
  await open(page, `/app/?job=${JOB_ID}#/prep-flow`);
  const states = await stepStates(page);
  expect(states[8]).toBe('nc');
});

for (const [name, routes, message] of [
  ['no lots', { '/api/lots': json(200, { ok: true, mode: 'memory', lots: [], events: [] }) }, 'No lot has been planned yet.'],
  ['the lot list failing', { '/api/lots': json(503, { ok: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'x' } }) }, 'The lot list could not be read'],
  ['a lot whose job is not stored', { '/api/lots': json(200, { ok: true, mode: 'memory', lots: [liveLot('planned')], events: [] }) }, 'No stored job has this ID'],
]) {
  test(`with ${name}, no step is shown done`, async ({ page }) => {
    await mockBackend(page, routes);
    await open(page, '/app/#/prep-flow');
    await expect(page.getByText(message)).toBeVisible();
    const states = await stepStates(page);
    expect(states).toEqual(Array(9).fill('nc'));
    await expect(page.locator('li[data-state="done"]')).toHaveCount(0);
  });
}

test('the flow drawing reflows at phone width without horizontal scroll', async ({ page }) => {
  await mockBackend(page, { [`/jobs/${JOB_ID}`]: json(200, { ok: true, jobSheet: storedJob('DRAFT') }) });
  await open(page, `/app/?job=${JOB_ID}#/prep-flow`, { width: 375, height: 812 });
  await expect(steps(page)).toHaveCount(9);
  await noHorizontalScroll(page);
});

const ROADMAP_LABELS = ['Planned', 'Research direction', 'Conceptual scenario', 'Requires hardware', 'Requires validated data', 'Future integration', 'Not in scope', 'Planned, not done'];

for (const theme of ['dark', 'light']) {
  test(`Planning renders in the ${theme} theme and every roadmap item carries a roadmap label`, async ({ page }) => {
    await mockBackend(page);
    await open(page, '/app/#/planning', { theme });
    await expect(page.getByRole('heading', { name: 'Planning', level: 1 })).toBeVisible();
    await expect(page.locator('.ph .pv')).toHaveText('Future, not live');
    const items = page.locator('[data-roadmap-item]');
    expect(await items.count()).toBeGreaterThanOrEqual(20);
    const texts = await items.evaluateAll((nodes) => nodes.map((node) => ({ name: node.getAttribute('data-roadmap-item'), text: node.textContent })));
    for (const { name, text } of texts) {
      expect(ROADMAP_LABELS.some((label) => text.includes(label)), `${name} has a roadmap label`).toBe(true);
    }
    await expect(page.getByText('Scheduling comes later. This screen is a concept.')).toBeVisible();
    await expect(page.locator('main')).not.toContainText(/8,640|Four of five|holdout bar|1,300|synthetic/i);
  });
}

test('the capability explorer changes only what you read, by click and by arrow keys', async ({ page }) => {
  await mockBackend(page);
  await open(page, '/app/#/planning');
  const rail = page.getByRole('group', { name: 'Capabilities' });
  await expect(page.locator('#capability-detail h3')).toHaveText('Production Preflight');
  await rail.getByRole('button', { name: /Factory Time Machine/ }).click();
  await expect(page.locator('#capability-detail h3')).toHaveText('Factory Time Machine');
  await expect(rail.getByRole('button', { name: /Factory Time Machine/ })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#capability-detail h3')).toHaveText('Production Fingerprints');
  await expect(rail.getByRole('button', { name: /Production Fingerprints/ })).toBeFocused();
});

test('Planning has no horizontal scroll at phone width', async ({ page }) => {
  await mockBackend(page);
  await open(page, '/app/#/planning', { width: 375, height: 812 });
  await expect(page.getByRole('heading', { name: 'Planning', level: 1 })).toBeVisible();
  await noHorizontalScroll(page);
});

const operatorRoutes = (status = 'APPROVED', revision) => ({
  [`/jobs/${JOB_ID}`]: json(200, { ok: true, jobSheet: storedJob(status), ...(revision ? { revision } : {}) }),
});

for (const theme of ['dark', 'light']) {
  test(`the operator card renders at 375 px in the ${theme} theme with no horizontal scroll`, async ({ page }) => {
    await mockBackend(page, operatorRoutes('APPROVED', { lotId: 'LOT-1', number: 1, fingerprint: 'f', status: 'APPROVED' }));
    await open(page, `/app/?job=${JOB_ID}#/operator`, { theme, width: 375, height: 812 });
    const card = page.getByRole('region', { name: 'Approved job card' });
    await expect(card.getByRole('heading', { name: 'PKBX0041, Rev 1' })).toBeVisible();
    await expect(card).toContainText('Approved, latest revision');
    await expect(card).toContainText('Modelled on our plant');
    await expect(card).toContainText('Set roll temperature to 170 °C at the single facer.');
    await expect(card).toContainText('was 32 s');
    await expect(card).toContainText('MEDIUM');
    await expect(card.getByRole('link', { name: 'Open the approved PDF' })).toHaveAttribute('href', `/jobs/${JOB_ID}/card.pdf`);
    await expect(card).toContainText('Demo session, simulated');
    await expect(page.locator('.side')).toHaveCount(0);
    await expect(page.locator('main')).not.toContainText(/synthetic/i);
    await noHorizontalScroll(page);
  });
}

test('the receipt and mismatch buttons send nothing', async ({ page }) => {
  const requests = await mockBackend(page, operatorRoutes());
  await open(page, `/app/?job=${JOB_ID}#/operator`, { width: 375, height: 812 });
  const card = page.getByRole('region', { name: 'Approved job card' });
  await expect(card.getByRole('heading', { name: 'PKBX0041' })).toBeVisible();
  const before = requests.length;

  // The button is announced as unavailable (aria-disabled) but still answers a click with the not-connected note.
  const receipt = card.getByRole('button', { name: 'I received this card' });
  await expect(receipt).toHaveAttribute('aria-disabled', 'true');
  await receipt.click({ force: true });
  await expect(card.getByText('Receipts are not recorded yet. Nothing was sent.')).toBeVisible();

  await expect(page.getByRole('region', { name: 'Report a mismatch' })).toHaveCount(0);
  await card.getByRole('button', { name: 'Report a mismatch' }).click();
  const sheet = page.getByRole('region', { name: 'Report a mismatch' });
  await expect(sheet.getByRole('heading', { name: 'Report a mismatch' })).toBeFocused();
  await sheet.getByRole('radio', { name: 'A unit' }).check();
  await sheet.getByLabel('Which setting?').selectOption('rollTempC');
  await sheet.getByLabel('What do you see?').fill('MISMATCH-TEXT-MUST-NOT-LEAVE');
  await sheet.getByRole('button', { name: 'Send to supervisor' }).click({ force: true });
  await sheet.getByRole('button', { name: 'Stop and call supervisor' }).click({ force: true });
  await expect(sheet.getByText(/Mismatch reports are not connected yet. Nothing was sent./)).toBeVisible();
  await page.keyboard.press('Enter');

  const after = requests.slice(before);
  expect(after.filter((request) => request.method !== 'GET')).toEqual([]);
  expect(after.filter((request) => /receipt|mismatch/i.test(request.url))).toEqual([]);
  expect(requests.filter((request) => (request.url + (request.body ?? '')).includes('MISMATCH-TEXT-MUST-NOT-LEAVE'))).toEqual([]);

  await sheet.getByRole('button', { name: 'Close' }).click();
  await expect(sheet).toHaveCount(0);
});

test('the operator page opens the newest approved lot when no job is named', async ({ page }) => {
  await mockBackend(page, {
    '/api/lots': json(200, { ok: true, mode: 'memory', lots: [{ ...liveLot('planned'), lotId: 'OTHER', jobId: 'OTHER' }, liveLot('approved')], events: [] }),
    ...operatorRoutes(),
  });
  await open(page, '/app/#/operator');
  await expect(page.getByRole('region', { name: 'Approved job card' }).getByRole('heading', { name: 'PKBX0041' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Report a mismatch' })).toBeVisible();
});

test('the operator page says what is missing when no card is approved', async ({ page }) => {
  await mockBackend(page, { '/api/lots': json(200, { ok: true, mode: 'memory', lots: [liveLot('planned')], events: [] }) });
  await open(page, '/app/#/operator', { width: 375, height: 812 });
  const card = page.getByRole('region', { name: 'Approved job card' });
  await expect(card).toContainText('No card has been approved yet.');
  await expect(card).toContainText('Not connected');
  await expect(card.getByRole('button')).toHaveCount(0);
});

test('a draft card is not offered to the operator as approved', async ({ page }) => {
  await mockBackend(page, operatorRoutes('DRAFT'));
  await open(page, `/app/?job=${JOB_ID}#/operator`, { width: 375, height: 812 });
  const card = page.getByRole('region', { name: 'Approved job card' });
  await expect(card).toContainText('Draft, not approved');
  await expect(card).not.toContainText('Approved, latest revision');
  await expect(card.getByRole('button', { name: 'I received this card' })).toHaveCount(0);
});

// The floor view lists every session's lots; a job from another demo session reads as 403.
const OTHER = 'JOB-HACK-ffffffffffffffffffffffffffffffff-ffffffffffffffffffffffffffffffffffffffff';
const DEMO_SCOPE = json(403, { ok: false, error: { code: 'DEMO_SCOPE_REQUIRED', message: 'This record does not belong to this demo session.' } });
const otherLot = (status) => ({ ...liveLot(status), lotId: OTHER, jobId: OTHER, updatedAt: '2026-11-25T11:00:00.000Z' });

test('Prep Flow skips lots from other demo sessions and shows this session\'s newest', async ({ page }) => {
  await mockBackend(page, {
    '/api/lots': json(200, { ok: true, mode: 'firestore', lots: [otherLot('planned'), liveLot('planned')], events: [] }),
    [`/jobs/${OTHER}`]: DEMO_SCOPE,
    [`/jobs/${JOB_ID}`]: json(200, { ok: true, jobSheet: storedJob('DRAFT') }),
  });
  await open(page, '/app/#/prep-flow');
  expect(await stepStates(page)).toEqual(['done', 'done', 'done', 'done', 'done', 'done', 'now', 'idle', 'idle']);
});

test('when every listed lot belongs to another session, Prep Flow says so and shows no step done', async ({ page }) => {
  await mockBackend(page, {
    '/api/lots': json(200, { ok: true, mode: 'firestore', lots: [otherLot('planned')], events: [] }),
    [`/jobs/${OTHER}`]: DEMO_SCOPE,
  });
  await open(page, '/app/#/prep-flow');
  await expect(page.getByText('The newest lots belong to other demo sessions.')).toBeVisible();
  expect(await stepStates(page)).toEqual(Array(9).fill('nc'));
});

test('the operator page skips approved cards from other demo sessions', async ({ page }) => {
  await mockBackend(page, {
    '/api/lots': json(200, { ok: true, mode: 'firestore', lots: [otherLot('approved')], events: [] }),
    [`/jobs/${OTHER}`]: DEMO_SCOPE,
  });
  await open(page, '/app/#/operator', { width: 375, height: 812 });
  const card = page.getByRole('region', { name: 'Approved job card' });
  await expect(card).toContainText('The newest approved cards belong to other demo sessions.');
  await expect(card.getByRole('button')).toHaveCount(0);
});
