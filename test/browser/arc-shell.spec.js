import { expect, test } from '@playwright/test';

const PAGES = [
  { link: 'New Lot', hash: '#/new-lot/order', title: 'New lot', crumb: 'New lot' },
  { link: 'Plant Explorer', hash: '#/explorer', title: 'Plant Explorer', crumb: 'Plant Explorer' },
  { link: 'Preparation Flow', hash: '#/prep-flow', title: 'Preparation flow', crumb: 'Preparation flow' },
  { link: 'Insights', hash: '#/insights', title: 'Insights', crumb: 'Insights' },
  { link: 'Photo Diagnosis', hash: '#/photo', title: 'Photo diagnosis', crumb: 'Photo diagnosis' },
  { link: 'Planning', hash: '#/planning', title: 'Planning', crumb: 'Planning' },
  { link: 'Home', hash: '#/home', title: 'Home', crumb: 'Home' },
];

const json = (status, body) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
const NOT_ENABLED = json(404, { ok: false, error: { code: 'ARC_NOT_ENABLED', message: 'Arc is not enabled on this deployment.' } });
const SESSION = json(200, { ok: true, session: {
  authorizationMode: 'HACKATHON_DEMO', identityLabel: 'Demo session, simulated', expiresAt: '2026-11-25T12:00:00.000Z',
  activeLots: [], jobIds: [], activeTaskRunId: null, resumable: false, turnCount: 0,
} });
const sse = (...events) => ({
  status: 200, contentType: 'text/event-stream; charset=utf-8', headers: { 'Arc-Turn': 'accepted' },
  body: ': keep-alive\n\n' + events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(''),
});

function storedTurn(clientTurnId, text, answer) {
  return json(200, { ok: true, turn: {
    clientTurnId, taskRunId: null, status: 'complete', createdAt: '2026-11-25T10:00:00.000Z', errorCode: null,
    input: { kind: 'text', text }, answer,
  } });
}

// Replies to POST /api/arc/turns with `stream(clientTurnId)` and to the turn read with `answer`.
async function mockTurn(page, { stream, answer, text }) {
  const posts = [];
  await page.route('**/api/arc/session', route => route.fulfill(SESSION));
  await page.route('**/api/arc/turns', route => {
    if (route.request().method() !== 'POST') return route.fallback();
    const body = route.request().postDataJSON();
    posts.push(body);
    return route.fulfill(stream(body.clientTurnId));
  });
  await page.route(/\/api\/arc\/turns\/[0-9a-f-]{36}$/, route => {
    const id = new URL(route.request().url()).pathname.split('/').pop();
    return route.fulfill(storedTurn(id, text, answer));
  });
  return posts;
}

// The test server allows 60 /api requests a minute per IP for the whole run, so this file answers
// every /api call itself and leaves that budget to the other specs. Routes added in a test win.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/config') return route.fulfill(json(200, { enabled: false, provider: 'firebase-google' }));
    if (path === '/api/status') return route.fulfill(json(200, { ok: true }));
    return route.fulfill(NOT_ENABLED);
  });
});

// A hash-only goto would keep the old page and its conversation, so each open starts fresh.
async function openArc(page, hash = '#/home') {
  await page.goto('about:blank');
  await page.goto('/app/' + hash);
  await page.getByRole('button', { name: 'Open Arc by Momentum' }).click();
  const panel = page.getByRole('dialog', { name: 'Arc by Momentum' });
  await expect(panel).toBeVisible();
  return panel;
}

