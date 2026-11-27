import { expect, test } from '@playwright/test';

// Home and Insights against recorded API responses. The values below differ on purpose from the
// live data and from the design PNGs, so a figure on screen can only have come from the mock.
const json = (status, body) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

const JOB_ID = 'JOB-TEST-0001';
const LOTS = {
  ok: true, mode: 'memory', events: [
    { type: 'lot.planned', lotId: JOB_ID, text: 'Lot TESTITEM1 planned · 900 units', at: '2026-11-25T09:00:00.000Z' },
  ],
  lots: [
    { lotId: JOB_ID, jobId: JOB_ID, orderId: 'TEST-PO-1', itemCode: 'TESTITEM1', quantity: 900, status: 'planned',
      totalScrapPct: 6.1, primaryDefect: 'WARP', lowConfidence: ['CRACK'], abstain: [], predictedSaving: 512, currency: 'INR',
      changes: [{ lever: 'rollTempC', from: 160, to: 168 }, { lever: 'gumApplication', from: 'HIGH', to: 'MED' }],
      updatedAt: '2026-11-25T09:00:00.000Z' },
    { lotId: 'JOB-TEST-0000', jobId: 'JOB-TEST-0000', orderId: 'TEST-PO-0', itemCode: 'TESTITEM0', quantity: 400, status: 'approved',
      changes: [], updatedAt: '2026-11-24T09:00:00.000Z' },
  ],
};
const MODELS = [['WARP', 0.4111], ['DELAM', 0.5222], ['STRENGTH', 0.3333], ['PRINT', 0.6644], ['CRACK', -0.0612]];
const STATUS = {
  ok: true,
  modelAcceptance: {
    status: 'accepted', requiredR2: { WARP: 0.6, DELAM: 0.6, STRENGTH: 0.45, PRINT: 0.6, CRACK: 0.3 }, prototypeThresholdsMet: false,
    split: 'holdout-2026-09: test split', evaluatedAt: '2026-11-20T09:10:00Z',
    models: MODELS.map(([defect, r2]) => ({ defect, resource: `prepagent.m2_${defect.toLowerCase()}`, r2, modelVersion: 'v', sampleCount: 150 })),
  },
};
const IMPACT = {
  ok: true, source: 'bigquery',
  kpis: { lotsScored: 123, lotsChanged: 120, netSavingMonth: 4321, kgSavedMonth: 87, scrapPctBefore: 5.55, scrapPctAfter: 4.44, scrapCostBefore: 50000, scrapCostAfter: 45679, currency: 'INR' },
  monthly: [], seasonal: [], topItems: [],
  counterfactual: { month: '2026-09', scrapCost: 45679, currency: 'INR', label: 'September 2026 with agent settings (counterfactual, not observed production)' },
};
const risk = (kg, rates) => ({ ratesPct: rates, totalScrapPct: 6, totalScrapKg: kg, scrapCost: kg * 50, currency: 'INR', primaryDefect: 'WARP' });
const levers = { sfSpeedMpm: 40, rollTempC: 160, gumApplication: 'HIGH', gumViscositySec: 32, pastingPressure: 'MED', dryingHours: 5, printSpeedSpm: 50 };
const JOB = {
  ok: true,
  jobSheet: {
    jobId: JOB_ID, createdAt: '2026-11-25T09:00:00.000Z', plantId: 'P1', status: 'DRAFT', approvedAt: null, cardUri: null,
    order: { orderId: 'TEST-PO-1', itemCode: 'TESTITEM1', customerId: 'C1', boxStyle: 'RSC', lengthMm: 300, widthMm: 200, heightMm: 150,
      ply: 5, fluteProfile: 'BC', topLinerGsm: 150, fluteGsm: 120, innerLinerGsm: 150, linerBf: 18, paperType: 'RECYCLED',
      paperSupplier: 'S1', inkColors: 1, inkCoveragePct: 10, quantity: 900, sourcePoNumber: 'PO-1' },
    conditions: { runDate: '2026-11-25', shift: 'DAY', ambientRhPct: 55, ambientTempC: 27, paperMoisturePct: 8.1, supervisorConfirmed: true, conditionSource: 'manual-entry' },
    baseline: { levers, risk: risk(70.2, { WARP: 2.1, DELAM: 1.9, STRENGTH: 0.8, PRINT: 1.2, CRACK: 0.6 }) },
    recommended: { levers: { ...levers, rollTempC: 168, gumApplication: 'MED' }, risk: {
      ...risk(61.5, { WARP: 1.7, DELAM: 1.6, STRENGTH: 0.8, PRINT: 1.2, CRACK: 0.6 }),
      targetUse: Object.fromEntries(['WARP', 'DELAM', 'STRENGTH', 'PRINT', 'CRACK'].map(defect => [defect,
        defect === 'CRACK' ? { useClass: 'advisory', reason: 'Little skill on the holdout.' } : { useClass: 'optimizer', reason: 'Counted.' }])),
    } },
    changes: [{ lever: 'rollTempC', from: 160, to: 168, reason: 'r' }, { lever: 'gumApplication', from: 'HIGH', to: 'MED', reason: 'r' }],
    evidence: [], explanation: 'Stored text.', savings: { kg: 8.7, amount: 435, currency: 'INR' },
  },
};
const EXPLANATION = {
  ok: true, source: 'bigquery-ml-and-gemini', explanation: 'Text.',
  rows: [
    { defect: 'WARP', predictedPct: 1.7, typicalPct: 1.5, driverRank: 1, driver: 'ambient_rh_pct', attributionPts: 0.512 },
    { defect: 'WARP', predictedPct: 1.7, typicalPct: 1.5, driverRank: 2, driver: 'drying_hours', attributionPts: 0.033 },
    { defect: 'WARP', predictedPct: 1.7, typicalPct: 1.5, driverRank: 3, driver: 'gum_application', attributionPts: -0.104 },
    { defect: 'DELAM', predictedPct: 1.6, typicalPct: 1.4, driverRank: 1, driver: 'gum_viscosity_sec', attributionPts: 0.271 },
    { defect: 'CRACK', predictedPct: 0.6, typicalPct: 0.5, driverRank: 1, driver: 'paper_moisture_pct', attributionPts: 0.044 },
  ],
  evidenceRefs: [],
};
const NOT_ENABLED = json(404, { ok: false, error: { code: 'ARC_NOT_ENABLED', message: 'Arc is not enabled on this deployment.' } });
const PASS_WORDING = /pass level|meets pass|below pass|needs 0\.\d|earlier check|synthetic/i;

