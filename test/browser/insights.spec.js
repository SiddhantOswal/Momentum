import { expect, test } from '@playwright/test';

test('Insights shows the reference lot as a labelled model estimate', async ({ page }) => {
  await page.goto('/app/#/insights');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Insights');
  await expect(page.locator('.sidebar .nav-item[aria-current="page"]')).toHaveText('Insights');
  await expect(page.getByText('Not a measured saving')).toBeVisible();
  await expect(page.getByText('Down from 62.9 kg')).toBeVisible();
  await expect(page.getByText('Measured savings are not on this page.')).toBeVisible();
});

test('the retired October figures are absent', async ({ page }) => {
  await page.goto('/app/#/insights');
  await expect(page.locator('.in-fit')).toBeVisible();
  const text = await page.locator('main, .main').first().innerText();
  for (const retired of ['100.4', '83.0', '925', '5,351', '0.078', 'pass level', 'needs 0.', '43 passed', '7 of 10']) {
    expect(text, retired).not.toContain(retired);
  }
});

test('model scores come from the status route', async ({ page }) => {
  await page.goto('/app/#/insights');
  const status = await (await page.request.get('/api/status')).json();
  const scores = status.modelAcceptance.models.map((model) => model.r2.toFixed(2));
  const label = await page.locator('.in-fit').getAttribute('aria-label');
  for (const score of scores) expect(label).toContain(score);
  await expect(page.getByText('219 test lots, September 2026')).toBeVisible();
});

test('a failed status request shows an error, not scores', async ({ page }) => {
  await page.route('**/api/status', (route) => route.abort());
  await page.goto('/app/#/insights');
  await expect(page.getByText('Model scores are unavailable.')).toBeVisible();
  await expect(page.locator('.in-fit')).toHaveCount(0);
});

test('unconnected evidence says so instead of showing numbers', async ({ page }) => {
  await page.goto('/app/#/insights');
  await expect(page.getByText('Attribution is not connected yet.')).toBeVisible();
  await expect(page.getByText('Needs a stored test record.')).toBeVisible();
  await expect(page.getByText('No lot history connected yet')).toBeVisible();
});

test('Dismiss closes the low-confidence notice', async ({ page }) => {
  await page.goto('/app/#/insights');
  await expect(page.getByText('Crack model: low confidence')).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss' }).click();
  await expect(page.getByText('Crack model: low confidence')).toHaveCount(0);
});

test('Pause or resume toggles the animation from the keyboard', async ({ page }) => {
  await page.goto('/app/#/insights');
  const button = page.getByRole('button', { name: 'Pause or resume' });
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.in-scene')).toHaveClass(/in-paused/);
});

test('Open Planning goes to the Planning route', async ({ page }) => {
  await page.goto('/app/#/insights');
  await page.getByRole('link', { name: 'Open Planning' }).click();
  await expect(page.locator('.sidebar .nav-item[aria-current="page"]')).toHaveText('Planning');
});

test('no horizontal overflow at 1280x800 and 1024x768', async ({ page }) => {
  for (const [width, height] of [[1280, 800], [1024, 768]]) {
    await page.setViewportSize({ width, height });
    await page.goto('/app/#/insights');
    await expect(page.locator('.in-fit')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