for (const theme of ['dark', 'light']) {
  test(`the frame renders in the ${theme} theme`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('/app/');

    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page.locator('.m')).toHaveCSS('background-color', theme === 'dark' ? 'rgb(18, 21, 25)' : 'rgb(238, 240, 242)');
    await expect(page.locator('.side')).toHaveCSS('background-color', theme === 'dark' ? 'rgb(11, 13, 16)' : 'rgb(227, 230, 233)');
    expect((await page.locator('.side').boundingBox()).width).toBe(232);
    expect((await page.locator('header.top').boundingBox()).height).toBe(56);

    await expect(page.getByRole('img', { name: 'Momentum' })).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav.getByRole('link')).toHaveText(['Home', 'New Lot', 'Plant Explorer', 'Preparation Flow', 'Insights', 'Photo Diagnosis', 'Planning']);
    await expect(nav.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    await expect(nav.getByText('Future', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Light theme' })).toHaveAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
    // Om, 2026-11-26 (ARC-M6-20): the app frame carries no demo labels.
    await expect(page.locator('.side')).not.toContainText('Supervisor session');
    await expect(page.locator('.side')).not.toContainText('Demo access only.');

    await expect(page.locator('.bc')).toHaveText('Plant / Home');
    await expect(page.getByRole('button', { name: 'Open Arc by Momentum' })).toContainText('Tell Arc what you need');
    await expect(page.getByRole('button', { name: 'Notifications' })).toBeEnabled();
    // The test server's /health answers ok, and a working connection shows no status in the top bar.
    await expect(page.locator('header.top')).not.toContainText(/backend/i);
    await expect(page.locator('header.top')).not.toContainText('Prototype data, not live');
    await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeAttached();
    await expect(page.locator('main')).toBeVisible();
  });
}