/** Answers every API call the two pages make; `overrides` replaces one route's response. */
async function mockApi(page, overrides = {}) {
  const reply = (key, fallback) => (key in overrides ? overrides[key] : fallback);
  const calls = { explanation: [] };
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/config') return route.fulfill(json(200, { enabled: false, provider: 'firebase-google' }));
    if (path === '/api/status') return route.fulfill(reply('status', json(200, STATUS)));
    if (path === '/api/lots') return route.fulfill(reply('lots', json(200, LOTS)));
    if (path === '/api/live') {
      const view = JSON.parse(reply('lots', json(200, LOTS)).body);
      return route.fulfill({ status: 200, contentType: 'text/event-stream', body: `event: floor\ndata: ${JSON.stringify({ lots: view.lots ?? [], events: view.events ?? [] })}\n\n` });
    }
    return route.fulfill(NOT_ENABLED);
  });
  await page.route('**/impact/summary', route => route.fulfill(reply('impact', json(200, IMPACT))));
  await page.route('**/jobs/*', route => route.fulfill(reply('job', json(200, JOB))));
  await page.route('**/risk/explanation', async route => {
    calls.explanation.push(route.request().postDataJSON());
    // Held open so repeated clicks land while the first request is still in flight.
    if (overrides.explanationDelayMs) await new Promise(resolve => setTimeout(resolve, overrides.explanationDelayMs));
    return route.fulfill(reply('explanation', json(200, EXPLANATION)));
  });
  return calls;
}

async function open(page, hash, theme = 'dark') {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: theme });
  await page.goto('/app/' + hash);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}

