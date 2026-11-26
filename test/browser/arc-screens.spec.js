import { expect, test } from '@playwright/test';

// Recorded shapes, written to match the real routes: event frames as src/arc/turn-runner.js
// eventView sends them, turns as run-view.js turnView builds them, and the dashboard records as
// GET /jobs/:id, GET /lots/:lotId, GET /evidence/approved-photos and POST /evidence/seen-before
// return them. Every figure here is a test value, not a design or plant figure.

const json = (status, body) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
const NOT_ENABLED = json(404, { ok: false, error: { code: 'ARC_NOT_ENABLED', message: 'Arc is not enabled on this deployment.' } });
const SESSION_ID = '3f0c9a1e5b7d4c2a8e6f1b0d9c7a5e34';
const LOT_ID = `LOT-HACK-${SESSION_ID}-a1b2c3d4e5f6`;
const JOB_ID = `JOB-HACK-${SESSION_ID}-0123456789abcdef0123456789abcdef01234567`;
const REVIEW_ID = '7d2f0a3c-1b4e-4c8a-9e6d-5f3a2b1c0d9e';
const FINGERPRINT = 'f'.repeat(16) + '0'.repeat(48);
const RUN_ID = 'b1c2d3e4-f5a6-4b7c-8d9e-0a1b2c3d4e5f';
const session = (patch = {}) => json(200, { ok: true, session: {
  authorizationMode: 'HACKATHON_DEMO', identityLabel: 'Demo session, simulated', expiresAt: '2026-11-25T12:00:00.000Z',
  activeLots: [], jobIds: [], activeTaskRunId: null, resumable: false, turnCount: 0, ...patch,
} });

const LABELS = {
  read_order: 'Reading the order', set_conditions: 'Saving the conditions', plan_lot: 'Planning the lot',
  diagnose_approved_photo: 'Checking the photo', get_status: 'Reading the data', query_metric: 'Reading the data',
  confirm_order: 'Confirming the order', confirm_conditions: 'Saving the conditions', approve: 'Waiting for your approval',
};
const label = (tool) => LABELS[tool] ?? 'Working on this step';

function frames(events) {
  return ': keep-alive\n\n' + events.map((event) =>
    `${event.sequence > 0 ? `id: ${event.sequence}\n` : ''}event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join('');
}
const sse = (events) => ({ status: 200, contentType: 'text/event-stream; charset=utf-8', headers: { 'Arc-Turn': 'accepted' }, body: frames(events) });

/** A run of one tool step. `end` is 'succeeded' (with resultRef), or a stop: { type, errorCode, retrySafe } or { waitingFor }. */
function oneStep(clientTurnId, { tool, kind, resultRef = null, end = 'succeeded' }) {
  const base = { clientTurnId };
  const step = { ...base, stepId: 'step_1', tool, label: label(tool) };
  const events = [
    { ...base, sequence: 1, type: 'run.started', taskRunId: RUN_ID, kind },
    { ...step, sequence: 2, type: 'step.started' },
  ];
  if (end === 'succeeded') {
    events.push({ ...step, sequence: 3, type: 'step.succeeded', resultRef },
      { ...base, sequence: 4, type: 'answer', resultRef: { kind: 'turn', id: clientTurnId } },
      { ...base, sequence: 5, type: 'run.completed' });
  } else if (end.waitingFor) {
    events.push({ ...step, sequence: 3, type: 'step.waiting_for_user', waitingFor: end.waitingFor });
  } else {
    events.push({ ...step, sequence: 3, type: end.type, errorCode: end.errorCode, retrySafe: end.retrySafe });
  }
  return events;
}
/**
 * A fixed action's run as the turn runner sends it: each tool step started and succeeded, then,
 * when the action hands over to the person, a step waiting for them and the answer with no run.completed.
 */
function actionRun(clientTurnId, { steps, waitingFor }) {
  const base = { clientTurnId };
  let sequence = 0;
  const events = [{ ...base, sequence: ++sequence, type: 'run.started', taskRunId: RUN_ID, kind: 'lot_preparation' }];
  steps.forEach(({ tool, resultRef = null }, index) => {
    const step = { ...base, stepId: `step_${index + 1}`, tool, label: label(tool) };
    events.push({ ...step, sequence: ++sequence, type: 'step.started' }, { ...step, sequence: ++sequence, type: 'step.succeeded', resultRef });
  });
  if (waitingFor) {
    events.push({ ...base, sequence: ++sequence, type: 'step.waiting_for_user', stepId: `step_${steps.length + 1}`, tool: waitingFor, label: label(waitingFor), waitingFor });
  }
  events.push({ ...base, sequence: ++sequence, type: 'answer', resultRef: { kind: 'turn', id: clientTurnId } });
  if (!waitingFor) events.push({ ...base, sequence: ++sequence, type: 'run.completed' });
  return events;
}
const REVIEW = { reviewId: REVIEW_ID, expiresAt: '2026-11-25T10:30:00.000Z', readByGemini: true,
  lines: [{ lineIndex: 0, sourcePage: 1, itemCode: 'PKBX0041', quantity: 1300, status: 'MATCHED' }] };
async function mockReview(page, review = REVIEW) {
  const reads = [];
  await page.route(/\/api\/arc\/reviews\/[^/]+$/, (route) => { reads.push(route.request().url()); return route.fulfill(json(200, { ok: true, review })); });
  return reads;
}

const noRun = (clientTurnId) => [{ sequence: 0, type: 'answer', clientTurnId, resultRef: { kind: 'turn', id: clientTurnId } }];

function turnRecord(clientTurnId, input, answer, taskRunId = RUN_ID) {
  return json(200, { ok: true, turn: {
    clientTurnId, taskRunId, status: 'complete', createdAt: '2026-11-25T10:00:00.000Z', errorCode: null,
    input: input.kind === 'text' ? input : { kind: 'action', actionId: input.actionId }, answer,
  } });
}

/**
 * Answers each POST /api/arc/turns with the next script in order. A script is
 * { events: (clientTurnId) => events, answer, taskRunId }. Returns the posted bodies.
 */
async function mockTurns(page, scripts, sessionResponse = session()) {
  const posts = [];
  const answers = new Map();
  await page.route('**/api/arc/session', (route) => route.fulfill(sessionResponse));
  await page.route('**/api/arc/turns', (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const body = route.request().postDataJSON();
    const script = scripts[Math.min(posts.length, scripts.length - 1)];
    posts.push(body);
    answers.set(body.clientTurnId, { script, input: body.input });
    return route.fulfill(sse(script.events(body.clientTurnId)));
  });
  await page.route(/\/api\/arc\/turns\/[0-9a-f-]{36}$/, (route) => {
    const id = new URL(route.request().url()).pathname.split('/').pop();
    const { script, input } = answers.get(id);
    return route.fulfill(turnRecord(id, input, script.answer ?? { text: 'Arc finished the requested steps.', generatedByGemini: false, writerOutcome: 'not_called', blocks: [] },
      script.taskRunId === undefined ? RUN_ID : script.taskRunId));
  });
  return posts;
}

const levers = (patch = {}) => ({ sfSpeedMpm: 48, rollTempC: 162, gumApplication: 'HIGH', gumViscositySec: 32, pastingPressure: 'MED', dryingHours: 5, printSpeedSpm: 60, ...patch });
const risk = (totalScrapKg, scrapCost, ratesPct) => ({ ratesPct, totalScrapPct: 4.2, totalScrapKg, scrapCost, currency: 'INR', primaryDefect: 'PRINT' });
const DRAFT = {
  jobId: JOB_ID, createdAt: '2026-11-25T09:58:00.000Z', plantId: 'PUNE-01', status: 'DRAFT',
  order: { orderId: 'TEST-CLA/PO/2026/1047', itemCode: 'PKBX0041', customerId: 'CLA', boxStyle: 'RSC', lengthMm: 400, widthMm: 300, heightMm: 250,
    ply: 5, fluteProfile: 'BC', topLinerGsm: 180, fluteGsm: 120, innerLinerGsm: 150, linerBf: 20, paperType: 'RECYCLED', paperSupplier: 'SUP-1',
    inkColors: 2, inkCoveragePct: 30, quantity: 1300 },
  conditions: { runDate: '2026-11-25', shift: 'DAY', ambientRhPct: 44, ambientTempC: 19.5, paperMoisturePct: 7.1, conditionSource: 'manual-entry' },
  baseline: { levers: levers(), risk: risk(71.2, 3800, { WARP: 1.2, DELAM: 1.1, STRENGTH: 0.71, PRINT: 1.7, CRACK: 0.3 }) },
  recommended: { levers: levers({ rollTempC: 170, gumApplication: 'MED', gumViscositySec: 45 }), risk: risk(64.5, 3440, { WARP: 1.0, DELAM: 1.0, STRENGTH: 0.73, PRINT: 1.5, CRACK: 0.3 }) },
  changes: [
    { lever: 'rollTempC', from: 162, to: 170, reason: 'Lower warp risk.' },
    { lever: 'gumApplication', from: 'HIGH', to: 'MED', reason: 'Lower delamination risk.' },
    { lever: 'gumViscositySec', from: 32, to: 45, reason: 'Steadier bond.' },
  ],
  evidence: [], explanation: 'Test explanation text.', savings: { kg: 6.7, amount: 360, currency: 'INR' },
  approvedAt: null, cardUri: null, approvalAudit: null,
};
const REVISION = { lotId: LOT_ID, number: 1, fingerprint: FINGERPRINT, status: 'CURRENT' };
const APPROVED = {
  ...DRAFT, status: 'APPROVED', approvedAt: '2026-11-25T10:05:00.000Z', cardUri: `gs://prepagent-hack-data/jobcards/${JOB_ID}.pdf`,
  approvalAudit: { jobId: JOB_ID, actorUid: 'demo:3f0c', actorType: 'HACKATHON_DEMO_PARTICIPANT', authorizationMode: 'HACKATHON_DEMO', identityProvider: 'server-signed-demo-session',
    authenticatedHuman: false, action: 'APPROVE', previousStatus: 'DRAFT', newStatus: 'APPROVED', decidedAt: '2026-11-25T10:05:00.000Z',
    correlationId: '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', decisionId: '1a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', cardUri: `gs://prepagent-hack-data/jobcards/${JOB_ID}.pdf` },
};
const LOT = {
  lotId: LOT_ID, stage: 'conditions', currentRevision: 0, currentJobId: null, version: 3, updatedAt: '2026-11-25T09:50:00.000Z',
  draftConditions: [
    { field: 'ambientRhPct', value: 44, unit: '% RH', provenance: 'operator_entry', sourceDetail: 'confirmed', label: 'Confirmed by operator', enteredByRole: 'Operator session', confirmed: true },
    { field: 'paperMoisturePct', value: 7.1, unit: '%', provenance: 'synthetic_example', sourceDetail: 'example', label: 'Example value', confirmed: false },
  ],
};

async function mockJob(page, { job = DRAFT, revision = REVISION, approve } = {}) {
  const approvals = [];
  await page.route(/\/jobs\/[^/]+$/, (route) => route.fulfill(json(200, { ok: true, jobSheet: job, ...(revision ? { revision } : {}) })));
  await page.route(/\/jobs\/[^/]+\/approve$/, (route) => {
    approvals.push({ body: route.request().postDataJSON(), headers: route.request().headers() });
    return route.fulfill(approve ?? json(200, { ok: true, agent: 'approveJob', jobSheet: APPROVED, cardUri: APPROVED.cardUri }));
  });
  return approvals;
}

// The test server allows 60 /api requests a minute per IP for the whole run, so every /api call is answered here.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/config') return route.fulfill(json(200, { enabled: false, provider: 'firebase-google' }));
    if (path === '/api/status') return route.fulfill(json(200, { ok: true }));
    return route.fulfill(NOT_ENABLED);
  });
});

