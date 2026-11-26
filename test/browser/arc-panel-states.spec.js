import { expect, test } from '@playwright/test';

// Stands in for /api/arc/* so the panel's three designed states can be driven. These responses are
// test fixtures; they show how the panel handles each answer, not that the real routes work.
const TURN = '00000000-0000-4000-8000-000000000001';

async function mockArc(page, { stage = 'conditions', blocks, text, sessionStatus = 200 } = {}) {
  const posted = [];
  await page.route('**/api/arc/session', route => sessionStatus === 200
    ? route.fulfill({ json: { ok: true, session: { identityLabel: 'Demo session, simulated', turnCount: 0, activeLots: stage ? [{ lotId: 'LOT-T', stage, currentJobId: null, currentRevision: 1 }] : [] } } })
    : route.fulfill({ status: sessionStatus, json: { ok: false, error: { code: 'X', message: 'no' } } }));
  await page.route('**/api/arc/turns', async route => {
    if (route.request().method() !== 'POST') return route.fulfill({ json: { ok: true, turns: [], nextBefore: null } });
    posted.push(route.request().postDataJSON());
    await route.fulfill({ contentType: 'text/event-stream', body: 'id: 0\nevent: answer\ndata: {"sequence":0,"type":"answer"}\n\n' });
  });
  await page.route('**/api/arc/turns/*', route => route.fulfill({ json: { ok: true, turn: { clientTurnId: TURN, status: 'complete', createdAt: '2026-11-26T00:00:00.000Z', input: { kind: 'text', text: 'q' }, errorCode: null, answer: { generatedByGemini: false, text, blocks } } } }));
  return posted;
}

const open = async page => {
  await page.goto('/app/#/home');
  await page.getByRole('button', { name: 'Open Arc by Momentum' }).click();
  return page.getByRole('dialog', { name: 'Arc by Momentum' });
};

test('start state shows the next step from the session and posts an action row', async ({ page }) => {
  const posted = await mockArc(page, { text: 'x', blocks: [] });
  const dialog = await open(page);
  await expect(dialog.getByRole('heading', { name: 'What do you need done?' })).toBeVisible();
  await expect(dialog.getByText('Next for you')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Open a job card' })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Speak to Arc' })).toBeDisabled();
  await dialog.getByRole('button', { name: /^New lot/ }).click();
  await expect.poll(() => posted[0]?.input).toEqual({ kind: 'action', actionId: 'list_samples' });
});

test('no next-step card without a lot at the conditions stage', async ({ page }) => {
  await mockArc(page, { stage: 'planning', text: 'x', blocks: [] });
  const dialog = await open(page);
  await expect(dialog.getByRole('button', { name: /^New lot/ })).toBeVisible();
  await expect(dialog.getByText('Next for you')).toHaveCount(0);
});

test('typed text is sent and an out-of-scope answer shows the refusal and suggestions', async ({ page }) => {
  const posted = await mockArc(page, {
    text: 'That is not something Arc does. Arc works on lots, conditions, settings, defects, job cards and plant data.',
    blocks: [{ blockId: 'b1', kind: 'refusal', suggestions: [{ actionId: 'get_weather', label: 'Check the plant weather' }] }],
  });
  const dialog = await open(page);
  await dialog.getByRole('textbox', { name: 'Message Arc' }).fill('Where is Phoenix Market City?');
  await dialog.getByRole('button', { name: 'Send' }).click();
  await expect.poll(() => posted[0]?.input).toEqual({ kind: 'text', text: 'Where is Phoenix Market City?' });
  await expect(dialog.getByText('Out of scope')).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'That is not something Arc does.' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Check the plant weather' }).click();
  await expect.poll(() => posted[1]?.input).toEqual({ kind: 'action', actionId: 'get_weather' });
});

test('a no-data answer names what is missing and shows alternatives', async ({ page }) => {
  await mockArc(page, {
    text: 'There is no measured scrap to chart.',
    blocks: [
      { blockId: 'b1', kind: 'no_data', missing: 'No measured lots are recorded yet.', alternatives: [{ actionId: 'get_status', label: 'Show the modeled comparison' }] },
      { blockId: 'b2', kind: 'value', title: 'Models at pass level', value: null, unit: null, labels: ['Missing'], note: null },
    ],
  });
  const dialog = await open(page);
  await dialog.getByRole('textbox', { name: 'Message Arc' }).fill('How did scrap change?');
  await dialog.getByRole('textbox', { name: 'Message Arc' }).press('Enter');
  await expect(dialog.getByText('Insufficient data')).toBeVisible();
  await expect(dialog.getByText('No measured lots are recorded yet.')).toBeVisible();
  await expect(dialog.getByText('Not recorded')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Show the modeled comparison' })).toBeVisible();
});

test('a failed session read shows an error state and keeps the composer off', async ({ page }) => {
  await mockArc(page, { sessionStatus: 503 });
  const dialog = await open(page);
  await expect(dialog.getByText("Can't reach Arc")).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'Message Arc' })).toBeDisabled();
});
