import { expect, test } from '@playwright/test';

const viewports = [[1440, 900], [1280, 800], [1024, 768]];

test('Home shows the sample-order start, reference run and labels', async ({ page }) => {
  await page.goto('/app/#/home');
  await expect(page.getByRole('heading', { name: 'Start with a sample order.' })).toBeVisible();
  await expect(page.locator('.sidebar .nav-item[aria-current="page"]')).toHaveText('Home');
  await expect(page.getByText('Synthetic demonstration').first()).toBeVisible();
  await expect(page.getByText('Model estimate, not measured')).toBeVisible();
  await expect(page.getByText('Sample, not approved')).toBeVisible();
  await expect(page.getByText('62.9 → 55.1')).toBeVisible();
});

test('the retired October figures and pass-level wording are absent', async ({ page }) => {
  await page.goto('/app/#/home');
  const text = await page.locator('main').innerText();
  for (const retired of ['100.4', '83.0', '86%', '35 s', 'pass level', 'Only Print passes', 'Below pass', 'Meets pass', 'confirmed']) {
    expect(text, retired).not.toContain(retired);
  }
});

test('Try a sample order opens New Lot', async ({ page }) => {
  await page.goto('/app/#/home');
  await page.getByRole('link', { name: /Try a sample order/ }).click();
  await expect(page.locator('.sidebar .nav-item[aria-current="page"]')).toHaveText('New Lot');
});

test('Open reference run and Open job card open Preparation Flow', async ({ page }) => {
  for (const name of ['Open reference run', /Open job card/]) {
    await page.goto('/app/#/home');
    await page.getByRole('link', { name }).click();
    await expect(page.locator('.sidebar .nav-item[aria-current="page"]')).toHaveText('Preparation Flow');
  }
});

test('Edit conditions opens New Lot', async ({ page }) => {
  await page.goto('/app/#/home');
  await page.getByRole('link', { name: 'Edit conditions' }).click();
  await expect(page.locator('.sidebar .nav-item[aria-current="page"]')).toHaveText('New Lot');
});

test('a failed status request shows an error and no model scores', async ({ page }) => {
  await page.route('**/api/status', route => route.fulfill({ status: 500, contentType: 'application/json', body: '{"ok":false}' }));
  await page.goto('/app/#/home');
  await expect(page.getByText('Model scores could not be loaded.')).toBeVisible();
  await expect(page.locator('.hm-model')).toHaveCount(0);
});

test('model scores come from the status route and missing values read Not recorded', async ({ page }) => {
  await page.route('**/api/status', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
    backendReachable: true,
    modelAcceptance: { models: [
      { defect: 'WARP', r2: 0.4682, sampleCount: 219 }, { defect: 'DELAM', r2: 0.5194, sampleCount: 219 },
      { defect: 'STRENGTH', r2: null, sampleCount: 219 }, { defect: 'PRINT', r2: 0.6404, sampleCount: 219 },
      { defect: 'CRACK', r2: 0.1081, sampleCount: 219 } ] },
  }) }));
  await page.goto('/app/#/home');
  const values = page.locator('.hm-model-value');
  await expect(values).toHaveText(['0.47', '0.52', 'Not recorded', '0.64', '0.11']);
  await expect(page.getByText('Fit score on 219 test lots.')).toBeVisible();
  await expect(page.getByText('Low confidence', { exact: true })).toBeVisible();
});

test('both themes keep the same text', async ({ page }) => {
  await page.route('**/api/status', route => route.fulfill({ status: 500, contentType: 'application/json', body: '{"ok":false}' }));
  await page.goto('/app/#/home');
  await page.evaluate(() => localStorage.setItem('momentum-theme', 'dark'));
  await page.reload();
  const read = () => page.locator('.hm-grid').innerText();
  await expect(page.getByText('Model scores could not be loaded.')).toBeVisible();
  const dark = await read();
  await page.getByRole('button', { name: 'Light theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await read()).toBe(dark);
});

for (const [width, height] of viewports) {
  test(`Home has no sideways scroll at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/app/#/home');
    await expect(page.getByRole('heading', { name: 'Start with a sample order.' })).toBeVisible();
    expect(await page.evaluate(() => document.scrollingElement.scrollWidth > window.innerWidth)).toBe(false);
  });
}