async function openArc(page, { theme = 'dark', hash = '#/new-lot/order' } = {}) {
  await page.emulateMedia({ colorScheme: theme });
  await page.goto('about:blank');
  await page.goto('/app/' + hash);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await page.getByRole('button', { name: 'Open Arc by Momentum' }).click();
  const panel = page.getByRole('dialog', { name: 'Arc by Momentum' });
  await expect(panel).toBeVisible();
  return panel;
}

async function type(panel, text) {
  const input = panel.getByRole('textbox', { name: 'Message Arc' });
  await input.fill(text);
  await input.press('Enter');
}

const planToJob = { events: (id) => oneStep(id, { tool: 'plan_lot', kind: 'lot_preparation', resultRef: { kind: 'job', id: JOB_ID } }) };

for (const theme of ['dark', 'light']) {
  test.describe(`${theme} theme`, () => {
    test('Arc-Start shows the starters and the next step for a lot the session records', async ({ page }) => {
      await mockTurns(page, [], session({ activeLots: [{ lotId: LOT_ID, stage: 'conditions', currentJobId: null, currentRevision: 0 }] }));
      const panel = await openArc(page, { theme });
      await expect(panel.getByRole('heading', { name: 'What do you need done?' })).toBeVisible();
      const next = panel.locator('section', { has: page.getByRole('heading', { name: 'Next for you' }) });
      await expect(next.getByText('Confirm the conditions', { exact: true })).toBeVisible();
      await expect(next.getByText('Not planned yet')).toBeVisible();
      await expect(next.getByRole('link', { name: 'Confirm conditions' })).toHaveAttribute('href', '#/new-lot/conditions');
      await expect(panel.getByRole('textbox', { name: 'Message Arc' })).toHaveAttribute('placeholder', 'Tell Arc what you need');
    });

    test('Arc-Start shows "Next for you" as not connected when the session has no lot', async ({ page }) => {
      await mockTurns(page, []);
      const panel = await openArc(page, { theme });
      const next = panel.locator('section', { has: page.getByRole('heading', { name: 'Next for you' }) });
      await expect(next.getByText('Not connected', { exact: true })).toBeVisible();
      await expect(next.getByText(/does not track lots in progress yet/)).toBeVisible();
    });

    test('Arc-Lot-Source: New lot runs list_samples and Read this order sends the chosen sample', async ({ page }) => {
      const posts = await mockTurns(page, [
        { events: (id) => oneStep(id, { tool: 'list_samples', kind: 'lot_preparation' }) },
        { events: (id) => oneStep(id, { tool: 'read_order', kind: 'lot_preparation', resultRef: { kind: 'po_review', id: REVIEW_ID } }) },
      ]);
      const panel = await openArc(page, { theme });
      await panel.getByRole('button', { name: /^New lot/ }).click();
      await expect(panel.getByRole('heading', { name: 'Choose the purchase order' })).toBeVisible();
      await expect(panel.getByRole('list', { name: 'New lot steps' }).locator('[aria-current="step"]')).toContainText('Order');
      const choices = panel.getByRole('radiogroup', { name: 'Approved sample orders' }).getByRole('radio');
      await expect(choices).toHaveCount(5);
      await expect(choices.first()).toBeChecked();
      await expect(panel.getByText('Approved sample', { exact: true })).toHaveCount(1);
      await expect(panel.getByText('Dropping your own PDF or JPEG is not connected to Arc yet.')).toBeVisible();
      expect((await panel.locator('.drop .pv').boundingBox()).width).toBeLessThan(160);
      await panel.getByRole('radio', { name: /^PO2 Multi-line/ }).click();
      await expect(choices.nth(1)).toBeChecked();
      await expect(panel.getByRole('textbox', { name: 'Message Arc' })).toHaveAttribute('placeholder', 'Tell Arc what to change');
      await panel.getByRole('button', { name: 'Read this order' }).click();

      await expect(panel.getByRole('heading', { name: 'Check what was read' })).toBeVisible();
      expect(posts[0].input).toEqual({ kind: 'action', actionId: 'list_samples' });
      expect(posts[1].input).toEqual({ kind: 'action', actionId: 'read_sample_order', params: { sampleId: 'PO2' } });
    });

    test('Arc-Lot-Review shows the stored lines, and Confirm order needs the three checks and sends only the review and line', async ({ page }) => {
      const posts = await mockTurns(page, [
        { events: (id) => actionRun(id, { steps: [{ tool: 'read_order', resultRef: { kind: 'po_review', id: REVIEW_ID } }], waitingFor: 'confirm_order' }) },
        { events: (id) => actionRun(id, { steps: [{ tool: 'confirm_order', resultRef: { kind: 'lot', id: LOT_ID } }], waitingFor: 'confirm_conditions' }) },
      ]);
      const reviewReads = await mockReview(page);
      await page.route(/\/lots\/[^/]+$/, (route) => route.fulfill(json(200, { ok: true, lot: { ...LOT, order: { itemCode: 'PKBX0041', quantity: 1300 }, draftConditions: [] }, revision: null })));
      const panel = await openArc(page, { theme });
      await type(panel, 'Read sample order PO1');
      await expect(panel.getByRole('heading', { name: 'Check what was read' })).toBeVisible();
      const lines = panel.getByRole('radiogroup', { name: 'Order lines' });
      await expect(lines.getByRole('radio')).toHaveCount(1);
      await expect(lines.getByRole('radio')).toBeChecked();
      await expect(lines).toContainText('Line 1: PKBX0041');
      await expect(lines).toContainText('1,300 boxes, page 1');
      await expect(lines).toContainText('Matched');
      await expect(panel.getByText('Read from the order by Gemini. One line on this order. The catalog match runs in code.')).toBeVisible();
      await expect(panel.getByText('Not connected', { exact: true })).toHaveCount(0);
      expect(decodeURIComponent(reviewReads[0])).toContain(`/api/arc/reviews/${REVIEW_ID}`);

      const confirm = panel.getByRole('button', { name: 'Confirm order' });
      const boxes = panel.getByRole('checkbox');
      await expect(boxes).toHaveCount(3);
      await expect(confirm).toBeDisabled();
      await boxes.nth(0).check();
      await boxes.nth(1).check();
      await expect(confirm).toBeDisabled();
      await boxes.nth(2).check();
      await expect(confirm).toBeEnabled();
      await confirm.click();
      await expect(panel.getByRole('heading', { name: "Confirm today's conditions" })).toBeVisible();
      expect(posts[1].input).toEqual({ kind: 'action', actionId: 'confirm_order', params: { reviewId: REVIEW_ID, lineIndex: 0 } });
    });

    test('Arc-Lot-Review keeps Confirm order off for a line the catalog did not match', async ({ page }) => {
      await mockTurns(page, [{ events: (id) => actionRun(id, { steps: [{ tool: 'read_order', resultRef: { kind: 'po_review', id: REVIEW_ID } }], waitingFor: 'confirm_order' }) }]);
      await mockReview(page, { ...REVIEW, readByGemini: false, lines: [{ lineIndex: 0, sourcePage: 1, itemCode: null, quantity: 1300, status: 'UNKNOWN_CODE' }] });
      const panel = await openArc(page, { theme });
      await type(panel, 'Read sample order PO1');
      const lines = panel.getByRole('radiogroup', { name: 'Order lines' });
      await expect(lines).toContainText('Line 1: No catalog item');
      await expect(lines).toContainText('Not in catalog');
      await expect(lines.getByRole('radio')).toBeDisabled();
      await expect(panel.getByText(/Sample output, no model call\./)).toBeVisible();
      for (const box of await panel.getByRole('checkbox').all()) await expect(box).toBeDisabled();
      await expect(panel.getByRole('button', { name: 'Confirm order' })).toBeDisabled();
      await expect(panel.getByText('Pick a matched line to confirm.')).toBeVisible();
    });

    test('Arc-Lot-Conditions reads the lot record and labels each value', async ({ page }) => {
      await mockTurns(page, [{ events: (id) => oneStep(id, { tool: 'set_conditions', kind: 'lot_preparation', resultRef: { kind: 'lot', id: LOT_ID } }) }]);
      const lotReads = [];
      await page.route(/\/lots\/[^/]+$/, (route) => { lotReads.push(route.request().url()); return route.fulfill(json(200, { ok: true, lot: LOT, revision: null })); });
      const panel = await openArc(page, { theme });
      await type(panel, 'Humidity is 44 percent');
      await expect(panel.getByRole('heading', { name: "Confirm today's conditions" })).toBeVisible();
      const rows = panel.getByRole('region', { name: 'Conditions' });
      await expect(rows.locator('.fr')).toHaveCount(5);
      await expect(rows.locator('.fr').nth(0)).toContainText('Humidity');
      await expect(rows.locator('.fr').nth(0)).toContainText('Confirmed by operator');
      await expect(rows.getByLabel('Humidity')).toHaveValue('44');
      await expect(rows.locator('.fr').nth(1)).toContainText('Example value');
      await expect(rows.getByLabel('Paper moisture')).toHaveValue('7.1');
      await expect(rows.locator('.fr').nth(2)).toContainText('Required');
      await expect(rows.getByLabel('Ambient temperature')).toHaveAttribute('placeholder', 'Enter value');
      await expect(panel.getByRole('tab', { name: /Conditions 3 left/ })).toHaveAttribute('aria-selected', 'true');
      await expect(panel.getByText('2 of 12 values entered.')).toBeVisible();
      await expect(panel.getByRole('button', { name: 'Confirm conditions' })).toBeDisabled();
      await panel.getByRole('tab', { name: /Conditions/ }).press('ArrowRight');
      await expect(panel.getByRole('tab', { name: /Planned settings 7 left/ })).toHaveAttribute('aria-selected', 'true');
      await expect(panel.getByRole('region', { name: 'Planned settings' }).locator('.fr')).toHaveCount(7);
      await expect(panel.getByText('Not connected', { exact: true })).toHaveCount(0);
      expect(lotReads).toHaveLength(1);
      expect(decodeURIComponent(lotReads[0])).toContain(`/lots/${LOT_ID}`);
    });

    test('Arc lot flow: Read this order, Confirm order and Confirm conditions reach the Approve card', async ({ page }) => {
      const posts = await mockTurns(page, [
        { events: (id) => oneStep(id, { tool: 'list_samples', kind: 'lot_preparation' }) },
        { events: (id) => actionRun(id, { steps: [{ tool: 'read_order', resultRef: { kind: 'po_review', id: REVIEW_ID } }], waitingFor: 'confirm_order' }) },
        { events: (id) => actionRun(id, { steps: [{ tool: 'confirm_order', resultRef: { kind: 'lot', id: LOT_ID } }], waitingFor: 'confirm_conditions' }) },
        { events: (id) => actionRun(id, { steps: [
          { tool: 'confirm_conditions', resultRef: { kind: 'lot', id: LOT_ID } }, { tool: 'plan_lot', resultRef: { kind: 'job', id: JOB_ID } },
        ], waitingFor: 'approve' }) },
      ]);
      await mockReview(page);
      await page.route(/\/lots\/[^/]+$/, (route) => route.fulfill(json(200, { ok: true, lot: { ...LOT, order: { itemCode: 'PKBX0041', quantity: 1300 }, draftConditions: [] }, revision: null })));
      const approvals = await mockJob(page);
      const panel = await openArc(page, { theme });
      await panel.getByRole('button', { name: /^New lot/ }).click();
      await panel.getByRole('button', { name: 'Read this order' }).click();
      await expect(panel.getByRole('radiogroup', { name: 'Order lines' }).getByRole('radio')).toBeChecked();
      for (const box of await panel.getByRole('checkbox').all()) await box.check();
      await panel.getByRole('button', { name: 'Confirm order' }).click();

      const card = panel.getByRole('article').last();
      await expect(card.getByRole('heading', { name: "Confirm today's conditions" })).toBeVisible();
      await expect(card.getByText('For PKBX0041, 1,300 boxes.')).toBeVisible();
      // The review card above it is closed, so it cannot open a second lot by mistake.
      const review = panel.getByRole('article').nth(1);
      await expect(review.getByRole('button', { name: 'Confirm order' })).toBeDisabled();
      await expect(review.getByText('Arc has moved on from this card. Read the order again to confirm another line.')).toBeVisible();
      for (const box of await review.getByRole('checkbox').all()) await expect(box).toBeDisabled();
      const conditions = card.getByRole('region', { name: 'Conditions' });
      await expect(conditions.getByLabel('Paper moisture')).toHaveValue('7.3');
      await expect(conditions.locator('.fr').nth(1)).toContainText('Example value');
      await conditions.getByLabel('Humidity').fill('62');
      await conditions.getByLabel('Ambient temperature').fill('24.5');
      await conditions.getByLabel('Run date').fill('2026-11-25');
      await conditions.getByLabel('Shift').selectOption('DAY');
      const confirm = card.getByRole('button', { name: 'Confirm conditions' });
      await expect(confirm).toBeDisabled();
      await card.getByRole('tab', { name: /Planned settings/ }).click();
      const settings = card.getByRole('region', { name: 'Planned settings' });
      for (const [name, value] of [['Single facer speed', '48'], ['Roll temperature', '162'], ['Gum viscosity', '32'], ['Drying time', '5'], ['Print speed', '60']]) {
        await settings.getByLabel(name).fill(value);
      }
      await settings.getByLabel('Gum application').selectOption('HIGH');
      await settings.getByLabel('Pasting pressure').selectOption('MED');
      await expect(card.getByText('Arc saves these values and plans the lot.')).toBeVisible();
      await confirm.click();

      await expect(panel.getByRole('heading', { name: 'Compare the two plans' })).toBeVisible();
      await panel.getByRole('button', { name: 'Prepare job-card draft' }).click();
      await expect(panel.getByRole('heading', { name: 'Approve the job card' })).toBeVisible();
      await expect(panel.getByRole('button', { name: 'Approve job card' })).toBeDisabled();
      expect(approvals).toHaveLength(0);
      expect(posts.map(({ input }) => input)).toEqual([
        { kind: 'action', actionId: 'list_samples' },
        { kind: 'action', actionId: 'read_sample_order', params: { sampleId: 'PO1' } },
        { kind: 'action', actionId: 'confirm_order', params: { reviewId: REVIEW_ID, lineIndex: 0 } },
        { kind: 'action', actionId: 'confirm_conditions', params: {
          lotId: LOT_ID, runDate: '2026-11-25', shift: 'DAY', ambientRhPct: 62, ambientTempC: 24.5, paperMoisturePct: 7.3, paperMoistureSource: 'example',
          sfSpeedMpm: 48, rollTempC: 162, gumApplication: 'HIGH', gumViscositySec: 32, pastingPressure: 'MED', dryingHours: 5, printSpeedSpm: 60,
        } },
      ]);
    });

    test('Arc-Lot-Conditions sends an edited paper moisture as confirmed, and a refused value keeps the form with the reason', async ({ page }) => {
      const posts = await mockTurns(page, [
        { events: (id) => actionRun(id, { steps: [{ tool: 'read_order', resultRef: { kind: 'po_review', id: REVIEW_ID } }], waitingFor: 'confirm_order' }) },
        { events: (id) => actionRun(id, { steps: [{ tool: 'confirm_order', resultRef: { kind: 'lot', id: LOT_ID } }], waitingFor: 'confirm_conditions' }) },
        { events: (id) => [
          { clientTurnId: id, sequence: 1, type: 'run.started', taskRunId: RUN_ID, kind: 'lot_preparation' },
          { clientTurnId: id, sequence: 2, type: 'step.started', stepId: 'step_1', tool: 'confirm_conditions', label: 'Saving the conditions' },
          { clientTurnId: id, sequence: 3, type: 'step.failed', stepId: 'step_1', tool: 'confirm_conditions', label: 'Saving the conditions', errorCode: 'VALIDATION_ERROR', retrySafe: false },
        ] },
      ]);
      await page.route(/\/lots\/[^/]+$/, (route) => route.fulfill(json(200, { ok: true, lot: { ...LOT, order: { itemCode: 'PKBX0041', quantity: 1300 }, draftConditions: [] }, revision: null })));
      await mockReview(page);
      const panel = await openArc(page, { theme });
      await type(panel, 'Read sample order PO1');
      await expect(panel.getByRole('radiogroup', { name: 'Order lines' }).getByRole('radio')).toBeChecked();
      for (const box of await panel.getByRole('checkbox').all()) await box.check();
      await panel.getByRole('button', { name: 'Confirm order' }).click();
      const card = panel.getByRole('article').last();
      await expect(card.getByRole('heading', { name: "Confirm today's conditions" })).toBeVisible();
      const conditions = card.getByRole('region', { name: 'Conditions' });
      await conditions.getByLabel('Humidity').fill('99');
      await conditions.getByLabel('Paper moisture').fill('8.1');
      await expect(conditions.locator('.fr').nth(1)).toContainText('Entered by operator');
      await conditions.getByLabel('Ambient temperature').fill('24.5');
      await conditions.getByLabel('Run date').fill('2026-11-25');
      await conditions.getByLabel('Shift').selectOption('NIGHT');
      await card.getByRole('tab', { name: /Planned settings/ }).click();
      const settings = card.getByRole('region', { name: 'Planned settings' });
      for (const [name, value] of [['Single facer speed', '48'], ['Roll temperature', '162'], ['Gum viscosity', '32'], ['Drying time', '5'], ['Print speed', '60']]) {
        await settings.getByLabel(name).fill(value);
      }
      await settings.getByLabel('Gum application').selectOption('HIGH');
      await settings.getByLabel('Pasting pressure').selectOption('MED');
      await card.getByRole('button', { name: 'Confirm conditions' }).click();
      const stopped = panel.getByRole('article').last();
      await expect(stopped.getByRole('alert')).toHaveText("Check the values. One is outside the plant's recorded range or is not a valid value.");
      await expect(stopped.getByRole('region', { name: 'Conditions' }).getByLabel('Humidity')).toHaveValue('99');
      expect(posts[2].input.params).toMatchObject({ lotId: LOT_ID, ambientRhPct: 99, paperMoisturePct: 8.1, paperMoistureSource: 'confirmed', shift: 'NIGHT' });
    });

    test('Arc-Lot-Compare draws the stored draft, and plan_lot blocked shows the reason', async ({ page }) => {
      await mockTurns(page, [planToJob, { events: (id) => oneStep(id, { tool: 'plan_lot', kind: 'lot_preparation', end: { type: 'step.blocked', errorCode: 'CONFIRMATION_REQUIRED', retrySafe: false } }) }]);
      await mockJob(page);
      const panel = await openArc(page, { theme });
      await type(panel, 'Plan the lot');
      await expect(panel.getByRole('heading', { name: 'Compare the two plans' })).toBeVisible();
      await expect(panel.getByText('71.2 → 64.5')).toBeVisible();
      await expect(panel.getByText('Model estimate', { exact: true })).toBeVisible();
      await expect(panel.getByText('6.7 kg')).toBeVisible();
      await expect(panel.getByText('₹360')).toBeVisible();
      await expect(panel.getByRole('heading', { name: '3 of 7 settings change' })).toBeVisible();
      await expect(panel.locator('.cl')).toHaveText('Working onPKBX0041, Rev 1Settings and risk');
      const table = panel.getByRole('table', { name: 'Setting changes' });
      await expect(table.getByRole('row')).toHaveCount(4);
      await expect(table.getByRole('row').nth(2)).toContainText('HIGH');
      await expect(table.getByRole('row').nth(2)).toContainText('MEDIUM');
      await expect(panel.getByText('Strength risk goes from 0.71% to 0.73%. Total cost still falls.')).toBeVisible();
      await expect(panel.getByText(/8,640|100\.4|83\.0|0\.078/)).toHaveCount(0);
      // The draft does not record who wrote its explanation, so the text and the Gemini chip stay off.
      await expect(panel.getByText('Test explanation text.')).toHaveCount(0);
      await expect(panel.getByText('Generated by Gemini')).toHaveCount(0);
      await expect(panel.getByRole('progressbar')).toHaveCount(0);

      await type(panel, 'Plan it again');
      const stopped = panel.getByRole('article').last();
      await expect(stopped.getByRole('heading', { name: 'Compare the two plans' })).toBeVisible();
      await expect(stopped.getByRole('alert')).toHaveText('Confirm the order and the conditions first.');
      await expect(stopped.getByRole('button', { name: 'Try again' })).toHaveCount(0);
    });

    test('Arc-Lot-Approve and Arc-Lot-Receipt: approval needs the tick and sends the guard fields', async ({ page }) => {
      await mockTurns(page, [planToJob]);
      const approvals = await mockJob(page);
      const panel = await openArc(page, { theme });
      await type(panel, 'Plan the lot');
      await panel.getByRole('button', { name: 'Prepare job-card draft' }).click();
      await expect(panel.getByRole('heading', { name: 'Approve the job card' })).toBeVisible();
      await expect(panel.getByRole('heading', { name: 'PKBX0041, Rev 1' })).toBeVisible();
      await expect(panel.getByText('Draft, not approved')).toBeVisible();
      await expect(panel.getByText('Supervisor session, demo access. This approval is simulated.')).toBeVisible();
      await expect(panel.getByText(/pass level/i)).toHaveCount(0);
      await expect(panel.locator('.cl')).toContainText('Working on');
      await expect(panel.locator('.cl')).toContainText('PKBX0041, Rev 1');

      const box = panel.getByRole('checkbox', { name: 'I reviewed the settings and limits on this card.' });
      const approve = panel.getByRole('button', { name: 'Approve job card' });
      await expect(box).not.toBeChecked();
      await expect(approve).toBeDisabled();
      await approve.click({ force: true });
      await approve.dispatchEvent('click');
      expect(approvals).toHaveLength(0);

      await box.check();
      await expect(approve).toBeEnabled();
      await box.uncheck();
      await expect(approve).toBeDisabled();
      await box.check();
      await approve.click();

      await expect(panel.getByRole('heading', { name: 'Job card approved' })).toBeVisible();
      expect(approvals).toHaveLength(1);
      expect(approvals[0].body).toEqual({ reviewConfirmed: true, revisionFingerprint: FINGERPRINT });
      expect(approvals[0].headers['content-type']).toBe('application/json');
      await expect(panel.getByText('Demo session, simulated', { exact: true })).toBeVisible();
      await expect(panel.getByText('This approval came from a demo session. It is simulated.')).toBeVisible();
      const card = panel.locator('.hrow', { hasText: 'Card checked' });
      await expect(card).toContainText('Not connected');
      await expect(panel.getByRole('link', { name: 'Open PDF' })).toHaveAttribute('href', `/jobs/${JOB_ID}/card.pdf`);
      await expect(panel.getByText('5-ply BC, 1,300 boxes')).toBeVisible();
      await expect(panel.locator('.cl')).toContainText('Approved');
      await expect(panel.getByRole('textbox', { name: 'Message Arc' })).toHaveAttribute('placeholder', 'Tell Arc what you need');
    });

    test('Arc-Lot-Replaced: a superseded revision cannot be approved', async ({ page }) => {
      await mockTurns(page, [planToJob]);
      const approvals = await mockJob(page, { revision: { ...REVISION, status: 'SUPERSEDED' } });
      await page.route(/\/lots\/[^/]+$/, (route) => route.fulfill(json(200, { ok: true, lot: { ...LOT, stage: 'conditions', currentRevision: 1 }, revision: {
        jobId: JOB_ID, number: 1, status: 'SUPERSEDED', fingerprint: FINGERPRINT, supersededBy: null, conditions: [],
        supersededReason: { field: 'paperMoisturePct', from: 7.1, to: 8.4, provenance: 'operator_entry', byRole: 'Operator session' },
      } })));
      const panel = await openArc(page, { theme });
      await type(panel, 'Plan the lot');
      await expect(panel.getByRole('alert')).toContainText('An input changed after Rev 1 was prepared.');
      await expect(panel.getByText('Replaced, read only')).toBeVisible();
      await expect(panel.locator('.kv', { hasText: 'Input' })).toContainText('Paper moisture');
      await expect(panel.locator('.kv', { hasText: 'Edited by' })).toContainText('Operator session');
      await expect(panel.getByRole('button', { name: 'Approve Rev 1' })).toBeDisabled();
      await expect(panel.getByText('Off. Rev 1 is replaced.')).toBeVisible();
      await expect(panel.getByRole('checkbox')).toHaveCount(0);
      await expect(panel.locator('.cl')).toContainText('Out of date');
      expect(approvals).toHaveLength(0);
    });

    test('an approve answered with REVISION_SUPERSEDED switches to the replaced view', async ({ page }) => {
      await mockTurns(page, [planToJob]);
      await page.route(/\/lots\/[^/]+$/, (route) => route.fulfill(json(200, { ok: true, lot: LOT, revision: null })));
      const approvals = await mockJob(page, { approve: json(409, { ok: false, error: { code: 'REVISION_SUPERSEDED', message: 'An input changed after this draft was prepared, so it is replaced and read only.' } }) });
      const panel = await openArc(page, { theme });
      await type(panel, 'Plan the lot');
      await panel.getByRole('button', { name: 'Prepare job-card draft' }).click();
      await panel.getByRole('checkbox', { name: 'I reviewed the settings and limits on this card.' }).check();
      await panel.getByRole('button', { name: 'Approve job card' }).click();
      await expect(panel.getByRole('button', { name: 'Approve Rev 1' })).toBeDisabled();
      expect(approvals).toHaveLength(1);
    });

    test('Arc-Answer-Value shows the value with its labels', async ({ page }) => {
      await mockTurns(page, [{ events: noRun, taskRunId: null, answer: {
        text: 'Paper moisture for this lot is 7.1%. It is an example value, not a sensor reading.', generatedByGemini: false, writerOutcome: 'not_called',
        blocks: [{ blockId: 'b1', kind: 'value', title: 'Paper moisture', value: 7.1, unit: '%', labels: ['Example value'], note: 'It is not a sensor reading.' }],
      } }]);
      const panel = await openArc(page, { theme });
      await type(panel, 'What is the moisture today?');
      const log = panel.getByRole('log');
      await expect(log.getByRole('heading', { name: 'What is the moisture today?' })).toBeVisible();
      await expect(log.locator('.n')).toHaveText('7.1%');
      await expect(log.getByText('Example value', { exact: true })).toBeVisible();
      await expect(log.getByText('It is not a sensor reading.', { exact: true })).toBeVisible();
      await expect(log.getByText('Generated by Gemini')).toHaveCount(0);
      await expect(panel.getByRole('textbox', { name: 'Message Arc' })).toHaveAttribute('placeholder', 'Ask a follow-up');
    });

    test('Arc-Answer-Chart shows current R2 with no pass marks, and the Gemini chip only on a writer answer', async ({ page }) => {
      const series = [['Warp', 0.47], ['Delamination', 0.52], ['Strength', 0.39], ['Print', 0.64], ['Crack', 0.11]];
      const chart = { blockId: 'b1', kind: 'chart', title: 'Holdout R2 per model', labels: ['Modeled, tested on 219 lots'],
        note: 'They come from modeled history, not measured production.', series: series.map(([name, value]) => ({ name, value, unit: null, labels: ['Modeled, tested on 219 lots'] })) };
      await mockTurns(page, [
        { events: (id) => oneStep(id, { tool: 'get_status', kind: 'data_question', resultRef: { kind: 'metric', id: 'model_scores' } }),
          answer: { text: 'Print scores highest at 0.64 on held-out lots.', generatedByGemini: true, writerOutcome: 'shown', blocks: [chart] } },
        { events: (id) => oneStep(id, { tool: 'get_status', kind: 'data_question', resultRef: { kind: 'metric', id: 'model_scores' } }),
          answer: { text: 'Holdout R2 per model: Warp 0.47, Delamination 0.52, Strength 0.39, Print 0.64, Crack 0.11. Modeled, tested on 219 lots. They come from modeled history, not measured production.', generatedByGemini: false, writerOutcome: 'not_called', blocks: [chart] } },
      ]);
      const panel = await openArc(page, { theme });
      await type(panel, 'Which model is strongest?');
      const writer = panel.getByRole('article').first();
      const table = writer.getByRole('table', { name: 'Holdout R² per model' });
      await expect(table.getByRole('row')).toHaveCount(5);
      for (const [index, [name, value]] of series.entries()) {
        await expect(table.getByRole('row').nth(index)).toContainText(name);
        await expect(table.getByRole('row').nth(index)).toContainText(value.toFixed(2));
      }
      await expect(writer.getByText('Generated by Gemini')).toHaveCount(1);
      await expect(writer.getByText('Modeled, tested on 219 lots', { exact: true })).toBeVisible();
      await expect(writer.getByText('R² on held-out lots')).toBeVisible();

      await panel.getByRole('textbox', { name: 'Message Arc' }).fill('How far can I trust the five models?');
      await panel.getByRole('button', { name: 'Send' }).click();
      const template = panel.getByRole('article').nth(1);
      await expect(template.getByRole('table')).toBeVisible();
      await expect(template.getByText('Generated by Gemini')).toHaveCount(0);
      await expect(panel.getByText(/pass level|meets|below pass|of 0\.60|0\.40|0\.61|0\.01/i)).toHaveCount(0);
    });

    test('Arc-Out-Of-Scope refuses and offers in-scope suggestions', async ({ page }) => {
      const posts = await mockTurns(page, [{ events: noRun, taskRunId: null, answer: {
        text: 'That is not something Arc does. Arc works on lots, conditions, settings, defects, job cards and plant data.', generatedByGemini: false, writerOutcome: 'not_called',
        blocks: [{ blockId: 'b1', kind: 'refusal', suggestions: [
          { actionId: 'get_status', label: 'How far can I trust the five models?' }, { actionId: 'list_samples', label: 'Show the sample orders' },
          { actionId: 'list_next_actions', label: 'What should I do next?' }] }],
      } }]);
      const panel = await openArc(page, { theme });
      await type(panel, 'Where is Phoenix Market City?');
      const log = panel.getByRole('log');
      await expect(log.getByText('Out of scope', { exact: true })).toBeVisible();
      await expect(log.getByText('That is not something Arc does.', { exact: true })).toBeVisible();
      await expect(log.getByRole('button', { name: 'Show the sample orders' })).toBeVisible();
      await expect(log.getByText('Generated by Gemini')).toHaveCount(0);
      await log.getByRole('button', { name: 'Show the sample orders' }).click();
      await expect.poll(() => posts.length).toBe(2);
      expect(posts[1].input).toEqual({ kind: 'action', actionId: 'list_samples' });
    });

    test('Arc-No-Data says what is missing and offers alternatives', async ({ page }) => {
      await mockTurns(page, [{ events: (id) => oneStep(id, { tool: 'query_metric', kind: 'data_question', resultRef: { kind: 'metric', id: 'no_data.scrap_trend_measured' } }), answer: {
        text: 'No measured lots are recorded yet. The history in Momentum is modeled.', generatedByGemini: false, writerOutcome: 'not_called',
        blocks: [{ blockId: 'b1', kind: 'no_data', missing: 'No measured lots are recorded yet. The history in Momentum is modeled.',
          alternatives: [{ actionId: 'get_status', label: 'How far can I trust the five models?' }] }],
      } }]);
      const panel = await openArc(page, { theme });
      await type(panel, 'How did scrap change over the last 3 months?');
      const log = panel.getByRole('log');
      await expect(log.getByText('Insufficient data', { exact: true })).toBeVisible();
      await expect(log.getByText('No measured lots are recorded yet.', { exact: true })).toBeVisible();
      await expect(log.getByText('The history in Momentum is modeled.', { exact: true })).toBeVisible();
      await expect(log.getByText('What Arc can show instead')).toBeVisible();
      await expect(log.getByRole('button', { name: 'How far can I trust the five models?' })).toBeVisible();
    });

    test('Arc-Defect-Photo lists the approved photos and keeps upload separate', async ({ page }) => {
      const posts = await mockTurns(page, [
        { events: (id) => oneStep(id, { tool: 'list_approved_photos', kind: 'photo_check' }) },
        { events: (id) => oneStep(id, { tool: 'diagnose_approved_photo', kind: 'photo_check', resultRef: { kind: 'photo', id: 'photo-03' } }),
          answer: { text: 'Arc finished the requested steps.', generatedByGemini: false, writerOutcome: 'not_called',
            blocks: [{ blockId: 'b1', kind: 'reference', ref: { kind: 'photo', id: 'photo-03' }, labels: ['Approved reference photo'], generatedByGemini: true }] } },
      ]);
      await page.route('**/evidence/approved-photos', (route) => route.fulfill(json(200, { ok: true,
        photos: Array.from({ length: 10 }, (_, index) => ({ id: `photo-${String(index + 1).padStart(2, '0')}`, label: `Approved photo ${index + 1}` })),
        provenance: 'Owner-consented demo/testing photos; image bytes and identifying branding are not exposed by this endpoint.' })));
      const panel = await openArc(page, { theme, hash: '#/photo' });
      await panel.getByRole('button', { name: /^Check a defect/ }).click();
      await expect(panel.getByRole('heading', { name: 'Check a defect' })).toBeVisible();
      await expect(panel.getByRole('tab', { name: 'Photo diagnosis' })).toHaveAttribute('aria-selected', 'true');
      await expect(panel.getByText('Approved photo 1 of 10')).toBeVisible();
      await expect(panel.getByRole('textbox', { name: 'Message Arc' })).toHaveAttribute('placeholder', 'Tell Arc what to change');
      await expect(panel.getByText('Approved reference photo', { exact: true })).toBeVisible();
      await expect(panel.getByText('Uploaded photo', { exact: true })).toBeVisible();
      await expect(panel.getByText(/Uploading your own photo is not connected/)).toBeVisible();
      await panel.getByRole('button', { name: 'Approved photo 3' }).click();
      await expect(panel.getByRole('button', { name: 'Approved photo 3' })).toHaveAttribute('aria-pressed', 'true');
      await expect(panel.getByText('Approved photo 3 of 10')).toBeVisible();
      await panel.getByRole('button', { name: 'Run diagnosis' }).click();
      await expect(panel.getByRole('heading', { name: 'Photo diagnosis' })).toBeVisible();
      const result = panel.getByRole('article').last();
      await expect(result.getByText('Approved reference photo', { exact: true })).toBeVisible();
      await expect(result.getByText('Generated by Gemini')).toHaveCount(0);
      await expect(result.getByText(/the label it found is not returned to Arc yet/)).toBeVisible();
      expect(posts[0].input).toEqual({ kind: 'action', actionId: 'list_approved_photos' });
      expect(posts[1].input).toEqual({ kind: 'text', text: 'Check approved photo photo-03' });
    });

    test('Arc-Defect-History searches and shows results and the zero-result state', async ({ page }) => {
      await mockTurns(page, [{ events: (id) => oneStep(id, { tool: 'list_approved_photos', kind: 'photo_check' }) }]);
      await page.route('**/evidence/approved-photos', (route) => route.fulfill(json(200, { ok: true, photos: [{ id: 'photo-01', label: 'Approved photo 1' }] })));
      const searches = [];
      await page.route('**/evidence/seen-before', (route) => {
        const body = route.request().postDataJSON();
        searches.push(body);
        const runs = (lots, rate) => ({ lots, avgRatePct: rate, sfSpeedMpm: 44.1, rollTempC: 168.2, gumApplication: 'MED', gumViscositySec: 40.5, pastingPressure: 'MED', dryingHours: 6.1, printSpeedSpm: 55 });
        return route.fulfill(json(200, body.defect === 'CRACK'
          ? { ok: true, source: 'bigquery', defect: 'CRACK', caseCount: 0, avgRateWhenMain: 0, costWhenMain: 0, goodRuns: null, badRuns: null, notes: [] }
          : { ok: true, source: 'bigquery', defect: 'WARP', caseCount: 23, avgRateWhenMain: 2.41, costWhenMain: 18000, goodRuns: runs(12, 0.8), badRuns: runs(11, 3.9), notes: [] }));
      });
      const panel = await openArc(page, { theme, hash: '#/photo' });
      await panel.getByRole('button', { name: /^Check a defect/ }).click();
      await panel.getByRole('tab', { name: 'Historical evidence' }).click();
      await expect(panel.getByText('No search yet')).toBeVisible();
      const search = panel.getByRole('button', { name: 'Search history' });
      await expect(search).toBeDisabled();
      await expect(panel.getByText('Pick a defect first.')).toBeVisible();
      await expect(panel.getByLabel('Board', { exact: true })).toBeDisabled();
      await panel.getByLabel('Defect', { exact: true }).selectOption('WARP');
      await panel.getByLabel('Humidity', { exact: true }).selectOption('60');
      await search.click();
      const results = panel.getByRole('status', { name: 'Search results' });
      await expect(results.locator('.n').first()).toHaveText('23lots');
      await expect(results.getByText('Modeled records', { exact: true })).toBeVisible();
      await expect(results).toContainText('Warp was the main problem near 60% humidity, at 2.41% of the lot on average.');
      await expect(results.getByText('Average settings of the 12 lots with the lowest Warp rate and the 11 with the highest, near 60% humidity.')).toBeVisible();
      await expect(results.getByRole('columnheader')).toHaveText(['Setting', 'Lowest', 'Highest']);
      await panel.getByLabel('Defect', { exact: true }).selectOption('CRACK');
      await search.click();
      await expect(panel.getByText('No matching lots')).toBeVisible();
      await expect(panel.getByText(/Crack was not the main problem in any lot near 60% humidity/)).toBeVisible();
      expect(searches).toEqual([{ defect: 'WARP', ambientRhPct: 60 }, { defect: 'CRACK', ambientRhPct: 60 }]);
    });

    test('a retry-safe failure on the order step keeps the source card and offers Try again', async ({ page }) => {
      const posts = await mockTurns(page, [
        { events: (id) => oneStep(id, { tool: 'read_order', kind: 'lot_preparation', end: { type: 'step.failed', errorCode: 'VERTEX_UNAVAILABLE', retrySafe: true } }) },
        { events: (id) => oneStep(id, { tool: 'read_order', kind: 'lot_preparation', resultRef: { kind: 'po_review', id: REVIEW_ID } }) },
      ]);
      const panel = await openArc(page, { theme });
      await type(panel, 'Read sample order PO1');
      await expect(panel.getByRole('heading', { name: 'Choose the purchase order' })).toBeVisible();
      await expect(panel.getByRole('alert')).toContainText('Arc could not reach Gemini. Try again.');
      await panel.getByRole('button', { name: 'Try again' }).click();
      await expect(panel.getByRole('heading', { name: 'Check what was read' })).toBeVisible();
      expect(posts).toHaveLength(2);
      expect(posts[1].input).toEqual(posts[0].input);
      expect(posts[1].clientTurnId).not.toBe(posts[0].clientTurnId);
    });
  });
}