for (const theme of ['dark', 'light']) {
  test(`Home shows the mocked lots, plan and model scores in the ${theme} theme`, async ({ page }) => {
    await mockApi(page);
    await open(page, '#/home', theme);
    const main = page.locator('main');

    await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeAttached();
    await expect(page.getByRole('heading', { name: 'Start with a sample order.' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Try a sample order' }).first()).toHaveAttribute('href', '#/new-lot/order');
    await expect(main.getByText('Modelled on our plant')).toHaveCount(0);

    await expect(main.getByText('Latest prepared run, TESTITEM1')).toBeVisible();
    await expect(main.getByText('70.2 → 61.5')).toBeVisible();
    await expect(main.getByText('Model estimate, predicted')).toHaveCount(0);

    const route = page.getByRole('region', { name: 'Production route' });
    await expect(route).toContainText('2 settings change, at Single facer and Pasting');
    await expect(route).toContainText('160 → 168 °C');
    await expect(route).toContainText('HIGH → MEDIUM');

    const orders = page.getByRole('region', { name: 'Approved sample orders' });
    await expect(orders).not.toContainText('Newest first');
    await expect(orders).not.toContainText('Not connected');
    const table = page.getByRole('table', { name: 'Lots from approved sample orders' });
    const first = table.getByRole('row').nth(1);
    await expect(first).toContainText('TESTITEM1');
    await expect(first).toContainText('Stage not recorded');
    await expect(first).toContainText('Crack: low confidence');
    await expect(first).toContainText('Ready for review');
    await expect(table.getByRole('row').nth(2)).toContainText('Approved');
    await expect(main.getByText('Humidity 55% confirmed. Paper moisture 8.1%.')).toBeVisible();

    const card = page.getByRole('region', { name: 'Job card' });
    await expect(card).toContainText('TESTITEM1');
    await expect(card).toContainText('Recycled 5-ply BC, 900 boxes');
    await expect(card).toContainText('160 → 168 °C');
    await expect(card).not.toContainText('Sample, not approved');

    const trust = page.getByRole('region', { name: 'How far to trust each model' });
    await expect(trust).toContainText('Fit score on 150 test lots.');
    for (const value of ['0.41', '0.52', '0.33', '0.66', '−0.06']) await expect(trust).toContainText(value);
    await expect(trust.getByText('Low confidence')).toHaveCount(1);

    const steps = page.getByRole('region', { name: 'Latest run steps' });
    await expect(steps).toContainText('900 boxes');
    await expect(steps.getByRole('listitem').nth(2)).toHaveText('Done: Conditions confirmedHumidity 55%');
    await expect(steps).toContainText('2 settings changed');

    await expect(page.getByRole('table', { name: 'Recent activity' })).toContainText('Lot TESTITEM1 planned · 900 units');
    await expect(page.getByRole('region', { name: 'Activity' })).not.toContainText(/\b(Live|Connecting|Offline)\b/);
    expect(await main.innerText()).not.toMatch(PASS_WORDING);
  });

  test(`Insights shows the mocked impact and model scores in the ${theme} theme`, async ({ page }) => {
    await mockApi(page);
    await open(page, '#/insights', theme);
    const main = page.locator('main');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Insights');
    await expect(page.getByRole('region', { name: 'Lots scored' })).toContainText('123lots');
    await expect(page.getByRole('region', { name: 'Lots scored' })).toContainText('120 with changed settings');
    await expect(page.getByRole('region', { name: 'Modeled scrap' })).toContainText('4.44%');
    await expect(page.getByRole('region', { name: 'Modeled scrap' })).toContainText('Down from 5.55%');
    const saving = page.getByRole('region', { name: 'Modeled saving' });
    await expect(saving).toContainText('₹4,321');
    await expect(saving).toContainText('In one held-out month. Not a measured saving.');
    await expect(saving).not.toContainText('a month');
    await expect(page.getByRole('region', { name: 'Board saved' })).toContainText('87kg');
    await expect(main.getByText('Model estimate', { exact: true })).toHaveCount(0);
    await expect(main.getByText('Modeled records', { exact: true })).toHaveCount(0);

    const compare = page.getByRole('region', { name: 'Held-out month, September 2026' });
    for (const value of ['5.55%', '4.44%', '₹50,000', '₹45,679']) await expect(compare).toContainText(value);
    await expect(compare).toContainText('Modeled, one held-out month. Not a measured saving.');

    const fit = page.getByRole('region', { name: 'How well the five models hold up' });
    await expect(fit).toContainText('150 test lots, September 2026');
    await expect(fit.getByRole('list', { name: 'Fit score on held-out test lots' }).getByRole('listitem'))
      .toHaveText(['Warp0.41', 'Delamination0.52', 'Strength0.33', 'Print0.66', 'Crack−0.06low confidence']);
    await expect(page.getByRole('region', { name: 'Reading this chart' })).toContainText('Crack is −0.06. Low confidence.');

    const settings = page.getByRole('region', { name: 'Two settings changed' });
    await expect(settings).toContainText('Roll temperature160 → 168 °C');
    await expect(settings).toContainText('Gum applicationHIGH → MEDIUM');

    await expect(page.getByRole('region', { name: 'Software checks' })).toContainText('No stored test-run summary yet.');
    await expect(page.getByRole('region', { name: 'Photo diagnosis' })).toContainText('No stored accuracy run over the ten approved photos yet');
    await expect(page.getByRole('region', { name: 'Approved job card' })).toContainText('The card check does not return a page count or file size yet.');
    for (const title of ['Software checks', 'Photo diagnosis', 'Approved job card']) {
      await expect(page.getByRole('region', { name: title })).not.toContainText('Not connected');
    }
    await expect(page.getByRole('region', { name: 'Capacity' })).toContainText('No machine or workforce data is read today.');
    for (const title of ['Defect intelligence', 'Delivery timeline', 'Throughput', 'Capacity', 'Production planning']) {
      await expect(page.getByRole('region', { name: title })).not.toContainText(/Not connected|Empty until lot history is connected|Sample|Future/);
    }
    await expect(page.getByRole('status').filter({ hasText: 'Crack model: low confidence' })).toBeVisible();
    const text = await main.innerText();
    expect(text).not.toMatch(PASS_WORDING);
    for (const stale of ['43 passed', '7 of 10', '16,994', '₹925', '100.4', '+0.751']) expect(text).not.toContain(stale);
  });
}

test('Home shows not-connected states, not numbers, when records are missing', async ({ page }) => {
  await mockApi(page, {
    status: json(503, { ok: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'Down.' } }),
    lots: json(200, { ok: true, lots: [], events: [] }),
  });
  await open(page, '#/home');
  const trust = page.getByRole('region', { name: 'How far to trust each model' });
  await expect(trust).toContainText('Model scores could not be read from the status route, so no score is shown.');
  await expect(trust).not.toContainText('Not connected');
  await expect(trust).not.toContainText(/\d\.\d\d/);
  await expect(page.locator('main').getByText('No prepared run yet. Try a sample order to make one.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Production route' })).toContainText('No stored plan yet');
  await expect(page.getByRole('region', { name: 'Job card' })).toContainText('No draft is waiting for approval.');
  await expect(page.getByRole('table', { name: 'Lots from approved sample orders' })).toContainText('No lots yet.');
  await expect(page.getByRole('table', { name: 'Recent activity' })).toContainText('No activity recorded yet.');
});

test('Home hides scrap figures from a job planned in another session', async ({ page }) => {
  await mockApi(page, { job: json(403, { ok: false, error: { code: 'DEMO_SCOPE_REQUIRED', message: 'This record does not belong to this demo session.' } }) });
  await open(page, '#/home');
  await expect(page.locator('main').getByText('Its scrap figures open in the session that planned it.')).toBeVisible();
  await expect(page.locator('main')).not.toContainText('70.2');
  await expect(page.getByRole('region', { name: 'Job card' })).toContainText('900 boxes');
});

test('Insights shows not-connected states when impact and scores are missing', async ({ page }) => {
  const down = json(503, { ok: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'Down.' } });
  await mockApi(page, { impact: down, status: down, lots: json(200, { ok: true, lots: [], events: [] }) });
  await open(page, '#/insights');
  await expect(page.getByRole('region', { name: 'Impact' })).toContainText('The impact summary could not be read, so no saving or scrap figure is shown.');
  await expect(page.getByRole('region', { name: 'How well the five models hold up' })).toContainText('Model scores could not be read from the status route, so no score is shown.');
  for (const title of ['Impact', 'How well the five models hold up']) {
    await expect(page.getByRole('region', { name: title })).not.toContainText('Not connected');
  }
  await expect(page.getByRole('region', { name: 'What moved the estimate' })).toContainText('No stored lot to explain yet.');
  await expect(page.locator('main')).not.toContainText('₹');
  await expect(page.getByRole('status').filter({ hasText: 'low confidence' })).toHaveCount(0);
});

