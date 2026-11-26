import { expect, test } from '@playwright/test';

test('Planning is a roadmap labelled as not live', async ({ page }) => {
  await page.goto('/app/#/planning');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Planning');
  await expect(page.locator('.sidebar .nav-item[aria-current="page"]')).toHaveText('Planning');
  await expect(page.getByText('Future, not live')).toBeVisible();
  await expect(page.getByText('Not validated in the plant yet.')).toBeVisible();
  await expect(page.getByText('Example lot. Nothing here is from your plant.')).toBeVisible();
});

test('every capability in the explorer opens its own detail', async ({ page }) => {
  await page.goto('/app/#/planning');
  const rail = page.getByRole('group', { name: 'Capabilities' });
  const items = rail.getByRole('button');
  await expect(items).toHaveCount(8);
  await expect(items.first()).toHaveAttribute('aria-pressed', 'true');
  for (let index = 0; index < 8; index += 1) {
    const item = items.nth(index);
    const name = (await item.locator('b').innerText()).trim();
    await item.click();
    await expect(item).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.pl-detail h3')).toHaveText(name);
    await expect(page.locator('.pl-detail dt')).toHaveText(['Problem', 'How it works', 'Needs', 'Human step', 'Limit', 'Today']);
    await expect(rail.locator('[aria-pressed="true"]')).toHaveCount(1);
  }
});

test('the explorer works from the keyboard and sends no request', async ({ page }) => {
  const requests = [];
  page.on('request', (request) => { if (request.method() !== 'GET') requests.push(request.url()); });
  await page.goto('/app/#/planning');
  const second = page.getByRole('group', { name: 'Capabilities' }).getByRole('button').nth(1);
  await second.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.pl-detail h3')).toHaveText('Experiment Designer');
  expect(requests).toEqual([]);
});

test('retired pass counts and the single-lot option count are absent', async ({ page }) => {
  await page.goto('/app/#/planning');
  await expect(page.locator('.pl-explorer')).toBeVisible();
  const items = page.getByRole('group', { name: 'Capabilities' }).getByRole('button');
  for (let index = 0; index < 8; index += 1) await items.nth(index).click();
  const text = await page.locator('main, .main').first().innerText();
  for (const retired of ['Four of five', 'holdout bar', '8,640']) expect(text, retired).not.toContain(retired);
});

for (const [width, height] of [[1440, 900], [1280, 800], [1024, 768]]) {
  test(`Planning has no sideways scroll at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/app/#/planning');
    await expect(page.locator('.pl-week')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