test('after stream.error, Try again re-posts the same clientTurnId so the server replays or takes the turn over', async ({ page }) => {
  const posts = await mockTurns(page, [
    { events: (id) => [
      { clientTurnId: id, sequence: 1, type: 'run.started', taskRunId: RUN_ID, kind: 'lot_preparation' },
      { clientTurnId: id, sequence: 2, type: 'step.started', stepId: 'step_1', tool: 'read_order', label: 'Reading the order' },
      { type: 'stream.error', code: 'REQUEST_TIMEOUT' },
    ] },
    { events: (id) => oneStep(id, { tool: 'read_order', kind: 'lot_preparation', resultRef: { kind: 'po_review', id: REVIEW_ID } }) },
  ]);
  const panel = await openArc(page);
  await type(panel, 'Read sample order PO1');
  await expect(panel.getByRole('alert')).toHaveText(/This step did not finish in time\. Your confirmed inputs are kept\. Try again\./);
  expect(posts).toHaveLength(1);
  await panel.getByRole('button', { name: 'Try again' }).click();
  await expect(panel.getByRole('heading', { name: 'Check what was read' })).toBeVisible();
  expect(posts).toHaveLength(2);
  expect(posts[1]).toEqual(posts[0]);
  await expect(panel.getByRole('article')).toHaveCount(1);
});