test('Arc is centered in the area beside the sidebar without covering the header controls', async ({ page }) => {
  await page.route('**/health', route => route.fulfill(json(503, { ok: false })));
  await page.goto('/app/#/prep-flow');
  const launcher = page.getByRole('button', { name: 'Open Arc by Momentum' });
  const status = page.getByRole('status').filter({ hasText: 'Backend' });
  await expect(status).toBeVisible();

  for (const width of [1440, 1280, 1024, 768, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const header = await page.locator('header.top').boundingBox();
    const arc = await launcher.boundingBox();
    expect(Math.abs(arc.x + arc.width / 2 - (header.x + header.width / 2)), `center at ${width}px`).toBeLessThanOrEqual(1);

    for (const neighbor of [
      page.locator('.bc'),
      page.getByRole('button', { name: 'Menu' }),
      page.getByRole('button', { name: 'Notifications' }),
      status,
    ]) {
      const box = await neighbor.boundingBox();
      if (!box) continue;
      const overlaps = arc.x < box.x + box.width && box.x < arc.x + arc.width
        && arc.y < box.y + box.height && box.y < arc.y + arc.height;
      expect(overlaps, `header controls overlap at ${width}px`).toBe(false);
    }
  }
});

test('the mobile sidebar closes with its back arrow and returns focus', async ({ page }) => {
  await page.setViewportSize({ width: 440, height: 956 });
  await page.goto('/app/#/home');
  const menu = page.getByRole('button', { name: 'Menu' });
  await menu.click();
  const close = page.getByRole('button', { name: 'Close navigation' });
  await expect(close).toBeFocused();
  await close.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(menu).toBeFocused();
  await expect(close).toBeHidden();
});

test('the backend indicator shows a failed health check', async ({ page }) => {
  await page.route('**/health', route => route.fulfill(json(503, { ok: false })));
  await page.goto('/app/#/home');
  await expect(page.getByRole('status').filter({ hasText: 'Backend' })).toHaveText('Backend not reachable');
});

test('every nav item routes to its own page', async ({ page }) => {
  await page.goto('/app/#/planning');
  const nav = page.getByRole('navigation', { name: 'Main' });
  for (const { link, hash, title, crumb } of PAGES) {
    await nav.getByRole('link', { name: link, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(hash.replace(/\//g, '\\/') + '$'));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    await expect(page.locator('.bc')).toHaveText(`Plant / ${crumb}`);
    await expect(nav.getByRole('link', { name: link, exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
  }
});

test('the New Lot steps, the operator view and unknown routes', async ({ page }) => {
  const steps = ['Order', 'Conditions', 'Settings and risk', 'Review and approve'];
  for (const [index, path] of ['order', 'conditions', 'settings', 'approve'].entries()) {
    await page.goto('/app/#/new-lot/' + path);
    await expect(page.getByRole('link', { name: 'New Lot', exact: true })).toHaveAttribute('aria-current', 'page');
    const current = page.getByRole('list', { name: 'New lot steps' }).locator('[aria-current="step"]');
    await expect(current).toContainText(steps[index]);
    await expect(page.getByRole('list', { name: 'New lot steps' }).getByText(', done')).toHaveCount(index);
  }

  await page.goto('/app/#/operator');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText("The same card, on the operator's phone.");
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Light theme' })).toBeVisible();

  await page.goto('/app/#/floor');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Home');
});

test('the launcher opens Arc on every page and Escape closes it', async ({ page }) => {
  await page.route('**/api/arc/session', route => route.fulfill(SESSION));
  for (const { hash, crumb } of PAGES) {
    await page.goto('/app/' + hash);
    const launcher = page.getByRole('button', { name: 'Open Arc by Momentum' });
    await launcher.click();
    const panel = page.getByRole('dialog', { name: 'Arc by Momentum' });
    await expect(panel).toBeVisible();
    await expect(panel.locator('.cx')).toHaveText(crumb);
    await expect(page.getByRole('button', { name: 'Close Arc by Momentum' })).toHaveText(/Close$/);
    await expect(panel.getByRole('textbox', { name: 'Message Arc' })).toBeFocused();
    await expect(page.locator('main')).toHaveAttribute('inert', '');
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(page.getByRole('button', { name: 'Open Arc by Momentum' })).toBeFocused();
    await expect(page.locator('main')).not.toHaveAttribute('inert', '');
  }

  const panel = await openArc(page);
  await expect(panel.getByRole('heading', { name: 'What do you need done?' })).toBeVisible();
  for (const row of ['New lot', 'Check a defect', 'Ask about the data', 'Open a job card']) {
    await expect(panel.getByRole('button', { name: new RegExp('^' + row) })).toBeEnabled();
  }
  await panel.getByRole('button', { name: 'Close Arc', exact: true }).click();
  await expect(panel).toBeHidden();
});

test('the mic button is disabled, named as unavailable and has no click listener', async ({ page }) => {
  const arcCalls = [];
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/arc/turns')) arcCalls.push(request.url()); });
  await page.route('**/api/arc/session', route => route.fulfill(SESSION));
  const panel = await openArc(page);
  const mic = panel.getByRole('button', { name: 'Speak to Arc. Voice is not available yet.' });
  await expect(mic).toBeVisible();
  await expect(mic).toBeDisabled();
  await expect(mic).toHaveAttribute('disabled', '');

  const reactHandlers = await mic.evaluate(node => {
    const key = Object.keys(node).find(name => name.startsWith('__reactProps'));
    return key ? Object.keys(node[key]).filter(name => /^on[A-Z]/.test(name)) : null;
  });
  expect(reactHandlers).toEqual([]);

  const cdp = await page.context().newCDPSession(page);
  const { result } = await cdp.send('Runtime.evaluate', { expression: 'document.querySelector("#arc-panel .mic")' });
  const { listeners } = await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId });
  expect(listeners).toEqual([]);
  await cdp.detach();

  await mic.click({ force: true });
  await expect(panel.getByRole('log')).toHaveCount(0);
  expect(arcCalls).toEqual([]);
});

test('a turn answered with ARC_NOT_ENABLED shows the not-connected state', async ({ page }) => {
  const posts = [];
  await page.route('**/api/arc/session', route => route.fulfill(SESSION));
  await page.route('**/api/arc/turns', route => {
    posts.push(route.request().postDataJSON());
    return route.fulfill(NOT_ENABLED);
  });
  const panel = await openArc(page);
  const input = panel.getByRole('textbox', { name: 'Message Arc' });
  await input.fill('What is the moisture today?');
  await input.press('Enter');

  const log = panel.getByRole('log', { name: 'Arc messages' });
  await expect(log.getByRole('heading', { name: 'What is the moisture today?' })).toBeVisible();
  await expect(log.getByRole('heading', { name: 'Arc is not connected' })).toBeVisible();
  await expect(log.getByText('Not connected', { exact: true })).toHaveCount(0);
  await expect(log.getByText(/Arc is not switched on for this deployment/)).toBeVisible();
  await expect(input).toBeDisabled();
  expect(posts).toHaveLength(1);
  expect(Object.keys(posts[0]).sort()).toEqual(['clientTurnId', 'input']);
  expect(posts[0].clientTurnId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  expect(posts[0].input).toEqual({ kind: 'text', text: 'What is the moisture today?' });
});

test('a session answered with ARC_NOT_ENABLED shows the not-connected state on open', async ({ page }) => {
  await page.route('**/api/arc/session', route => route.fulfill(NOT_ENABLED));
  const panel = await openArc(page);
  await expect(panel.getByRole('heading', { name: 'Arc is not connected' })).toBeVisible();
  await expect(panel.getByRole('textbox', { name: 'Message Arc' })).toBeDisabled();
  await expect(panel.getByRole('button', { name: 'Send' })).toBeDisabled();
  await expect(panel).not.toContainText('Answers use sample data');
});

test('writer and template answers show the text with no source chips', async ({ page }) => {
  const reply = (id) => sse({ sequence: 0, type: 'answer', clientTurnId: id, resultRef: { kind: 'turn', id } });
  const chartBlock = { blockId: 'b1', kind: 'chart', title: 'Holdout R2 per model', labels: ['Modeled, tested on 219 lots'],
    note: 'They come from modeled history, not measured production.', series: [{ name: 'Print', value: 0.64, unit: null, labels: [] }] };
  await mockTurn(page, { stream: reply, text: 'How far can I trust the models?',
    answer: { text: 'Print scores 0.64 on the holdout lots.', generatedByGemini: true, writerOutcome: 'shown', blocks: [chartBlock] } });
  const panel = await openArc(page);
  await panel.getByRole('textbox', { name: 'Message Arc' }).fill('How far can I trust the models?');
  await panel.getByRole('button', { name: 'Send' }).click();
  const log = panel.getByRole('log');
  await expect(log.getByText('Print scores 0.64 on the holdout lots.')).toBeVisible();
  await expect(log.getByText('Generated by Gemini')).toHaveCount(0);
  await expect(log.getByText('Modeled, tested on 219 lots')).toHaveCount(0);

  await mockTurn(page, { stream: reply, text: 'How far can I trust the models?',
    answer: { text: 'Print scores 0.64 on the holdout lots.', generatedByGemini: false, writerOutcome: 'fallback', blocks: [chartBlock] } });
  const second = await openArc(page);
  await second.getByRole('textbox', { name: 'Message Arc' }).fill('How far can I trust the models?');
  await second.getByRole('button', { name: 'Send' }).click();
  await expect(second.getByRole('log').getByText('Print scores 0.64 on the holdout lots.')).toBeVisible();
  await expect(second.getByText('Generated by Gemini')).toHaveCount(0);
});

test('a refusal shows its suggestions, and a suggestion is sent as an action', async ({ page }) => {
  const posts = await mockTurn(page, {
    stream: (id) => sse({ sequence: 0, type: 'answer', clientTurnId: id, resultRef: { kind: 'turn', id } }),
    text: 'Where is Phoenix Market City?',
    answer: { text: 'That is not something Arc does. Arc works on lots, conditions, settings, defects, job cards and plant data.',
      generatedByGemini: false, writerOutcome: 'not_called',
      blocks: [{ blockId: 'b1', kind: 'refusal', suggestions: [{ actionId: 'get_status', label: 'How far can I trust the five models?' }] }] },
  });
  const panel = await openArc(page);
  await panel.getByRole('button', { name: /^Ask about the data/ }).click();
  const log = panel.getByRole('log');
  await expect(log.getByText('Outside Arc', { exact: true })).toBeVisible();
  await expect(log.getByText('Out of scope', { exact: true })).toHaveCount(0);
  await expect(log.getByText('That is not something Arc does.', { exact: true })).toBeVisible();
  await expect(log.getByText('Generated by Gemini')).toHaveCount(0);
  await log.getByRole('button', { name: 'How far can I trust the five models?' }).click();
  await expect.poll(() => posts.length).toBe(2);
  expect(posts[0].input).toEqual({ kind: 'text', text: 'Ask about the data' });
  expect(posts[1].input).toEqual({ kind: 'action', actionId: 'get_status' });
});

test('a budget block and a rate limit are shown in plain words', async ({ page }) => {
  await mockTurn(page, {
    stream: (id) => sse(
      { sequence: 1, type: 'run.started', clientTurnId: id, taskRunId: 'c4d5e6f7-0a1b-4c2d-8e3f-5a6b7c8d9e0f', kind: 'data_question' },
      { sequence: 2, type: 'step.blocked', clientTurnId: id, stepId: 's1', tool: 'query_metric', label: 'Reading the data', errorCode: 'BUDGET_DAY_EXHAUSTED', retrySafe: false },
    ),
    text: 'x', answer: null,
  });
  const panel = await openArc(page);
  await panel.getByRole('textbox', { name: 'Message Arc' }).fill('What is the moisture today?');
  await panel.getByRole('textbox', { name: 'Message Arc' }).press('Enter');
  await expect(panel.getByRole('alert')).toHaveText("Arc has used today's Gemini limit. Buttons still work. The limit resets at midnight IST (02:30 in Singapore).");

  await page.route('**/api/arc/turns', route => route.fulfill({ ...json(429, { ok: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'x' } }), headers: { 'Retry-After': '30' } }));
  await panel.getByRole('textbox', { name: 'Message Arc' }).fill('And the humidity?');
  await panel.getByRole('textbox', { name: 'Message Arc' }).press('Enter');
  await expect(panel.getByRole('alert').last()).toHaveText('Too many requests from this network. Try again in 30 s.');
});

test('past work lists this session\'s turns and opens one', async ({ page }) => {
  await mockTurn(page, { stream: () => NOT_ENABLED, text: 'Can you order me a pizza?',
    answer: { text: 'That is not something Arc does. Arc works on lots, conditions, settings, defects, job cards and plant data.', generatedByGemini: false, writerOutcome: 'not_called', blocks: [] } });
  await page.route(/\/api\/arc\/turns\?/, route => route.fulfill(json(200, { ok: true, nextBefore: null, turns: [{
    clientTurnId: '6f1c2a44-8b0e-4d51-9c7a-3e5d1b7f0a21', taskRunId: null, status: 'complete', createdAt: '2026-11-25T09:44:30.000Z', errorCode: null,
    input: { kind: 'text', text: 'Can you order me a pizza?' }, answer: { text: 'That is not something Arc does.', generatedByGemini: false },
  }] })));
  const panel = await openArc(page);
  const history = panel.getByRole('button', { name: 'Past work' });
  await history.click();
  await expect(history).toHaveAttribute('aria-pressed', 'true');
  await expect(panel.getByRole('heading', { name: 'Past work' })).toBeVisible();
  await panel.getByRole('button', { name: /Can you order me a pizza\?/ }).click();
  await expect(panel.getByRole('log').getByRole('heading', { name: 'Can you order me a pizza?' })).toBeVisible();
  await expect(panel.getByRole('log').getByText('That is not something Arc does. Arc works on lots, conditions, settings, defects, job cards and plant data.')).toBeVisible();
});

test('the header shows Gemini calls left only when the status reports them', async ({ page }) => {
  await page.route('**/api/arc/session', route => route.fulfill(SESSION));
  let panel = await openArc(page);
  await expect(panel.getByText(/Gemini left today/)).toHaveCount(0);

  await page.route('**/api/status', route => route.fulfill(json(200, { ok: true, runtimeAvailability: { geminiBudget: {
    available: true, callsLeftToday: 7 } } })));
  panel = await openArc(page);
  await expect(panel.getByText('Gemini left today: 7 calls')).toBeVisible();

  await page.route('**/api/status', route => route.fulfill(json(200, { ok: true, runtimeAvailability: { geminiBudget: {
    available: false, callsLeftToday: 7 } } })));
  panel = await openArc(page);
  await expect(panel.getByText(/Gemini left today/)).toHaveCount(0);
});

test('at phone width Arc is a full-width sheet and the page does not scroll sideways', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.route('**/api/arc/session', route => route.fulfill(SESSION));
  await page.goto('/app/#/home');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Home' })).toBeHidden();
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Insights' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Insights');
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Home' })).toBeHidden();

  await page.getByRole('button', { name: 'Open Arc by Momentum' }).click();
  const panel = page.getByRole('dialog', { name: 'Arc by Momentum' });
  expect(await panel.boundingBox()).toMatchObject({ x: 0, y: 0, width: 375, height: 812 });
  await expect(panel.getByRole('button', { name: 'Speak to Arc. Voice is not available yet.' })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
});