test('What moved the estimate sends the stored plan and shows the rows exactly as returned', async ({ page }) => {
  const calls = await mockApi(page);
  await open(page, '#/insights');
  const panel = page.getByRole('region', { name: 'What moved the estimate' });
  await expect(panel.getByRole('combobox', { name: 'Lot' })).toHaveValue(JOB_ID);
  expect(calls.explanation).toHaveLength(0);

  await panel.getByRole('button', { name: 'Show what moved the estimate' }).click();
  await expect(panel.getByTestId('attribution-value')).toHaveText(['+0.512', '+0.033', '−0.104']);
  await expect(panel).toContainText('Humidity');
  await expect(panel).toContainText('Orange raises Warp risk. Green lowers it.');
  expect(calls.explanation).toHaveLength(1);
  const [body] = calls.explanation;
  expect(body.order).not.toHaveProperty('sourcePoNumber');
  expect(body.conditions).toEqual({ runDate: '2026-11-25', shift: 'DAY', ambientRhPct: 55, ambientTempC: 27, paperMoisturePct: 8.1 });
  expect(body.prediction).toEqual(JOB.jobSheet.baseline.risk);
  expect(body.optimization.best).toEqual(JOB.jobSheet.recommended);
  expect(body.optimization.savings).toEqual({ kg: 8.7, inr: 435 });

  await panel.getByRole('button', { name: 'Delamination' }).click();
  await expect(panel.getByTestId('attribution-value')).toHaveText(['+0.271']);
  await expect(panel).toContainText('Gum viscosity');
});