test('a stream that drops with no terminal event is re-posted once with the same clientTurnId', async ({ page }) => {
  const posts = await mockTurns(page, [
    { events: (id) => [
      { clientTurnId: id, sequence: 1, type: 'run.started', taskRunId: RUN_ID, kind: 'lot_preparation' },
      { clientTurnId: id, sequence: 2, type: 'step.started', stepId: 'step_1', tool: 'list_samples', label: 'Working on this step' },
    ] },
    { events: (id) => oneStep(id, { tool: 'list_samples', kind: 'lot_preparation' }) },
  ]);
  const panel = await openArc(page);
  await panel.getByRole('button', { name: /^New lot/ }).click();
  await expect(panel.getByRole('heading', { name: 'Choose the purchase order' })).toBeVisible();
  expect(posts).toHaveLength(2);
  expect(posts[1]).toEqual(posts[0]);
});

test('a rate-limited step offers Try again only after the wait, and then as a new turn', async ({ page }) => {
  const posts = await mockTurns(page, [
    { events: (id) => oneStep(id, { tool: 'query_metric', kind: 'data_question', end: { type: 'step.blocked', errorCode: 'BUDGET_RATE_LIMITED', retrySafe: true } })
      .map((event) => event.type === 'step.blocked' ? { ...event, retryAfterSeconds: 2 } : event) },
    { events: noRun, taskRunId: null, answer: { text: 'Arc finished the requested steps.', generatedByGemini: false, writerOutcome: 'not_called', blocks: [] } },
  ]);
  const panel = await openArc(page);
  await type(panel, 'Which lots had the most scrap?');
  await expect(panel.getByRole('alert')).toContainText('Too many typed messages in one minute. Wait 2 s, or use the buttons.');
  await expect(panel.getByRole('button', { name: 'Try again' })).toHaveCount(0);
  await expect(panel.getByRole('button', { name: 'Try again' })).toBeVisible({ timeout: 4000 });
  await panel.getByRole('button', { name: 'Try again' }).click();
  await expect.poll(() => posts.length).toBe(2);
  expect(posts[1].input).toEqual(posts[0].input);
  expect(posts[1].clientTurnId).not.toBe(posts[0].clientTurnId);
});

