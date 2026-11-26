import { expect, test } from '@playwright/test';

// The lot store answers come from fixtures here. They show how the page reacts to each answer; they do
// not show that /api/lots works.
const lot = (overrides = {}) => ({ lotId: 'LOT-TEST-1', orderId: 'ORD-1', itemCode: 'PKBX0041', quantity: 1300, status: 'planned', updatedAt: '2026-11-26T10:00:00Z', changes: [{ lever: 'rollTempC', from: 162, to: 170 }, { lever: 'gumApplication', from: 'HIGH', to: 'MED' }, { lever: 'gumViscositySec', from: 32, to: 45 }], ...overrides });
async function mockLots(page, lots) {
  await page.route('**/api/lots', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ lots, events: [] }) }));
  await page.route('**/api/live', (route) => route.fulfill({ status: 200, contentType: 'text/event-stream', body: `event: floor\ndata: ${JSON.stringify({ lots, events: [] })}\n\n` }));
}

test('a planned lot shows step 7 waiting on the supervisor', async ({ page }) => {
  await mockLots(page, [lot()]);
  await page.goto('/app/#/preparation-flow');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Preparation flow');
  await expect(page.locator('.sidebar .nav-item[aria-current="page"]')).toHaveText('Preparation Flow');
  await expect(page.getByText('LOT-TEST-1')).toBeVisible();
  await expect(page.getByText('Step 7 of 9, Decision zone')).toBeVisible();
  await expect(page.locator('.pf-node[aria-current="step"]')).toContainText('Review plan');
  await expect(page.getByText('Waiting on you')).toBeVisible();
  await expect(page.getByText('Do the three changes make sense for today\'s floor?')).toBeVisible();
});

test('the retired trade-off figure and pass-level claim are absent', async ({ page }) => {
  await mockLots(page, [lot()]);
  await page.goto('/app/#/preparation-flow');
  await expect(page.getByText('Step 7 of 9')).toBeVisible();
  const text = await page.locator('main').innerText();
  for (const retired of ['0.078', 'Only Print', 'pass level', 'Prototype data']) expect(text, retired).not.toContain(retired);
});

test('with no lot the page says so and shows no flow', async ({ page }) => {
  await mockLots(page, []);
  await page.goto('/app/#/preparation-flow');
  await expect(page.getByText('No lot to show yet.')).toBeVisible();
  await expect(page.locator('.pf-node')).toHaveCount(0);
});

test('an approved lot is not drawn because its step history is not stored', async ({ page }) => {
  await mockLots(page, [lot({ status: 'approved' })]);
  await page.goto('/app/#/preparation-flow');
  await expect(page.getByText('Step status is not recorded for this lot yet.')).toBeVisible();
  await expect(page.locator('.pf-node')).toHaveCount(0);
});

test('Open New Lot and the step button both open New Lot', async ({ page }) => {
  await mockLots(page, [lot()]);
  for (const name of ['Open New Lot', /Open this step in New Lot/]) {
    await page.goto('/app/#/preparation-flow');
    await page.getByRole('button', { name }).click();
    await expect(page.locator('.sidebar .nav-item[aria-current="page"]')).toHaveText('New Lot');
  }
});

test('the decision questions can be ticked from the keyboard and do not approve anything', async ({ page }) => {
  await mockLots(page, [lot()]);
  const requests = [];
  page.on('request', (request) => { if (request.method() !== 'GET') requests.push(request.url()); });
  await page.goto('/app/#/preparation-flow');
  const first = page.getByLabel('Do the three changes make sense for today\'s floor?');
  await first.focus();
  await page.keyboard.press('Space');
  await expect(first).toBeChecked();
  expect(requests.filter((url) => /approve|jobs/.test(url))).toEqual([]);
});

for (const [width, height] of [[1440, 900], [1280, 800], [1024, 768]]) {
  test(`no horizontal page overflow at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await mockLots(page, [lot()]);
    await page.goto('/app/#/preparation-flow');
    await expect(page.getByText('Step 7 of 9')).toBeVisible();
    expect(await page.evaluate(() => document.scrollingElement.scrollWidth > window.innerWidth)).toBe(false);
  });
}