test('a failed explanation shows the server message and no rows', async ({ page }) => {
  await mockApi(page, { explanation: json(503, { ok: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'The evidence-grounded risk explanation is temporarily unavailable.' } }) });
  await open(page, '#/insights');
  const panel = page.getByRole('region', { name: 'What moved the estimate' });
  await panel.getByRole('button', { name: 'Show what moved the estimate' }).click();
  await expect(panel.getByRole('alert')).toHaveText('The evidence-grounded risk explanation is temporarily unavailable.');
  await expect(panel.getByTestId('attribution-value')).toHaveCount(0);
});

test('Ask Insights opens the Arc panel instead of a separate chat', async ({ page }) => {
  await mockApi(page);
  await open(page, '#/insights');
  await page.getByRole('button', { name: 'Ask Insights' }).click();
  await expect(page.getByRole('dialog', { name: 'Arc by Momentum' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close Arc by Momentum' })).toBeVisible();
});

test('the pause control stops the Insights animation and is announced', async ({ page }) => {
  await mockApi(page);
  await open(page, '#/insights');
  const pause = page.getByRole('button', { name: 'Pause or resume' });
  await pause.focus();
  await page.keyboard.press('Enter');
  await expect(pause).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.in-mo')).toHaveClass(/paused/);
});

test('Home shows conditions as entered, not confirmed, when the record says so', async ({ page }) => {
  const unconfirmed = structuredClone(JOB);
  unconfirmed.jobSheet.conditions.supervisorConfirmed = false;
  await mockApi(page, { job: json(200, unconfirmed) });
  await open(page, '#/home');
  const steps = page.getByRole('region', { name: 'Latest run steps' });
  await expect(steps.getByRole('listitem').nth(2)).toHaveText('Not done: Conditions confirmedEntered, not confirmed');
  await expect(page.locator('main').getByText('Humidity 55% entered. Paper moisture 8.1%.')).toBeVisible();
});

test('Home shows no figures from a job record that belongs to another lot', async ({ page }) => {
  const other = structuredClone(JOB);
  other.jobSheet.jobId = 'JOB-TEST-9999';
  await mockApi(page, { job: json(200, other) });
  await open(page, '#/home');
  await expect(page.locator('main').getByText('Its scrap figures open in the session that planned it.')).toBeVisible();
  await expect(page.locator('main')).not.toContainText('70.2');
  await expect(page.locator('main')).not.toContainText('Recycled 5-ply');
  await expect(page.getByRole('region', { name: 'Latest run steps' }).getByRole('listitem').nth(2)).toHaveText('Not done: Conditions confirmedNot known here');
});

test('attribution labels a defect the stored plan marks advisory as low confidence', async ({ page }) => {
  await mockApi(page);
  await open(page, '#/insights');
  const panel = page.getByRole('region', { name: 'What moved the estimate' });
  await panel.getByRole('button', { name: 'Show what moved the estimate' }).click();
  await expect(panel.getByTestId('attribution-value')).toHaveText(['+0.512', '+0.033', '−0.104']);
  await expect(panel.getByTestId('attribution-confidence')).toHaveCount(0);
  await panel.getByRole('button', { name: 'Crack' }).click();
  await expect(panel.getByTestId('attribution-value')).toHaveText(['+0.044']);
  await expect(panel.getByTestId('attribution-confidence')).toHaveText('Low confidence. Supervised use only.');
});

test('a double click on the explanation button sends one request', async ({ page }) => {
  const calls = await mockApi(page, { explanationDelayMs: 600 });
  await open(page, '#/insights');
  const panel = page.getByRole('region', { name: 'What moved the estimate' });
  await panel.getByRole('button', { name: 'Show what moved the estimate' }).dblclick();
  await expect(panel.getByTestId('attribution-value')).toHaveText(['+0.512', '+0.033', '−0.104']);
  expect(calls.explanation).toHaveLength(1);
});

test('three clicks in one task send one explanation request', async ({ page }) => {
  const calls = await mockApi(page, { explanationDelayMs: 600 });
  await open(page, '#/insights');
  const button = page.getByRole('region', { name: 'What moved the estimate' }).getByRole('button', { name: 'Show what moved the estimate' });
  await button.evaluate(element => { element.click(); element.click(); element.click(); });
  await expect(page.getByTestId('attribution-value')).toHaveText(['+0.512', '+0.033', '−0.104']);
  expect(calls.explanation).toHaveLength(1);
});

// 720 px wide is the 1440 px design at 200% zoom.
for (const hash of ['#/home', '#/insights']) {
  test(`${hash} fits at phone width and at 200% zoom, with nothing scrolling sideways inside main`, async ({ page }) => {
    await mockApi(page);
    for (const width of [375, 720]) {
      await page.setViewportSize({ width, height: 812 });
      await page.goto('about:blank');
      await page.goto('/app/' + hash);
      await expect(page.locator('main .cd').first()).toBeVisible();
      await expect(page.locator('main').getByText(hash === '#/home' ? 'TESTITEM1' : '₹4,321').first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      // Text kept only for screen readers is clipped on purpose, and shapes inside an SVG are
      // clipped by the SVG's own box, which is checked; both are left out.
      const wide = await page.locator('main').evaluate((main, limit) => [main, ...main.querySelectorAll('*')]
        .filter(element => !(element instanceof SVGElement && element.ownerSVGElement))
        .filter(element => {
          for (let node = element; node && node !== main.parentElement; node = node.parentElement) {
            if (getComputedStyle(node).clip.startsWith('rect')) return false;
          }
          return true;
        })
        .filter(element => element.scrollWidth > element.clientWidth + 1 || element.getBoundingClientRect().right > limit + 1)
        .map(element => `${element.tagName.toLowerCase()}.${element.getAttribute('class') ?? ''} ${element.scrollWidth}/${element.clientWidth}`), width);
      expect(wide, `${hash} at ${width} px`).toEqual([]);
    }
  });
}