async function toApproveCard(page) {
  const panel = await openArc(page);
  await type(panel, 'Plan the lot');
  await panel.getByRole('button', { name: 'Prepare job-card draft' }).click();
  await panel.getByRole('checkbox', { name: 'I reviewed the settings and limits on this card.' }).check();
  return panel;
}

test('two clicks on Approve in one task send one approve request', async ({ page }) => {
  await mockTurns(page, [planToJob]);
  const approvals = [];
  await page.route(/\/jobs\/[^/]+$/, (route) => route.fulfill(json(200, { ok: true, jobSheet: DRAFT, revision: REVISION })));
  await page.route(/\/jobs\/[^/]+\/approve$/, async (route) => {
    approvals.push(route.request().postDataJSON());
    await new Promise((resolve) => setTimeout(resolve, 300));
    return route.fulfill(json(200, { ok: true, agent: 'approveJob', jobSheet: APPROVED, cardUri: APPROVED.cardUri }));
  });
  const panel = await toApproveCard(page);
  await panel.getByRole('button', { name: 'Approve job card' }).evaluate((button) => { button.click(); button.click(); });
  await expect(panel.getByRole('heading', { name: 'Job card approved' })).toBeVisible();
  expect(approvals).toHaveLength(1);
});

test('APPROVAL_IN_PROGRESS reads the job again and shows what the record says', async ({ page }) => {
  await mockTurns(page, [planToJob]);
  const reads = [];
  await page.route(/\/jobs\/[^/]+$/, (route) => {
    reads.push(route.request().url());
    return route.fulfill(json(200, { ok: true, jobSheet: reads.length < 2 ? DRAFT : APPROVED, revision: REVISION }));
  });
  const approvals = [];
  await page.route(/\/jobs\/[^/]+\/approve$/, (route) => {
    approvals.push(route.request().postDataJSON());
    return route.fulfill(json(409, { ok: false, error: { code: 'APPROVAL_IN_PROGRESS', message: 'This draft is already being approved. Wait for the result.' } }));
  });
  const panel = await toApproveCard(page);
  await panel.getByRole('button', { name: 'Approve job card' }).click();
  await expect(panel.getByRole('status').filter({ hasText: 'Checking the job card' })).toBeVisible();
  await expect(panel.getByRole('heading', { name: 'Job card approved' })).toBeVisible({ timeout: 6000 });
  expect(approvals).toHaveLength(1);
  expect(reads).toHaveLength(2);
  await expect(panel.getByText(/Arc will show the result here/)).toHaveCount(0);
});

test('APPROVAL_IN_PROGRESS with the draft still unapproved promises nothing', async ({ page }) => {
  await mockTurns(page, [planToJob]);
  const approvals = await mockJob(page, { approve: json(409, { ok: false, error: { code: 'APPROVAL_IN_PROGRESS', message: 'x' } }) });
  const panel = await toApproveCard(page);
  await panel.getByRole('button', { name: 'Approve job card' }).click();
  await expect(panel.getByRole('alert')).toHaveText('An approval for this card is already being processed. Check the job card before trying again.', { timeout: 6000 });
  await expect(panel.getByText(/Arc will show the result here/)).toHaveCount(0);
  await expect(panel.getByRole('heading', { name: 'Approve the job card' })).toBeVisible();
  expect(approvals).toHaveLength(1);
});

test('the keyboard path from Prepare to Approve keeps focus in the panel', async ({ page }) => {
  await mockTurns(page, [planToJob]);
  const approvals = await mockJob(page);
  const panel = await openArc(page);
  await type(panel, 'Plan the lot');
  await panel.getByRole('button', { name: 'Prepare job-card draft' }).focus();
  await page.keyboard.press('Enter');
  await expect(panel.getByRole('heading', { name: 'Approve the job card' })).toBeFocused();

  await panel.getByRole('button', { name: 'Revise' }).focus();
  await page.keyboard.press('Enter');
  await expect(panel.getByRole('heading', { name: 'Compare the two plans' })).toBeFocused();
  await panel.getByRole('button', { name: 'Prepare job-card draft' }).focus();
  await page.keyboard.press('Enter');
  await panel.getByRole('button', { name: 'Keep draft' }).focus();
  await page.keyboard.press('Enter');
  const kept = panel.getByRole('status').filter({ hasText: 'Draft kept.' });
  await expect(kept).toBeFocused();
  await kept.getByRole('button', { name: 'Review it again' }).focus();
  await page.keyboard.press('Enter');
  await expect(panel.getByRole('heading', { name: 'Approve the job card' })).toBeFocused();

  // From the heading, Tab reaches the tick box first, then Approve.
  await page.keyboard.press('Tab');
  await expect(panel.getByRole('checkbox', { name: 'I reviewed the settings and limits on this card.' })).toBeFocused();
  await page.keyboard.press('Space');
  await page.keyboard.press('Tab');
  await expect(panel.getByRole('button', { name: 'Approve job card' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(panel.getByRole('heading', { name: 'Job card approved' })).toBeFocused();
  expect(approvals).toHaveLength(1);
});

test('a starter row that sends a turn leaves focus in the message box', async ({ page }) => {
  await mockTurns(page, [{ events: (id) => oneStep(id, { tool: 'list_samples', kind: 'lot_preparation' }) }]);
  const panel = await openArc(page);
  await panel.getByRole('button', { name: /^New lot/ }).focus();
  await page.keyboard.press('Enter');
  await expect(panel.getByRole('heading', { name: 'Choose the purchase order' })).toBeVisible();
  await expect(panel.getByRole('textbox', { name: 'Message Arc' })).toBeFocused();
});


// Every laid-out element inside the panel that is wider inside than its box, as tag.class names.
// Inline boxes report no width of their own, and screen-reader-only text is clipped on purpose.
function overflowingInPanel(page) {
  return page.evaluate(() => [...document.querySelectorAll('#arc-panel *')].filter((element) => {
    if (element.closest('.sr-only, svg')) return false;
    const display = getComputedStyle(element).display;
    if (display === 'inline' || display === 'contents' || display === 'none') return false;
    return element.scrollWidth > element.clientWidth + 1;
  }).map((element) => `${element.tagName.toLowerCase()}${[...element.classList].map((name) => `.${name}`).join('')}`));
}

async function expectNoSidewaysScroll(page) {
  expect(await overflowingInPanel(page)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
}

test('Arc-Phone: a full-width sheet at 375 px with no sideways scroll, and approval is still a tick plus a button', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await mockTurns(page, [planToJob]);
  const approvals = await mockJob(page);
  const panel = await openArc(page, { hash: '#/home' });
  expect(await panel.boundingBox()).toMatchObject({ x: 0, y: 0, width: 375, height: 812 });
  await type(panel, 'Plan the lot');
  await expect(panel.getByRole('heading', { name: 'Compare the two plans' })).toBeVisible();
  await expect(panel.getByText('Step 3 of 4')).toBeVisible();
  await expect(panel.getByRole('list', { name: 'New lot steps' })).toBeHidden();
  await expectNoSidewaysScroll(page);
  await panel.getByRole('button', { name: 'Prepare job-card draft' }).click();
  await expect(panel.getByText('Step 4 of 4')).toBeVisible();
  const box = panel.getByRole('checkbox', { name: 'I reviewed the settings and limits on this card.' });
  const approve = panel.getByRole('button', { name: 'Approve job card' });
  await expect(approve).toBeDisabled();
  await expectNoSidewaysScroll(page);
  await box.check();
  await approve.click();
  await expect(panel.getByRole('heading', { name: 'Job card approved' })).toBeVisible();
  expect(approvals).toHaveLength(1);
  await expectNoSidewaysScroll(page);
});

test('the phone sheet has no sideways scroll on the defect screens', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await mockTurns(page, [{ events: (id) => oneStep(id, { tool: 'list_approved_photos', kind: 'photo_check' }) }]);
  await page.route('**/evidence/approved-photos', (route) => route.fulfill(json(200, { ok: true,
    photos: Array.from({ length: 10 }, (_, index) => ({ id: `photo-${String(index + 1).padStart(2, '0')}`, label: `Approved photo ${index + 1}` })) })));
  const panel = await openArc(page, { hash: '#/home' });
  await panel.getByRole('button', { name: /^Check a defect/ }).click();
  await expect(panel.getByText('Approved photo 1 of 10')).toBeVisible();
  await expectNoSidewaysScroll(page);
  await panel.getByRole('tab', { name: 'Historical evidence' }).click();
  await expect(panel.getByRole('button', { name: 'Search history' })).toBeVisible();
  await expectNoSidewaysScroll(page);
});

test('long unbroken server strings wrap inside the phone sheet', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const LONG = 'PKBX' + 'Q'.repeat(150);
  const chart = { blockId: 'b1', kind: 'chart', title: `Holdout R2 per model ${LONG}`, labels: [LONG], note: LONG,
    series: [{ name: LONG, value: 0.47, unit: null, labels: [LONG] }, { name: 'Print', value: 0.64, unit: null, labels: [] }] };
  const followUps = { blockId: 'b2', kind: 'follow_ups', suggestions: [{ actionId: 'get_status', label: LONG }] };
  const value = { blockId: 'b1', kind: 'value', title: LONG, value: LONG, unit: LONG, labels: [LONG], note: LONG };
  const answer = (blocks) => ({ text: `${LONG} ${LONG}`, generatedByGemini: true, writerOutcome: 'shown', blocks });
  await mockTurns(page, [
    { events: noRun, taskRunId: null, answer: answer([chart, followUps]) },
    { events: noRun, taskRunId: null, answer: { ...answer([{ blockId: 'b1', kind: 'refusal', suggestions: [{ actionId: 'list_samples', label: LONG }] }]), generatedByGemini: false } },
    { events: noRun, taskRunId: null, answer: answer([value, { blockId: 'b2', kind: 'reference', ref: { kind: 'trace', id: LONG }, labels: [LONG], generatedByGemini: false }]) },
    planToJob,
  ]);
  await mockJob(page, { job: { ...DRAFT, order: { ...DRAFT.order, itemCode: LONG, fluteProfile: LONG } } });
  const panel = await openArc(page, { hash: '#/home' });
  await type(panel, LONG);
  await expect(panel.getByRole('table', { name: /Holdout R² per model/ })).toBeVisible();
  await type(panel, 'Where is Phoenix Market City?');
  await expect(panel.getByText('Out of scope', { exact: true })).toBeVisible();
  await type(panel, 'What is the moisture today?');
  await expect(panel.getByRole('article').nth(2).locator('.n').first()).toBeVisible();
  await expectNoSidewaysScroll(page);
  await type(panel, 'Plan the lot');
  await panel.getByRole('button', { name: 'Prepare job-card draft' }).click();
  await expect(panel.getByRole('heading', { name: new RegExp(`^${LONG}, Rev 1$`) })).toBeVisible();
  await expect(panel.locator('.cl')).toContainText(LONG);
  await expectNoSidewaysScroll(page);
});

test('the phone sheet has no sideways scroll on the review and conditions cards', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await mockTurns(page, [
    { events: (id) => actionRun(id, { steps: [{ tool: 'read_order', resultRef: { kind: 'po_review', id: REVIEW_ID } }], waitingFor: 'confirm_order' }) },
    { events: (id) => actionRun(id, { steps: [{ tool: 'confirm_order', resultRef: { kind: 'lot', id: LOT_ID } }], waitingFor: 'confirm_conditions' }) },
  ]);
  await mockReview(page);
  await page.route(/\/lots\/[^/]+$/, (route) => route.fulfill(json(200, { ok: true, lot: { ...LOT, order: { itemCode: 'PKBX0041', quantity: 1300 }, draftConditions: [] }, revision: null })));
  const panel = await openArc(page, { hash: '#/home' });
  await type(panel, 'Read sample order PO1');
  await expect(panel.getByRole('radiogroup', { name: 'Order lines' }).getByRole('radio')).toBeChecked();
  await expectNoSidewaysScroll(page);
  for (const box of await panel.getByRole('checkbox').all()) await box.check();
  await panel.getByRole('button', { name: 'Confirm order' }).click();
  await expect(panel.getByRole('region', { name: 'Conditions' })).toBeVisible();
  await expectNoSidewaysScroll(page);
  await panel.getByRole('tab', { name: /Planned settings/ }).click();
  await expect(panel.getByRole('region', { name: 'Planned settings' })).toBeVisible();
  await expectNoSidewaysScroll(page);
});
